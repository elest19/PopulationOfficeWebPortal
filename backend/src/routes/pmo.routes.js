const express = require('express');
const Joi = require('joi');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail, isValidEmail } = require('../services/mailjetEmail');
const pmoSmsTemplates = require('../services/pmoSmsTemplates');
const { getSupabaseClient } = require('../config/supabase');

const router = express.Router();

const ENABLE_PMO_NOTIFICATIONS = true;

const answerValueSchema = Joi.string().valid('Agree', 'Neutral / Unsure', 'Disagree');

const bookingAnswerItemSchema = Joi.object({
  questionID: Joi.number().integer().min(1).required(),
  isHusband: Joi.boolean().required(),
  answer: answerValueSchema.required(),
  reason: Joi.string().trim().min(1).required()
});

const bookingSchema = {
  body: Joi.object({
    schedule: Joi.object().allow(null),
    personalInfo: Joi.object({
      husband_name: Joi.string().max(255).required(),
      husband_birthday: Joi.date().iso().required(),
      husband_age: Joi.number().integer().min(0).required(),
      husband_address: Joi.string().required(),
      husband_occupation: Joi.string().max(255).required(),
      husband_religion: Joi.string().max(100).required(),
      husband_educational_attainment: Joi.string().max(100).required(),
      husband_citizenship: Joi.string().max(100).required(),
      husband_id_type: Joi.string().max(100).required(),
      husband_id_number: Joi.string().max(100).required(),
      husband_id_photo: Joi.string().required(),
      husband_4ps: Joi.boolean().required(),
      husband_pwd: Joi.boolean().required(),

      wife_name: Joi.string().max(255).required(),
      wife_birthday: Joi.date().iso().required(),
      wife_age: Joi.number().integer().min(0).required(),
      wife_address: Joi.string().required(),
      wife_occupation: Joi.string().max(255).required(),
      wife_religion: Joi.string().max(100).required(),
      wife_educational_attainment: Joi.string().max(100).required(),
      wife_citizenship: Joi.string().max(100).required(),
      wife_id_type: Joi.string().max(100).required(),
      wife_id_number: Joi.string().max(100).required(),
      wife_id_photo: Joi.string().required(),
      wife_4ps: Joi.boolean().required(),
      wife_pwd: Joi.boolean().required(),

      marriage_date: Joi.date().iso().allow(null),
      solemnizing_officer: Joi.string().max(255).allow('', null),
      main_contact: Joi.string().max(50).required(),
      backup_contact: Joi.string().max(50).required(),
      email: Joi.string().email().required()
    }).required(),
    answers: Joi.array().items(bookingAnswerItemSchema).min(1).required()
  })
};

// Reminder-type SMS events that are safe to re-send
const REMINDER_EVENT_TYPES = [
  'FP_REMINDER_2_DAYS',
  'FP_REMINDER_SAME_DAY',
  'PMO_REMINDER_2_DAYS',
  'PMO_REMINDER_SAME_DAY',
  'USAPAN_REMINDER_2_DAYS',
  'USAPAN_REMINDER_SAME_DAY',
  'FILETASK_OVERDUE_REMINDER'
];

const adminScheduleUpdateSchema = {
  body: Joi.object({
    description: Joi.string().allow('', null),
    // NOTE: `details` is not persisted in the current PmoSchedules schema;
    // we ignore it at the API level to avoid referencing a missing column.
    counselor: Joi.number().integer().min(1).allow(null),
    status: Joi.string().allow('', null),
    date: Joi.date().allow(null),
    start_time: Joi.string().allow('', null),
    end_time: Joi.string().allow('', null)
  })
};

router.get('/questionnaire', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "questionID", question_text, question_type, parent_question_id, sort_order FROM "PMO_Questionnaire" ORDER BY sort_order ASC, "questionID" ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /pmo/appointments/me - list PMO appointments for the logged-in user
router.get('/appointments/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT
         a."appointmentID" AS "appointmentId",
         a.status,
         a."referenceNumber" AS "referenceNumber",
         a.reject_reason AS "rejectReason",
         a.created_at,
         s.date AS "scheduleDate",
         s.start_time AS "scheduleStartTime",
         s.end_time AS "scheduleEndTime"
       FROM "PMO_Appointments" a
       JOIN "PmoSchedules" s ON s."pmoID" = a."scheduleId"
       WHERE a."userid" = $1
       ORDER BY s.date DESC, s.start_time DESC, a."appointmentID" DESC`,
      [userId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

const listSmsLogsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(25),
    eventType: Joi.string().allow('', null),
    status: Joi.string().valid('SENT', 'FAILED').allow('', null)
  })
};

// GET /pmo/admin/sms-logs - list SMS attempts with joined context
router.get(
  '/admin/sms-logs',
  authenticate,
  authorize(['Admin']),
  validate(listSmsLogsSchema),
  async (req, res, next) => {
    try {
      const { page, limit, eventType, status } = req.query;
      const offset = (page - 1) * limit;

      const values = [];
      const where = [];
      if (eventType) {
        values.push(eventType);
        where.push('l.event_type = $' + values.length);
      }
      if (status) {
        const successFlag = status === 'SENT';
        values.push(successFlag);
        where.push('l.success = $' + values.length);
      }
      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const countSql = `SELECT COUNT(*)::int AS count FROM "SMS_Logs" l ${whereClause}`;
      const count = await db.query(countSql, values);
      const total = count.rows[0]?.count || 0;

      values.push(limit);
      values.push(offset);

      const sql = `
        SELECT
          l.id,
          l.event_type AS "eventType",
          l.recipient,
          l.message,
          l.success,
          l.error_message AS "errorMessage",
          l.created_at AS "createdAt",
          l.appointment_id AS "appointmentId",
          l.couple_id AS "coupleId",
          a."referenceNumber" AS "referenceNumber",
          ct.main_contact AS "mainContact"
        FROM "SMS_Logs" l
        LEFT JOIN "PMO_Appointments" a ON a."appointmentID" = l.appointment_id
        LEFT JOIN "PMO_Couples" c ON c.couple_id = COALESCE(l.couple_id, a."coupleID")
        LEFT JOIN "PMO_Contacts" ct ON ct.couple_id = c.couple_id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`;
      const { rows } = await db.query(sql, values);

      res.json({ success: true, data: rows, meta: { page, limit, total } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /pmo/admin/db/import-sql - execute raw SQL script against the database
router.post(
  '/admin/db/import-sql',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const sqlText = req.body && typeof req.body.sql === 'string' ? req.body.sql : null;

      if (!sqlText || !sqlText.trim()) {
        client.release();
        return res.status(400).json({ success: false, message: 'SQL text is required for import.' });
      }

      await client.query('BEGIN');
      await client.query(sqlText);
      await client.query('COMMIT');

      return res.json({ success: true, data: { executed: true } });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failures
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

// POST /pmo/admin/db/import - restore database from JSON backup payload
router.post(
  '/admin/db/import',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const payload = req.body;

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid import payload.' });
      }

      const tablesNode = payload.tables && typeof payload.tables === 'object'
        ? payload.tables
        : null;

      if (!tablesNode) {
        return res.status(400).json({ success: false, message: 'No tables found in import payload.' });
      }

      const rawMode = String(payload.mode || 'replace').toLowerCase();
      const mode = rawMode === 'add' ? 'add' : 'replace';

      // Discover existing user tables so we only import into known tables.
      const tablesResult = await db.pool.query(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
          ORDER BY table_name ASC`
      );
      const existingTables = new Set(tablesResult.rows.map((r) => r.table_name).filter(Boolean));

      // Discover primary key columns for each table (used for duplicate detection in add mode).
      const pkResult = await db.pool.query(
        `SELECT tc.table_name, kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'`
      );
      const pkColumnsByTable = new Map();
      for (const row of pkResult.rows) {
        const name = row.table_name;
        const col = row.column_name;
        if (!name || !col) continue;
        if (!pkColumnsByTable.has(name)) pkColumnsByTable.set(name, []);
        pkColumnsByTable.get(name).push(col);
      }

      const entries = Object.entries(tablesNode).filter(([name]) => existingTables.has(name));
      if (!entries.length) {
        return res.status(400).json({ success: false, message: 'None of the tables in the backup match existing database tables.' });
      }

      await client.query('BEGIN');

      const summary = [];
      const skippedByTable = {};

      for (const [tableName, value] of entries) {
        let rows = [];
        if (value && typeof value === 'object' && Array.isArray(value.rows)) {
          rows = value.rows;
        } else if (Array.isArray(value)) {
          rows = value;
        }

        const pkCols = pkColumnsByTable.get(tableName) || [];

        if (mode === 'replace') {
          // Truncate the table before inserting new rows.
          await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);

          if (rows.length === 0) {
            summary.push({ table: tableName, rowCount: 0, skipped: 0 });
            continue;
          }

          // Insert rows one-by-one using parameterized queries.
          for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const columns = Object.keys(row);
            if (!columns.length) continue;

            const colList = columns.map((c) => `"${c}"`).join(', ');
            const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = columns.map((c) => row[c]);

            await client.query(
              `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`,
              values
            );
          }

          summary.push({ table: tableName, rowCount: rows.length, skipped: 0 });
        } else {
          // mode === 'add': only insert non-duplicates.
          let insertedCount = 0;
          let skippedCount = 0;
          const skippedRows = [];

          for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const columns = Object.keys(row);
            if (!columns.length) continue;

            // Build duplicate check WHERE clause.
            const keyColumns = pkCols.length ? pkCols : columns;
            const whereParts = [];
            const whereValues = [];
            keyColumns.forEach((colName) => {
              const val = row[colName];
              if (val === null || val === undefined) {
                whereParts.push(`"${colName}" IS NULL`);
              } else {
                whereValues.push(val);
                whereParts.push(`"${colName}" = $${whereValues.length}`);
              }
            });

            let isDuplicate = false;
            if (whereParts.length) {
              const dupSql = `SELECT 1 FROM "${tableName}" WHERE ${whereParts.join(' AND ')} LIMIT 1`;
              const dupRes = await client.query(dupSql, whereValues);
              isDuplicate = dupRes.rowCount > 0;
            }

            if (isDuplicate) {
              skippedCount += 1;
              if (skippedRows.length < 50) {
                skippedRows.push(row);
              }
              continue;
            }

            const colList = columns.map((c) => `"${c}"`).join(', ');
            const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = columns.map((c) => row[c]);

            await client.query(
              `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`,
              values
            );
            insertedCount += 1;
          }

          summary.push({ table: tableName, rowCount: insertedCount, skipped: skippedCount });
          if (skippedRows.length) {
            skippedByTable[tableName] = skippedRows;
          }
        }
      }

      await client.query('COMMIT');

      return res.json({ success: true, data: { mode, tables: summary, skipped: skippedByTable } });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failures
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

