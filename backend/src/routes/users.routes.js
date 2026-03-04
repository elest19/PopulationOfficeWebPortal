const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapUserRow(row) {
  return {
    id: row.userid,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    contactNumber: row.contact_number,
    role: row.role,
    barangay: row.barangay,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    role: Joi.string().valid('Admin', 'Barangay Officer').allow(null, '')
  })
};

router.get('/', authenticate, authorize(['ADMIN']), validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit, role } = req.query;
    const offset = (page - 1) * limit;

    const values = [];
    const where = [];
    if (role) {
      values.push(role);
      where.push(`role = $${values.length}`);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM users ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit);
    values.push(offset);

    const result = await db.query(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({ success: true, data: result.rows.map(mapUserRow), meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// Self-service profile update for the currently logged-in user
const selfUpdateSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    contactNumber: Joi.string().min(5).max(50).required(),
    barangay: Joi.string().allow(null, ''),
    password: Joi.string().min(6).allow(null, '')
  })
};

// PUT /users/me - update own profile (no role changes)
router.put('/me', authenticate, validate(selfUpdateSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, username, email, contactNumber, barangay, password } = req.body;

    const existingRes = await db.query('SELECT * FROM users WHERE userid = $1', [userId]);
    if (existingRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const existing = existingRes.rows[0];
    const role = existing.role; // role cannot be changed via self-service

    const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    const normalizedUsername = String(username).trim().toLowerCase();

    if (role === 'Admin' && (barangay && String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay must be empty for Admin.' } });
    }

    if (role !== 'Admin' && (!barangay || !String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay is required for non-Admin roles.' } });
    }

    const dupContact = await db.query('SELECT 1 FROM users WHERE contact_number = $1 AND userid <> $2', [
      contactNumber,
      userId
    ]);
    if (dupContact.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Contact number already in use' } });
    }

    const dupUsername = await db.query('SELECT 1 FROM users WHERE lower(username) = $1 AND userid <> $2', [
      normalizedUsername,
      userId
    ]);
    if (dupUsername.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Username already in use' } });
    }

    if (normalizedEmail) {
      const dupEmail = await db.query('SELECT 1 FROM users WHERE lower(email) = $1 AND userid <> $2', [
        normalizedEmail,
        userId
      ]);
      if (dupEmail.rowCount > 0) {
        return res.status(400).json({ success: false, error: { message: 'Email already in use' } });
      }
    }

    let passwordHash = existing.password_hash;
    if (password && String(password).trim()) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `UPDATE users
       SET full_name = $1,
           username = $2,
           email = $3,
           contact_number = $4,
           password_hash = $5,
           barangay = $6,
           updated_at = NOW()
       WHERE userid = $7
       RETURNING *`,
      [
        fullName,
        normalizedUsername,
        normalizedEmail,
        contactNumber,
        passwordHash,
        role === 'Admin' ? null : barangay,
        userId
      ]
    );

    res.json({ success: true, data: mapUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/me - deactivate own account
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE userid = $1 RETURNING *',
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    res.json({ success: true, data: mapUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const accountsPerBarangay = await db.query(
      `SELECT COALESCE(barangay,'Unknown') AS barangay, COUNT(*)::int AS count
       FROM users
       WHERE role <> 'Admin'
       GROUP BY 1
       ORDER BY count DESC`
    );

    const usersMonthly = await db.query(
      `SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS count
       FROM users
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`
    );

    const totalUsers = await db.query(`SELECT COUNT(*)::int AS count FROM users`);

    res.json({
      success: true,
      data: {
        accountsPerBarangay: accountsPerBarangay.rows,
        usersMonthly: usersMonthly.rows,
        totalUsers: totalUsers.rows[0]?.count || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    contactNumber: Joi.string().min(5).max(50).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Barangay Officer', 'User').required(),
    barangay: Joi.string().allow(null, '')
  })
};

router.post('/', authenticate, authorize(['ADMIN']), validate(createSchema), async (req, res, next) => {
  try {
    const { fullName, username, email, contactNumber, password, role, barangay } = req.body;

    const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    const normalizedUsername = String(username).trim().toLowerCase();

    if (role === 'Admin' && (barangay && String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay must be empty for Admin.' } });
    }

    if (role === 'Barangay Officer' && (!barangay || !String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay is required for Barangay Officer.' } });
    }

    const dupContact = await db.query('SELECT 1 FROM users WHERE contact_number = $1', [contactNumber]);
    if (dupContact.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Contact number already in use' } });
    }

    const dupUsername = await db.query('SELECT 1 FROM users WHERE lower(username) = $1', [normalizedUsername]);
    if (dupUsername.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Username already in use' } });
    }

    if (normalizedEmail) {
      const dupEmail = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
      if (dupEmail.rowCount > 0) {
        return res.status(400).json({ success: false, error: { message: 'Email already in use' } });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (full_name, username, email, contact_number, password_hash, role, barangay, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING *`,
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

    const io = req.app.get('io'); if (io) io.emit('accounts:updated');
    res.status(201).json({ success: true, data: mapUserRow(result.rows[0]) });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(400).json({ success: false, error: { message: 'Duplicate account details' } });
    }
    next(err);
  }
});

const updateSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().allow(null, ''),
    contactNumber: Joi.string().min(5).max(50).required(),
    role: Joi.string().valid('Admin', 'Barangay Officer', 'User').required(),
    barangay: Joi.string().allow(null, ''),
    password: Joi.string().min(6).allow(null, '')
  })
};

router.put('/:id', authenticate, authorize(['ADMIN']), validate(updateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, username, email, contactNumber, role, barangay, password } = req.body;

    const normalizedEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
    const normalizedUsername = String(username).trim().toLowerCase();

    if (role === 'Admin' && (barangay && String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay must be empty for Admin.' } });
    }

    if (role === 'Barangay Officer' && (!barangay || !String(barangay).trim())) {
      return res.status(400).json({ success: false, error: { message: 'Barangay is required for Barangay Officer.' } });
    }

    const existing = await db.query('SELECT * FROM users WHERE userid = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const dupContact = await db.query('SELECT 1 FROM users WHERE contact_number = $1 AND userid <> $2', [
      contactNumber,
      id
    ]);
    if (dupContact.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Contact number already in use' } });
    }

    const dupUsername = await db.query('SELECT 1 FROM users WHERE lower(username) = $1 AND userid <> $2', [
      normalizedUsername,
      id
    ]);
    if (dupUsername.rowCount > 0) {
      return res.status(400).json({ success: false, error: { message: 'Username already in use' } });
    }

    if (normalizedEmail) {
      const dupEmail = await db.query('SELECT 1 FROM users WHERE lower(email) = $1 AND userid <> $2', [
        normalizedEmail,
        id
      ]);
      if (dupEmail.rowCount > 0) {
        return res.status(400).json({ success: false, error: { message: 'Email already in use' } });
      }
    }

    let passwordHash = existing.rows[0].password_hash;
    if (password && String(password).trim()) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `UPDATE users
       SET full_name = $1,
           username = $2,
           email = $3,
           contact_number = $4,
           password_hash = $5,
           role = $6,
           barangay = $7,
           updated_at = NOW()
       WHERE userid = $8
       RETURNING *`,
      [
        fullName,
        normalizedUsername,
        normalizedEmail,
        contactNumber,
        passwordHash,
        role,
        role === 'Admin' ? null : barangay,
        id
      ]
    );

    const io = req.app.get('io'); if (io) io.emit('accounts:updated');
    res.json({ success: true, data: mapUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

const setActiveSchema = {
  body: Joi.object({
    isActive: Joi.boolean().required()
  })
};

router.patch('/:id/active', authenticate, authorize(['ADMIN']), validate(setActiveSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const result = await db.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE userid = $2 RETURNING *`,
      [isActive, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const io = req.app.get('io'); if (io) io.emit('accounts:updated');
    res.json({ success: true, data: mapUserRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
