const cron = require('node-cron');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');

// Event types that are considered reminder-related and safe to retry
const REMINDER_EVENT_TYPES = [
  'FP_REMINDER_2_DAYS',
  'FP_REMINDER_SAME_DAY',
  'PMO_REMINDER_2_DAYS',
  'PMO_REMINDER_SAME_DAY',
  'USAPAN_REMINDER_2_DAYS',
  'USAPAN_REMINDER_SAME_DAY',
  'FILETASK_OVERDUE_REMINDER'
];

// Log a retry attempt into SMS_Logs so it appears in the SMS Logs UI
async function logSmsRetryAttempt({
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
        String(eventType || 'UNKNOWN_RETRY'),
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null
      ]
    );
  } catch (e) {
    console.error('Failed to write SMS retry log (job):', e?.message || e);
  }
}

async function processFailedReminderSmsRetries() {
  // Group by logical message (same appointment, couple, event type, recipient, message)
  // and find those that only have failed attempts so far.
  const result = await db.query(
    `WITH grouped AS (
       SELECT
         appointment_id,
         couple_id,
         event_type,
         recipient,
         message,
         COUNT(*) AS total_attempts,
         BOOL_OR(success) AS has_success
       FROM "SMS_Logs"
       WHERE event_type = ANY($1)
         AND COALESCE(recipient, '') <> ''
       GROUP BY appointment_id, couple_id, event_type, recipient, message
     )
     SELECT *
     FROM grouped
     WHERE has_success = FALSE
       AND total_attempts < 5`,
    [REMINDER_EVENT_TYPES]
  );

  if (!result.rows.length) {
    return;
  }

  for (const row of result.rows) {
    const recipient = String(row.recipient || '').trim();
    const message = String(row.message || '').trim();
    if (!recipient || !message) continue;

    const smsResult = await sendSMS(recipient, message);

    await logSmsRetryAttempt({
      appointmentId: row.appointment_id,
      coupleId: row.couple_id,
      eventType: row.event_type,
      recipient,
      message,
      success: smsResult.success,
      providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
      errorMessage: smsResult.success ? null : smsResult.error?.message
    });

    if (!smsResult.success) {
      console.error('SMS reminder retry failed:', smsResult.error?.message || smsResult.error);
    }
  }

  console.log('SMS reminder retries processed:', {
    count: result.rows.length,
    at: new Date().toISOString()
  });
}

function startSmsRetryJob() {
  // Runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processFailedReminderSmsRetries();
    } catch (e) {
      console.error('SMS reminder retry job failed:', e?.message || e);
    }
  });
}

module.exports = {
  startSmsRetryJob
};
