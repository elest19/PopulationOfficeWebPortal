const cron = require('node-cron');
const dayjs = require('dayjs');

const db = require('../config/db');
const { sendSMS } = require('../services/textbeeSms');
const { sendEmail, isValidEmail } = require('../services/mailjetEmail');

async function logFamilyPlanningSmsAttempt({
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
        null, // appointment_id is reserved for PMO appointments; leave null for Family Planning
        null,
        String(eventType || 'FP_UNKNOWN'),
        String(recipient || ''),
        String(message || ''),
        Boolean(success),
        providerResponse ? providerResponse : null,
        errorMessage ? String(errorMessage) : null
      ]
    );
  } catch (e) {
    console.error('Failed to write Family Planning SMS log (job):', e?.message || e);
  }
}

async function sendFamilyPlanningReminder({ row, when }) {
  const contact = String(row.contact_number || '').replace(/[^0-9]/g, '');
  if (!contact) return;

  const datePart = row.pref_date
    ? dayjs(row.pref_date).format('MMMM D, YYYY')
    : 'your scheduled date';

  const baseMessage = `Hello ${row.full_name || 'Client'}, this is a reminder for your Family Planning booking on ${datePart}.`;
  const message = when === 'twoDaysBefore'
    ? `${baseMessage} This is a reminder 2 days before your schedule.`
    : `${baseMessage} This is a reminder for your appointment today.`;

  // Avoid duplicate SMS by checking existing log with same event type and recipient
  const eventType = when === 'twoDaysBefore'
    ? 'FP_REMINDER_2_DAYS'
    : 'FP_REMINDER_SAME_DAY';

  const existing = await db.query(
    'SELECT 1 FROM "SMS_Logs" WHERE event_type = $1 AND recipient = $2 LIMIT 1',
    [eventType, contact]
  );
  if (existing.rowCount > 0) {
    return;
  }

  const smsResult = await sendSMS(contact, message);
  await logFamilyPlanningSmsAttempt({
    eventType,
    recipient: contact,
    message,
    success: smsResult.success,
    providerResponse: smsResult.success ? smsResult.data : (smsResult.error?.data || null),
    errorMessage: smsResult.success ? null : smsResult.error?.message
  });

  if (!smsResult.success) {
    console.error('Family Planning reminder SMS failed:', smsResult.error?.message || smsResult.error);
  }

  // Email (if user id linked)
  if (row.userid != null) {
    try {
      const userResult = await db.query('SELECT email FROM users WHERE userid = $1', [row.userid]);
      const user = userResult.rows[0];
      const email = user && user.email ? String(user.email).trim() : '';
      if (email && isValidEmail(email)) {
        const subject = when === 'twoDaysBefore'
          ? 'Family Planning Appointment Reminder (2 days before)'
          : 'Family Planning Appointment Reminder (today)';
        const emailResult = await sendEmail(email, subject, message);
        if (!emailResult.success) {
          console.error('Family Planning reminder email failed:', emailResult.error?.message || emailResult.error);
        }
      }
    } catch (e) {
      console.error('Family Planning reminder email lookup failed:', e?.message || e);
    }
  }
}

function startFamilyPlanningReminderJob() {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = dayjs();

      // 2 days before: bookings whose pref_date = current_date + 2 days and status Approved
      const twoDaysRowsResult = await db.query(
        `SELECT "fpbID" as id, full_name, contact_number, pref_date, userid
         FROM "FamilyPlanningBooking"
         WHERE status = 'Approved'
           AND pref_date = (CURRENT_DATE + INTERVAL '2 days')`
      );

      for (const row of twoDaysRowsResult.rows) {
        await sendFamilyPlanningReminder({ row, when: 'twoDaysBefore' });
      }

      // Same-day reminders: pref_date = today and status Approved
      const sameDayRowsResult = await db.query(
        `SELECT "fpbID" as id, full_name, contact_number, pref_date, userid
         FROM "FamilyPlanningBooking"
         WHERE status = 'Approved'
           AND pref_date = CURRENT_DATE`
      );

      for (const row of sameDayRowsResult.rows) {
        await sendFamilyPlanningReminder({ row, when: 'sameDay' });
      }

      if (twoDaysRowsResult.rows.length || sameDayRowsResult.rows.length) {
        console.log('Family Planning reminders processed:', {
          twoDays: twoDaysRowsResult.rows.length,
          sameDay: sameDayRowsResult.rows.length,
          at: now.toISOString()
        });
      }
    } catch (e) {
      console.error('Family Planning reminder job failed:', e?.message || e);
    }
  });
}

module.exports = {
  startFamilyPlanningReminderJob
};
