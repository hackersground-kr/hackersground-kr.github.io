const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

/**
 * POST /api/register
 *
 * Body (JSON):
 * {
 *   "eventId": "hackersground-2025",
 *   "eventName": "해커그라운드 2025 해커톤",
 *   "name": "홍길동",
 *   "email": "hong@example.com",
 *   "phone": "010-1234-5678",     // optional
 *   "affiliation": "XX대학교",    // optional - 소속
 *   "message": "..."              // optional - 한마디
 * }
 *
 * 환경 변수:
 *   AZURE_STORAGE_ACCOUNT_NAME  - Storage 계정 이름
 *   AZURE_STORAGE_ACCOUNT_KEY   - Storage 계정 키
 *   ALLOWED_ORIGIN              - CORS 허용 origin (기본: https://hackersground-kr.github.io)
 */

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME = 'EventRegistrations';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://hackersground-kr.github.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

app.http('register', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'register',
  handler: async (request, context) => {

    // Preflight
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return {
        status: 400,
        headers: CORS_HEADERS,
        jsonBody: { error: '요청 본문을 파싱할 수 없어요.' },
      };
    }

    // 필수 필드 검증
    const { eventId, eventName, name, email } = body;
    if (!eventId || !eventName || !name || !email) {
      return {
        status: 400,
        headers: CORS_HEADERS,
        jsonBody: { error: 'eventId, eventName, name, email은 필수예요.' },
      };
    }

    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        status: 400,
        headers: CORS_HEADERS,
        jsonBody: { error: '이메일 형식이 올바르지 않아요.' },
      };
    }

    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
      context.error('Storage 환경 변수가 설정되지 않았습니다.');
      return {
        status: 500,
        headers: CORS_HEADERS,
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

      // 테이블이 없으면 생성
      await tableClient.createTable().catch(() => {});

      const rowKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await tableClient.createEntity({
        partitionKey: eventId,   // 행사별로 그룹화
        rowKey,
        eventName,
        name,
        email,
        phone: body.phone || '',
        affiliation: body.affiliation || '',
        message: body.message || '',
        registeredAt: new Date().toISOString(),
      });

      context.log(`[등록] ${eventId} | ${name} <${email}>`);

      return {
        status: 201,
        headers: CORS_HEADERS,
        jsonBody: {
          success: true,
          message: `${name}님, 신청이 완료되었어요! 확인 이메일을 보내드릴게요.`,
        },
      };

    } catch (err) {
      context.error('Table Storage 오류:', err);
      return {
        status: 500,
        headers: CORS_HEADERS,
        jsonBody: { error: '신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      };
    }
  },
});
