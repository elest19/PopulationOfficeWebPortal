const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapHierarchyRow(row) {
  return {
    id: row.sfh_id,
    name: row.name,
    position: row.position
  };
}

const POSITIONS = ['Mayor', 'Vice Mayor', 'Population Office Head', 'Population Office Staff', 'Barangay Representative'];

const listSchema = {
  query: Joi.object({})
};

router.get('/', validate(listSchema), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT sfh_id, name, position FROM "SanFabianHierarchy" ORDER BY sfh_id ASC'
    );
    res.json({ success: true, data: result.rows.map(mapHierarchyRow) });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    position: Joi.string().valid(...POSITIONS).required()
  })
};

router.post('/', authenticate, authorize(['ADMIN']), validate(upsertSchema), async (req, res, next) => {
  try {
    const { name, position } = req.body;

    // Generate a new sfh_id manually since the column is NOT NULL without a default/sequence
    const maxResult = await db.query('SELECT COALESCE(MAX(sfh_id), 0) + 1 AS next_id FROM "SanFabianHierarchy"');
    const nextId = maxResult.rows[0]?.next_id || 1;

    const result = await db.query(
      'INSERT INTO "SanFabianHierarchy" (sfh_id, name, position) VALUES ($1, $2, $3) RETURNING sfh_id, name, position',
      [nextId, name, position]
    );
    res.status(201).json({ success: true, data: mapHierarchyRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize(['ADMIN']), validate(upsertSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;

    const result = await db.query(
      'UPDATE "SanFabianHierarchy" SET name = $1, position = $2 WHERE sfh_id = $3 RETURNING sfh_id, name, position',
      [name, position, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Hierarchy record not found' } });
    }

    res.json({ success: true, data: mapHierarchyRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM "SanFabianHierarchy" WHERE sfh_id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Hierarchy record not found' } });
    }

    res.json({ success: true, data: { id: Number(id) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
