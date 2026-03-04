const express = require('express');
const Joi = require('joi');
const multer = require('multer');

const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const config = require('../config/env');
const { getSupabaseClient } = require('../config/supabase');
const { uploadFile, deleteFile, createFolder, renameFile } = require('../services/googleDrive');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      const err = new Error('Only PDF, Word, Excel, and image files are allowed');
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

// Static list of San Fabian barangays used to create Drive subfolders for each task.
const SAN_FABIAN_BARANGAYS = [
  'Alacan',
  'Ambalangan-Dalin',
  'Angio',
  'Anonang',
  'Aramal',
  'Bigbiga',
  'Binday',
  'Bolaoen',
  'Bolasi',
  'Cabaruan',
  'Cayanga',
  'Colisao',
  'Gomot',
  'Inmalog',
  'Inmalog Norte',
  'Lekep-Butao',
  'Lipit-Tomeeng',
  'Longos',
  'Longos Proper',
  'Longos-Amangonan-Parac-Parac (Fabrica)',
  'Mabilao',
  'Nibaliw Central',
  'Nibaliw East',
  'Nibaliw Magliba',
  'Nibaliw Narvarte (Nibaliw West Compound)',
  'Nibaliw Vidal (Nibaliw West Proper)',
  'Palapad',
  'Poblacion',
  'Rabon',
  'Sagud-Bahley',
  'Sobol',
  'Tempra-Guilig',
  'Tiblong',
  'Tocok'
];

function mapTaskRow(row) {
  if (!row) return null;
  const now = new Date();
  const submitUntil = row.submituntil ? new Date(row.submituntil) : null;
  const submittedAt = row.submittedat ? new Date(row.submittedat) : null;

  // Preserve explicit Archived status from DB
  const rawStatus = row.status || row.Status;
  let status;
  if (rawStatus && String(rawStatus).toUpperCase() === 'ARCHIVED') {
    status = 'Archived';
  } else if (submittedAt) {
    status = 'Submitted';
  } else if (submitUntil && now > submitUntil) {
    status = 'Overdue';
  } else {
    status = 'Pending';
  }

  return {
    id: row.filetaskid || row.fileTaskID || row.filetaskid,
    userId: row.userid || row.userID,
    officerName: row.officer_name || null,
    officerBarangay: row.officer_barangay || null,
    taskTitle: row.tasktitle || row.taskTitle,
    description: row.description,
    submitUntil: row.submituntil || row.submitUntil,
    supabaseFileID: row.supabasefileid || row.supabaseFileID || row.googledrivefileid || row.googleDriveFileID,
    supabaseLink: row.supabaselink || row.supabaseLink || row.googledrivelink || row.googleDriveLink,
    fileName: row.filename || row.fileName,
    submittedAt: row.submittedat || row.submittedAt,
    status,
    createdBy: row.createdby || row.createdBy,
    createdByName: row.created_by_name || null,
    createdAt: row.createdat || row.createdAt,
    updatedAt: row.updatedat || row.updatedAt
  };
}

const adminListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(340).default(50),
    status: Joi.string().valid('Pending', 'Submitted', 'Overdue', 'Archived').allow(null, '')
  })
};

const adminCreateSchema = {
  body: Joi.object({
    taskTitle: Joi.string().max(255).required(),
    description: Joi.string().allow('', null),
    submitUntil: Joi.date().iso().required()
  })
};

const adminUpdateSchema = {
  body: Joi.object({
    taskTitle: Joi.string().max(255).required(),
    description: Joi.string().allow('', null),
    submitUntil: Joi.date().iso().required(),
    status: Joi.string().valid('Pending', 'Submitted', 'Overdue', 'Archived').optional()
  })
};

