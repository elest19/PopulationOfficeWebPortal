const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { sendSMS } = require('../services/textbeeSms');

const router = express.Router();

const SAN_FABIAN_BARANGAYS = [
  'Alacan','Ambalangan-Dalin','Angio','Anonang','Aramal','Bigbiga','Binday','Bolaoen','Bolasi','Cabaruan','Cayanga','Colisao','Gomot','Inmalog','Inmalog Norte','Lekep-Butao','Lipit-Tomeeng','Longos','Longos Proper','Longos-Amangonan-Parac-Parac (Fabrica)','Mabilao','Nibaliw Central','Nibaliw East','Nibaliw Magliba','Nibaliw Narvarte (Nibaliw West Compound)','Nibaliw Vidal (Nibaliw West Proper)','Palapad','Poblacion','Rabon','Sagud-Bahley','Sobol','Tempra-Guilig','Tiblong','Tocok'
];

const eventsSchema = {
  query: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().required()
  })
};

async function logUsapanSmsAttempt({
  eventType,
  recipient,
  message,
  success,
  providerResponse,
  errorMessage
}) {
  try {
    await db.query(
      `INSERT INTO "SMS_Logs" (
         appointment_id,
         couple_id,
         event_type,
         recipient,
         message,
         success,
         provider_response,
         error_message
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        null, // appointment_id is reserved for PMO appointments; leave null for Usapan-Series
        null,
        String(eventType || 'USAPAN_UNKNOWN'),
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null
      ]
    );
  } catch (e) {
    console.error('Failed to write Usapan-Series SMS log (calendar):', e?.message || e);
  }
}

async function sendUsapanStatusSms(usapanId, newStatus) {
  if (!usapanId || !newStatus) return;

  const status = String(newStatus).trim();
  const normalizedStatus = status.toLowerCase();

  // Map DB status to human-friendly label and event type
  let statusLabel = null;
  let eventType = null;

  if (normalizedStatus === 'pending') {
    statusLabel = 'PENDING';
    eventType = 'USAPAN_STATUS_PENDING';
  } else if (normalizedStatus === 'rejected') {
    statusLabel = 'REJECTED';
    eventType = 'USAPAN_STATUS_REJECTED';
  } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
    statusLabel = 'CANCELLED';
    eventType = 'USAPAN_STATUS_CANCELLED';
  } else if (normalizedStatus === 'scheduled') {
    // Treat Scheduled as the "approved" state for Usapan-Series
    statusLabel = 'APPROVED';
    eventType = 'USAPAN_STATUS_APPROVED';
  } else {
    // For other states (e.g., Completed, Ongoing), we skip notifications for now
    return;
  }

  try {
    const { rows } = await db.query(
      `SELECT s."usapanID" AS id,
              s.date,
              s.status,
              s.reason,
              s."userID" AS "userId",
              u.full_name,
              u.contact_number
         FROM "UsapanSchedules" s
         LEFT JOIN users u ON u."userid" = s."userID"
        WHERE s."usapanID" = $1`,
      [usapanId]
    );

    const row = rows[0];
    if (!row) return;

    const rawContact = row.contact_number || '';
    const contact = String(rawContact).replace(/[^0-9]/g, '');
    if (!contact) return;

    const fullName = row.full_name || 'Officer';
    const jsDate = row.date ? new Date(row.date) : null;
    const datePart = jsDate && !Number.isNaN(jsDate.getTime())
      ? jsDate.toLocaleDateString('en-PH')
      : 'your Usapan-Series date';

    const basePrefix = `Hello ${fullName}, your Usapan-Series schedule for ${datePart}`;
    let message;

    if (statusLabel === 'PENDING') {
      message = `${basePrefix} is now marked as PENDING and awaiting confirmation.`;
    } else if (statusLabel === 'APPROVED') {
      message = `${basePrefix} has been APPROVED. The Municipal Population Office will coordinate further details with you.`;
    } else if (statusLabel === 'REJECTED') {
      const reason = row.reason && String(row.reason).trim()
        ? String(row.reason).trim()
        : 'No reason provided.';
      message = `${basePrefix} has been REJECTED. Reason: ${reason}`;
    } else if (statusLabel === 'CANCELLED') {
      const reason = row.reason && String(row.reason).trim()
        ? String(row.reason).trim()
        : 'No reason provided.';
      message = `${basePrefix} has been CANCELLED. Reason: ${reason}`;
    }

    const smsResult = await sendSMS(contact, message);
    if (!smsResult.success) {
      console.error('Usapan status SMS failed:', smsResult.error?.message || smsResult.error);
    }

    await logUsapanSmsAttempt({
      eventType,
      recipient: contact,
      message,
      success: smsResult.success,
      providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
      errorMessage: smsResult.success ? null : smsResult.error?.message
    });
  } catch (e) {
    console.error('Usapan status SMS error:', e?.message || e);
  }
}

const updateScheduleSchema = {
  body: Joi.object({
    type: Joi.string().valid('Pre-Marriage Orientation', 'Usapan-Series', 'Event/Activity').required(),
    date: Joi.date().iso().required(),
    title: Joi.string().max(255).allow('', null),
    counselorID: Joi.number().integer().min(1).allow(null),
    lead: Joi.string().max(255).allow('', null),
    location: Joi.string().max(255).allow('', null),
    barangay: Joi.string().allow('', null),
    userID: Joi.number().integer().min(1).allow(null),
    reason: Joi.string().allow('', null),
    startTime: Joi.string().required(),
    endTime: Joi.string().allow(null, ''),
    description: Joi.string().allow('', null),
    // NOTE:
    // - PMO schedules and Event/Activity announcements still use Scheduled/Ongoing/Finished/Cancelled/ARCHIVED via their own tables.
    // - Usapan-Series uses a dedicated enum type `usapan_series_scl` with values:
    //   Pending, Scheduled, Completed, Rejected, Cancelled
    status: Joi.string().required()
  })
};

const createScheduleSchema = {
  body: Joi.object({
    type: Joi.string().valid('Pre-Marriage Orientation', 'Usapan-Series', 'Event/Activity').required(),
    date: Joi.date().iso().required(),
    title: Joi.string().max(255).allow('', null),
    counselorID: Joi.number().integer().min(1).allow(null),
    lead: Joi.string().max(255).allow('', null),
    location: Joi.string().max(255).allow('', null),
    barangay: Joi.string().allow('', null),
    userID: Joi.number().integer().min(1).allow(null),
    startTime: Joi.string().required(),
    endTime: Joi.string().allow(null, ''),
    description: Joi.string().allow('', null),
    // For PMO and Event/Activity, we still rely on Scheduled/Ongoing/Finished/Cancelled/ARCHIVED semantics.
    // For Usapan-Series, the underlying enum is usapan_series_scl with values:
    //   Pending, Scheduled, Completed, Rejected, Cancelled
    status: Joi.string().default('Scheduled')
  })
};

router.get('/events', validate(eventsSchema), async (req, res, next) => {
  try {
    const { start, end } = req.query;

    // Auto-complete past Usapan-Series schedules:
    // If the date is before today and the status is still Pending/Scheduled/Ongoing,
    // mark it as Completed in the database so all consumers see the real status.
    await db.query(
      `UPDATE "UsapanSchedules"
       SET status = 'Completed', updated_at = NOW()
       WHERE date < CURRENT_DATE
         AND status IN ('Pending', 'Scheduled', 'Ongoing')`
    );

    // NOTE: We do not auto-mutate PMO schedule statuses here because the underlying
    // enum only supports specific values (e.g. Scheduled / Ongoing / Cancelled),
    // and introducing new literals (Finished, ARCHIVED, etc.) causes enum errors.
    // The Calendar UI derives FINISHED/ONGOING/UPCOMING from dates at runtime.

    const result = await db.query(
      `SELECT
         x.id,
         x.type,
         to_char(x.date, 'YYYY-MM-DD') AS date_str,
         x.title,
         x.description,
         x.location,
         x.start_time,
         x.end_time,
         x.status,
         x.counselor_name,
         x.lead,
         x.counselor,
         x.user_id,
         x.requester_name
       FROM (
         SELECT
           a."announcementID" AS id,
           'Event/Activity'::text AS type,
           a.date AS date,
           a.title,
           a.description,
           a.location,
           a.start_time,
           a.end_time,
           a.status::text AS status,
           NULL::text AS counselor_name,
           a.lead,
           NULL::int AS counselor,
           a.created_by AS user_id,
           NULL::text AS requester_name
         FROM announcements a
        WHERE a.date BETWEEN $1::date AND $2::date
          AND a.status <> 'ARCHIVED'

         UNION ALL

         SELECT
           s."pmoID" AS id,
           'Pre-Marriage Orientation'::text AS type,
           s.date AS date,
           NULL::text AS title,
           NULL::text AS description,
           s.location,
           s.start_time,
           s.end_time,
           s.status::text AS status,
           c.counselor_name,
           NULL::text AS lead,
           s.counselor,
           NULL::int AS user_id,
           NULL::text AS requester_name
         FROM "PmoSchedules" s
         LEFT JOIN "Counselors" c ON c."counselorID" = s.counselor
        WHERE s.date BETWEEN $1::date AND $2::date
          AND s.status <> 'Archived'

         UNION ALL

         SELECT
           s."usapanID" AS id,
           'Usapan-Series'::text AS type,
           s.date AS date,
           NULL::text AS title,
           NULL::text AS description,
           s.barangay AS location,
           s.start_time,
           s.end_time,
           s.status::text AS status,
           NULL::text AS counselor_name,
           NULL::text AS lead,
           NULL::int AS counselor,
           s."userID" AS user_id,
           u.full_name AS requester_name
         FROM "UsapanSchedules" s
         LEFT JOIN users u ON u."userid" = s."userID"
        WHERE s.date BETWEEN $1::date AND $2::date
          AND s.status <> 'Archived'
       ) x
       ORDER BY x.date ASC, x.start_time ASC`,
      [start, end]
    );

    const events = result.rows.map((row) => {
      const dateStr = row.date_str;
      const startTime = String(row.start_time).slice(0, 5);
      const endTime = row.end_time ? String(row.end_time).slice(0, 5) : null;

      const startDateIso = `${dateStr}T${startTime}:00`;
      const endDateIso = endTime ? `${dateStr}T${endTime}:00` : startDateIso;

      return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        location: row.location || null,
        status: row.status,
        counselorID: row.counselor || null,
        counselor: row.counselor_name || null,
        lead: row.lead || null,
        userId: row.user_id || null,
        requesterName: row.requester_name || null,
        startDate: startDateIso,
        endDate: endDateIso
      };
    });

    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/events',
  authenticate,
  authorize(['ADMIN']),
  validate(createScheduleSchema),
  async (req, res, next) => {
    try {
      const { type, date, counselorID, lead, startTime, endTime, status, barangay, location, userID, reason } = req.body;

      const isEvent = type === 'Event/Activity';

      if (type === 'Pre-Marriage Orientation') {
        if (!counselorID) {
          return res.status(400).json({ success: false, error: { message: 'Counselor is required for this type.' } });
        }
        if (lead) {
          return res.status(400).json({ success: false, error: { message: 'Lead must be empty for this type.' } });
        }
      }

      if (isEvent) {
        return res.status(400).json({ success: false, error: { message: 'Event/Activity is managed via Announcements only.' } });
      }

      if (counselorID) {
        const counselor = await db.query('SELECT * FROM "Counselors" WHERE "counselorID" = $1', [counselorID]);
        if (counselor.rowCount === 0) {
          return res.status(400).json({ success: false, error: { message: 'Selected counselor does not exist.' } });
        }
        if (!counselor.rows[0].isActive) {
          return res.status(400).json({ success: false, error: { message: 'Selected counselor is not active.' } });
        }
      }

      let finalBarangay = barangay ? String(barangay).trim() : null;
      let finalUserId = userID || null;

      if (type === 'Usapan-Series') {
        if (counselorID) {
          return res.status(400).json({ success: false, error: { message: 'Counselor must be empty for this type.' } });
        }
        if (lead) {
          return res.status(400).json({ success: false, error: { message: 'Lead must be empty for this type.' } });
        }
        if (!endTime) {
          return res.status(400).json({ success: false, error: { message: 'End time is required for Usapan-Series.' } });
        }

        // Option B: derive barangay from userID when provided, otherwise require explicit valid barangay.
        if (userID) {
          const userRes = await db.query('SELECT barangay FROM users WHERE "userID" = $1', [userID]);
          if (userRes.rowCount === 0) {
            return res.status(400).json({ success: false, error: { message: 'User not found for provided userID.' } });
          }
          const b = (userRes.rows[0].barangay || '').trim();
          if (!b) {
            return res.status(400).json({ success: false, error: { message: 'User does not have a barangay set.' } });
          }
          if (!SAN_FABIAN_BARANGAYS.includes(b)) {
            return res.status(400).json({ success: false, error: { message: 'User barangay must be a valid San Fabian barangay.' } });
          }
          finalBarangay = b;
          finalUserId = userID;
        } else {
          if (!finalBarangay) {
            return res.status(400).json({ success: false, error: { message: 'Barangay is required for Usapan-Series.' } });
          }
          if (!SAN_FABIAN_BARANGAYS.includes(finalBarangay)) {
            return res.status(400).json({ success: false, error: { message: 'Barangay must be a valid San Fabian barangay.' } });
          }
        }
      }

      let result;
      if (type === 'Pre-Marriage Orientation') {
        result = await db.query(
          `INSERT INTO "PmoSchedules" (date, counselor, start_time, end_time, status, location)
           VALUES ($1::date, $2, $3, $4, $5, $6)
           RETURNING *`,
          [date, counselorID || null, startTime, endTime, status, location || null]
        );
      } else {
        result = await db.query(
          `INSERT INTO "UsapanSchedules" (date, start_time, end_time, barangay, "userID", status)
           VALUES ($1::date, $2, $3, $4, $5, $6)
           RETURNING *`,
          [date, startTime, endTime, finalBarangay, finalUserId, status]
        );
      }

      const io = req.app.get('io');
      if (io) {
        if (type === 'Pre-Marriage Orientation') io.emit('pmo:updated');
        else io.emit('usapan:updated');
      }
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// List archived Usapan-Series schedules for admin (includes only Archived status)
router.get(
  '/usapan/admin/schedules/archived',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT
           s."usapanID" AS id,
           s.date,
           s.start_time,
           s.end_time,
           s.barangay AS location,
           s.status::text AS status,
           s."userID" AS user_id,
           u.full_name AS requester_name
         FROM "UsapanSchedules" s
         LEFT JOIN users u ON u."userid" = s."userID"
        WHERE s.status = 'Archived'
        ORDER BY s.date DESC, s.start_time DESC`
      );

      const rows = result.rows.map((row) => {
        const dateStr = String(row.date).slice(0, 10);
        const startTime = String(row.start_time).slice(0, 5);
        const endTime = row.end_time ? String(row.end_time).slice(0, 5) : null;
        const startDateIso = `${dateStr}T${startTime}:00`;
        const endDateIso = endTime ? `${dateStr}T${endTime}:00` : startDateIso;
        return {
          id: row.id,
          type: 'Usapan-Series',
          date: row.date,
          location: row.location,
          status: row.status,
          userId: row.user_id,
          requesterName: row.requester_name,
          startDate: startDateIso,
          endDate: endDateIso
        };
      });

      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }
);

