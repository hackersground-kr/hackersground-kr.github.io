const { app } = require('@azure/functions');
const { AzureNamedKeyCredential, TableClient } = require('@azure/data-tables');
const { Resend } = require('resend');
const { sendSms } = require('./sms');

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EVENTS_TABLE = 'SiteContent';
const REGISTRATIONS_TABLE = 'EventRegistrations';
const REMINDER_FROM = process.env.EVENT_REMINDER_FROM || 'Hackers Ground <events@hackersground.kr>';

function getTableClient(tableName) {
  if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
    throw new Error('Storage 환경 변수가 설정되지 않았습니다.');
  }

  return new TableClient(
    `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
    tableName,
    new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY),
  );
}

function koreanDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function reminderDateKey(now) {
  const [year, month, day] = koreanDateKey(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
}

function formatEventStart(startAt) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendReminderEmail({ email, name, event, eventUrl }) {
  if (!RESEND_API_KEY || !email) {
    return false;
  }

  try {
    const eventStart = formatEventStart(event.eventStartAt);
    await new Resend(RESEND_API_KEY).emails.send({
      from: REMINDER_FROM,
      to: email,
      subject: `[Hackers Ground] ${event.title} 행사 7일 전 안내`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>안녕하세요, ${escapeHtml(name)}님!</h2>
          <p><strong>${escapeHtml(event.title)}</strong> 행사가 일주일 앞으로 다가왔습니다.</p>
          <p>일시: ${escapeHtml(eventStart)}</p>
          ${event.location ? `<p>장소: ${escapeHtml(event.location)}</p>` : ''}
          <p><a href="${escapeHtml(eventUrl)}">행사 상세 보기</a></p>
          <p>행사에서 뵙겠습니다.</p>
        </div>`,
    });
    return true;
  } catch (error) {
    console.error('[event-reminder] email delivery failed:', error.message);
    return false;
  }
}

async function sendReminderSms({ phone, name, event, eventUrl }) {
  const eventStart = formatEventStart(event.eventStartAt);
  const location = event.location ? ` 장소: ${event.location}.` : '';
  return sendSms({
    to: phone,
    text: `[Hackers Ground] ${name}님, ${event.title} 행사가 7일 남았습니다. 일시: ${eventStart}.${location} 상세: ${eventUrl}`,
  });
}

async function sendEventReminders(now, context) {
  const events = getTableClient(EVENTS_TABLE);
  const registrations = getTableClient(REGISTRATIONS_TABLE);
  const targetDate = reminderDateKey(now);
  let smsSent = 0;
  let emailSent = 0;

  for await (const event of events.listEntities({
    queryOptions: { filter: "PartitionKey eq 'event' and status eq 'published'" },
  })) {
    const eventStart = new Date(event.eventStartAt);
    if (Number.isNaN(eventStart.getTime()) || koreanDateKey(eventStart) !== targetDate) {
      continue;
    }

    const eventUrl = `https://hackersground.kr/events/content.html?slug=${encodeURIComponent(event.rowKey)}`;
    for await (const registration of registrations.listEntities({
      queryOptions: { filter: `PartitionKey eq '${event.rowKey}'` },
    })) {
      const [emailDelivered, smsDelivered] = await Promise.all([
        registration.reminderEmailSentAt
          ? false
          : sendReminderEmail({ email: registration.email, name: registration.name, event, eventUrl }),
        registration.reminderSmsSentAt
          ? false
          : sendReminderSms({ phone: registration.phone, name: registration.name, event, eventUrl }),
      ]);

      if (!emailDelivered && !smsDelivered) {
        continue;
      }

      const sentAt = new Date().toISOString();
      await registrations.updateEntity({
        partitionKey: event.rowKey,
        rowKey: registration.rowKey,
        ...(emailDelivered ? { reminderEmailSentAt: sentAt } : {}),
        ...(smsDelivered ? { reminderSmsSentAt: sentAt } : {}),
      }, 'Merge');
      emailSent += Number(emailDelivered);
      smsSent += Number(smsDelivered);
    }
  }

  context.log(`[event-reminder] completed: email=${emailSent}, sms=${smsSent}`);
}

app.timer('sendEventReminders', {
  schedule: '0 0 0 * * *',
  handler: async (timer, context) => {
    try {
      await sendEventReminders(new Date(), context);
    } catch (error) {
      context.error('[event-reminder] failed:', error);
    }
  },
});

module.exports = {
  koreanDateKey,
  reminderDateKey,
  sendEventReminders,
};