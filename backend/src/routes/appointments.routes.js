const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { sendSMS } = require('../services/textbeeSms');

const router = express.Router();

// services table removed; we now rely on fixed slugs

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
    console.error('Failed to write Usapan-Series SMS log:', e?.message || e);
  }
}

const preMarriageSchema = {
  body: Joi.object({
    fullName: Joi.string().max(255).required(),
    contactNumber: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    requestedDate: Joi.date().iso().allow(null),
    surveyResponses: Joi.object().unknown(true).required()
  })
};

router.post('/pre-marriage', validate(preMarriageSchema), async (req, res, next) => {
  try {
    const { fullName, contactNumber, email, requestedDate, surveyResponses } = req.body;

    const result = await db.query(
      `INSERT INTO appointments (
         service_slug,
         citizen_full_name,
         citizen_contact_number,
         citizen_email,
         requested_date,
         status,
         survey_responses
       ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       RETURNING *`,
      ['pre-marriage-orientation', fullName, contactNumber, email, requestedDate || null, surveyResponses]
    );

    // Fire-and-forget SMS confirmation to the citizen's contact number
    const normalizedContact = String(contactNumber || '').replace(/[^0-9]/g, '');
    if (normalizedContact) {
      const datePart = requestedDate ? new Date(requestedDate).toLocaleDateString('en-PH') : 'your scheduled date';
      const message = `Hello ${fullName || 'Client'}, your Pre-Marriage Orientation appointment request has been received. Requested date: ${datePart}. We will contact you once it is reviewed.`;
      setImmediate(async () => {
        try {
          const smsResult = await sendSMS(normalizedContact, message);
          if (!smsResult.success) {
            console.error('Pre-marriage booking SMS failed:', smsResult.error?.message || smsResult.error);
          }
        } catch (e) {
          console.error('Pre-marriage booking SMS error:', e?.message || e);
        }
      });
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message:
        'You have successfully booked an appointment for pre-marriage orientation. A message will be sent to the number and email you provided.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /appointments/pre-marriage/me - list pre-marriage appointments for the logged-in user
router.get('/pre-marriage/me', authenticate, async (req, res, next) => {
  try {
    const email = req.user?.email ? String(req.user.email).trim().toLowerCase() : null;

    if (!email) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT id,
              service_slug,
              citizen_full_name,
              citizen_contact_number,
              citizen_email,
              requested_date,
              status,
              created_at
         FROM appointments
        WHERE service_slug = 'pre-marriage-orientation'
          AND lower(citizen_email) = $1
        ORDER BY created_at DESC`,
      [email]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

const usapanSchema = {
  body: Joi.object({
    requestedDate: Joi.date().iso().required(),
    // Optional end time in HH:MM (24-hour) format; frontend enforces required, but
    // backend treats it as optional for backward compatibility.
    endTime: Joi.string()
      .pattern(/^\d{2}:\d{2}$/)
      .allow(null)
      .optional(),
    reason: Joi.string().allow('', null)
  })
};

router.post(
  '/usapan-series',
  authenticate,
  authorize(['BARANGAY_OFFICER']),
  validate(usapanSchema),
  async (req, res, next) => {
    try {
      const { requestedDate, endTime, reason } = req.body;

      // Normalize requestedDate into separate date and time components for UsapanSchedules
      const jsDate = new Date(requestedDate);
      if (Number.isNaN(jsDate.getTime())) {
        return res.status(400).json({ success: false, error: { message: 'Invalid requested date.' } });
      }
      const dateStr = jsDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = jsDate.toTimeString().slice(0, 5); // HH:MM (start time)

      // Determine end time: prefer explicitly provided endTime, otherwise fall back
      // to start time to satisfy NOT NULL constraint.
      const endTimeStr = typeof endTime === 'string' && endTime.trim() ? endTime.trim() : timeStr;

      const barangay = req.user.barangay || null;

      const result = await db.query(
        `INSERT INTO "UsapanSchedules" (
           date,
           start_time,
           end_time,
           barangay,
           "userID",
           status,
           reason
         ) VALUES ($1::date, $2, $3, $4, $5, 'Pending', $6)
         RETURNING *`,
        [dateStr, timeStr, endTimeStr, barangay, req.user.id, reason || null]
      );

      // Fire-and-forget SMS confirmation to the barangay officer who created the schedule
      setImmediate(async () => {
        try {
          const userResult = await db.query(
            'SELECT full_name, contact_number FROM users WHERE "userid" = $1',
            [req.user.id]
          );
          const dbUser = userResult.rows[0] || {};

          // Fallbacks to ensure we have a name/contact when possible
          const fullName = dbUser.full_name || req.user.full_name || req.user.name || 'Officer';
          const rawContact = dbUser.contact_number || req.user.contactNumber || req.user.contact_number || '';
          const normalizedContact = String(rawContact || '').replace(/[^0-9]/g, '');

          const datePart = requestedDate
            ? new Date(requestedDate).toLocaleDateString('en-PH')
            : 'your requested date';
          const message = `Hello ${fullName}, your Usapan-Series appointment request for ${datePart} has been recorded. The Municipal Population Office will coordinate with you for scheduling.`;

          let smsResult = { success: false, error: { message: 'Phone number is required.' } };

          if (normalizedContact) {
            smsResult = await sendSMS(normalizedContact, message);
            if (!smsResult.success) {
              console.error('Usapan booking SMS failed:', smsResult.error?.message || smsResult.error);
            }
          } else {
            console.error('Usapan booking SMS skipped: missing contact number for officer');
          }

          await logUsapanSmsAttempt({
            eventType: 'USAPAN_REQUEST_CONFIRMATION',
            recipient: normalizedContact,
            message,
            success: smsResult.success,
            providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
            errorMessage: smsResult.success ? null : smsResult.error?.message
          });
        } catch (e) {
          console.error('Usapan booking SMS error:', e?.message || e);
        }
      });

      const io = req.app.get('io'); if (io) io.emit('usapan:updated');
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/usapan-series/me', authenticate, authorize(['BARANGAY_OFFICER']), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*
       FROM "UsapanSchedules" s
       WHERE s."userID" = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.full_name AS officer_name
       FROM appointments a
       LEFT JOIN users u ON a.officer_id = u."userID"
       ORDER BY a.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    // If the legacy `appointments` table does not exist, avoid crashing the API.
    // Return an empty list so admin UIs can continue to function without this table.
    if (err && err.code === '42P01') {
      return res.json({ success: true, data: [] });
    }
    next(err);
  }
});

const updateStatusSchema = {
  body: Joi.object({
    status: Joi.string()
      .valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')
      .required()
  })
};

router.patch(
  '/:id/status',
  authenticate,
  authorize(['ADMIN']),
  validate(updateStatusSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await db.query(
        `UPDATE appointments
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