// Admin DB export (JSON or SQL)
router.get(
  '/admin/db/export',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const rawFormat = String(req.query.format || 'json').toLowerCase();
      const format = rawFormat === 'sql' ? 'sql' : 'json';
      const includeData = String(req.query.includeData || 'true').toLowerCase() !== 'false';

      // Discover all user tables in the public schema so we export everything.
      const tablesResult = await db.pool.query(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
          ORDER BY table_name ASC`
      );
      const TABLES = tablesResult.rows.map((r) => r.table_name).filter(Boolean);

      // Discover schema details: columns, primary keys, and foreign key relationships.
      const columnsResult = await db.pool.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position`
      );

      const pkResult = await db.pool.query(
        `SELECT tc.table_name, kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.constraint_type = 'PRIMARY KEY'`
      );

      const fkResult = await db.pool.query(
        `SELECT
           tc.table_name,
           kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage AS ccu
           ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'`
      );

      const tableSchemas = {};
      for (const tableName of TABLES) {
        tableSchemas[tableName] = {
          columns: [],
          primaryKey: [],
          foreignKeys: []
        };
      }

      for (const row of columnsResult.rows) {
        const name = row.table_name;
        if (!tableSchemas[name]) continue;
        tableSchemas[name].columns.push({
          name: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === 'YES',
          default: row.column_default || null
        });
      }

      for (const row of pkResult.rows) {
        const name = row.table_name;
        if (!tableSchemas[name]) continue;
        tableSchemas[name].primaryKey.push(row.column_name);
      }

      for (const row of fkResult.rows) {
        const name = row.table_name;
        if (!tableSchemas[name]) continue;
        tableSchemas[name].foreignKeys.push({
          column: row.column_name,
          referencesTable: row.foreign_table_name,
          referencesColumn: row.foreign_column_name
        });
      }

      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

      if (format === 'json') {
        const tablesPayload = {};

        for (const tableName of TABLES) {
          if (!includeData) {
            // Structure-only export: always include an empty rows array so imports remain compatible.
            tablesPayload[tableName] = { rows: [] };
            continue;
          }

          try {
            const { rows } = await db.query(`SELECT * FROM "${tableName}"`);
            tablesPayload[tableName] = { rows };
          } catch (e) {
            // If a table is missing in this environment, skip it gracefully.
            console.error('DB export JSON: failed to read table', tableName, e?.message || e);
            tablesPayload[tableName] = { rows: [], error: e?.message || String(e) };
          }
        }

        const payload = {
          meta: {
            format: 'json',
            includeData,
            exportedAt: new Date().toISOString(),
            tables: TABLES,
            tableSchemas
          },
          tables: tablesPayload
        };

        const filename = `population-office-backup-${timestamp}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(JSON.stringify(payload, null, 2));
      }

      // SQL export
      const chunks = [];
      chunks.push('-- Population Office backup');
      chunks.push(`-- Exported at ${new Date().toISOString()}`);
      chunks.push('BEGIN;');

      const sqlEscapeLiteral = (value) => {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        const str = String(value);
        // Escape single quotes by doubling them
        return "'" + str.replace(/'/g, "''") + "'";
      };

      for (const tableName of TABLES) {
        if (!includeData) {
          continue;
        }

        let rows;
        try {
          const result = await db.query(`SELECT * FROM "${tableName}"`);
          rows = result.rows;
        } catch (e) {
          console.error('DB export SQL: failed to read table', tableName, e?.message || e);
          continue;
        }

        if (!rows || !rows.length) continue;

        for (const row of rows) {
          const columns = Object.keys(row);
          if (!columns.length) continue;
          const colList = columns.map((c) => `"${c}"`).join(', ');
          const valuesList = columns.map((c) => sqlEscapeLiteral(row[c])).join(', ');
          chunks.push(`INSERT INTO "${tableName}" (${colList}) VALUES (${valuesList});`);
        }
      }

      chunks.push('COMMIT;');
      const sqlText = chunks.join('\n');
      const filename = `population-office-backup-${timestamp}.sql`;
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(sqlText);
    } catch (err) {
      next(err);
    }
  }
);

// GET /pmo/admin/sms-logs/failed-count - total number of failed SMS attempts
router.get(
  '/admin/sms-logs/failed-count',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const result = await db.query(
        'SELECT COUNT(*)::int AS count FROM "SMS_Logs" WHERE success = FALSE'
      );
      const count = result.rows[0]?.count || 0;
      return res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /pmo/admin/sms-logs/:id/resend - manually re-send a specific reminder SMS
router.post(
  '/admin/sms-logs/:id/resend',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid SMS log id.' });
      }

      const existingResult = await db.query(
        'SELECT * FROM "SMS_Logs" WHERE id = $1 LIMIT 1',
        [id]
      );
      const logRow = existingResult.rows[0];
      if (!logRow) {
        return res.status(404).json({ success: false, message: 'SMS log not found.' });
      }

      const eventType = String(logRow.event_type || '').trim();
      const recipient = String(logRow.recipient || '').trim();
      const message = String(logRow.message || '').trim();

      if (!recipient || !message) {
        return res.status(400).json({ success: false, message: 'SMS log has no recipient or message to resend.' });
      }

      // Only allow manual resend for known reminder-related events
      if (!REMINDER_EVENT_TYPES.includes(eventType)) {
        return res.status(400).json({ success: false, message: 'This SMS event type cannot be resent from the dashboard.' });
      }

      const smsResult = await sendSMS(recipient, message);

      // Update the existing log entry instead of inserting a new row,
      // so the table reflects the latest status without growing unbounded.
      const updateResult = await db.query(
        `UPDATE "SMS_Logs"
           SET success = $1,
               provider_response = $2,
               error_message = $3,
               created_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          Boolean(smsResult.success),
          smsResult.success ? (smsResult.data || null) : (smsResult.error?.data || null),
          smsResult.success ? null : (smsResult.error?.message || null),
          id
        ]
      );

      const updatedRow = updateResult.rows[0] || logRow;

      return res.json({
        success: true,
        data: updatedRow
      });
    } catch (err) {
      next(err);
    }
  }
);

