const cron = require('node-cron');
const dayjs = require('dayjs');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail, isValidEmail } = require('../services/mailjetEmail');

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
    console.error('Failed to write Usapan-Series SMS log (job):', e?.message || e);
  }
}

async function sendUsapanReminder({ row, when }) {
  const rawContact = row.contact_number || '';
  const contact = String(rawContact).replace(/[^0-9]/g, '');
  if (!contact) return;

  const datePart = row.date
    ? dayjs(row.date).format('MMMM D, YYYY')
    : 'your Usapan-Series date';

  const name = row.full_name || row.requester_name || 'Officer';
  const baseMessage = `Hello ${name}, this is a reminder for your Usapan-Series schedule on ${datePart}.`;
  const message = when === 'twoDaysBefore'
    ? `${baseMessage} This is a reminder 2 days before your schedule.`
    : `${baseMessage} This is a reminder for your appointment today.`;

  const eventType = when === 'twoDaysBefore'
    ? 'USAPAN_REMINDER_2_DAYS'
    : 'USAPAN_REMINDER_SAME_DAY';

  // Avoid duplicate SMS by checking existing log with same event type and recipient
  const existing = await db.query(
    'SELECT 1 FROM "SMS_Logs" WHERE event_type = $1 AND recipient = $2 LIMIT 1',
    [eventType, contact]
  );
  if (existing.rowCount > 0) {
    return;
  }

  const smsResult = await sendSMS(contact, message);
  await logUsapanSmsAttempt({
    eventType,
    recipient: contact,
    message,
    success: smsResult.success,
    providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
    errorMessage: smsResult.success ? null : smsResult.error?.message
  });

  if (!smsResult.success) {
    console.error('Usapan reminder SMS failed:', smsResult.error?.message || smsResult.error);
  }

  // Email reminder if user has email
  if (row.user_id != null) {
    try {
      const userResult = await db.query('SELECT email FROM users WHERE "userid" = $1', [row.user_id]);
      const user = userResult.rows[0];
      const email = user && user.email ? String(user.email).trim() : '';
      if (email && isValidEmail(email)) {
        const subject = when === 'twoDaysBefore'
          ? 'Usapan-Series Schedule Reminder (2 days before)'
          : 'Usapan-Series Schedule Reminder (today)';
        const emailResult = await sendEmail(email, subject, message);
        if (!emailResult.success) {
          console.error('Usapan reminder email failed:', emailResult.error?.message || emailResult.error);
        }
      }
    } catch (e) {
      console.error('Usapan reminder email lookup failed:', e?.message || e);
    }
  }
}

function startUsapanReminderJob() {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = dayjs();

      // 2 days before reminders: Scheduled Usapan-Series whose date = current_date + 2 days
      const twoDaysResult = await db.query(
        `SELECT s."usapanID" AS id,
                s.date,
                s.status,
                s."userID" AS user_id,
                u.full_name,
                u.contact_number
           FROM "UsapanSchedules" s
           LEFT JOIN users u ON u."userid" = s."userID"
          WHERE s.status = 'Scheduled'
            AND s.date = (CURRENT_DATE + INTERVAL '2 days')`
      );

      for (const row of twoDaysResult.rows) {
        await sendUsapanReminder({ row, when: 'twoDaysBefore' });
      }

      // Same-day reminders: Scheduled Usapan-Series with date = today
      const sameDayResult = await db.query(
        `SELECT s."usapanID" AS id,
                s.date,
                s.status,
                s."userID" AS user_id,
                u.full_name,
                u.contact_number
           FROM "UsapanSchedules" s
           LEFT JOIN users u ON u."userid" = s."userID"
          WHERE s.status = 'Scheduled'
            AND s.date = CURRENT_DATE`
      );

      for (const row of sameDayResult.rows) {
        await sendUsapanReminder({ row, when: 'sameDay' });
      }

      if (twoDaysResult.rows.length || sameDayResult.rows.length) {
        console.log('Usapan-Series reminders processed:', {
          twoDays: twoDaysResult.rows.length,
          sameDay: sameDayResult.rows.length,
          at: now.toISOString()
        });
      }
    } catch (e) {
      console.error('Usapan reminder job failed:', e?.message || e);
    }
  });
}

module.exports = {
  startUsapanReminderJob
};
