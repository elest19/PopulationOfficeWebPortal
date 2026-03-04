const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail, isValidEmail } = require('../services/mailjetEmail');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

async function logFamilyPlanningSmsAttempt({
  bookingId,
  eventType,
  recipient,
  message,
  success,
  providerResponse,
  errorMessage,
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
        null, // appointment_id is reserved for PMO appointments; leave null for Family Planning
        null,
        String(eventType || 'FP_UNKNOWN'),
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null,
      ],
    );
  } catch (e) {
    console.error('Failed to write Family Planning SMS log:', e?.message || e);
  }
}

// Create booking (requires logged-in user)
const createSchema = {
  body: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    age: Joi.number().integer().min(10).max(120).required(),
    // accept string or number, will normalize to digits string
    contactNumber: Joi.alternatives().try(
      Joi.string().pattern(/^\d{7,15}$/),
      Joi.number().integer()
    ).required(),
    prefDate: Joi.date().iso().required(),
    notes: Joi.string().allow('', null)
  })
};

router.post('/bookings', authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const { fullName, age, contactNumber, prefDate, notes } = req.body;
    const normalizedContact = String(contactNumber).replace(/[^0-9]/g, '');
    const userId = req.user && req.user.id != null ? req.user.id : null;

    // Prevent creating bookings with a preferred date in the past (server time)
    const jsDate = new Date(prefDate);
    if (Number.isNaN(jsDate.getTime())) {
      return res.status(400).json({ success: false, error: { message: 'Invalid preferred date.' } });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prefOnlyDate = new Date(jsDate);
    prefOnlyDate.setHours(0, 0, 0, 0);
    if (prefOnlyDate < today) {
      return res.status(400).json({ success: false, error: { message: 'Past dates cannot be selected.' } });
    }

    const result = await db.query(
      `INSERT INTO "FamilyPlanningBooking" (
         full_name,
         age,
         contact_number,
         pref_date,
         notes,
         created_at,
         status,
         userid
       )
       VALUES ($1,$2,$3,$4,$5, NOW(), $6, $7)
       RETURNING *`,
      [fullName, age, normalizedContact, prefOnlyDate.toISOString(), notes || null, 'Pending', userId]
    );

    const booking = result.rows[0];

    // Fire-and-forget SMS and email confirmation
    setImmediate(async () => {
      try {
        const datePart = prefOnlyDate.toLocaleDateString('en-PH');
        const message = `Hello ${fullName || 'Client'}, your Family Planning counseling request has been received. Preferred date: ${datePart}. The office will contact you to confirm the schedule.`;

        if (normalizedContact) {
          const smsResult = await sendSMS(normalizedContact, message);
          if (!smsResult.success) {
            console.error('Family Planning booking SMS failed:', smsResult.error?.message || smsResult.error);
          }
          await logFamilyPlanningSmsAttempt({
            bookingId: booking.fpbID,
            eventType: 'FP_BOOKING_CONFIRMATION',
            recipient: normalizedContact,
            message,
            success: smsResult.success,
            providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
            errorMessage: smsResult.success ? null : smsResult.error?.message,
          });
        }

        if (userId != null) {
          try {
            const userResult = await db.query('SELECT email FROM users WHERE userid = $1', [userId]);
            const user = userResult.rows[0];
            const email = user && user.email ? String(user.email).trim() : '';
            if (email && isValidEmail(email)) {
              const emailResult = await sendEmail(
                email,
                'Family Planning Counseling Request Received',
                message
              );
              if (!emailResult.success) {
                console.error('Family Planning booking email failed:', emailResult.error?.message || emailResult.error);
              }
            }
          } catch (e) {
            console.error('Family Planning booking email lookup failed:', e?.message || e);
          }
        }
      } catch (e) {
        console.error('Family Planning booking notifications failed:', e?.message || e);
      }
    });

    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

// Cancel booking (no SMS, just update status and store reason)
const cancelSchema = {
  params: Joi.object({ id: Joi.number().integer().required() }),
  body: Joi.object({ reason: Joi.string().min(2).max(500).required() })
};

router.post('/admin/bookings/:id/cancel', authenticate, authorize(['ADMIN']), validate(cancelSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { rows } = await db.query(
      'SELECT "fpbID" as id, full_name, contact_number, pref_date, userid FROM "FamilyPlanningBooking" WHERE "fpbID" = $1',
      [id]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, error: { message: 'Booking not found' } });
    }

    const contact = String(row.contact_number || '').replace(/[^0-9]/g, '');
    const datePart = row.pref_date ? new Date(row.pref_date).toISOString().slice(0, 10) : 'your scheduled date';
    const message = `Hello ${row.full_name || 'Client'}, your Family Planning booking has been cancelled. Preferred date: ${datePart}. Reason: ${reason}`;

    if (contact) {
      const sms = await sendSMS(contact, message);
      if (!sms.success) {
        console.error('Family Planning cancel SMS failed:', sms.error?.message || sms.error);
      }
      await logFamilyPlanningSmsAttempt({
        bookingId: row.id,
        eventType: 'FP_STATUS_CANCELLED',
        recipient: contact,
        message,
        success: sms.success,
        providerResponse: sms.success ? sms.data : (sms.error?.data || null),
        errorMessage: sms.success ? null : sms.error?.message,
      });
    }

    if (row.userid != null) {
      try {
        const userResult = await db.query('SELECT email FROM users WHERE userid = $1', [row.userid]);
        const user = userResult.rows[0];
        const email = user && user.email ? String(user.email).trim() : '';
        if (email && isValidEmail(email)) {
          const emailResult = await sendEmail(
            email,
            'Family Planning Booking Cancelled',
            message
          );
          if (!emailResult.success) {
            console.error('Family Planning cancel email failed:', emailResult.error?.message || emailResult.error);
          }
        }
      } catch (e) {
        console.error('Family Planning cancel email lookup failed:', e?.message || e);
      }
    }

    await db.query(
      'UPDATE "FamilyPlanningBooking" SET status = $1, reject_reason = $2 WHERE "fpbID" = $3',
      ['Cancelled', reason, id]
    );

    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    return res.json({ success: true, data: { id: row.id } });
  } catch (err) {
    next(err);
  }
});

