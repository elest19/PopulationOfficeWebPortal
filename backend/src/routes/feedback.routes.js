const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const createSchema = {
  body: Joi.object({
    message: Joi.string().required()
  })
};

// Allow Admin, Barangay Officer, and Regular authenticated users to submit feedback
router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER', 'USER']),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const { message } = req.body;
      const userId = req.user && req.user.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      }

      const result = await db.query(
        `INSERT INTO "feedbacks" ("userID", message)
         VALUES ($1, $2)
         RETURNING "feedbackID", "userID", message, created_at`,
        [userId, message]
      );
      const io = req.app.get('io'); if (io) io.emit('feedback:updated');
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/client-satisfaction/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'SELECT * FROM "ClientSatisfactionFeedback" WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Client satisfaction feedback not found' } });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/client-satisfaction/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'DELETE FROM "ClientSatisfactionFeedback" WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Client satisfaction feedback not found' } });
      }

      const io = req.app.get('io'); if (io) io.emit('feedback:updated');
      return res.json({ success: true, data: { id } });
    } catch (err) {
      next(err);
    }
  }
);

// Public client satisfaction measurement (CSM) feedback
const clientSatisfactionSchema = {
  body: Joi.object({
    clientType: Joi.string().valid('Citizen', 'Business', 'Government').required(),
    date: Joi.date().required(),
    regionOfResidence: Joi.string().trim().min(1).max(255).required(),
    sex: Joi.string().valid('Male', 'Female').required(),
    age: Joi.number().integer().min(1).max(99).required(),
    serviceAvailed: Joi.string().trim().min(1).max(255).required(),

    cc1: Joi.string().valid('1', '2', '3', '4').required(),
    cc2: Joi.string().valid('1', '2', '3', '4', '5').required(),
    cc3: Joi.string().valid('1', '2', '3', '4').required(),

    sqd0: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd1: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd2: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd3: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd4: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd5: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd6: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd7: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),
    sqd8: Joi.string().valid('SD', 'D', 'N', 'A', 'SA', 'NA').required(),

    suggestions: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null)
  })
};

router.post('/client-satisfaction', validate(clientSatisfactionSchema), async (req, res, next) => {
  try {
    const {
      clientType,
      date,
      regionOfResidence,
      sex,
      age,
      serviceAvailed,
      cc1,
      cc2,
      cc3,
      sqd0,
      sqd1,
      sqd2,
      sqd3,
      sqd4,
      sqd5,
      sqd6,
      sqd7,
      sqd8,
      suggestions,
      email
    } = req.body;

    const result = await db.query(
      `INSERT INTO "ClientSatisfactionFeedback" (
         client_type,
         date,
         region_of_residence,
         sex,
         age,
         service_availed,
         cc1,
         cc2,
         cc3,
         sqd0,
         sqd1,
         sqd2,
         sqd3,
         sqd4,
         sqd5,
         sqd6,
         sqd7,
         sqd8,
         suggestions,
         email
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id, client_type, date, region_of_residence, sex, age, service_availed, created_at`,
      [
        clientType,
        date,
        regionOfResidence,
        sex,
        age,
        serviceAvailed,
        cc1,
        cc2,
        cc3,
        sqd0,
        sqd1,
        sqd2,
        sqd3,
        sqd4,
        sqd5,
        sqd6,
        sqd7,
        sqd8,
        suggestions || null,
        email || null
      ]
    );

    const io = req.app.get('io'); if (io) io.emit('feedback:updated');
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

const clientSatisfactionListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50)
  })
};

router.get(
  '/client-satisfaction',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(clientSatisfactionListSchema),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const offset = (page - 1) * limit;

      const countResult = await db.query('SELECT COUNT(*) FROM "ClientSatisfactionFeedback"');
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT id,
                client_type,
                date,
                region_of_residence,
                sex,
                age,
                service_availed,
                suggestions,
                email,
                created_at
         FROM "ClientSatisfactionFeedback"
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({ success: true, data: result.rows, meta: { total, page, limit } });
    } catch (err) {
      next(err);
    }
  }
);

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50)
  })
};

router.get(
  '/',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(listSchema),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const offset = (page - 1) * limit;

      const countResult = await db.query('SELECT COUNT(*) FROM "feedbacks"');
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT f."feedbackID" as id,
                f."userID" as userId,
                f.message,
                f.created_at,
                u.full_name,
                u.email,
                u.contact_number,
                u.barangay,
                u.role
         FROM "feedbacks" f
         JOIN users u ON u.userid = f."userID"
         ORDER BY f.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({ success: true, data: result.rows, meta: { total, page, limit } });
    } catch (err) {
      next(err);
    }
  }
);

const updateSchema = {
  body: Joi.object({
    status: Joi.string().valid('NEW', 'REVIEWED', 'RESOLVED').required()
  })
};

router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      // No status field in new schema; this endpoint is currently a no-op.
      return res.status(400).json({ success: false, error: { message: 'Not supported for current feedback schema' } });
    } catch (err) {
      next(err);
    }
  }
);

// Delete a feedback (Admin and Barangay Officer)
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'BARANGAY OFFICER']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        `DELETE FROM "feedbacks" WHERE "feedbackID" = $1`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Feedback not found' } });
      }
      const io = req.app.get('io'); if (io) io.emit('feedback:updated');
      return res.json({ success: true, data: { id } });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
router.get(
  '/analytics',
  authenticate,
  authorize(['ADMIN']),
  async (req, res, next) => {
    try {
      const total = await db.query('SELECT COUNT(*)::int AS count FROM "feedbacks"');
      const monthly = await db.query(
        `SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS count
         FROM "feedbacks"
         GROUP BY 1
         ORDER BY 1 DESC
         LIMIT 12`
      );
      const byBarangayMonthly = await db.query(
        `SELECT
           date_trunc('month', f.created_at) AS month,
           COALESCE(u.barangay, 'Unknown') AS barangay,
           COUNT(*)::int AS count
         FROM "feedbacks" f
         LEFT JOIN users u ON u.userid = f."userID"
         GROUP BY 1, 2
         ORDER BY 1 DESC, 3 DESC`
      );

      // Client satisfaction (public client feedback) monthly counts
      const clientMonthly = await db.query(
        `SELECT date_trunc('month', date) AS month, COUNT(*)::int AS count
         FROM "ClientSatisfactionFeedback"
         GROUP BY 1
         ORDER BY 1 DESC
         LIMIT 12`
      );

      res.json({
        success: true,
        data: {
          totalFeedback: total.rows[0]?.count || 0,
          feedbackMonthly: monthly.rows,
          feedbackByBarangayMonthly: byBarangayMonthly.rows,
          clientFeedbackMonthly: clientMonthly.rows
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
