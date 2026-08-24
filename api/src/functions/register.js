const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');
const { Resend } = require('resend');

/**
 * POST /api/register
 *
 * 환경 변수:
 *   AZURE_STORAGE_ACCOUNT_NAME  - Storage 계정 이름
 *   AZURE_STORAGE_ACCOUNT_KEY   - Storage 계정 키
 *   ALLOWED_ORIGIN              - CORS 허용 origins (콤마 구분)
 *   RESEND_API_KEY              - Resend API 키 (확인 이메일 발송)
 *   SLACK_WEBHOOK_URL           - 슬랙 Incoming Webhook URL
 */

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY     = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME      = 'EventRegistrations';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://hackersground-kr.github.io')
  .split(',').map(o => o.trim()).filter(Boolean);
const RESEND_API_KEY   = process.env.RESEND_API_KEY || '';
const SLACK_WEBHOOK    = process.env.SLACK_WEBHOOK_URL || '';
const AI_SEARCHABLE_HOMEPAGE_EVENT_ID = 'ai-searchable-homepage';
const AI_SEARCHABLE_HOMEPAGE_PAYMENT_INSTRUCTIONS = process.env.AI_SEARCHABLE_HOMEPAGE_PAYMENT_INSTRUCTIONS || '';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCorsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

// 신청자에게 확인 이메일 발송
async function sendConfirmEmail({ eventId, name, email, eventName }) {
  if (!RESEND_API_KEY) return;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const paymentNotice = eventId === AI_SEARCHABLE_HOMEPAGE_EVENT_ID
      && AI_SEARCHABLE_HOMEPAGE_PAYMENT_INSTRUCTIONS
      ? `
          <section style="margin: 24px 0; padding: 20px; border: 1px solid #00ff41; border-radius: 12px; background: #f4fff7;">
            <h3 style="margin: 0 0 12px; color: #137333;">참가비 입금 안내</h3>
            <p style="margin: 0 0 12px;">참가 확정을 위해 아래 계좌로 <strong>30,000원</strong>을 입금해 주세요.</p>
            <p style="margin: 0 0 12px; font-size: 1.05em;"><strong>${escapeHtml(AI_SEARCHABLE_HOMEPAGE_PAYMENT_INSTRUCTIONS)}</strong></p>
            <p style="margin: 0;">입금자명은 신청하신 성함으로 부탁드립니다. 입금 확인 후 참가가 확정됩니다.</p>
          </section>
        `
      : '';
    await resend.emails.send({
      from: 'Hackers Ground <events@hackersground.kr>',
      to: email,
      subject: `[Hackers Ground] ${escapeHtml(eventName)} 신청이 완료되었습니다 🎉`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00ff41;">안녕하세요, ${escapeHtml(name)}님! 👋</h2>
          <p><strong>${escapeHtml(eventName)}</strong> 신청이 완료되었습니다.</p>
          ${paymentNotice}
          <p>행사 관련 상세 안내는 신청하신 이메일(<strong>${escapeHtml(email)}</strong>)로 발송해 드릴 예정입니다.</p>
          <hr style="border-color: #333;" />
          <p style="color: #888; font-size: 0.85em;">
            문의: <a href="mailto:events@hackersground.kr">events@hackersground.kr</a><br>
            Hackers Ground — 클라우드 개발자들을 위한 놀이터
          </p>
        </div>
      `,
    });
  } catch (err) {
    // 이메일 실패해도 신청 자체는 성공 처리
    console.error('[Resend] 이메일 발송 실패:', err.message);
  }
}

// 슬랙 알림
async function notifySlack({ name, email, phone, eventName, affiliation }) {
  if (!SLACK_WEBHOOK) return;
  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎉 새 행사 신청!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🎉 새 행사 신청!*\n*행사:* ${eventName}\n*이름:* ${name}\n*이메일:* ${email}${phone ? `\n*전화:* ${phone}` : ''}${affiliation ? `\n*소속:* ${affiliation}` : ''}`,
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[Slack] 알림 실패:', err.message);
  }
}

app.http('register', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'register',
  handler: async (request, context) => {
    const corsHeaders = getCorsHeaders(request.headers.get('origin') || '');

    // Preflight
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        headers: corsHeaders,
        jsonBody: { error: '요청 본문을 파싱할 수 없어요.' },
      };
    }

    // 필수 필드 검증
    const { eventId, eventName, name, email } = body;
    if (!eventId || !eventName || !name || !email) {
      return {
        status: 400,
        headers: corsHeaders,
        jsonBody: { error: 'eventId, eventName, name, email은 필수예요.' },
      };
    }

    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        status: 400,
        headers: corsHeaders,
        jsonBody: { error: '이메일 형식이 올바르지 않아요.' },
      };
    }

    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
      context.error('Storage 환경 변수가 설정되지 않았습니다.');
      return {
        status: 500,
        headers: corsHeaders,
        jsonBody: { error: '서버 설정 오류입니다. 관리자에게 문의하세요.' },
      };
    }

    // Azure Table Storage에 저장
    try {
      const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
      const tableClient = new TableClient(
        `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
        TABLE_NAME,
        credential
      );

      await tableClient.createTable().catch(() => {});

      const rowKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await tableClient.createEntity({
        partitionKey: eventId,
        rowKey,
        eventName,
        name,
        email,
        phone: body.phone || '',
        affiliation: body.affiliation || '',
        message: body.message || '',
        registeredAt: new Date().toISOString(),
        paymentStatus: 'unpaid',
        paymentConfirmedAt: '',
        paymentConfirmedBy: '',
      });

      context.log(`[등록] ${eventId} | ${name} <${email}>`);

      // 이메일 + 슬랙 알림 (실패해도 신청 성공 처리)
      await Promise.all([
        sendConfirmEmail({ eventId, name, email, eventName }),
        notifySlack({ name, email, phone: body.phone, eventName, affiliation: body.affiliation }),
      ]);

      return {
        status: 201,
        headers: corsHeaders,
        jsonBody: {
          success: true,
          message: `${name}님, 신청이 완료되었어요! ${email}로 확인 이메일을 보내드렸어요.`,
        },
      };

    } catch (err) {
      context.error('Table Storage 오류:', err);
      return {
        status: 500,
        headers: corsHeaders,
        jsonBody: { error: '신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      };
    }
  },
});
