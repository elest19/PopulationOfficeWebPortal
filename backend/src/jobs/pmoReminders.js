const cron = require('node-cron');
const dayjs = require('dayjs');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail, isValidEmail } = require('../services/mailjetEmail');

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
    console.error('Failed to write PMO SMS log (job):', e?.message || e);
  }
}

async function loadPmoReminderContextForDateRange(targetDateSql) {
  const result = await db.query(
    `SELECT
       a."appointmentID" AS "appointmentId",
       a."coupleID" AS "coupleId",
       a.status,
       c.marriage_date,
       h.name AS "husbandName",
       w.name AS "wifeName",
       ct.email AS email,
       ct.main_contact AS "mainContact",
       s.date AS "scheduleDate",
       s.start_time AS "scheduleStartTime",
       s.end_time AS "scheduleEndTime"
     FROM "PMO_Appointments" a
     JOIN "PMO_Couples" c ON c.couple_id = a."coupleID"
     LEFT JOIN "PMO_Contacts" ct ON ct.couple_id = c.couple_id
     LEFT JOIN "PMO_Persons" h ON h.couple_id = c.couple_id AND h.role = 'husband'
     LEFT JOIN "PMO_Persons" w ON w.couple_id = c.couple_id AND w.role = 'wife'
     JOIN "PmoSchedules" s ON s."pmoID" = a."scheduleId"
    WHERE s.date = ${targetDateSql}
      AND a.status = 'APPROVED'`,
  );
  return result.rows;
}

function getPmoFullName(ctx) {
  const husband = ctx?.husbandName ? String(ctx.husbandName).trim() : '';
  const wife = ctx?.wifeName ? String(ctx.wifeName).trim() : '';
  if (husband && wife) return `${husband} & ${wife}`;
  return husband || wife || 'Client';
}

function formatScheduleDate(ctx) {
  const date = ctx?.scheduleDate ? new Date(ctx.scheduleDate) : null;
  if (!date || Number.isNaN(date.getTime())) return 'your PMO schedule date';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function sendPmoReminder({ ctx, when }) {
  const recipient = String(ctx.mainContact || '').trim();
  if (!recipient) return;

  const fullName = getPmoFullName(ctx);
  const datePart = formatScheduleDate(ctx);

  const baseMessage = `Hello ${fullName}, this is a reminder for your Pre-Marriage Orientation schedule on ${datePart}.`;
  const message = when === 'twoDaysBefore'
    ? `${baseMessage} This is a reminder 2 days before your schedule.`
    : `${baseMessage} This is a reminder for your appointment today.`;

  const eventType = when === 'twoDaysBefore'
    ? 'PMO_REMINDER_2_DAYS'
    : 'PMO_REMINDER_SAME_DAY';

  // Avoid duplicate SMS by checking existing log with same event type and recipient
  const existing = await db.query(
    'SELECT 1 FROM "SMS_Logs" WHERE event_type = $1 AND recipient = $2 LIMIT 1',
    [eventType, recipient]
  );
  if (existing.rowCount > 0) {
    return;
  }

  const smsResult = await sendSMS(recipient, message);
  await logPmoSmsAttempt({
    appointmentId: ctx.appointmentId,
    coupleId: ctx.coupleId,
    eventType,
    recipient,
    message,
    success: smsResult.success,
    providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
    errorMessage: smsResult.success ? null : smsResult.error?.message
  });

  if (!smsResult.success) {
    console.error('PMO reminder SMS failed:', smsResult.error?.message || smsResult.error);
  }

  const email = ctx.email ? String(ctx.email).trim() : '';
  if (email && isValidEmail(email)) {
    const subject = when === 'twoDaysBefore'
      ? 'Pre-Marriage Orientation Schedule Reminder (2 days before)'
      : 'Pre-Marriage Orientation Schedule Reminder (today)';
    const emailResult = await sendEmail(email, subject, message);
    if (!emailResult.success) {
      console.error('PMO reminder email failed:', emailResult.error?.message || emailResult.error);
    }
  }
}

function startPmoReminderJob() {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = dayjs();

      // 2 days before reminders
      const twoDaysRows = await loadPmoReminderContextForDateRange('CURRENT_DATE + INTERVAL \'2 days\'');
      for (const ctx of twoDaysRows) {
        await sendPmoReminder({ ctx, when: 'twoDaysBefore' });
      }

      // Same-day reminders
      const sameDayRows = await loadPmoReminderContextForDateRange('CURRENT_DATE');
      for (const ctx of sameDayRows) {
        await sendPmoReminder({ ctx, when: 'sameDay' });
      }

      if (twoDaysRows.length || sameDayRows.length) {
        console.log('PMO reminders processed:', {
          twoDays: twoDaysRows.length,
          sameDay: sameDayRows.length,
          at: now.toISOString()
        });
      }
    } catch (e) {
      console.error('PMO reminder job failed:', e?.message || e);
    }
  });
}

module.exports = {
  startPmoReminderJob
};
