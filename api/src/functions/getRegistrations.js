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
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://hackersground-kr.github.io')
  .split(',').map(o => o.trim()).filter(Boolean);

// 어드민 인증: Azure 엔터프라이즈 앱에서 appRoleAssignmentRequired=true로 관리
// ADMIN_ALLOWED_EMAILS가 설정된 경우 추가 필터로 동작, 미설정 시 로그인된 사용자 전체 허용
const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function getCorsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Email',
    'Content-Type': 'application/json',
  };
}

app.http('getRegistrations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'registrations',
  handler: async (request, context) => {

    if (request.method === 'OPTIONS') {
      return { status: 204, headers: getCorsHeaders(request.headers.get('origin') || '') };
    }

    // 이메일 헤더 확인 (Azure AD 로그인 후 MSAL이 전송)
    const adminEmail = (request.headers.get('x-admin-email') || '').toLowerCase();
    if (!adminEmail) {
      context.log('[admin] 접근 거부: 이메일 헤더 없음');
      return {
        status: 403,
        headers: getCorsHeaders(request.headers.get('origin') || ''),
        jsonBody: { error: '로그인이 필요합니다.' },
      };
    }
    // ADMIN_ALLOWED_EMAILS 설정 시 추가 필터 적용 (미설정 시 Azure AD 할당 사용자 전체 허용)
    if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(adminEmail)) {
      context.log(`[admin] 접근 거부 (이메일 필터): ${adminEmail}`);
      return {
        status: 403,
        headers: getCorsHeaders(request.headers.get('origin') || ''),
        jsonBody: { error: '접근 권한이 없어요. Azure 엔터프라이즈 앱에서 사용자 할당을 확인해주세요.' },
      };
    }
    context.log(`[admin] 접근 허용: ${adminEmail}`);

    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
      return { status: 500, headers: getCorsHeaders(request.headers.get("origin") || ""), jsonBody: { error: '서버 설정 오류입니다.' } };
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
        headers: getCorsHeaders(request.headers.get("origin") || ""),
        jsonBody: {
          total: rows.length,
          accessedBy: adminEmail,
          registrations: rows,
        },
      };

    } catch (err) {
      context.error('조회 오류:', err);
      return { status: 500, headers: getCorsHeaders(request.headers.get("origin") || ""), jsonBody: { error: '데이터 조회 중 오류가 발생했어요.' } };
    }
  },
});
