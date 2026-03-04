const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const db = require('../config/db');
const config = require('../config/env');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail } = require('../services/mailjetEmail');

const router = express.Router();

const BARANGAYS = [
  'Alacan','Ambalangan-Dalin','Angio','Anonang','Aramal','Bigbiga','Binday','Bolaoen','Bolasi','Cabaruan','Cayanga','Colisao','Gomot','Inmalog','Inmalog Norte','Lekep-Butao','Lipit-Tomeeng','Longos','Longos Proper','Longos-Amangonan-Parac-Parac (Fabrica)','Mabilao','Nibaliw Central','Nibaliw East','Nibaliw Magliba','Nibaliw Narvarte (Nibaliw West Compound)','Nibaliw Vidal (Nibaliw West Proper)','Palapad','Poblacion','Rabon','Sagud-Bahley','Sobol','Tempra-Guilig','Tiblong','Tocok'
];

const loginSchema = {
  body: Joi.object({
    username: Joi.string().min(3).required(),
    password: Joi.string().min(6).required()
  })
};

const forgotStartSchema = {
  body: Joi.object({
    identifier: Joi.string().min(3).max(255).required()
  })
};

const forgotVerifySchema = {
  body: Joi.object({
    identifier: Joi.string().min(3).max(255).required(),
    code: Joi.string().min(4).max(10).required()
  })
};

const forgotResetSchema = {
  body: Joi.object({
    identifier: Joi.string().min(3).max(255).required(),
    code: Joi.string().min(4).max(10).required(),
    newPassword: Joi.string().min(6).required()
  })
};

// In-memory store for password reset codes (per-process; sufficient for this system).
// Map key: user_id, value: { code, expiresAt, attempts }
const resetStore = new Map();

const registerSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    contactNumber: Joi.string().min(5).max(50).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Barangay Officer', 'User').required(),
    barangay: Joi.string().valid(...BARANGAYS).allow(null, '')
  })
};

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { fullName, username, email, contactNumber, password, role, barangay } = req.body;

    const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    const normalizedUsername = String(username).trim().toLowerCase();

    if (role === 'Admin' && (barangay && String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay must be empty for Admin.' } });
    }

    if (role !== 'Admin' && (!barangay || !String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay is required for non-Admin roles.' } });
    }

    const dupContact = await db.query('SELECT 1 FROM users WHERE contact_number = $1', [contactNumber]);
    if (dupContact.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Contact number already in use' } });
    }

    if (normalizedEmail) {
      const dupEmail = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
      if (dupEmail.rowCount > 0) {
        return res.status(400).json({ success: false, error: { message: 'Email already in use' } });
      }
    }

    // Uniqueness checks
    const dupUsername = await db.query('SELECT 1 FROM users WHERE lower(username) = $1', [normalizedUsername]);
    if (dupUsername.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Username already in use' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (full_name, username, email, contact_number, password_hash, role, barangay, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [
        fullName,
        normalizedUsername,
        normalizedEmail,
        contactNumber,
        passwordHash,
        role,
        role === 'Admin' ? null : barangay
      ]
    );

    return res.status(201).json({ success: true, data: { message: 'Account created' } });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ success: false, error: { message: 'Duplicate account details' } });
    }
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(
      `SELECT u.userid AS user_id,
              u.full_name,
              u.username,
              u.email,
              u.contact_number,
              u.password_hash,
              u.role,
              u.barangay,
              u.is_active
       FROM users u
       WHERE lower(u.username) = $1 AND u.is_active = true`,
      [String(username).toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    const accessToken = jwt.sign(
      {
        sub: user.user_id,
        role: user.role,
        barangay: user.barangay || null
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenTtl }
    );

    return res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.user_id,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          contactNumber: user.contact_number,
          role: user.role,
          barangay: user.barangay || null
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// Forgot password: start (identify account and send code)
router.post('/forgot/start', validate(forgotStartSchema), async (req, res, next) => {
  try {
    const { identifier } = req.body;
    const raw = String(identifier || '').trim();

    if (!raw) {
      return res.status(400).json({ success: false, error: { message: 'Identifier is required' } });
    }

    // Decide whether the user entered an email or a phone number.
    const looksLikeEmail = /@/.test(raw);
    const looksLikePhone = /^09\d{9}$/.test(raw);

    // Try match by email (case-insensitive) or contact number
    const result = await db.query(
      `SELECT userid AS user_id, email, contact_number
       FROM users
       WHERE (lower(email) = lower($1) AND email IS NOT NULL)
          OR contact_number = $2`,
      [raw, raw]
    );

    // For security, always respond with success even if not found.
    if (result.rowCount === 0) {
      return res.json({
        success: true,
        data: { message: 'If an account matches these details, a verification code has been sent.' }
      });
    }

    const user = result.rows[0];
    const userId = user.user_id;

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
    const ttlMinutes = 10;
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

    resetStore.set(userId, { code, expiresAt, attempts: 0 });

    const phone = user.contact_number ? String(user.contact_number).trim() : null;
    const email = user.email ? String(user.email).trim() : null;

    // Only send via the channel the user actually used.
    if (looksLikePhone && phone && /^09\d{9}$/.test(phone)) {
      await sendSMS(phone, `Your password reset code is: ${code}. It will expire in ${ttlMinutes} minutes.`);
    } else if (looksLikeEmail && email) {
      const subject = 'Password reset code';
      const body = `Your password reset code is: ${code}. It will expire in ${ttlMinutes} minutes.`;
      await sendEmail(email, subject, body);
    } else {
      // Fallback: if input format is unclear, prefer email when available, otherwise SMS.
      if (email) {
        const subject = 'Password reset code';
        const body = `Your password reset code is: ${code}. It will expire in ${ttlMinutes} minutes.`;
        await sendEmail(email, subject, body);
      } else if (phone && /^09\d{9}$/.test(phone)) {
        await sendSMS(phone, `Your password reset code is: ${code}. It will expire in ${ttlMinutes} minutes.`);
      }
    }

    return res.json({
      success: true,
      data: { message: 'If an account matches these details, a verification code has been sent.' }
    });
  } catch (err) {
    next(err);
  }
});

// Forgot password: verify code
router.post('/forgot/verify', validate(forgotVerifySchema), async (req, res, next) => {
  try {
    const { identifier, code } = req.body;
    const raw = String(identifier || '').trim();
    const trimmedCode = String(code || '').trim();

    const result = await db.query(
      `SELECT userid AS user_id
       FROM users
       WHERE (lower(email) = lower($1) AND email IS NOT NULL)
          OR contact_number = $2`,
      [raw, raw]
    );

    if (result.rowCount === 0) {
      // Generic error
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    const userId = result.rows[0].user_id;
    const entry = resetStore.get(userId);

    if (!entry) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    if (entry.expiresAt < Date.now()) {
      resetStore.delete(userId);
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    const attempts = entry.attempts || 0;
    if (attempts >= 5) {
      resetStore.delete(userId);
      return res.status(400).json({ success: false, error: { message: 'Too many attempts. Please request a new code.' } });
    }

    if (entry.code !== trimmedCode) {
      entry.attempts = attempts + 1;
      resetStore.set(userId, entry);
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    // Mark as verified by storing a special flag; keep code for reset step
    entry.verified = true;
    resetStore.set(userId, entry);

    return res.json({ success: true, data: { message: 'Code verified. You may now change your password.' } });
  } catch (err) {
    next(err);
  }
});

// Forgot password: reset password
router.post('/forgot/reset', validate(forgotResetSchema), async (req, res, next) => {
  try {
    const { identifier, code, newPassword } = req.body;
    const raw = String(identifier || '').trim();
    const trimmedCode = String(code || '').trim();

    const result = await db.query(
      `SELECT userid AS user_id
       FROM users
       WHERE (lower(email) = lower($1) AND email IS NOT NULL)
          OR contact_number = $2`,
      [raw, raw]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    const userId = result.rows[0].user_id;
    const entry = resetStore.get(userId);

    if (!entry || entry.expiresAt < Date.now() || entry.code !== trimmedCode) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired verification code.' } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query('UPDATE users SET password_hash = $1 WHERE userid = $2', [passwordHash, userId]);

    // Invalidate any existing code for this user
    resetStore.delete(userId);

    return res.json({ success: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.userid AS user_id,
              u.full_name,
              u.username,
              u.email,
              u.role,
              u.barangay,
              u.contact_number,
              u.is_active,
              u.created_at
       FROM users u
       WHERE u.userid = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.user_id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        barangay: user.barangay,
        contactNumber: user.contact_number,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
