const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const { getSupabaseClient } = require('../config/supabase');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function mapNewsRow(row) {
  return {
    id: row.newsID,
    title: row.title,
    slug: row.slug,
    shortDescription: row.content,
    content: row.content,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    isPublished: row.is_published,
    userId: row.created_by || null,
    authorUsername: row.author_username || null
  };
}

function parseSupabasePublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  // Matches: https://<proj>.supabase.co/storage/v1/object/public/{bucket}/{path}
  const m = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

function generateSlug(title) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now()
  );
}

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().allow('', null),
    from: Joi.date().iso().allow(null),
    to: Joi.date().iso().allow(null)
  })
};

// Admin listing: same filters, but allows viewing both published and archived
const adminListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().allow('', null),
    from: Joi.date().iso().allow(null),
    to: Joi.date().iso().allow(null),
    // When omitted, returns all; when true/false, filters by publication state
    isPublished: Joi.boolean().allow(null)
  })
};

router.get('/', validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit, search, from, to } = req.query;
    const offset = (page - 1) * limit;

    const values = [];
    const where = ['n.is_published = true'];

    if (search) {
      values.push(`%${search}%`);
      where.push(`(n.title ILIKE $${values.length} OR n.content ILIKE $${values.length})`);
    }
    if (from) {
      values.push(from);
      where.push(`n.published_at >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      where.push(`n.published_at <= $${values.length}`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM news n ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit);
    values.push(offset);

    const newsResult = await db.query(
      `SELECT n.*, u.username AS author_username
       FROM news n
       LEFT JOIN users u ON u.userid = n.created_by
       ${whereClause}
       ORDER BY n.published_at DESC NULLS LAST
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({
      success: true,
      data: newsResult.rows.map(mapNewsRow),
      meta: {
        total,
        page,
        limit
      }
    });
  } catch (err) {
    next(err);
  }
});

