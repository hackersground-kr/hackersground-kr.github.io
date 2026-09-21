const { SolapiMessageService } = require('solapi');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || '';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || '';
const SOLAPI_SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER || '';

function normalizeKoreanMobileNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const localNumber = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;
  return /^01[016789]\d{7,8}$/.test(localNumber) ? localNumber : '';
}

function normalizeKoreanSenderNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const localNumber = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;
  return /^0\d{8,10}$/.test(localNumber) ? localNumber : '';
}

function isConfigured() {
  return Boolean(SOLAPI_API_KEY && SOLAPI_API_SECRET && normalizeKoreanSenderNumber(SOLAPI_SENDER_NUMBER));
}

async function sendSms({ to, text }) {
  const recipient = normalizeKoreanMobileNumber(to);
  if (!isConfigured() || !recipient || !text) {
    return false;
  }

  try {
    const messageService = new SolapiMessageService(SOLAPI_API_KEY, SOLAPI_API_SECRET);
    await messageService.send({
      to: recipient,
      from: normalizeKoreanSenderNumber(SOLAPI_SENDER_NUMBER),
      text,
    });
    return true;
  } catch (error) {
    console.error('[Solapi] SMS delivery failed:', error.message);
    return false;
  }
}

module.exports = {
  isConfigured,
  normalizeKoreanMobileNumber,
  normalizeKoreanSenderNumber,
  sendSms,
};