const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

const { getSupabaseClient } = require('../config/supabase'); // adjust path if needed

const BOOKLET_BUCKET = 'education_corner_booklet';

function getStorageObjectPathFromPublicUrl(publicUrl, bucketName) {
  if (!publicUrl) return null;

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;

  return publicUrl.substring(idx + marker.length);
}

async function safeRemoveFromBucket(bucketName, publicUrl) {
  const path = getStorageObjectPathFromPublicUrl(publicUrl, bucketName);
  if (!path) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(bucketName).remove([path]);
    if (error) console.error('Supabase remove error:', error);
  } catch (e) {
    console.error('Supabase remove exception:', e?.message || e);
  }
}

function mapWebRow(row) {
  return {
    id: row.id,
    title: row.title,
    imageThumbnailUrl: row.image_thumbnail_url,
    label: row.label,
    purpose: row.purpose,
    overview: row.overview,
    mainExplanation: row.main_explanation,
    visualImageUrl: row.visual_image_url,
    benefits: row.benefits,
    limitationsOrNotes: row.limitations_or_notes,
    youtubeVideoUrl: row.youtube_video_url,
    isPublished: row.is_published,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWebConceptRow(row) {
  return {
    id: row.id,
    webId: row.web_id,
    conceptTitle: row.concept_title,
    conceptDescription: row.concept_description,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBookletRow(row) {
  return {
    id: row.id,
    title: row.title,
    imageThumbnailUrl: row.image_thumbnail_url,
    brochureContentNumber: row.brochure_content_number,
    isPublished: row.is_published,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBookletPageRow(row) {
  return {
    id: row.id,
    bookletId: row.booklet_id,
    pageNumber: row.page_number,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------

const webUpsertSchema = {
  body: Joi.object({
    title: Joi.string().max(255).required(),
    imageThumbnailUrl: Joi.string().uri().max(2048).allow(null, '').optional(),
    label: Joi.string().allow(null, '').optional(),
    purpose: Joi.string().allow(null, '').optional(),
    overview: Joi.string().allow(null, '').optional(),
    mainExplanation: Joi.string().allow(null, '').optional(),
    visualImageUrl: Joi.string().uri().max(2048).allow(null, '').optional(),
    benefits: Joi.string().allow(null, '').optional(),
    limitationsOrNotes: Joi.string().allow(null, '').optional(),
    youtubeVideoUrl: Joi.string().max(2048).allow(null, '').optional(),
    isPublished: Joi.boolean().optional(),
    displayOrder: Joi.number().integer().allow(null).optional()
  })
};

const webConceptsSchema = {
  body: Joi.object({
    concepts: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().allow(null).optional(),
          conceptTitle: Joi.string().max(255).required(),
          conceptDescription: Joi.string().allow('', null).optional(),
          displayOrder: Joi.number().integer().min(1).optional()
        })
      )
      .default([])
  })
};

const bookletUpsertSchema = {
  body: Joi.object({
    title: Joi.string().max(255).required(),
    imageThumbnailUrl: Joi.string().uri().max(2048).allow(null, '').optional(),
    brochureContentNumber: Joi.number().integer().min(1).required(),
    isPublished: Joi.boolean().optional(),
    displayOrder: Joi.number().integer().allow(null).optional()
  })
};

const pageUpsertSchema = {
  body: Joi.object({
    pageNumber: Joi.number().integer().min(1).required(),
    imageUrl: Joi.string().uri().max(2048).required()
  })
};

// ---------------------------------------------------------------------
// WEB CONTENT ROUTES
// ---------------------------------------------------------------------

// List all (admin view can see all; public endpoint should filter is_published=true)
router.get('/web', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM education_corner_web ORDER BY display_order NULLS LAST, created_at DESC'
    );
    res.json({ success: true, data: result.rows.map(mapWebRow) });
  } catch (err) {
    next(err);
  }
});

// Create web content
router.post(
  '/web',
  authenticate,
  authorize(['ADMIN']),
  validate(webUpsertSchema),
  async (req, res, next) => {
    try {
      const {
        title,
        imageThumbnailUrl,
        label,
        purpose,
        overview,
        mainExplanation,
        visualImageUrl,
        benefits,
        limitationsOrNotes,
        youtubeVideoUrl,
        isPublished,
        displayOrder
      } = req.body;

      const result = await db.query(
        `INSERT INTO education_corner_web (
           id, title, image_thumbnail_url, label, purpose, overview,
           main_explanation, visual_image_url, benefits, limitations_or_notes,
           youtube_video_url, is_published, display_order
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, FALSE), $12)
         RETURNING *`,
        [
          title,
          imageThumbnailUrl || null,
          label || null,
          purpose || null,
          overview || null,
          mainExplanation || null,
          visualImageUrl || null,
          benefits || null,
          limitationsOrNotes || null,
          youtubeVideoUrl || null,
          isPublished,
          displayOrder || null
        ]
      );

      res.status(201).json({ success: true, data: mapWebRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Update web content
router.put(
  '/web/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(webUpsertSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        title,
        imageThumbnailUrl,
        label,
        purpose,
        overview,
        mainExplanation,
        visualImageUrl,
        benefits,
        limitationsOrNotes,
        youtubeVideoUrl,
        isPublished,
        displayOrder
      } = req.body;

      const result = await db.query(
        `UPDATE education_corner_web
         SET title = $1,
             image_thumbnail_url = $2,
             label = $3,
             purpose = $4,
             overview = $5,
             main_explanation = $6,
             visual_image_url = $7,
             benefits = $8,
             limitations_or_notes = $9,
             youtube_video_url = $10,
             is_published = COALESCE($11, is_published),
             display_order = $12,
             updated_at = NOW()
         WHERE id = $13
         RETURNING *`,
        [
          title,
          imageThumbnailUrl || null,
          label || null,
          purpose || null,
          overview || null,
          mainExplanation || null,
          visualImageUrl || null,
          benefits || null,
          limitationsOrNotes || null,
          youtubeVideoUrl || null,
          typeof isPublished === 'boolean' ? isPublished : null,
          displayOrder || null,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Web content not found' } });
      }

      res.json({ success: true, data: mapWebRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Unarchive web content (set published = true)
router.put(
  '/web/:id/unarchive',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE education_corner_web SET is_published = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Web content not found' } });
      }
      res.json({ success: true, data: mapWebRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Archive web content (soft-delete)
router.put(
  '/web/:id/archive',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE education_corner_web SET is_published = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Web content not found' } });
      }
      res.json({ success: true, data: mapWebRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Get key concepts for a web content
router.get(
  '/web/:id/key-concepts',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM education_corner_web_key_concepts WHERE web_id = $1 ORDER BY display_order ASC, created_at ASC',
        [id]
      );
      res.json({ success: true, data: result.rows.map(mapWebConceptRow) });
    } catch (err) {
      next(err);
    }
  }
);

// Replace key concepts set for a web content
router.put(
  '/web/:id/key-concepts',
  authenticate,
  authorize(['ADMIN']),
  validate(webConceptsSchema),
  async (req, res, next) => {
    const client = db.pool; // use pool for transaction
    const { id } = req.params;
    const { concepts } = req.body;

    const clientConn = await client.connect();
    try {
      await clientConn.query('BEGIN');

      await clientConn.query('DELETE FROM education_corner_web_key_concepts WHERE web_id = $1', [id]);

      for (let i = 0; i < concepts.length; i += 1) {
        const c = concepts[i];
        await clientConn.query(
          `INSERT INTO education_corner_web_key_concepts (
             id, web_id, concept_title, concept_description, display_order
           ) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)`,
          [c.id || null, id, c.conceptTitle, c.conceptDescription || null, c.displayOrder || i + 1]
        );
      }

      await clientConn.query('COMMIT');

      const result = await db.query(
        'SELECT * FROM education_corner_web_key_concepts WHERE web_id = $1 ORDER BY display_order ASC, created_at ASC',
        [id]
      );

      res.json({ success: true, data: result.rows.map(mapWebConceptRow) });
    } catch (err) {
      await clientConn.query('ROLLBACK');
      next(err);
    } finally {
      clientConn.release();
    }
  }
);

// ---------------------------------------------------------------------
// BOOKLETS / BROCHURES ROUTES
// ---------------------------------------------------------------------

// List booklets
router.get('/booklets', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM education_corner_booklets ORDER BY display_order NULLS LAST, created_at DESC'
    );
    res.json({ success: true, data: result.rows.map(mapBookletRow) });
  } catch (err) {
    next(err);
  }
});

// Create booklet
router.post(
  '/booklets',
  authenticate,
  authorize(['ADMIN']),
  validate(bookletUpsertSchema),
  async (req, res, next) => {
    try {
      const { title, imageThumbnailUrl, brochureContentNumber, isPublished, displayOrder } = req.body;

      const result = await db.query(
        `INSERT INTO education_corner_booklets (
           id, title, image_thumbnail_url, brochure_content_number, is_published, display_order
         ) VALUES (gen_random_uuid(), $1, $2, $3, COALESCE($4, FALSE), $5)
         RETURNING *`,
        [
          title,
          imageThumbnailUrl || null,
          brochureContentNumber,
          isPublished,
          displayOrder || null
        ]
      );

      res.status(201).json({ success: true, data: mapBookletRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Update booklet
router.put(
  '/booklets/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(bookletUpsertSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { title, imageThumbnailUrl, brochureContentNumber, isPublished, displayOrder } = req.body;

      const result = await db.query(
        `UPDATE education_corner_booklets
         SET title = $1,
             image_thumbnail_url = $2,
             brochure_content_number = $3,
             is_published = COALESCE($4, is_published),
             display_order = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          title,
          imageThumbnailUrl || null,
          brochureContentNumber,
          typeof isPublished === 'boolean' ? isPublished : null,
          displayOrder || null,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Booklet not found' } });
      }

      res.json({ success: true, data: mapBookletRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Archive booklet
router.put(
  '/booklets/:id/archive',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE education_corner_booklets SET is_published = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Booklet not found' } });
      }
      res.json({ success: true, data: mapBookletRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// List pages for a booklet (public)
router.get('/booklets/:id/pages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM education_corner_booklet_pages WHERE booklet_id = $1 ORDER BY page_number ASC',
      [id]
    );
    res.json({ success: true, data: result.rows.map(mapBookletPageRow) });
  } catch (err) {
    next(err);
  }
});

// Create page  ✅ FIXED (transaction + deferred constraints + keep count in sync)
router.post(
  '/booklets/:id/pages',
  authenticate,
  authorize(['ADMIN']),
  validate(pageUpsertSchema),
  async (req, res, next) => {
    const clientConn = await db.pool.connect(); // IMPORTANT: use a single connection
    try {
      const { id } = req.params;
      const { pageNumber, imageUrl } = req.body;

      await clientConn.query('BEGIN');
      await clientConn.query('SET CONSTRAINTS ALL DEFERRED');

      // 1) insert page
      const result = await clientConn.query(
        `INSERT INTO education_corner_booklet_pages (
           id, booklet_id, page_number, image_url
         ) VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING *`,
        [id, pageNumber, imageUrl]
      );

      // 2) sync brochure_content_number to actual count (so trigger will be satisfied)
      await clientConn.query(
        `UPDATE education_corner_booklets
         SET brochure_content_number = (
           SELECT COUNT(*) FROM education_corner_booklet_pages WHERE booklet_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      await clientConn.query('COMMIT');

      res.status(201).json({ success: true, data: mapBookletPageRow(result.rows[0]) });
    } catch (err) {
      try { await clientConn.query('ROLLBACK'); } catch {}
      next(err);
    } finally {
      clientConn.release();
    }
  }
);  

router.put(
  '/booklet-pages/:pageId',
  authenticate,
  authorize(['ADMIN']),
  validate(pageUpsertSchema),
  async (req, res, next) => {
    const clientConn = await db.pool.connect();
    try {
      const { pageId } = req.params;
      const { pageNumber, imageUrl } = req.body;

      await clientConn.query('BEGIN');
      await clientConn.query('SET CONSTRAINTS ALL DEFERRED');

      // Get old image_url + booklet_id
      const found = await clientConn.query(
        'SELECT booklet_id, image_url FROM education_corner_booklet_pages WHERE id = $1',
        [pageId]
      );

      if (found.rowCount === 0) {
        await clientConn.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Booklet page not found' } });
      }

      const bookletId = found.rows[0].booklet_id;
      const oldImageUrl = found.rows[0].image_url;

      // Update row
      const result = await clientConn.query(
        `UPDATE education_corner_booklet_pages
         SET page_number = $1,
             image_url = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [pageNumber, imageUrl, pageId]
      );

      // Sync count
      await clientConn.query(
        `UPDATE education_corner_booklets
         SET brochure_content_number = (
           SELECT COUNT(*) FROM education_corner_booklet_pages WHERE booklet_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [bookletId]
      );

      await clientConn.query('COMMIT');

      // ✅ If image changed, delete the old one
      if (oldImageUrl && imageUrl && oldImageUrl !== imageUrl) {
        await safeRemoveFromBucket(BOOKLET_BUCKET, oldImageUrl);
      }

      res.json({ success: true, data: mapBookletPageRow(result.rows[0]) });
    } catch (err) {
      try { await clientConn.query('ROLLBACK'); } catch {}
      next(err);
    } finally {
      clientConn.release();
    }
  }
);

router.delete(
  '/booklet-pages/:pageId',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    const clientConn = await db.pool.connect();
    try {
      const { pageId } = req.params;

      await clientConn.query('BEGIN');
      await clientConn.query('SET CONSTRAINTS ALL DEFERRED');

      // Get current image_url + booklet_id
      const found = await clientConn.query(
        'SELECT booklet_id, image_url FROM education_corner_booklet_pages WHERE id = $1',
        [pageId]
      );

      if (found.rowCount === 0) {
        await clientConn.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Booklet page not found' } });
      }

      const bookletId = found.rows[0].booklet_id;
      const oldImageUrl = found.rows[0].image_url;

      // Delete row
      await clientConn.query('DELETE FROM education_corner_booklet_pages WHERE id = $1', [pageId]);

      // Sync count
      await clientConn.query(
        `UPDATE education_corner_booklets
         SET brochure_content_number = (
           SELECT COUNT(*) FROM education_corner_booklet_pages WHERE booklet_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [bookletId]
      );

      await clientConn.query('COMMIT');

      // ✅ Delete file in storage AFTER DB commit
      await safeRemoveFromBucket(BOOKLET_BUCKET, oldImageUrl);

      res.status(204).send();
    } catch (err) {
      try { await clientConn.query('ROLLBACK'); } catch {}
      next(err);
    } finally {
      clientConn.release();
    }
  }
);

module.exports = router;