// Admin: list all file tasks
router.get(
  '/admin',
  authenticate,
  authorize(['Admin']),
  validate(adminListSchema),
  async (req, res, next) => {
    try {
      const { page, limit, status } = req.query;
      const offset = (page - 1) * limit;

      const values = [];
      const where = [];
      if (status) {
        values.push(status);
        where.push(`t."status" = $${values.length}`);
      }
      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const countRes = await db.query(`SELECT COUNT(*)::int AS count FROM file_tasks t ${whereClause}`, values);
      const total = countRes.rows[0]?.count || 0;

      values.push(limit);
      values.push(offset);

      const sql = `
        SELECT
          t."fileTaskID" AS filetaskid,
          t."userID" AS userid,
          t."taskTitle" AS tasktitle,
          t.description,
          t."submitUntil" AS submituntil,
          t."supabaseFileID" AS supabasefileid,
          t."supabaseLink" AS supabaselink,
          t."fileName" AS filename,
          t."submittedAt" AS submittedat,
          t."status" AS status,
          t."createdBy" AS createdby,
          t."createdAt" AS createdat,
          t."updatedAt" AS updatedat,
          u.full_name AS officer_name,
          u.barangay AS officer_barangay,
          c.full_name AS created_by_name
        FROM file_tasks t
        LEFT JOIN users u ON u.userid = t."userID"  -- may be NULL for global tasks
        JOIN users c ON c.userid = t."createdBy"
        ${whereClause}
        ORDER BY t."createdAt" DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
      `;

      const result = await db.query(sql, values);
      const data = result.rows.map((row) => mapTaskRow({
        filetaskid: row.filetaskid || row.filetaskid || row.filetaskid,
        userid: row.userid || row.userid,
        officer_name: row.officer_name,
        officer_barangay: row.officer_barangay,
        tasktitle: row.tasktitle,
        description: row.description,
        submituntil: row.submituntil,
        supabasefileid: row.supabasefileid,
        supabaselink: row.supabaselink,
        filename: row.filename,
        submittedat: row.submittedat,
        status: row.status,
        createdby: row.createdby,
        created_by_name: row.created_by_name,
        createdat: row.createdat,
        updatedat: row.updatedat
      }));

      res.json({ success: true, data, meta: { page, limit, total } });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: create task
router.post(
  '/admin',
  authenticate,
  authorize(['Admin']),
  validate(adminCreateSchema),
  async (req, res, next) => {
    try {
      const { taskTitle, description, submitUntil } = req.body;
      const creatorId = req.user.id;

      const deadline = new Date(submitUntil);
      const now = new Date();
      if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
        return res.status(400).json({ success: false, error: { message: 'submitUntil must be a valid date' } });
      }
      if (deadline <= now) {
        return res.status(400).json({ success: false, error: { message: 'Deadline must be in the future' } });
      }

      // Fetch all Barangay Officers so we can map them to barangays.
      const officersRes = await db.query(
        'SELECT userid, barangay FROM users WHERE role = $1',
        ['Barangay Officer']
      );

      // Map barangay name -> officer userId (first officer per barangay wins).
      const officersByBarangay = new Map();
      for (const off of officersRes.rows) {
        const bRaw = off.barangay || '';
        const bName = String(bRaw).trim();
        if (!bName) continue;
        if (!officersByBarangay.has(bName)) {
          officersByBarangay.set(bName, off.userid);
        }
      }

      let parentFolderId = null;
      const rows = [];

      // Create parent folder and fixed barangay subfolders in Google Drive (best-effort).
      const barangayFolderMap = new Map(); // barangay name -> folderId

      if (config.drive && config.drive.folderId) {
        try {
          // Parent folder for this task (one per task, regardless of number of officers).
          const folderName = taskTitle;
          parentFolderId = await createFolder(folderName, config.drive.folderId);

          // Create one subfolder per barangay in San Fabian.
          for (const name of SAN_FABIAN_BARANGAYS) {
            const bName = String(name).trim();
            if (!bName) continue;
            const subFolderId = await createFolder(bName, parentFolderId);
            barangayFolderMap.set(bName, subFolderId);
          }
        } catch (e) {
          console.error('Failed to create task or barangay folders in Drive:', e?.message || e);
          // We continue; DB rows are still valid even without folders.
        }
      }

      // Insert one task row per barangay in SAN_FABIAN_BARANGAYS, ensuring we always
      // have a fixed number of expected submissions (e.g. 34), even if some barangays
      // do not currently have an officer account configured.
      for (const name of SAN_FABIAN_BARANGAYS) {
        const bName = String(name).trim();
        if (!bName) continue;

        const userId = officersByBarangay.get(bName) || null;
        const barangayFolderId = barangayFolderMap.get(bName) || null;

        const insertRes = await db.query(
          `INSERT INTO file_tasks ("userID", "taskTitle", description, "submitUntil", "createdBy", status, "parentFolderId", "taskFolderId")
           VALUES ($1, $2, $3, $4, $5, 'Pending', $6, $7)
           RETURNING *`,
          [
            userId,
            taskTitle,
            description || null,
            deadline.toISOString(),
            creatorId,
            parentFolderId,
            barangayFolderId
          ]
        );

        if (insertRes.rows[0]) {
          rows.push(insertRes.rows[0]);
        }
      }

      res.status(201).json({ success: true, data: rows.map((r) => mapTaskRow(r)) });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: get single task
router.get(
  '/admin/:id',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const sql = `
        SELECT
          t.*, u.full_name AS officer_name, u.barangay AS officer_barangay,
          c.full_name AS created_by_name
        FROM file_tasks t
        LEFT JOIN users u ON u.userid = t."userID"  -- may be NULL for global tasks
        JOIN users c ON c.userid = t."createdBy"
        WHERE t."fileTaskID" = $1
      `;
      const result = await db.query(sql, [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }
      const row = result.rows[0];
      res.json({ success: true, data: mapTaskRow(row) });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: update task definition (not submission)
router.put(
  '/admin/:id',
  authenticate,
  authorize(['Admin']),
  validate(adminUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { taskTitle, description, submitUntil, status } = req.body;

      const deadline = new Date(submitUntil);
      const now = new Date();
      if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
        return res.status(400).json({ success: false, error: { message: 'submitUntil must be a valid date' } });
      }
      if (deadline <= now) {
        return res.status(400).json({ success: false, error: { message: 'Deadline must be in the future' } });
      }

      // Load the base row so we know which logical task this id belongs to.
      const baseRes = await db.query(
        'SELECT "taskTitle", description, "submitUntil", "parentFolderId" FROM file_tasks WHERE "fileTaskID" = $1',
        [id]
      );

      if (baseRes.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const baseRow = baseRes.rows[0];
      const parentFolderId = baseRow.parentFolderId;

      let result;

      if (parentFolderId) {
        // Normal case: all officer rows for this task share the same parentFolderId.
        result = await db.query(
          `UPDATE file_tasks
           SET "taskTitle" = $1,
               description = $2,
               "submitUntil" = $3,
               "status" = COALESCE($4, "status"),
               "updatedAt" = NOW()
           WHERE "parentFolderId" = $5
           RETURNING *`,
          [taskTitle, description || null, deadline.toISOString(), status || null, parentFolderId]
        );

        // Best-effort: keep the Google Drive parent folder name in sync with the task title.
        if (parentFolderId && baseRow.taskTitle && baseRow.taskTitle !== taskTitle) {
          // Fire-and-forget; any errors are logged inside renameFile.
          renameFile(parentFolderId, taskTitle).catch(() => {});
        }
      } else {
        // Fallback: identify the logical task by its original title/description/deadline,
        // matching the same grouping used in the frontend.
        result = await db.query(
          `UPDATE file_tasks
           SET "taskTitle" = $1,
               description = $2,
               "submitUntil" = $3,
               "status" = COALESCE($4, "status"),
               "updatedAt" = NOW()
           WHERE "taskTitle" = $5
             AND COALESCE(description, '') = COALESCE($6, '')
             AND "submitUntil" = $7
           RETURNING *`,
          [
            taskTitle,
            description || null,
            deadline.toISOString(),
            status || null,
            baseRow.taskTitle,
            baseRow.description,
            baseRow.submitUntil,
          ]
        );
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      // Return one representative row (first) to the client.
      const row = result.rows[0];
      res.json({ success: true, data: mapTaskRow(row) });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: delete task (kept as hard delete, UI should prefer archive instead)
router.delete(
  '/admin/:id',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT "taskTitle", description, "submitUntil", "parentFolderId" FROM file_tasks WHERE "fileTaskID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const baseRow = existing.rows[0];
      const parentFolderId = baseRow.parentFolderId;

      if (parentFolderId) {
        // Normal case: delete all rows for this logical task (shared parentFolderId).
        await db.query('DELETE FROM file_tasks WHERE "parentFolderId" = $1', [parentFolderId]);
      } else {
        // Fallback: delete all rows that match the original logical task definition.
        await db.query(
          `DELETE FROM file_tasks
           WHERE "taskTitle" = $1
             AND COALESCE(description, '') = COALESCE($2, '')
             AND "submitUntil" = $3`,
          [baseRow.taskTitle, baseRow.description, baseRow.submitUntil]
        );
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// Admin: archive logical task (mark all rows as Archived)
router.patch(
  '/admin/:id/archive',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT "taskTitle", description, "submitUntil", "parentFolderId" FROM file_tasks WHERE "fileTaskID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const baseRow = existing.rows[0];
      const parentFolderId = baseRow.parentFolderId;
      let result;

      if (parentFolderId) {
        result = await db.query(
          'UPDATE file_tasks SET "status" = $1, "updatedAt" = NOW() WHERE "parentFolderId" = $2 RETURNING *',
          ['Archived', parentFolderId]
        );
      } else {
        result = await db.query(
          `UPDATE file_tasks
           SET "status" = $1, "updatedAt" = NOW()
           WHERE "taskTitle" = $2
             AND COALESCE(description, '') = COALESCE($3, '')
             AND "submitUntil" = $4
           RETURNING *`,
          ['Archived', baseRow.taskTitle, baseRow.description, baseRow.submitUntil]
        );
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      return res.json({ success: true, data: { id: Number(id) } });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: unarchive logical task (clear Archived status so it becomes active again)
router.patch(
  '/admin/:id/unarchive',
  authenticate,
  authorize(['Admin']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT "taskTitle", description, "submitUntil", "parentFolderId" FROM file_tasks WHERE "fileTaskID" = $1', [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const baseRow = existing.rows[0];
      const parentFolderId = baseRow.parentFolderId;
      let result;

      if (parentFolderId) {
        result = await db.query(
          'UPDATE file_tasks SET "status" = NULL, "updatedAt" = NOW() WHERE "parentFolderId" = $1 RETURNING *',
          [parentFolderId]
        );
      } else {
        result = await db.query(
          `UPDATE file_tasks
           SET "status" = NULL, "updatedAt" = NOW()
           WHERE "taskTitle" = $1
             AND COALESCE(description, '') = COALESCE($2, '')
             AND "submitUntil" = $3
           RETURNING *`,
          [baseRow.taskTitle, baseRow.description, baseRow.submitUntil]
        );
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      return res.json({ success: true, data: { id: Number(id) } });
    } catch (err) {
      next(err);
    }
  }
);

// Officer: list my tasks
router.get(
  '/me',
  authenticate,
  authorize(['Barangay Officer']),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const sql = `
        SELECT
          t.*, u.full_name AS officer_name, u.barangay AS officer_barangay,
          c.full_name AS created_by_name
        FROM file_tasks t
        LEFT JOIN users u ON u.userid = t."userID"  -- may be NULL for global tasks
        JOIN users c ON c.userid = t."createdBy"
        WHERE (t."userID" = $1 OR t."userID" IS NULL)
          AND COALESCE(t."status", '') <> 'Archived'
        ORDER BY t."submitUntil" ASC
      `;
      const result = await db.query(sql, [userId]);
      const data = result.rows.map(mapTaskRow);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// Officer: submit file (first submission)
router.post(
  '/me/:id/submit',
  authenticate,
  authorize(['Barangay Officer']),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'File is required' } });
      }

      const taskRes = await db.query('SELECT * FROM file_tasks WHERE "fileTaskID" = $1 AND "userID" = $2', [
        taskId,
        userId
      ]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const task = taskRes.rows[0];
      const existingFileId = task.supabaseFileID || task.supabasefileid || task.googleDriveFileID || task.googledrivefileid;
      if (existingFileId) {
        return res.status(400).json({ success: false, error: { message: 'Task already has a submission. Use replace.' } });
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname;
      const fileName = `${task.fileTaskID || task.filetaskid || taskId}-${Date.now()}-${originalName}`;

      const supabase = getSupabaseClient();
      const bucket = 'file_task_reports';

      // Derive barangay for path grouping
      let barangay = 'general';
      if (task.userID) {
        try {
          const officerRes = await db.query('SELECT barangay FROM users WHERE userid = $1', [task.userID]);
          if (officerRes.rowCount > 0) {
            barangay = officerRes.rows[0].barangay || 'general';
          }
        } catch (e) {
          // Fallback to default barangay on error
          barangay = 'general';
        }
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const safeBarangay = String(barangay || 'general').trim() || 'general';
      const folderSlug = safeBarangay.replace(/[^A-Za-z0-9-_]/g, '_');
      const path = `${folderSlug}/${year}/${month}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: mimeType,
        upsert: true
      });

      if (uploadError) {
        const err = new Error(uploadError.message || 'Failed to upload file');
        err.status = 500;
        throw err;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;

      console.log('Uploaded Supabase file for file task submit:', {
        taskId,
        userId,
        bucket,
        path,
        fileName: originalName
      });

      const result = await db.query(
        `UPDATE file_tasks
         SET "supabaseFileID" = $1,
             "supabaseLink" = $2,
             "fileName" = $3,
             "submittedAt" = NOW(),
             "status" = 'Submitted',
             "updatedAt" = NOW()
         WHERE "fileTaskID" = $4
         RETURNING *`,
        [path, publicUrl, originalName, taskId]
      );

      res.json({ success: true, data: mapTaskRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Officer: replace submission (allowed even after deadline)
router.put(
  '/me/:id/submit',
  authenticate,
  authorize(['Barangay Officer']),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'File is required' } });
      }

      const taskRes = await db.query('SELECT * FROM file_tasks WHERE "fileTaskID" = $1 AND "userID" = $2', [
        taskId,
        userId
      ]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const task = taskRes.rows[0];
      const supabase = getSupabaseClient();
      const bucket = 'file_task_reports';

      // Remove previous file from Supabase if present
      const oldFileId = task.supabaseFileID || task.supabasefileid || task.googleDriveFileID || task.googledrivefileid;
      if (oldFileId) {
        try {
          await supabase.storage.from(bucket).remove([oldFileId]);
        } catch (e) {
          console.error('Failed to remove previous Supabase file for file task replace:', e?.message || e);
        }
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname;
      const fileName = `${task.fileTaskID || task.filetaskid || taskId}-${Date.now()}-${originalName}`;

      // Derive barangay for path grouping
      let barangay = 'general';
      if (task.userID) {
        try {
          const officerRes = await db.query('SELECT barangay FROM users WHERE userid = $1', [task.userID]);
          if (officerRes.rowCount > 0) {
            barangay = officerRes.rows[0].barangay || 'general';
          }
        } catch (e) {
          barangay = 'general';
        }
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const safeBarangay = String(barangay || 'general').trim() || 'general';
      const folderSlug = safeBarangay.replace(/[^A-Za-z0-9-_]/g, '_');
      const path = `${folderSlug}/${year}/${month}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: mimeType,
        upsert: true
      });

      if (uploadError) {
        const err = new Error(uploadError.message || 'Failed to upload file');
        err.status = 500;
        throw err;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;

      console.log('Uploaded Supabase file for file task replace:', {
        taskId,
        userId,
        bucket,
        path,
        fileName: originalName
      });

      const result = await db.query(
        `UPDATE file_tasks
         SET "supabaseFileID" = $1,
             "supabaseLink" = $2,
             "fileName" = $3,
             "submittedAt" = NOW(),
             "status" = 'Submitted',
             "updatedAt" = NOW()
         WHERE "fileTaskID" = $4
         RETURNING *`,
        [path, publicUrl, originalName, taskId]
      );

      res.json({ success: true, data: mapTaskRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// Officer: delete submission (revert to Pending/Overdue based on deadline)
router.delete(
  '/me/:id/submit',
  authenticate,
  authorize(['Barangay Officer']),
  async (req, res, next) => {
    try {
      const taskId = req.params.id;
      const userId = req.user.id;

      const taskRes = await db.query('SELECT * FROM file_tasks WHERE "fileTaskID" = $1 AND "userID" = $2', [
        taskId,
        userId
      ]);
      if (taskRes.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Task not found' } });
      }

      const task = taskRes.rows[0];
      const hasFileId = task.supabaseFileID || task.supabasefileid || task.googleDriveFileID || task.googledrivefileid;
      const hasLink = task.supabaseLink || task.supabaselink || task.googleDriveLink || task.googledrivelink;
      if (!hasFileId && !hasLink && !task.fileName && !task.submittedAt) {
        return res.status(400).json({ success: false, error: { message: 'No submission to delete' } });
      }

      const supabase = getSupabaseClient();
      const bucket = 'file_task_reports';

      if (hasFileId) {
        try {
          await supabase.storage.from(bucket).remove([hasFileId]);
        } catch (e) {
          console.error('Failed to remove Supabase file during delete submission:', e?.message || e);
        }
      }

      const now = new Date();
      const deadline = task.submitUntil || task.submituntil;
      const deadlineDate = deadline ? new Date(deadline) : null;
      let newStatus = 'Pending';
      if (deadlineDate && now > deadlineDate) {
        newStatus = 'Overdue';
      }

      const result = await db.query(
        `UPDATE file_tasks
         SET "supabaseFileID" = NULL,
             "supabaseLink" = NULL,
             "fileName" = NULL,
             "submittedAt" = NULL,
             "status" = $1,
             "updatedAt" = NOW()
         WHERE "fileTaskID" = $2
         RETURNING *`,
        [newStatus, taskId]
      );

      res.json({ success: true, data: mapTaskRow(result.rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