// Unarchive a Usapan-Series schedule back to Scheduled
router.patch(
  '/events/:id/unarchive',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const usapan = await db.query(
        `UPDATE "UsapanSchedules"
         SET status = 'Scheduled', updated_at = NOW()
         WHERE "usapanID" = $1 AND status = 'Archived'
         RETURNING *`,
        [id]
      );

      if (usapan.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Event not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('usapan:updated');
      return res.json({ success: true, data: usapan.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// Soft-archive a Usapan-Series schedule (and fallback to announcements) instead of hard-deleting
router.patch(
  '/events/:id/archive',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // First, try archiving a Usapan schedule
      const usapan = await db.query(
        `UPDATE "UsapanSchedules"
         SET status = 'Archived', updated_at = NOW()
         WHERE "usapanID" = $1
         RETURNING *`,
        [id]
      );

      if (usapan.rowCount > 0) {
        const io = req.app.get('io'); if (io) io.emit('usapan:updated');
        return res.json({ success: true, data: usapan.rows[0] });
      }

      // If not a Usapan schedule, fall back to archiving an announcement
      const ann = await db.query(
        `UPDATE announcements
         SET status = 'ARCHIVED', updated_at = NOW()
         WHERE "announcementID" = $1
         RETURNING *`,
        [id]
      );

      if (ann.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Event not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      return res.json({ success: true, data: ann.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/events/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(updateScheduleSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { type, date, counselorID, lead, startTime, endTime, status, barangay, location, userID, reason } = req.body;

      const isEvent = type === 'Event/Activity';

      if (type === 'Pre-Marriage Orientation') {
        if (!counselorID) {
          return res.status(400).json({ success: false, error: { message: 'Counselor is required for this type.' } });
        }
        if (lead) {
          return res.status(400).json({ success: false, error: { message: 'Lead must be empty for this type.' } });
        }
      }

      if (isEvent) {
        return res.status(400).json({ success: false, error: { message: 'Event/Activity is managed via Announcements only.' } });
      }

      if (counselorID) {
        const counselor = await db.query('SELECT * FROM "Counselors" WHERE "counselorID" = $1', [counselorID]);
        if (counselor.rowCount === 0) {
          return res.status(400).json({ success: false, error: { message: 'Selected counselor does not exist.' } });
        }
        if (!counselor.rows[0].isActive) {
          return res.status(400).json({ success: false, error: { message: 'Selected counselor is not active.' } });
        }
      }

      let finalBarangay = barangay ? String(barangay).trim() : null;
      let finalUserId = userID || null;

      if (type === 'Usapan-Series') {
        if (counselorID) {
          return res.status(400).json({ success: false, error: { message: 'Counselor must be empty for this type.' } });
        }
        if (lead) {
          return res.status(400).json({ success: false, error: { message: 'Lead must be empty for this type.' } });
        }
        if (!endTime) {
          return res.status(400).json({ success: false, error: { message: 'End time is required for Usapan-Series.' } });
        }

        if (userID) {
          const userRes = await db.query('SELECT barangay FROM users WHERE "userID" = $1', [userID]);
          if (userRes.rowCount === 0) {
            return res.status(400).json({ success: false, error: { message: 'User not found for provided userID.' } });
          }
          const b = (userRes.rows[0].barangay || '').trim();
          if (!b) {
            return res.status(400).json({ success: false, error: { message: 'User does not have a barangay set.' } });
          }
          if (!SAN_FABIAN_BARANGAYS.includes(b)) {
            return res.status(400).json({ success: false, error: { message: 'User barangay must be a valid San Fabian barangay.' } });
          }
          finalBarangay = b;
          finalUserId = userID;
        }
      }

      let result;
      if (type === 'Pre-Marriage Orientation') {
        result = await db.query(
          `UPDATE "PmoSchedules"
           SET date = $1::date,
               counselor = $2,
               start_time = $3,
               end_time = $4,
               status = $5,
               location = $6,
               updated_at = NOW()
           WHERE "pmoID" = $7
           RETURNING *`,
          [date, counselorID || null, startTime, endTime, status, location || null, id]
        );
      } else {
        result = await db.query(
          `UPDATE "UsapanSchedules"
           SET date = $1::date,
               start_time = $2,
               end_time = $3,
               barangay = COALESCE($4, barangay),
               "userID" = COALESCE($5, "userID"),
               status = $6,
               reason = COALESCE($7, reason),
               updated_at = NOW()
           WHERE "usapanID" = $8
           RETURNING *`,
          [date, startTime, endTime, finalBarangay, finalUserId, status, reason ?? null, id]
        );
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Event not found' } });
      }

      // For Usapan-Series, send SMS + log when status changes to key states
      if (type === 'Usapan-Series' && status) {
        const updated = result.rows[0];
        const usapanId = updated.usapanID || updated.usapanid || id;
        await sendUsapanStatusSms(usapanId, status);
      }

      const io = req.app.get('io');
      if (io) {
        if (type === 'Pre-Marriage Orientation') io.emit('pmo:updated');
        else io.emit('usapan:updated');
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/events/:id/cancel',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // First, try cancelling a PMO schedule
      const pmo = await db.query(
        `UPDATE "PmoSchedules"
         SET status = 'Cancelled', updated_at = NOW()
         WHERE "pmoID" = $1
         RETURNING *`,
        [id]
      );

      if (pmo.rowCount > 0) {
        const io = req.app.get('io'); if (io) io.emit('pmo:updated');
        return res.json({ success: true, data: pmo.rows[0] });
      }

      // If no PMO schedule was updated, try cancelling a Usapan schedule
      const usapan = await db.query(
        `UPDATE "UsapanSchedules"
         SET status = 'Cancelled', updated_at = NOW()
         WHERE "usapanID" = $1
         RETURNING *`,
        [id]
      );

      if (usapan.rowCount > 0) {
        const row = usapan.rows[0];
        await sendUsapanStatusSms(row.usapanID || row.usapanid || id, 'Cancelled');
        const io = req.app.get('io'); if (io) io.emit('usapan:updated');
        return res.json({ success: true, data: row });
      }

      // Finally, fall back to archiving an announcement
      const ann = await db.query(
        `UPDATE announcements
         SET status = 'ARCHIVED', updated_at = NOW()
         WHERE "announcementID" = $1
         RETURNING *`,
        [id]
      );

      if (ann.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Event not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('events:updated');
      return res.json({ success: true, data: ann.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/events/:id',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `WITH del1 AS (
           DELETE FROM "PmoSchedules" WHERE "pmoID" = $1 RETURNING 1
         ), del2 AS (
           DELETE FROM "UsapanSchedules" WHERE "usapanID" = $1 AND NOT EXISTS (SELECT 1 FROM del1) RETURNING 1
         )
         SELECT 1 AS ok FROM del1
         UNION ALL SELECT 1 AS ok FROM del2`,
        [id]
      );
      if (result.rowCount === 0) {
        const ann = await db.query(
          `UPDATE announcements SET status = 'ARCHIVED', updated_at = NOW() WHERE "announcementID" = $1 RETURNING 1`,
          [id]
        );
        if (ann.rowCount === 0) {
          return res.status(404).json({ success: false, error: { message: 'Event not found' } });
        }
      }
      const io = req.app.get('io');
      if (io) { io.emit('pmo:updated'); io.emit('usapan:updated'); io.emit('events:updated'); }
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
