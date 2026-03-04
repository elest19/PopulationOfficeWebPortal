const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapFaqRow(row) {
  return {
    id: row.id,
    topic: row.topic,
    question: row.question,
    answer: row.answer,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// List published FAQs (model without is_published assumes all rows are public)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "faqID" AS id, topic, question AS question, answer_text AS answer, created_at, updated_at FROM faqs ORDER BY "faqID" ASC'
    );
    res.json({ success: true, data: result.rows.map(mapFaqRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/topics', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT topic
       FROM faqs
       WHERE topic IS NOT NULL AND TRIM(topic) <> ''
       ORDER BY topic ASC`
    );
    res.json({ success: true, data: result.rows.map((r) => r.topic) });
  } catch (err) {
    next(err);
  }
});

const createOrUpdateSchema = {
  body: Joi.object({
    topic: Joi.string().max(255).allow('', null),
    question: Joi.string().required(),
    answer: Joi.string().required()
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { topic, question, answer } = req.body;
      const result = await db.query(
        `INSERT INTO faqs (topic, question, answer_text)
         VALUES ($1, $2, $3)
         RETURNING "faqID" AS id, topic, question AS question, answer_text AS answer, created_at, updated_at`,
        [topic || null, question, answer]
      );
      res.status(201).json({ success: true, data: mapFaqRow(result.rows[0]) });
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
      const { topic, question, answer } = req.body;
      const result = await db.query(
        `UPDATE faqs
         SET topic = $1,
             question = $2,
             answer_text = $3,
             updated_at = NOW()
         WHERE "faqID" = $4
         RETURNING "faqID" AS id, topic, question AS question, answer_text AS answer, created_at, updated_at`,
        [topic || null, question, answer, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'FAQ not found' } });
      }
      res.json({ success: true, data: mapFaqRow(result.rows[0]) });
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
      const result = await db.query('DELETE FROM faqs WHERE "faqID" = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'FAQ not found' } });
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
