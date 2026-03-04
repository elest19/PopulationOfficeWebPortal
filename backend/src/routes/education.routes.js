const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapMaterialRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    category: row.category,
    isPublished: row.is_published
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM education_materials WHERE is_published = true ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows.map(mapMaterialRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await db.query(
      'SELECT * FROM education_materials WHERE slug = $1 AND is_published = true',
      [slug]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Material not found' } });
    }
    res.json({ success: true, data: mapMaterialRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

const createOrUpdateSchema = {
  body: Joi.object({
    title: Joi.string().max(255).required(),
    slug: Joi.string().max(255).required(),
    content: Joi.string().required(),
    category: Joi.string().allow('', null),
    isPublished: Joi.boolean().default(true)
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { title, slug, content, category, isPublished } = req.body;
      const result = await db.query(
        `INSERT INTO education_materials (title, slug, content, category, is_published, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [title, slug, content, category || null, isPublished, req.user.id]
      );
      res.status(201).json({ success: true, data: mapMaterialRow(result.rows[0]) });
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
      const { title, slug, content, category, isPublished } = req.body;
      const result = await db.query(
        `UPDATE education_materials
         SET title = $1,
             slug = $2,
             content = $3,
             category = $4,
             is_published = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [title, slug, content, category || null, isPublished, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Material not found' } });
      }
      res.json({ success: true, data: mapMaterialRow(result.rows[0]) });
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
      const result = await db.query('DELETE FROM education_materials WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Material not found' } });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
