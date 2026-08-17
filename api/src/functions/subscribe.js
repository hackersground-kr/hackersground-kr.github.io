const { app } = require('@azure/functions');
const { createHash } = require('node:crypto');
const { AzureNamedKeyCredential, TableClient } = require('@azure/data-tables');

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME = 'NewsletterSubscribers';
const AFFILIATIONS = new Set(['developer', 'worker', 'representative', 'student']);
const INTERESTS = new Set(['ai', 'cloud', 'github', 'career', 'opensource']);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN
  || 'https://hackersground.kr,https://hackersground-kr.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function getTableClient() {
  if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
    throw new Error('Storage 환경 변수가 설정되지 않았습니다.');
  }

  return new TableClient(
    `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
    TABLE_NAME,
    new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY),
  );
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

app.http('subscribe', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'subscribe',
  handler: async (request, context) => {
    const headers = corsHeaders(request.headers.get('origin') || '');
    if (request.method === 'OPTIONS') {
      return { status: 204, headers };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, headers, jsonBody: { error: '요청 본문을 읽을 수 없습니다.' } };
    }

    const email = normalizeEmail(body.email);
    const affiliation = typeof body.affiliation === 'string' ? body.affiliation : '';
    const interests = Array.isArray(body.interests) ? body.interests : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { status: 400, headers, jsonBody: { error: '올바른 이메일 주소를 입력해주세요.' } };
    }
    if (!AFFILIATIONS.has(affiliation)) {
      return { status: 400, headers, jsonBody: { error: '소속을 선택해주세요.' } };
    }
    if (interests.length === 0 || interests.some((interest) => !INTERESTS.has(interest))) {
      return { status: 400, headers, jsonBody: { error: '관심사를 하나 이상 선택해주세요.' } };
    }
    if (body.consent !== true) {
      return { status: 400, headers, jsonBody: { error: '뉴스레터 수신 동의가 필요합니다.' } };
    }

    try {
      const tableClient = getTableClient();
      await tableClient.createTable().catch(() => {});

      const rowKey = createHash('sha256').update(email).digest('hex');
      const now = new Date().toISOString();
      let existing;
      try {
        existing = await tableClient.getEntity('newsletter', rowKey);
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      await tableClient.upsertEntity({
        partitionKey: 'newsletter',
        rowKey,
        email,
        status: 'active',
        affiliation,
        interests: JSON.stringify([...new Set(interests)]),
        source: typeof body.source === 'string' ? body.source.slice(0, 40) : 'website',
        consentText: '해커그라운드 소식 및 행사 안내 이메일 수신에 동의합니다.',
        consentedAt: now,
        subscribedAt: existing?.subscribedAt || now,
        updatedAt: now,
      }, 'Replace');

      context.log(`[newsletter] subscribed ${rowKey}`);
      return {
        status: 200,
        headers,
        jsonBody: {
          success: true,
          message: '구독이 완료됐습니다. 월 1~2회 해커그라운드 소식을 보내드릴게요.',
        },
      };
    } catch (error) {
      context.error('뉴스레터 구독 처리 오류:', error);
      return { status: 500, headers, jsonBody: { error: '구독 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' } };
    }
  },
});