// Get bookings for the logged-in user
router.get('/bookings/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user && req.user.id != null ? req.user.id : null;
    if (!userId) {
      return res.status(400).json({ success: false, error: { message: 'Missing user identifier.' } });
    }

    const result = await db.query(
      `SELECT
         "fpbID" as id,
         full_name,
         contact_number,
         pref_date,
         notes,
         created_at,
         status
       FROM "FamilyPlanningBooking"
       WHERE userid = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Admin analytics for Family Planning bookings
router.get('/admin/analytics', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const monthly = await db.query(
      `SELECT
         date_trunc('month', pref_date::timestamp) AS month,
         COUNT(*)::int AS count
       FROM "FamilyPlanningBooking"
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`
    );

    const statusCounts = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM "FamilyPlanningBooking"
       GROUP BY status`
    );

    res.json({
      success: true,
      data: {
        monthly: monthly.rows,
        statusCounts: statusCounts.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// Admin list
const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50)
  })
};

router.get('/admin/bookings', authenticate, authorize(['ADMIN']), validate(listSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const count = await db.query('SELECT COUNT(*)::int AS count FROM "FamilyPlanningBooking"');
    const total = count.rows[0]?.count || 0;

    const rows = await db.query(
      `SELECT "fpbID" as id,
              full_name,
              age,
              contact_number,
              pref_date,
              notes,
              created_at,
              status
       FROM "FamilyPlanningBooking"
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ success: true, data: rows.rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// Admin delete (kept for backward compatibility, prefer archive instead of delete in the UI)
router.delete('/admin/bookings/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM "FamilyPlanningBooking" WHERE "fpbID" = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Booking not found' } });
    }
    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// Admin archive booking (soft delete)
const archiveSchema = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};

router.post('/admin/bookings/:id/archive', authenticate, authorize(['ADMIN']), validate(archiveSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE "FamilyPlanningBooking" SET status = $1 WHERE "fpbID" = $2',
      ['Archived', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Booking not found' } });
    }

    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    return res.json({ success: true, data: { id: Number(id) } });
  } catch (err) {
    next(err);
  }
});

// Admin unarchive booking (restore to Pending)
const unarchiveSchema = {
  params: Joi.object({ id: Joi.number().integer().required() }),
};

router.post('/admin/bookings/:id/unarchive', authenticate, authorize(['ADMIN']), validate(unarchiveSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE "FamilyPlanningBooking" SET status = $1 WHERE "fpbID" = $2',
      ['Pending', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Booking not found' } });
    }

    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    return res.json({ success: true, data: { id: Number(id) } });
  } catch (err) {
    next(err);
  }
});

// Approve booking and send SMS/email (with optional note to client)
const approveSchema = {
  params: Joi.object({ id: Joi.number().integer().required() }),
  body: Joi.object({ note: Joi.string().max(500).allow('', null) }).optional(),
};

router.post('/admin/bookings/:id/approve', authenticate, authorize(['ADMIN']), validate(approveSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = req.body && typeof req.body.note === 'string' ? req.body.note.trim() : '';
    const { rows } = await db.query(
      `SELECT "fpbID" as id, full_name, contact_number, pref_date, userid
       FROM "FamilyPlanningBooking" WHERE "fpbID" = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, error: { message: 'Booking not found' } });

    const contact = String(row.contact_number || '').replace(/[^0-9]/g, '');
    if (!contact) return res.status(400).json({ success: false, error: { message: 'Missing contact number' } });

    const datePart = row.pref_date ? new Date(row.pref_date).toISOString().slice(0, 10) : 'your scheduled date';
    const noteLine = note ? ` Note: ${note}` : '';
    const message = `Hello ${row.full_name || 'Client'}, your Family Planning booking is approved. Preferred date: ${datePart}.${noteLine}`;

    const sms = await sendSMS(contact, message);
    await logFamilyPlanningSmsAttempt({
      bookingId: row.id,
      eventType: 'FP_STATUS_APPROVED',
      recipient: contact,
      message,
      success: sms.success,
      providerResponse: sms.success ? sms.data : (sms.error?.data || null),
      errorMessage: sms.success ? null : sms.error?.message,
    });
    if (!sms.success) {
      return res.status(502).json({ success: false, error: { message: sms.error?.message || 'Failed to send SMS' } });
    }

    if (row.userid != null) {
      try {
        const userResult = await db.query('SELECT email FROM users WHERE userid = $1', [row.userid]);
        const user = userResult.rows[0];
        const email = user && user.email ? String(user.email).trim() : '';
        if (email && isValidEmail(email)) {
          const emailResult = await sendEmail(
            email,
            'Family Planning Booking Approved',
            message
          );
          if (!emailResult.success) {
            console.error('Family Planning approve email failed:', emailResult.error?.message || emailResult.error);
          }
        }
      } catch (e) {
        console.error('Family Planning approve email lookup failed:', e?.message || e);
      }
    }

    // update status
    await db.query('UPDATE "FamilyPlanningBooking" SET status = $1 WHERE "fpbID" = $2', ['Approved', id]);
    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Reject booking and send SMS with reason
const rejectSchema = {
  params: Joi.object({ id: Joi.number().integer().required() }),
  body: Joi.object({ reason: Joi.string().min(2).max(500).required() })
};

router.post('/admin/bookings/:id/reject', authenticate, authorize(['ADMIN']), validate(rejectSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { rows } = await db.query(
      `SELECT "fpbID" as id, full_name, contact_number, pref_date, userid
       FROM "FamilyPlanningBooking" WHERE "fpbID" = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, error: { message: 'Booking not found' } });

    const contact = String(row.contact_number || '').replace(/[^0-9]/g, '');
    if (!contact) return res.status(400).json({ success: false, error: { message: 'Missing contact number' } });

    const datePart = row.pref_date ? new Date(row.pref_date).toISOString().slice(0, 10) : 'your scheduled date';
    const message = `Hello ${row.full_name || 'Client'}, your Family Planning booking for ${datePart} has been rejected. Reason: ${reason}`;

    const sms = await sendSMS(contact, message);
    if (!sms.success) {
      console.error('Family Planning reject SMS failed:', sms.error?.message || sms.error);
    }

    await logFamilyPlanningSmsAttempt({
      bookingId: row.id,
      eventType: 'FP_STATUS_REJECTED',
      recipient: contact,
      message,
      success: sms.success,
      providerResponse: sms.success ? sms.data : (sms.error?.data || null),
      errorMessage: sms.success ? null : sms.error?.message,
    });

    if (row.userid != null) {
      try {
        const userResult = await db.query('SELECT email FROM users WHERE userid = $1', [row.userid]);
        const user = userResult.rows[0];
        const email = user && user.email ? String(user.email).trim() : '';
        if (email && isValidEmail(email)) {
          const emailResult = await sendEmail(
            email,
            'Family Planning Booking Rejected',
            message
          );
          if (!emailResult.success) {
            console.error('Family Planning reject email failed:', emailResult.error?.message || emailResult.error);
          }
        }
      } catch (e) {
        console.error('Family Planning reject email lookup failed:', e?.message || e);
      }
    }

    // update status and store the rejection reason
    await db.query('UPDATE "FamilyPlanningBooking" SET status = $1, reject_reason = $2 WHERE "fpbID" = $3', ['Rejected', reason, id]);
    const io = req.app.get('io'); if (io) io.emit('fp:updated');
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
