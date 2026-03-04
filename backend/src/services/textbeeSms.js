const axios = require('axios');

const BASE_URL = process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev/api/v1';
const API_KEY = process.env.TEXTBEE_API_KEY;
const DEVICE_ID = process.env.TEXTBEE_DEVICE_ID;

async function sendSMS(phoneNumber, message) {
  if (!API_KEY || !DEVICE_ID) {
    return {
      success: false,
      error: {
        message: 'TextBee is not configured. Missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID.'
      }
    };
  }

  if (!phoneNumber || !String(phoneNumber).trim()) {
    return { success: false, error: { message: 'Phone number is required.' } };
  }

  if (!message || !String(message).trim()) {
    return { success: false, error: { message: 'Message is required.' } };
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/gateway/devices/${DEVICE_ID}/send-sms`,
      {
        recipients: [String(phoneNumber).trim()],
        message: String(message)
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    const payload = error?.response?.data || null;
    const message = payload ? JSON.stringify(payload) : (error?.message || 'SMS request failed');
    return { success: false, error: { message, data: payload } };
  }
}

module.exports = {
  sendSMS
};