// Admin-only listing that can see both published and archived news
router.get('/admin', authenticate, authorize(['ADMIN', 'BARANGAY OFFICER']), validate(adminListSchema), async (req, res, next) => {
  try {
    const { page, limit, search, from, to, isPublished } = req.query;
    const offset = (page - 1) * limit;

    const values = [];
    const where = [];

    if (typeof isPublished === 'boolean') {
      values.push(isPublished);
      where.push(`n.is_published = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      where.push(`(n.title ILIKE $${values.length} OR n.content ILIKE $${values.length})`);
    }
    if (from) {
      values.push(from);
      where.push(`n.published_at >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      where.push(`n.published_at <= $${values.length}`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM news n ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit);
    values.push(offset);

    const newsResult = await db.query(
      `SELECT n.*, u.username AS author_username
       FROM news n
       LEFT JOIN users u ON u.userid = n.created_by
       ${whereClause}
       ORDER BY n.published_at DESC NULLS LAST
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({
      success: true,
      data: newsResult.rows.map(mapNewsRow),
      meta: {
        total,
        page,
        limit
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/latest', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT n.*, u.username AS author_username
       FROM news n
       LEFT JOIN users u ON u.userid = n.created_by
       WHERE n.is_published = true
       ORDER BY n.published_at DESC NULLS LAST
       LIMIT 5`
    );
    res.json({ success: true, data: result.rows.map(mapNewsRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT n.*, u.username AS author_username
       FROM news n
       LEFT JOIN users u ON u.userid = n.created_by
       WHERE n."newsID" = $1 AND n.is_published = true`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'News not found' } });
    }

    res.json({ success: true, data: mapNewsRow(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

const createOrUpdateSchema = {
  body: Joi.object({
    title: Joi.string().max(255).required(),
    shortDescription: Joi.string().allow('', null),
    content: Joi.string().required(),
    imageUrl: Joi.string().uri().allow('', null),
    isPublished: Joi.boolean().default(true),
    publishedAt: Joi.date().iso().allow(null)
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { title, shortDescription, content, imageUrl, isPublished, publishedAt } = req.body;
      const slug = generateSlug(title);

      const result = await db.query(
        `INSERT INTO news (title, slug, content, image_url, is_published, published_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          title,
          slug,
          shortDescription || content,
          imageUrl || null,
          isPublished,
          publishedAt || new Date(),
          req.user.id
        ]
      );

      const io = req.app.get('io'); if (io) io.emit('news:updated');
      res.status(201).json({ success: true, data: mapNewsRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { title, shortDescription, content, imageUrl, isPublished, publishedAt } = req.body;

      const existing = await db.query('SELECT * FROM news WHERE "newsID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'News not found' } });
      }

      // RBAC: Barangay Officers may only edit their own news
      const row = existing.rows[0];
      const ownerId = row.created_by || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to edit this news item.' } });
        }
      }

      const slug = existing.rows[0].slug || generateSlug(title);

      const result = await db.query(
        `UPDATE news
         SET title = $1,
             slug = $2,
             content = $3,
             image_url = $4,
             is_published = $5,
             published_at = $6,
             updated_at = NOW()
         WHERE "newsID" = $7
         RETURNING *`,
        [
          title,
          slug,
          shortDescription || content,
          imageUrl || null,
          isPublished,
          publishedAt || existing.rows[0].published_at,
          id
        ]
      );

      // If image changed, delete the old file from storage
      try {
        const oldUrl = existing.rows[0].image_url;
        if (oldUrl && imageUrl && String(oldUrl) !== String(imageUrl)) {
          const parsed = parseSupabasePublicUrl(oldUrl);
          if (parsed?.bucket && parsed?.path) {
            const supabase = getSupabaseClient();
            await supabase.storage.from(parsed.bucket).remove([parsed.path]);
          }
        }
      } catch (e) {
        // Log but do not fail the request
        console.error('Failed to remove old news image:', e?.message || e);
      }

      const io = req.app.get('io'); if (io) io.emit('news:updated');
      res.json({ success: true, data: mapNewsRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Soft-archive a news item (set is_published = false)
router.put(
  '/:id/archive',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM news WHERE "newsID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'News not found' } });
      }

      // RBAC: Barangay Officers may only archive their own news
      const row = existing.rows[0];
      const ownerId = row.created_by || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to archive this news item.' } });
        }
      }

      const result = await db.query(
        `UPDATE news
         SET is_published = FALSE,
             updated_at = NOW()
         WHERE "newsID" = $1
         RETURNING *`,
        [id]
      );

      const io = req.app.get('io'); if (io) io.emit('news:updated');
      res.json({ success: true, data: mapNewsRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Unarchive a news item (set is_published = true)
router.put(
  '/:id/unarchive',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM news WHERE "newsID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'News not found' } });
      }

      // RBAC: Barangay Officers may only unarchive their own news
      const row = existing.rows[0];
      const ownerId = row.created_by || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to unarchive this news item.' } });
        }
      }

      const result = await db.query(
        `UPDATE news
         SET is_published = TRUE,
             updated_at = NOW()
         WHERE "newsID" = $1
         RETURNING *`,
        [id]
      );

      const io = req.app.get('io'); if (io) io.emit('news:updated');
      res.json({ success: true, data: mapNewsRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // Fetch existing to check ownership and delete image afterwards
      const existing = await db.query('SELECT image_url, created_by FROM news WHERE "newsID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'News not found' } });
      }

      // RBAC: Barangay Officers may only delete their own news
      const row = existing.rows[0];
      const ownerId = row.created_by || row.userID || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to delete this news item.' } });
        }
      }

      const result = await db.query('DELETE FROM news WHERE "newsID" = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'News not found' } });
      }
      // Attempt to delete the associated image
      try {
        const oldUrl = existing?.rows?.[0]?.image_url;
        const parsed = parseSupabasePublicUrl(oldUrl);
        if (parsed?.bucket && parsed?.path) {
          const supabase = getSupabaseClient();
          await supabase.storage.from(parsed.bucket).remove([parsed.path]);
        }
      } catch (e) {
        console.error('Failed to remove news image on delete:', e?.message || e);
      }
      const io = req.app.get('io'); if (io) io.emit('news:updated');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
