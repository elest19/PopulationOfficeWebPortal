const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapServiceRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM services WHERE is_active = true ORDER BY id ASC');
    res.json({ success: true, data: result.rows.map(mapServiceRow) });
  } catch (err) {
    next(err);
  }
});

const createOrUpdateSchema = {
  body: Joi.object({
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255).required(),
    description: Joi.string().required(),
    isActive: Joi.boolean().default(true)
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { name, slug, description, isActive } = req.body;
      const result = await db.query(
        `INSERT INTO services (name, slug, description, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, slug, description, isActive]
      );
      res.status(201).json({ success: true, data: mapServiceRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, slug, description, isActive } = req.body;
      const result = await db.query(
        `UPDATE services
         SET name = $1,
             slug = $2,
             description = $3,
             is_active = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [name, slug, description, isActive, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Service not found' } });
      }
      res.json({ success: true, data: mapServiceRow(result.rows[0]) });
    } catch (err) {
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
      const result = await db.query('DELETE FROM services WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Service not found' } });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
