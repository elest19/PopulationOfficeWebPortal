const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "counselorID", counselor_name, email, contact_number, "isActive" FROM "Counselors" ORDER BY counselor_name ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/active', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "counselorID", counselor_name FROM "Counselors" WHERE "isActive" = true ORDER BY counselor_name ASC'
    );
    res.json({
      success: true,
      data: result.rows.map((r) => ({ id: r.counselorID, name: r.counselor_name }))
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = {
  body: Joi.object({
    counselor_name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    contact_number: Joi.string().min(5).max(50).required(),
    isActive: Joi.boolean().default(true)
  })
};

const updateSchema = {
  body: Joi.object({
    counselor_name: Joi.string().min(2).max(255).optional(),
    email: Joi.string().email().optional(),
    contact_number: Joi.string().min(5).max(50).optional(),
    isActive: Joi.boolean().optional()
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const { counselor_name, email, contact_number, isActive } = req.body;
      const result = await db.query(
        `INSERT INTO "Counselors" (counselor_name, email, contact_number, "isActive")
         VALUES ($1,$2,$3,$4)
         RETURNING "counselorID", counselor_name, email, contact_number, "isActive"`,
        [counselor_name, email, contact_number, isActive]
      );
      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err && err.code === '23505') {
        return res.status(400).json({ success: false, error: { message: 'Email already exists for a counselor.' } });
      }
      next(err);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { counselor_name, email, contact_number, isActive } = req.body || {};

      const existing = await db.query('SELECT 1 FROM "Counselors" WHERE "counselorID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Counselor not found' } });
      }

      const result = await db.query(
        `UPDATE "Counselors"
         SET
           counselor_name = COALESCE($1, counselor_name),
           email = COALESCE($2, email),
           contact_number = COALESCE($3, contact_number),
           "isActive" = COALESCE($4, "isActive")
         WHERE "counselorID" = $5
         RETURNING "counselorID", counselor_name, email, contact_number, "isActive"`,
        [counselor_name ?? null, email ?? null, contact_number ?? null, typeof isActive === 'boolean' ? isActive : null, id]
      );

      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err && err.code === '23505') {
        return res.status(400).json({ success: false, error: { message: 'Email already exists for a counselor.' } });
      }
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM "Counselors" WHERE "counselorID" = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Counselor not found' } });
      }
      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
