const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

/**
 * GET /api/registrations
 *
 * 인증: Microsoft 계정 로그인 (Easy Auth)
 *   Authorization: Bearer <MSAL access token>
 *
 * Query params:
 *   event  - 행사 ID (없으면 전체 조회)
 */

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME = 'EventRegistrations';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://hackersground-kr.github.io';
// 허용된 어드민 이메일 목록 (콤마로 구분, 소문자로 비교)
const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Email',
  'Content-Type': 'application/json',
};

app.http('getRegistrations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'registrations',
  handler: async (request, context) => {

    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS };
    }

    // 이메일 헤더로 어드민 인증
    const adminEmail = (request.headers.get('x-admin-email') || '').toLowerCase();
    if (!adminEmail || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(adminEmail))) {
      context.log(`[admin] 접근 거부: ${adminEmail || '(없음)'}`);
      return {
        status: 403,
        headers: CORS_HEADERS,
        jsonBody: { error: '접근 권한이 없어요. 어드민 이메일을 확인해주세요.' },
      };
    }
    context.log(`[admin] 접근 허용: ${adminEmail}`);

    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
      return { status: 500, headers: CORS_HEADERS, jsonBody: { error: '서버 설정 오류입니다.' } };
    }

    const eventId = request.query.get('event') || null;

    try {
      const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
      const tableClient = new TableClient(
        `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
        TABLE_NAME,
        credential
      );

      const filter = eventId ? `PartitionKey eq '${eventId}'` : undefined;
      const rows = [];
      for await (const entity of tableClient.listEntities({ queryOptions: { filter } })) {
        rows.push({
          eventId: entity.partitionKey,
          registeredAt: entity.registeredAt,
          name: entity.name,
          email: entity.email,
          phone: entity.phone || '',
          affiliation: entity.affiliation || '',
          message: entity.message || '',
        });
      }

      rows.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

      return {
        status: 200,
        headers: CORS_HEADERS,
        jsonBody: {
          total: rows.length,
          accessedBy: adminEmail,
          registrations: rows,
        },
      };

    } catch (err) {
      context.error('조회 오류:', err);
      return { status: 500, headers: CORS_HEADERS, jsonBody: { error: '데이터 조회 중 오류가 발생했어요.' } };
    }
  },
});
