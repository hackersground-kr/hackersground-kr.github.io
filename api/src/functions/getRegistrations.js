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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Easy Auth가 검증한 사용자 정보 헤더 확인
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        headers: CORS_HEADERS,
        jsonBody: { error: 'Microsoft 계정 로그인이 필요해요.' },
      };
    }

    let userInfo = {};
    try {
      userInfo = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf-8'));
      context.log(`[admin] 접근: ${userInfo.userDetails || '알 수 없음'}`);
    } catch { /* 파싱 실패해도 헤더 존재 = 인증 성공 */ }

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
          accessedBy: userInfo.userDetails || '알 수 없음',
          registrations: rows,
        },
      };

    } catch (err) {
      context.error('조회 오류:', err);
      return { status: 500, headers: CORS_HEADERS, jsonBody: { error: '데이터 조회 중 오류가 발생했어요.' } };
    }
  },
});
