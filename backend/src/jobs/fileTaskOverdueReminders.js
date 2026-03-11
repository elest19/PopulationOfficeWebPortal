const cron = require('node-cron');
const dayjs = require('dayjs');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');

async function logFileTaskOverdueSmsAttempt({ fileTaskId, recipient, message, success, providerResponse, errorMessage }) {
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
        fileTaskId, // reuse appointment_id column to track which file task this log refers to
        null,
        'FILETASK_OVERDUE_REMINDER',
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null
      ]
    );
  } catch (e) {
    console.error('Failed to write File Task overdue SMS log (job):', e?.message || e);
  }
}

async function sendOverdueTaskReminder(row) {
  const rawContact = row.contact_number || '';
  const contact = String(rawContact).replace(/[^0-9]/g, '');
  if (!contact) return;

  const taskTitle = row.task_title || row.taskTitle || row.tasktitle || 'your assigned task';
  const message = `The task "${taskTitle}" is overdue, please submit the necessary document.`;

  // Avoid duplicate SMS: same event type, same recipient, same fileTaskID (stored in appointment_id)
  const existing = await db.query(
    'SELECT 1 FROM "SMS_Logs" WHERE event_type = $1 AND recipient = $2 AND appointment_id = $3 LIMIT 1',
    ['FILETASK_OVERDUE_REMINDER', contact, row.filetaskid]
  );
  if (existing.rowCount > 0) {
    return;
  }

  const smsResult = await sendSMS(contact, message);

  await logFileTaskOverdueSmsAttempt({
    fileTaskId: row.filetaskid,
    recipient: contact,
    message,
    success: smsResult.success,
    providerResponse: smsResult.success ? smsResult.data : smsResult.error?.data || null,
    errorMessage: smsResult.success ? null : smsResult.error?.message
  });

  if (!smsResult.success) {
    console.error('File Task overdue reminder SMS failed:', smsResult.error?.message || smsResult.error);
  }
}

function startFileTaskOverdueReminderJob() {
  // Run once a day at 8:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = dayjs();

      // Find tasks assigned to Barangay Officers that are overdue and not yet submitted.
      // We only consider tasks with a specific userID (assigned officer), not global tasks.
      const sql = `
        SELECT
          t."fileTaskID" AS filetaskid,
          t."taskTitle" AS task_title,
          t."submitUntil" AS submit_until,
          u.full_name,
          u.contact_number
        FROM file_tasks t
        JOIN users u ON u.userid = t."userID"
        WHERE
          t."submitUntil" IS NOT NULL
          AND t."submitUntil" < CURRENT_DATE
          AND (t."submittedAt" IS NULL)
          AND COALESCE(t."status", '') <> 'Archived'
      `;

      const result = await db.query(sql);

      for (const row of result.rows) {
        await sendOverdueTaskReminder(row);
      }

      if (result.rows.length) {
        console.log('File task overdue reminders processed:', {
          count: result.rows.length,
          at: now.toISOString()
        });
      }
    } catch (e) {
      console.error('File task overdue reminder job failed:', e?.message || e);
    }
  });
}

module.exports = {
  startFileTaskOverdueReminderJob
};