function parseBase64ToBuffer(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^data:.*?;base64,(.*)$/);
  const raw = m ? m[1] : trimmed;
  try {
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}

async function uploadPmoIdToSupabase(base64OrDataUrl, role) {
  if (!base64OrDataUrl || typeof base64OrDataUrl !== 'string') return null;

  const buffer = parseBase64ToBuffer(base64OrDataUrl);
  if (!buffer) return null;

  const supabase = getSupabaseClient();
  const bucket = 'ids';

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const safeRole = role && typeof role === 'string' ? role.toLowerCase() : 'id';
  const fileName = `${Date.now()}-${safeRole}.jpg`;
  const path = `${year}/${month}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: false
  });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl || null;
  return publicUrl;
}

async function logPmoSmsAttempt({
  appointmentId,
  coupleId,
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
        appointmentId || null,
        coupleId || null,
        String(eventType || 'UNKNOWN'),
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null
      ]
    );
  } catch (e) {
    console.error('Failed to write PMO SMS log:', e?.message || e);
  }
}

async function markPmoNotificationSent(appointmentId) {
  if (!appointmentId) return;
  try {
    await db.query(
      'UPDATE "PMO_Appointments" SET "notificationSent" = TRUE WHERE "appointmentID" = $1',
      [appointmentId]
    );
  } catch (e) {
    console.error('Failed to update PMO notificationSent:', e?.message || e);
  }
}

async function getPmoSmsContext(appointmentId) {
  const result = await db.query(
    `SELECT
       a."appointmentID" AS "appointmentID",
       a."referenceNumber" AS "referenceNumber",
       a.status AS status,
       a.reject_reason AS "rejectReason",
       a."coupleID" AS "coupleID",
       h.name AS "husbandName",
       w.name AS "wifeName",
       ct.email AS email,
       ct.main_contact AS "mainContact",
       s.date AS "scheduleDate",
       s.start_time AS "scheduleStartTime",
       s.end_time AS "scheduleEndTime",
       s.location AS "scheduleLocation",
       r.counselor_name AS "counselorName"
     FROM "PMO_Appointments" a
     JOIN "PMO_Couples" c ON c.couple_id = a."coupleID"
     LEFT JOIN "PMO_Contacts" ct ON ct.couple_id = c.couple_id
     LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
     LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
     JOIN "PmoSchedules" s ON s."pmoID" = a."scheduleId"
     LEFT JOIN "Counselors" r ON r."counselorID" = a."counselorId"
     WHERE a."appointmentID" = $1`,
    [appointmentId]
  );
  return result.rows[0] || null;
}

function getPmoFullName(ctx) {
  const husband = ctx?.husbandName ? String(ctx.husbandName).trim() : '';
  const wife = ctx?.wifeName ? String(ctx.wifeName).trim() : '';
  if (husband && wife) return `${husband} & ${wife}`;
  return husband || wife || 'Client';
}

function formatScheduleDateTime(ctx) {
  const date = ctx?.scheduleDate ? new Date(ctx.scheduleDate) : null;
  const scheduleDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const st = ctx?.scheduleStartTime ? String(ctx.scheduleStartTime).slice(0, 5) : null;
  const et = ctx?.scheduleEndTime ? String(ctx.scheduleEndTime).slice(0, 5) : null;
  const scheduleTime = st && et ? `${st} - ${et}` : (st || et || null);
  return { scheduleDate, scheduleTime };
}

function applyStandardPlaceholders(template, ctx) {
  const { scheduleDate, scheduleTime } = formatScheduleDateTime(ctx);
  const husband = ctx?.husbandName ? String(ctx.husbandName).trim() : '';
  const wife = ctx?.wifeName ? String(ctx.wifeName).trim() : '';
  const fullName = getPmoFullName(ctx);
  const status = ctx?.status ? String(ctx.status) : '';
  const rejectReason = ctx?.rejectReason ? String(ctx.rejectReason) : '';

  const counselorName = ctx?.counselorName ? String(ctx.counselorName).trim() : '';
  const scheduleLocation = ctx?.scheduleLocation ? String(ctx.scheduleLocation).trim() : '';

  const scheduleParts = [];
  if (scheduleDate) scheduleParts.push(scheduleDate);
  if (scheduleTime) scheduleParts.push(scheduleTime);
  if (counselorName) scheduleParts.push(`Counselor: ${counselorName}`);
  if (scheduleLocation) scheduleParts.push(`Location: ${scheduleLocation}`);
  const scheduleDetails = scheduleParts.join(' | ');

  const isApproved = String(status).toUpperCase() === 'APPROVED';
  const rawRef = ctx?.referenceNumber || ctx?.appointmentID || '';
  const referenceNumber = isApproved && rawRef ? String(rawRef) : '';
  const referenceLine = referenceNumber ? `Reference No.: ${referenceNumber}` : '';

  const namesLine = [husband, wife].some(Boolean)
    ? `Husband: ${husband || 'N/A'}\nWife: ${wife || 'N/A'}`
    : '';
  const scheduleLine = scheduleDetails ? `Schedule: ${scheduleDetails}` : '';

  return String(template)
    .replaceAll('{full_name}', fullName)
    .replaceAll('{husband_name}', husband)
    .replaceAll('{wife_name}', wife)
    .replaceAll('{names_line}', namesLine)
    .replaceAll('{reference_number}', referenceNumber)
    .replaceAll('{reference_number_line}', referenceLine)
    .replaceAll('{schedule_date}', scheduleDate || 'TBA')
    .replaceAll('{schedule_time}', scheduleTime || 'TBA')
    .replaceAll('{schedule_details}', scheduleDetails)
    .replaceAll('{schedule_line}', scheduleLine)
    .replaceAll('{status}', status)
    .replaceAll('{reject_reason}', rejectReason);
}

function getPmoEmailSubject(eventType) {
  if (eventType === 'BOOKING_CONFIRMATION') return 'PMO Appointment Confirmation';
  if (eventType === 'PMO_STATUS_APPROVED') return 'PMO Appointment Status Update';
  if (eventType === 'PMO_STATUS_REJECTED') return 'PMO Appointment Rejected';
  if (eventType === 'PMO_STATUS_CANCELLED') return 'PMO Appointment Cancelled';
  return 'PMO Appointment Status Update';
}

async function sendPmoStatusSmsNonBlocking(appointmentId, eventType, buildMessage) {
  setImmediate(async () => {
    try {
      const ctx = await getPmoSmsContext(appointmentId);
      if (!ctx) return;

      const recipient = String(ctx.mainContact || '').trim();
      const email = ctx.email ? String(ctx.email).trim() : '';

      const rawMessage = buildMessage(ctx);
      const message = applyStandardPlaceholders(rawMessage, ctx);

      let smsResult = { success: false, error: { message: 'Phone number is required.' } };
      if (recipient) {
        smsResult = await sendSMS(recipient, message);
        await logPmoSmsAttempt({
          appointmentId: ctx.appointmentID,
          coupleId: ctx.coupleID,
          eventType,
          recipient,
          message,
          success: smsResult.success,
          providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
          errorMessage: smsResult.success ? null : smsResult.error?.message
        });
      }

      if (email && isValidEmail(email)) {
        const subject = getPmoEmailSubject(eventType);
        const emailResult = await sendEmail(email, subject, message);
        if (!emailResult.success) {
          console.error('PMO Email send failed:', emailResult.error?.message || emailResult.error || emailResult);
        }
      }

      if (smsResult.success) {
        await markPmoNotificationSent(ctx.appointmentID);
      }
    } catch (e) {
      console.error('PMO SMS send failed:', e?.message || e);
    }
  });
}

router.get('/admin/appointments', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    // Auto-reject any appointments whose schedule date is today and are still pending.
    // This keeps the dashboard in sync without requiring a manual admin action.
    const autoRejectReason =
      'We are sorry to inform you that the schedule you chose was stopped. Please select a new schedule.';
    await db.query(
      `UPDATE "PMO_Appointments" a
         SET status = 'REJECTED',
             reject_reason = $1,
             "referenceNumber" = NULL
       FROM "PmoSchedules" s
       WHERE a."scheduleId" = s."pmoID"
         AND s.date = CURRENT_DATE
         AND a.status = 'PENDING'`,
      [autoRejectReason]
    );

    // Auto-complete any APPROVED appointments whose schedule date/time has already passed.
    await db.query(
      `UPDATE "PMO_Appointments" a
          SET status = 'COMPLETED'
        FROM "PmoSchedules" s
        WHERE a."scheduleId" = s."pmoID"
          AND a.status = 'APPROVED'
          AND (
            s.date < CURRENT_DATE
            OR (
              s.date = CURRENT_DATE
              AND COALESCE(s.end_time, s.start_time) <= (NOW() AT TIME ZONE 'Asia/Manila')::time
            )
          )`
    );

    const sql = `
      SELECT
        a."appointmentID",
        a."referenceNumber",
        a.status,
        a."notificationSent",
        a.created_at,
        a.reject_reason,
        a."coupleID",
        a."scheduleId" AS "scheduleId",
        a."counselorId",

        -- Husband
        h.name            AS husband_name,
        h.birthday        AS husband_birthday,
        EXTRACT(YEAR FROM age(h.birthday))::int AS husband_age,
        h.address         AS husband_address,
        h.occupation      AS husband_occupation,
        h.religion        AS husband_religion,
        h.educational_attainment AS husband_educational_attainment,
        h.citizenship     AS husband_citizenship,
        h.id_type         AS husband_id_type,
        h.id_number       AS husband_id_number,
        h.photo_url       AS husband_id_photo,
        h.is_4ps          AS husband_4ps,
        h.is_pwd          AS husband_pwd,

        -- Wife
        w.name            AS wife_name,
        w.birthday        AS wife_birthday,
        EXTRACT(YEAR FROM age(w.birthday))::int AS wife_age,
        w.address         AS wife_address,
        w.occupation      AS wife_occupation,
        w.religion        AS wife_religion,
        w.educational_attainment AS wife_educational_attainment,
        w.citizenship     AS wife_citizenship,
        w.id_type         AS wife_id_type,
        w.id_number       AS wife_id_number,
        w.photo_url       AS wife_id_photo,
        w.is_4ps          AS wife_4ps,
        w.is_pwd          AS wife_pwd,

        c.marriage_date,
        c.solemnizing_officer   AS solemnizing_officer,
        ct.main_contact,
        ct.backup_contact,
        ct.email,
        s.date AS "scheduleDate",
        s.start_time AS "scheduleStartTime",
        s.end_time AS "scheduleEndTime",
        r.counselor_name AS "counselorName"
      FROM "PMO_Appointments" a
      JOIN "PMO_Couples" c ON c.couple_id = a."coupleID"
      LEFT JOIN "PMO_Contacts" ct ON ct.couple_id = c.couple_id
      LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
      LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
      JOIN "PmoSchedules" s ON s."pmoID" = a."scheduleId"
      LEFT JOIN "Counselors" r ON r."counselorID" = a."counselorId"
      ORDER BY a."appointmentID" DESC`;
    const { rows } = await db.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /pmo/admin/appointments/:id/accept - approve appointment and assign reference number per year sequence
router.post('/admin/appointments/:id/accept', authenticate, authorize(['Admin']), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const appt = await client.query(
      `SELECT a."appointmentID", a.status, a."scheduleId", a.created_at, a."referenceNumber"
       FROM "PMO_Appointments" a
       WHERE a."appointmentID" = $1
       FOR UPDATE`,
      [id]
    );
    if (appt.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    const createdAt = appt.rows[0].created_at;
    const year = Number(new Date(createdAt).getFullYear());

    // Compute next reference number for this year based on current max
    const refPrefix = `${year}-`;
    const maxRes = await client.query(
      `SELECT MAX(CAST(split_part("referenceNumber", '-', 2) AS int)) AS max_n
       FROM "PMO_Appointments"
       WHERE "referenceNumber" LIKE $1`,
      [`${refPrefix}%`]
    );
    const maxN = maxRes.rows[0]?.max_n || 0;
    const nextN = Number(maxN) + 1;
    const nextRef = `${year}-${nextN}`;

    // Approve and assign reference number for this single appointment
    await client.query(
      'UPDATE "PMO_Appointments" SET status = $1, reject_reason = NULL, "referenceNumber" = $2 WHERE "appointmentID" = $3',
      ['APPROVED', nextRef, id]
    );

    await client.query('COMMIT');

    sendPmoStatusSmsNonBlocking(id, 'PMO_STATUS_APPROVED', (ctx) =>
      pmoSmsTemplates.accepted({
        referenceNumber: ctx.referenceNumber,
        appointmentId: ctx.appointmentID,
        date: ctx.scheduleDate,
        startTime: ctx.scheduleStartTime,
        endTime: ctx.scheduleEndTime
      })
    );

    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    res.json({ success: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /pmo/admin/appointments/:id/archive - soft-archive appointment (hide from active lists)
router.patch('/admin/appointments/:id/archive', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE "PMO_Appointments" SET status = $1 WHERE "appointmentID" = $2 RETURNING "appointmentID"',
      ['ARCHIVED', id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }
    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /pmo/admin/appointments/:id/unarchive - restore archived appointment back to PENDING
router.patch('/admin/appointments/:id/unarchive', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE "PMO_Appointments" SET status = $1 WHERE "appointmentID" = $2 RETURNING "appointmentID"',
      ['PENDING', id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }
    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /pmo/admin/appointments/:id/cancel - cancel appointment (with optional reason) and resequence numbers
router.post('/admin/appointments/:id/cancel', authenticate, authorize(['Admin']), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    await client.query('BEGIN');

    const appt = await client.query(
      `SELECT a."appointmentID", a.status, a."scheduleId", a.created_at
       FROM "PMO_Appointments" a
       WHERE a."appointmentID" = $1
       FOR UPDATE`,
      [id]
    );
    if (appt.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    await client.query(
      'UPDATE "PMO_Appointments" SET status = $1, reject_reason = $2, "referenceNumber" = NULL WHERE "appointmentID" = $3',
      ['CANCELLED', reason ? String(reason).trim() : null, id]
    );

    await client.query('COMMIT');

    sendPmoStatusSmsNonBlocking(id, 'PMO_STATUS_CANCELLED', (ctx) =>
      pmoSmsTemplates.cancelled({
        rejectReason: ctx.rejectReason
      })
    );

    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    res.json({ success: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
});

// POST /pmo/admin/appointments/:id/reject - reject appointment with reason and resequence numbers
router.post('/admin/appointments/:id/reject', authenticate, authorize(['Admin']), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Reject reason is required' } });
    }

    await client.query('BEGIN');

    const appt = await client.query(
      `SELECT a."appointmentID", a.status, a."scheduleId", a.created_at
       FROM "PMO_Appointments" a
       WHERE a."appointmentID" = $1
       FOR UPDATE`,
      [id]
    );
    if (appt.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    const createdAt = appt.rows[0].created_at;
    const year = Number(new Date(createdAt).getFullYear());

    // Mark as REJECTED and store reason (assumes column reject_reason exists). We clear referenceNumber for this
    // appointment but do NOT resequence others to avoid duplicate key issues.
    await client.query(
      'UPDATE "PMO_Appointments" SET status = $1, reject_reason = $2, "referenceNumber" = NULL WHERE "appointmentID" = $3',
      ['REJECTED', reason, id]
    );

    await client.query('COMMIT');

    sendPmoStatusSmsNonBlocking(id, 'PMO_STATUS_REJECTED', (ctx) =>
      pmoSmsTemplates.rejected({
        referenceNumber: ctx.referenceNumber,
        appointmentId: ctx.appointmentID,
        rejectReason: ctx.rejectReason
      })
    );

    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    res.json({ success: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         s."pmoID" AS id,
         'Pre-Marriage Orientation'::text AS type,
         s.date,
         NULL::text AS title,
         s.start_time,
         s.end_time,
         s.status,
         c.counselor_name
       FROM "PmoSchedules" s
       LEFT JOIN "Counselors" c ON c."counselorID" = s.counselor
       ORDER BY s.date ASC, s.start_time ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error loading PMO schedules:', err?.message || err);
    res.status(500).json({ success: false, error: { message: 'Failed to load schedules' } });
  }
});

const adminQuestionSchema = {
  body: Joi.object({
    question_text: Joi.string().required(),
    question_type: Joi.string().valid('Standalone', 'Filler', 'Sub-question').required(),
    parent_question_id: Joi.number().integer().min(1).allow(null),
    sort_order: Joi.number().integer().min(0).default(0)
  })
};

async function assertParentIsFiller(client, parentQuestionId) {
  if (!parentQuestionId) return;
  const parent = await client.query(
    'SELECT question_type FROM "PMO_Questionnaire" WHERE "questionID" = $1',
    [parentQuestionId]
  );
  if (parent.rowCount === 0) {
    const err = new Error('Parent question not found');
    err.status = 400;
    throw err;
  }
  if (parent.rows[0].question_type !== 'Filler') {
    const err = new Error('Parent question must be a Filler');
    err.status = 400;
    throw err;
  }
}

async function nextFreeSortOrder(client, parentQuestionId, desiredSortOrder, excludeQuestionId) {
  let order = Number.isInteger(desiredSortOrder) ? desiredSortOrder : 0;

  // Enforce uniqueness within same hierarchy level (same parent_question_id)
  // If duplicate exists, bump by +1 until free.
  while (true) {
    const conflict = await client.query(
      `SELECT 1
       FROM "PMO_Questionnaire"
       WHERE parent_question_id IS NOT DISTINCT FROM $1
         AND sort_order = $2
         AND ("questionID" <> $3)
       LIMIT 1`,
      [parentQuestionId || null, order, excludeQuestionId || 0]
    );
    if (conflict.rowCount === 0) return order;
    order += 1;
  }
}

// Public read-only questionnaire endpoint for MEIF preview in services
router.get('/questionnaire', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "questionID", question_text, question_type, parent_question_id, sort_order FROM "PMO_Questionnaire" ORDER BY sort_order ASC, "questionID" ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/questionnaire', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT "questionID", question_text, question_type, parent_question_id, sort_order FROM "PMO_Questionnaire" ORDER BY sort_order ASC, "questionID" ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/admin/questionnaire',
  authenticate,
  authorize(['Admin']),
  validate(adminQuestionSchema),
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { question_text, question_type } = req.body;
      let { parent_question_id, sort_order } = req.body;

      if (question_type === 'Sub-question') {
        if (!parent_question_id) {
          return res.status(400).json({ success: false, error: { message: 'Parent question is required for Sub-question' } });
        }
        await assertParentIsFiller(client, parent_question_id);
      }

      if (question_type === 'Standalone' && parent_question_id) {
        await assertParentIsFiller(client, parent_question_id);
      }

      if (question_type === 'Filler' && parent_question_id) {
        await assertParentIsFiller(client, parent_question_id);
      }

      await client.query('BEGIN');

      const resolvedSortOrder = await nextFreeSortOrder(client, parent_question_id, sort_order, null);

      const result = await client.query(
        `INSERT INTO "PMO_Questionnaire" (question_text, question_type, parent_question_id, sort_order)
         VALUES ($1,$2,$3,$4)
         RETURNING "questionID", question_text, question_type, parent_question_id, sort_order`,
        [question_text, question_type, parent_question_id || null, resolvedSortOrder]
      );

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

router.put(
  '/admin/questionnaire/:id',
  authenticate,
  authorize(['Admin']),
  validate(adminQuestionSchema),
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { id } = req.params;
      const { question_text, question_type } = req.body;
      let { parent_question_id, sort_order } = req.body;

      const existing = await client.query('SELECT 1 FROM "PMO_Questionnaire" WHERE "questionID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Question not found' } });
      }

      if (question_type === 'Sub-question') {
        if (!parent_question_id) {
          return res.status(400).json({ success: false, error: { message: 'Parent question is required for Sub-question' } });
        }
        await assertParentIsFiller(client, parent_question_id);
      }

      if (question_type === 'Standalone' && parent_question_id) {
        await assertParentIsFiller(client, parent_question_id);
      }

      if (question_type === 'Filler' && parent_question_id) {
        await assertParentIsFiller(client, parent_question_id);
      }

      await client.query('BEGIN');

      const resolvedSortOrder = await nextFreeSortOrder(client, parent_question_id, sort_order, Number(id));

      const result = await client.query(
        `UPDATE "PMO_Questionnaire"
         SET question_text = $1,
             question_type = $2,
             parent_question_id = $3,
             sort_order = $4
         WHERE "questionID" = $5
         RETURNING "questionID", question_text, question_type, parent_question_id, sort_order`,
        [question_text, question_type, parent_question_id || null, resolvedSortOrder, id]
      );

      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

router.delete('/admin/questionnaire/:id', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM "PMO_Questionnaire" WHERE "questionID" = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Question not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/admin/schedules', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         s."pmoID" AS id,
         'Pre-Marriage Orientation'::text AS type,
         s.date,
         NULL::text AS title,
         s.start_time,
         s.end_time,
         s.status,
         s.location AS description,
         s.counselor,
         c.counselor_name
       FROM "PmoSchedules" s
       LEFT JOIN "Counselors" c ON c."counselorID" = s.counselor
       ORDER BY s.date DESC, s.start_time DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/admin/schedules/:id',
  authenticate,
  authorize(['Admin']),
  validate(adminScheduleUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { description, counselor, status, date, start_time, end_time } = req.body || {};

      const existing = await db.query('SELECT 1 FROM "PmoSchedules" WHERE "pmoID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
      }

      await db.query(
        `UPDATE "PmoSchedules"
         SET location = COALESCE($1, location),
             counselor = COALESCE($2, counselor),
             status = COALESCE($3, status),
             date = COALESCE($4, date),
             start_time = COALESCE($5, start_time),
             end_time = COALESCE($6, end_time)
         WHERE "pmoID" = $7`,
        [
          description ?? null,
          counselor ?? null,
          status ?? null,
          date ?? null,
          start_time ?? null,
          end_time ?? null,
          id
        ]
      );

      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// Keep hard delete route for safety, but UI should prefer archive instead of delete
router.delete(
  '/admin/schedules/:id',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM "PmoSchedules" WHERE "pmoID" = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
      }
      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// Admin: archive PMO schedule (soft delete via status)
router.patch(
  '/admin/schedules/:id/archive',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE "PmoSchedules" SET status = $1 WHERE "pmoID" = $2',
        ['Archived', id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
      }
      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      return res.json({ success: true, data: { id: Number(id) } });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: unarchive PMO schedule (restore to Scheduled)
router.patch(
  '/admin/schedules/:id/unarchive',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE "PmoSchedules" SET status = $1 WHERE "pmoID" = $2',
        ['Scheduled', id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
      }
      const io = req.app.get('io'); if (io) io.emit('pmo:updated');
      return res.json({ success: true, data: { id: Number(id) } });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/admin/bookings', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         c.couple_id AS "coupleID",
         h.name AS husband_name,
         w.name AS wife_name,
         c.marriage_date,
         c.solemnizing_officer,
         ct.main_contact,
         ct.backup_contact,
         ct.email,
         NULL::jsonb AS schedule_details,
         c.created_at,
         (
           SELECT a."referenceNumber"
           FROM "PMO_Appointments" a
           WHERE a."coupleID" = c.couple_id AND a."referenceNumber" IS NOT NULL
           ORDER BY a.created_at DESC, a."appointmentID" DESC
           LIMIT 1
         ) AS "referenceNumber"
       FROM "PMO_Couples" c
       LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
       LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
       LEFT JOIN "PMO_Contacts" ct ON ct.couple_id = c.couple_id
       ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /pmo/admin/appointments/:id/meif - fetch MEIF data for a specific appointment
// `id` here is the appointmentID. We resolve the related coupleID from the appointment
// and then load their MEIF answers.
router.get(
  '/admin/appointments/:id/meif',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Load appointment with joined couple and schedule info
      const apptSql = `
        SELECT
          a."appointmentID",
          a."coupleID",
          a."scheduleId" AS "scheduleId",
          a.status,
          a."referenceNumber",
          a.created_at,

          -- Husband from PMO_Persons
          h.name            AS husband_name,
          h.birthday        AS husband_birthday,
          EXTRACT(YEAR FROM age(h.birthday))::int AS husband_age,
          h.address         AS husband_address,
          h.occupation      AS husband_occupation,
          h.religion        AS husband_religion,
          h.educational_attainment AS husband_educational_attainment,
          h.citizenship     AS husband_citizenship,
          h.is_4ps          AS husband_4ps,
          h.is_pwd          AS husband_pwd,

          -- Wife from PMO_Persons
          w.name            AS wife_name,
          w.birthday        AS wife_birthday,
          EXTRACT(YEAR FROM age(w.birthday))::int AS wife_age,
          w.address         AS wife_address,
          w.occupation      AS wife_occupation,
          w.religion        AS wife_religion,
          w.educational_attainment AS wife_educational_attainment,
          w.citizenship     AS wife_citizenship,
          w.is_4ps          AS wife_4ps,
          w.is_pwd          AS wife_pwd,

          s.date AS "scheduleDate",
          s.start_time AS "scheduleStartTime",
          s.end_time AS "scheduleEndTime"
        FROM "PMO_Appointments" a
        JOIN "PMO_Couples" c ON c.couple_id = a."coupleID"
        LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
        LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
        LEFT JOIN "PmoSchedules" s ON s."pmoID" = a."scheduleId"
        WHERE a."appointmentID" = $1
        LIMIT 1`;

      const apptResult = await db.query(apptSql, [id]);
      if (apptResult.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
      }

      const apptRow = apptResult.rows[0];
      const coupleId = apptRow.coupleID;

      // Load MEIF questions with any existing answers for this couple.
      // We use PMO_Questionnaire as the base so that all questions are
      // returned even if answers have not yet been stored.
      const answersSql = `
        SELECT
          q."questionID",
          q.question_text,
          q.question_type,
          q.parent_question_id,
          a.answer,
          a.reason,
          a."isHusband"
        FROM "PMO_Questionnaire" q
        LEFT JOIN "PMO_Answers" a
          ON a."questionID" = q."questionID" AND a."coupleID" = $1
        ORDER BY q.sort_order ASC, q."questionID" ASC`;

      const answersResult = await db.query(answersSql, [coupleId]);

      const couple = {
        coupleID: coupleId,
        husband_name: apptRow.husband_name,
        husband_birthday: apptRow.husband_birthday,
        husband_age: apptRow.husband_age,
        husband_address: apptRow.husband_address,
        husband_occupation: apptRow.husband_occupation,
        husband_religion: apptRow.husband_religion,
        husband_educational_attainment: apptRow.husband_educational_attainment,
        husband_citizenship: apptRow.husband_citizenship,
        husband_4ps: apptRow.husband_4ps,
        husband_pwd: apptRow.husband_pwd,
        wife_name: apptRow.wife_name,
        wife_birthday: apptRow.wife_birthday,
        wife_age: apptRow.wife_age,
        wife_address: apptRow.wife_address,
        wife_occupation: apptRow.wife_occupation,
        wife_religion: apptRow.wife_religion,
        wife_educational_attainment: apptRow.wife_educational_attainment,
        wife_citizenship: apptRow.wife_citizenship,
        wife_4ps: apptRow.wife_4ps,
        wife_pwd: apptRow.wife_pwd
      };

      const appointment = {
        appointmentID: apptRow.appointmentID,
        coupleID: coupleId,
        scheduleId: apptRow.scheduleId,
        status: apptRow.status,
        referenceNumber: apptRow.referenceNumber,
        created_at: apptRow.created_at,
        scheduleDate: apptRow.scheduleDate,
        scheduleStartTime: apptRow.scheduleStartTime,
        scheduleEndTime: apptRow.scheduleEndTime
      };

      return res.json({
        success: true,
        data: {
          appointment,
          couple,
          answers: answersResult.rows
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/admin/answers', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         c.couple_id AS "coupleID",
         h.name AS husband_name,
         w.name AS wife_name,
         c.created_at,
         (
           SELECT a."referenceNumber"
           FROM "PMO_Appointments" a
           WHERE a."coupleID" = c.couple_id AND a."referenceNumber" IS NOT NULL
           ORDER BY a.created_at DESC, a."appointmentID" DESC
           LIMIT 1
         ) AS "referenceNumber",
         COALESCE(
           json_agg(
             json_build_object(
               'questionID', q."questionID",
               'question_text', q.question_text,
               'question_type', q.question_type,
               'isHusband', a."isHusband",
               'answer', a.answer,
               'reason', a.reason
             )
             ORDER BY q.sort_order ASC, q."questionID" ASC
           ) FILTER (WHERE q."questionID" IS NOT NULL),
           '[]'::json
         ) AS answers
       FROM "PMO_Couples" c
       LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
       LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
       LEFT JOIN "PMO_Answers" a ON a."coupleID" = c.couple_id
       LEFT JOIN "PMO_Questionnaire" q ON q."questionID" = a."questionID"
       GROUP BY c.couple_id, h.name, w.name, c.created_at
       ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/analytics', authenticate, authorize(['Admin']), async (req, res, next) => {
  try {
    const totalBookings = await db.query('SELECT COUNT(*)::int AS count FROM "PMO_Couples"');

    const schedulesMonthly = await db.query(
      `SELECT
         date_trunc('month', date) AS month,
         COUNT(*)::int AS count
       FROM "PmoSchedules"
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`
    );

    const appointmentsMonthly = await db.query(
      `SELECT
         date_trunc('month', created_at) AS month,
         COUNT(*)::int AS count
       FROM "PMO_Appointments"
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`
    );

    const appointmentStatusCounts = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM "PMO_Appointments"
       GROUP BY status
       ORDER BY status ASC`
    );

    const appointmentsMonthlyByStatus = await db.query(
      `SELECT date_trunc('month', created_at) AS month,
              status,
              COUNT(*)::int AS count
       FROM "PMO_Appointments"
       WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '11 months'
       GROUP BY 1,2
       ORDER BY 1 DESC, 2 ASC`
    );

    const schedulesYearly = await db.query(
      `SELECT
         date_trunc('year', date) AS year,
         COUNT(*)::int AS count
       FROM "PmoSchedules"
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 5`
    );

    const appointmentsYearly = await db.query(
      `SELECT
         date_trunc('year', created_at) AS year,
         COUNT(*)::int AS count
       FROM "PMO_Appointments"
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 5`
    );

    const appointmentsYearlyByStatus = await db.query(
      `SELECT date_trunc('year', created_at) AS year,
              status,
              COUNT(*)::int AS count
       FROM "PMO_Appointments"
       WHERE created_at >= date_trunc('year', NOW()) - INTERVAL '4 years'
       GROUP BY 1,2
       ORDER BY 1 DESC, 2 ASC`
    );

    const scheduleStatusCounts = await db.query(
      `SELECT
         CASE
           WHEN status = 'Cancelled' THEN 'Cancelled'
           WHEN date < CURRENT_DATE
             OR (date = CURRENT_DATE AND COALESCE(end_time, start_time) <= (NOW() AT TIME ZONE 'Asia/Manila')::time)
             THEN 'Completed'
           ELSE 'Scheduled'
         END AS status,
         COUNT(*)::int AS count
       FROM "PmoSchedules"
       GROUP BY 1`
    );

    const counselorsCount = await db.query(
      'SELECT COUNT(*)::int AS count FROM "Counselors"'
    );

    res.json({
      success: true,
      data: {
        totalBookings: totalBookings.rows[0]?.count || 0,
        schedulesMonthly: schedulesMonthly.rows,
        appointmentsMonthly: appointmentsMonthly.rows,
        appointmentStatusCounts: appointmentStatusCounts.rows,
        schedulesYearly: schedulesYearly.rows,
        appointmentsYearly: appointmentsYearly.rows,
        appointmentsMonthlyByStatus: appointmentsMonthlyByStatus.rows,
        appointmentsYearlyByStatus: appointmentsYearlyByStatus.rows,
        scheduleStatusCounts: scheduleStatusCounts.rows,
        counselorsCount: counselorsCount.rows[0]?.count || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// Public PMO booking endpoint used by the frontend wizard.
// Must be authenticated so we can associate the appointment with the logged-in user.
router.post('/bookings', authenticate, validate(bookingSchema), async (req, res, next) => {
  const client = await db.pool.connect();

  try {
    const { schedule, personalInfo, answers } = req.body;

    // Associate this booking with the current user (if any)
    const userId = req.user && req.user.id ? req.user.id : null;

    console.log('PMO /bookings received payload:', {
      answersCount: Array.isArray(answers) ? answers.length : 0,
    });

    // Upload ID photos to Supabase "ids" bucket and store only the public URL
    let husbandPhotoUrl = null;
    let wifePhotoUrl = null;
    try {
      husbandPhotoUrl = await uploadPmoIdToSupabase(personalInfo && personalInfo.husband_id_photo, 'husband');
      wifePhotoUrl = await uploadPmoIdToSupabase(personalInfo && personalInfo.wife_id_photo, 'wife');
    } catch (e) {
      console.error('PMO booking ID upload failed:', e?.message || e);
      return res.status(500).json({ success: false, error: { message: 'Failed to upload ID photos.' } });
    }

    if (!husbandPhotoUrl) {
      return res.status(400).json({ success: false, error: { message: 'Invalid husband ID photo.' } });
    }
    if (!wifePhotoUrl) {
      return res.status(400).json({ success: false, error: { message: 'Invalid wife ID photo.' } });
    }

    await client.query('BEGIN');

    // Insert couple into normalized tables: PMO_Couples, PMO_Contacts, PMO_Persons
    const coupleResult = await client.query(
      `INSERT INTO "PMO_Couples" (
         marriage_date,
         solemnizing_officer,
         created_at
       ) VALUES ($1, $2, NOW())
       RETURNING couple_id`,
      [
        personalInfo.marriage_date || null,
        personalInfo.marriage_date ? (personalInfo.solemnizing_officer || null) : null
      ]
    );

    const coupleID = coupleResult.rows[0].couple_id;

    await client.query(
      `INSERT INTO "PMO_Contacts" (
         couple_id,
         email,
         main_contact,
         backup_contact
       ) VALUES ($1, $2, $3, $4)`,
      [
        coupleID,
        personalInfo.email,
        personalInfo.main_contact,
        personalInfo.backup_contact
      ]
    );

    await client.query(
      `INSERT INTO "PMO_Persons" (
         couple_id,
         role,
         name,
         birthday,
         address,
         occupation,
         religion,
         educational_attainment,
         citizenship,
         id_type,
         id_number,
         is_4ps,
         is_pwd,
         photo_url
       ) VALUES (
         $1, 'husband', $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12, $13
       )`,
      [
        coupleID,
        personalInfo.husband_name,
        personalInfo.husband_birthday,
        personalInfo.husband_address,
        personalInfo.husband_occupation,
        personalInfo.husband_religion,
        personalInfo.husband_educational_attainment,
        personalInfo.husband_citizenship,
        personalInfo.husband_id_type,
        personalInfo.husband_id_number,
        personalInfo.husband_4ps,
        personalInfo.husband_pwd,
        husbandPhotoUrl
      ]
    );

    await client.query(
      `INSERT INTO "PMO_Persons" (
         couple_id,
         role,
         name,
         birthday,
         address,
         occupation,
         religion,
         educational_attainment,
         citizenship,
         id_type,
         id_number,
         is_4ps,
         is_pwd,
         photo_url
       ) VALUES (
         $1, 'wife', $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12, $13
       )`,
      [
        coupleID,
        personalInfo.wife_name,
        personalInfo.wife_birthday,
        personalInfo.wife_address,
        personalInfo.wife_occupation,
        personalInfo.wife_religion,
        personalInfo.wife_educational_attainment,
        personalInfo.wife_citizenship,
        personalInfo.wife_id_type,
        personalInfo.wife_id_number,
        personalInfo.wife_4ps,
        personalInfo.wife_pwd,
        wifePhotoUrl
      ]
    );

    // If a schedule was selected, create a PMO appointment linked to this couple and user
    const scheduleId = schedule && (schedule.id || schedule.pmoID || schedule.pmoId);
    let appointmentId = null;
    if (scheduleId) {
      // Resolve counselor from schedule record and validate schedule exists
      const schedRow = await client.query(
        'SELECT "pmoID", counselor FROM "PmoSchedules" WHERE "pmoID" = $1',
        [scheduleId]
      );
      if (schedRow.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: { message: 'Selected PMO schedule does not exist.' } });
      }
      const counselorId = schedRow.rows[0].counselor || null;
      const apptInsert = await client.query(
        `INSERT INTO "PMO_Appointments" (
           "userid", "coupleID", "scheduleId", "counselorId", status, "notificationSent"
         ) VALUES ($1, $2, $3, $4, 'PENDING', false)
         RETURNING "appointmentID"`,
        [userId, coupleID, scheduleId, counselorId]
      );

      appointmentId = apptInsert.rows[0]?.appointmentID || null;
    }

    const entries = Array.isArray(answers) ? answers : [];
    console.log('PMO /bookings inserting answers count:', entries.length);
    for (const item of entries) {
      const questionID = Number(item?.questionID);
      if (!Number.isInteger(questionID)) continue;

      // Map payload to explicit husband/wife flags
      const isHusbandEntry = item?.isHusband === true;
      const isHusband = isHusbandEntry;
      const isWife = !isHusbandEntry;

      const answer = item?.answer;
      const reason = item?.reason;

      await client.query('SAVEPOINT pmo_ans_savepoint');
      try {
        await client.query(
          `INSERT INTO "PMO_Answers" (
             "questionID",
             "coupleID",
             "isHusband",
             "isWife",
             answer,
             reason
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT ("coupleID", "questionID", "isHusband")
           DO UPDATE SET
             "isWife" = EXCLUDED."isWife",
             answer = EXCLUDED.answer,
             reason = EXCLUDED.reason`,
          [questionID, coupleID, isHusband, isWife, answer, reason]
        );
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT pmo_ans_savepoint');
        console.warn('PMO answer insert skipped:', {
          questionID,
          isHusband,
          isWife,
          answer,
          reason,
          code: e.code,
          message: e.message,
        });
      }
    }

    // Debug: log how many husband vs wife answers were stored for this couple
    const debugCounts = await client.query(
      'SELECT "isHusband", "isWife", COUNT(*) AS cnt FROM "PMO_Answers" WHERE "coupleID" = $1 GROUP BY "isHusband", "isWife"',
      [coupleID]
    );
    console.log('PMO /bookings answer distribution for couple', coupleID, debugCounts.rows);

    await client.query('COMMIT');

    // Send booking confirmation SMS (non-blocking; failures should not affect the booking response)
    if (ENABLE_PMO_NOTIFICATIONS && appointmentId && personalInfo?.main_contact) {
      setImmediate(async () => {
        try {
          const recipient = String(personalInfo.main_contact || '').trim();
          let ctx = null;
          try {
            ctx = await getPmoSmsContext(appointmentId);
          } catch (e) {
            console.error('PMO booking SMS context lookup failed:', e?.message || e);
          }

          const rawMessage = pmoSmsTemplates.bookingConfirmation({ appointmentId });
          const message = applyStandardPlaceholders(rawMessage, ctx);
          const result = await sendSMS(recipient, message);

          await logPmoSmsAttempt({
            appointmentId,
            coupleId: coupleID,
            eventType: 'BOOKING_CONFIRMATION',
            recipient,
            message,
            success: result.success,
            providerResponse: result.success ? result.data : (result.error?.data || null),
            errorMessage: result.success ? null : result.error?.message
          });

          if (!result.success) {
            console.error('PMO booking SMS send failed:', result.error?.message || result.error || result);
          }

          if (result.success) {
            await markPmoNotificationSent(appointmentId);
          }

          const email = personalInfo?.email ? String(personalInfo.email).trim() : (ctx?.email ? String(ctx.email).trim() : '');
          if (email && isValidEmail(email)) {
            const subject = getPmoEmailSubject('BOOKING_CONFIRMATION');
            const emailResult = await sendEmail(email, subject, message);
            if (!emailResult.success) {
              console.error('PMO Email send failed:', emailResult.error?.message || emailResult.error || emailResult);
            }
          }
        } catch (e) {
          console.error('PMO booking notification send failed:', e?.message || e);
        }
      });
    }

    const io = req.app.get('io'); if (io) io.emit('pmo:updated');
    res.status(201).json({ success: true, data: { coupleID, appointmentId } });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    // Map duplicate key violations to clearer client errors
    if (err && err.code === '23505' && typeof err.detail === 'string') {
      const d = err.detail;
      if (d.includes('(husband_id_number)')) {
        err.status = 409;
        err.message = 'Husband ID number already exists.';
      } else if (d.includes('(wife_id_number)')) {
        err.status = 409;
        err.message = 'Wife ID number already exists.';
      }
    }
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
