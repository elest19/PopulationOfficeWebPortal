const axios = require('axios');

const BASE_URL = 'https://api.mailjet.com/v3.1';

function isValidEmail(email) {
  if (!email) return false;
  const v = String(email).trim();
  if (!v) return false;
  // Simple but practical email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function sendEmail(toEmail, subject, text) {
  const apiKeyPublic = process.env.MJ_APIKEY_PUBLIC;
  const apiKeyPrivate = process.env.MJ_APIKEY_PRIVATE;

  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || 'Municipal Office of Population';

  if (!apiKeyPublic || !apiKeyPrivate) {
    return {
      success: false,
      error: { message: 'Mailjet is not configured. Missing MJ_APIKEY_PUBLIC or MJ_APIKEY_PRIVATE.' }
    };
  }

  if (!fromEmail || !String(fromEmail).trim()) {
    return {
      success: false,
      error: { message: 'Mailjet is not configured. Missing MAILJET_FROM_EMAIL.' }
    };
  }

  if (!isValidEmail(toEmail)) {
    return { success: false, error: { message: 'Invalid email address.' } };
  }

  if (!subject || !String(subject).trim()) {
    return { success: false, error: { message: 'Email subject is required.' } };
  }

  if (!text || !String(text).trim()) {
    return { success: false, error: { message: 'Email body is required.' } };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/send`,
      {
        Messages: [
          {
            From: {
              Email: String(fromEmail).trim(),
              Name: String(fromName)
            },
            To: [
              {
                Email: String(toEmail).trim()
              }
            ],
            Subject: String(subject),
            TextPart: String(text)
          }
        ]
      },
      {
        auth: {
          username: apiKeyPublic,
          password: apiKeyPrivate
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    const payload = error?.response?.data || null;
    const message = payload ? JSON.stringify(payload) : (error?.message || 'Email request failed');
    return { success: false, error: { message, data: payload } };
  }
}

module.exports = {
  sendEmail,
  isValidEmail
};
