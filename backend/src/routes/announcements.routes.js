const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
// Supabase storage integration removed per requirement

const router = express.Router();

function mapAnnouncementRow(row) {
  return {
    id: row.announcementID,
    title: row.title,
    description: row.description,
    lead: row.lead || null,
    date: row.date,
    startTime: row.start_time || null,
    endTime: row.end_time || null,
    location: row.location,
    status: row.status,
    authorName: row.author_name || row.full_name || null,
    createdByUserId: row.created_by || row.userID || null
  };
}

// Removed supabase public URL parsing since image storage is no longer used

function computeStatus(date) {
  const today = new Date();
  const d = new Date(date);
  const todayYmd = today.toISOString().slice(0, 10);
  const dYmd = d.toISOString().slice(0, 10);
  if (dYmd < todayYmd) return 'PAST';
  if (dYmd === todayYmd) return 'ONGOING';
  return 'UPCOMING';
}

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('UPCOMING', 'ONGOING', 'PAST', 'ARCHIVED').allow(null)
  })
};

router.get('/', validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const offset = (page - 1) * limit;

    const values = [];
    const where = [];

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM announcements ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit);
    values.push(offset);

    const result = await db.query(
      `SELECT a.*, u.full_name AS author_name
       FROM announcements a
       LEFT JOIN users u ON u.userid = a.created_by
       ${whereClause}
       ORDER BY a.date DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({
      success: true,
      data: result.rows.map(mapAnnouncementRow),
      meta: { total, page, limit }
    });
  } catch (err) {
    next(err);
  }
});

const createOrUpdateSchema = {
  body: Joi.object({
    title: Joi.string().max(255).required(),
    description: Joi.string().required(),
    lead: Joi.string().allow('', null),
    date: Joi.date().iso().required(),
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .allow(null, '')
      .messages({ 'string.pattern.base': 'startTime must be HH:MM (24h)' }),
    endTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .allow(null, '')
      .messages({ 'string.pattern.base': 'endTime must be HH:MM (24h)' }),
    location: Joi.string().allow('', null)
  })
};

router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(createOrUpdateSchema),
  async (req, res, next) => {
    try {
      const { title, description, lead, date, startTime, endTime, location } = req.body;
      const status = computeStatus(date);
      const st = startTime || '09:00';
      const et = endTime || '10:00';

      const result = await db.query(
        `INSERT INTO announcements (title, description, lead, date, start_time, end_time, location, status, created_by)
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time, $7, $8, $9)
         RETURNING *`,
        [title, description, lead || null, date, st, et, location || null, status, req.user.id]
      );

      const joined = await db.query(
        `SELECT a.*, u.full_name AS author_name
         FROM announcements a
         LEFT JOIN users u ON u.userid = a.created_by
         WHERE a."announcementID" = $1`,
        [result.rows[0].announcementID]
      );

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      res.status(201).json({ success: true, data: mapAnnouncementRow(joined.rows[0] || result.rows[0]) });
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
      const { title, description, lead, date, startTime, endTime, location } = req.body;
      const status = computeStatus(date);
      const st = startTime || '09:00';
      const et = endTime || '10:00';

      const existing = await db.query('SELECT * FROM announcements WHERE "announcementID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Announcement not found' } });
      }

      // RBAC: Barangay Officers may only edit their own announcements
      const row = existing.rows[0];
      const ownerId = row.created_by || row.userID || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to edit this announcement.' } });
        }
      }

      const result = await db.query(
        `UPDATE announcements
         SET title = $1,
             description = $2,
             lead = $3,
             date = $4::date,
             start_time = $5::time,
             end_time = $6::time,
             location = $7,
             status = $8,
             updated_at = NOW()
         WHERE "announcementID" = $9
         RETURNING *`,
        [title, description, lead || null, date, st, et, location || null, status, id]
      );

      const joined = await db.query(
        `SELECT a.*, u.full_name AS author_name
         FROM announcements a
         LEFT JOIN users u ON u.userid = a.created_by
         WHERE a."announcementID" = $1`,
        [id]
      );

      const updated = joined.rows[0] || result.rows[0];

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      res.json({ success: true, data: mapAnnouncementRow(updated) });
    } catch (err) {
      next(err);
    }
  }
);

// Soft-archive an announcement (used for Events/Activity archive)
router.patch(
  '/:id/archive',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM announcements WHERE "announcementID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Announcement not found' } });
      }

      // RBAC: Barangay Officers may only archive their own announcements
      const row = existing.rows[0];
      const ownerId = row.created_by || row.userID || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to archive this announcement.' } });
        }
      }

      const result = await db.query(
        `UPDATE announcements
         SET status = 'ARCHIVED',
             updated_at = NOW()
         WHERE "announcementID" = $1
         RETURNING *`,
        [id]
      );

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      res.json({ success: true, data: mapAnnouncementRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Unarchive an announcement: recompute status from its date
router.patch(
  '/:id/unarchive',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await db.query('SELECT * FROM announcements WHERE "announcementID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Announcement not found' } });
      }

      // RBAC: Barangay Officers may only unarchive their own announcements
      const row = existing.rows[0];
      const ownerId = row.created_by || row.userID || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to unarchive this announcement.' } });
        }
      }

      const date = row.date;
      const status = computeStatus(date);

      const result = await db.query(
        `UPDATE announcements
         SET status = $1,
             updated_at = NOW()
         WHERE "announcementID" = $2
         RETURNING *`,
        [status, id]
      );

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      res.json({ success: true, data: mapAnnouncementRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Hard delete: remove row permanently
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT created_by, "userID" FROM announcements WHERE "announcementID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Announcement not found' } });
      }

      // RBAC: Barangay Officers may only delete their own announcements
      const row = existing.rows[0];
      const ownerId = row.created_by || row.userID || null;
      const currentUserId = req.user && req.user.id;
      if (req.user && req.user.role === 'BARANGAY OFFICER') {
        if (!ownerId || String(ownerId) !== String(currentUserId)) {
          return res.status(403).json({ success: false, error: { message: 'You are not allowed to delete this announcement.' } });
        }
      }

      const del = await db.query(
        'DELETE FROM announcements WHERE "announcementID" = $1',
        [id]
      );

      if (del.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Announcement not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

