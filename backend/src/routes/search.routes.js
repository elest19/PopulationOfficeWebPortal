const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');

const router = express.Router();

const searchSchema = {
  query: Joi.object({
    q: Joi.string().trim().min(1).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  })
};

router.get('/', validate(searchSchema), async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;
    const offset = (page - 1) * limit;

    const pattern = `%${q}%`;

    const countResult = await db.query(
      `SELECT (
          (SELECT COUNT(*)::int
           FROM news
           WHERE is_published = true
             AND (title ILIKE $1 OR content ILIKE $1)
          )
          +
          (SELECT COUNT(*)::int
           FROM announcements
           WHERE title ILIKE $1 OR description ILIKE $1 OR COALESCE(lead, '') ILIKE $1 OR COALESCE(location, '') ILIKE $1
          )
        ) AS total`,
      [pattern]
    );

    const total = Number(countResult.rows?.[0]?.total || 0);

    const rowsResult = await db.query(
      `WITH results AS (
        SELECT
          'News'::text AS type,
          "newsID"::int AS id,
          title::text AS title,
          COALESCE(content, short_description, '')::text AS snippet,
          image_url::text AS "imageUrl",
          published_at::timestamptz AS "sortDate",
          ('/news/' || "newsID"::text)::text AS href
        FROM news
        WHERE is_published = true
          AND (title ILIKE $1 OR content ILIKE $1)

        UNION ALL

        SELECT
          'Announcement'::text AS type,
          "announcementID"::int AS id,
          title::text AS title,
          COALESCE(description, '')::text AS snippet,
          NULL::text AS "imageUrl",
          date::timestamptz AS "sortDate",
          '/calendar'::text AS href
        FROM announcements
        WHERE title ILIKE $1 OR description ILIKE $1 OR COALESCE(lead, '') ILIKE $1 OR COALESCE(location, '') ILIKE $1
      )
      SELECT *
      FROM results
      ORDER BY "sortDate" DESC NULLS LAST
      LIMIT $2 OFFSET $3`,
      [pattern, limit, offset]
    );

    res.json({
      success: true,
      data: rowsResult.rows || [],
      meta: { total, page, limit }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
