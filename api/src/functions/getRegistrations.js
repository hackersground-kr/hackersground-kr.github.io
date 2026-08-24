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
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Email',
    'Content-Type': 'application/json',
  };
}

app.http('getRegistrations', {
  methods: ['GET', 'DELETE', 'PATCH', 'OPTIONS'],
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
    const registrationId = request.query.get('id') || '';
    const showTrash = request.query.get('trash') === 'true';

    try {
      const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
      const tableClient = new TableClient(
        `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
        TABLE_NAME,
        credential
      );

      if (request.method === 'DELETE' || request.method === 'PATCH') {
        if (!eventId || !registrationId) {
          return { status: 400, headers: getCorsHeaders(request.headers.get('origin') || ''), jsonBody: { error: '행사와 신청자 식별자가 필요합니다.' } };
        }

        const registration = await tableClient.getEntity(eventId, registrationId);
        const now = new Date().toISOString();
        let requestBody = {};
        if (request.method === 'PATCH') {
          try {
            requestBody = await request.json();
          } catch {
            requestBody = {};
          }
        }
        if (request.method === 'DELETE') {
          if (registration.trashedAt) {
            return { status: 409, headers: getCorsHeaders(request.headers.get('origin') || ''), jsonBody: { error: '이미 휴지통에 있는 신청자입니다.' } };
          }
          await tableClient.updateEntity({
            partitionKey: eventId,
            rowKey: registrationId,
            trashedAt: now,
            trashedBy: adminEmail,
          }, 'Merge');
          context.log(`[admin] 신청자 휴지통 이동: ${eventId}/${registrationId} by ${adminEmail}`);
        } else if (requestBody.paymentStatus) {
          if (!['paid', 'unpaid'].includes(requestBody.paymentStatus)) {
            return { status: 400, headers: getCorsHeaders(request.headers.get('origin') || ''), jsonBody: { error: '올바른 입금 상태가 아닙니다.' } };
          }
          await tableClient.updateEntity({
            partitionKey: eventId,
            rowKey: registrationId,
            paymentStatus: requestBody.paymentStatus,
            paymentConfirmedAt: requestBody.paymentStatus === 'paid' ? now : '',
            paymentConfirmedBy: requestBody.paymentStatus === 'paid' ? adminEmail : '',
          }, 'Merge');
          context.log(`[admin] 입금 상태 변경: ${eventId}/${registrationId} -> ${requestBody.paymentStatus} by ${adminEmail}`);
        } else {
          if (!registration.trashedAt) {
            return { status: 409, headers: getCorsHeaders(request.headers.get('origin') || ''), jsonBody: { error: '휴지통에 없는 신청자입니다.' } };
          }
          await tableClient.updateEntity({
            partitionKey: eventId,
            rowKey: registrationId,
            trashedAt: '',
            trashedBy: '',
            restoredAt: now,
          }, 'Merge');
          context.log(`[admin] 신청자 복원: ${eventId}/${registrationId} by ${adminEmail}`);
        }
        return { status: 204, headers: getCorsHeaders(request.headers.get('origin') || '') };
      }

      const filter = eventId ? `PartitionKey eq '${eventId}'` : undefined;
      const rows = [];
      for await (const entity of tableClient.listEntities({ queryOptions: { filter } })) {
        if (Boolean(entity.trashedAt) !== showTrash) {
          continue;
        }
        rows.push({
          eventId: entity.partitionKey,
          id: entity.rowKey,
          registeredAt: entity.registeredAt,
          name: entity.name,
          email: entity.email,
          phone: entity.phone || '',
          affiliation: entity.affiliation || '',
          message: entity.message || '',
          trashedAt: entity.trashedAt || '',
          paymentStatus: entity.paymentStatus || 'unpaid',
          paymentConfirmedAt: entity.paymentConfirmedAt || '',
          paymentConfirmedBy: entity.paymentConfirmedBy || '',
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

app.timer('purgeTrashedRegistrations', {
  schedule: '0 0 0 * * *',
  handler: async (timer, context) => {
    if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
      context.error('[admin] Storage 환경 변수가 설정되지 않아 휴지통 정리를 건너뜁니다.');
      return;
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const tableClient = new TableClient(
      `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
      TABLE_NAME,
      new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY),
    );
    let deleted = 0;
    for await (const entity of tableClient.listEntities()) {
      const trashedAt = new Date(entity.trashedAt);
      if (entity.trashedAt && !Number.isNaN(trashedAt.getTime()) && trashedAt.getTime() <= cutoff) {
        await tableClient.deleteEntity(entity.partitionKey, entity.rowKey);
        deleted += 1;
      }
    }
    context.log(`[admin] 휴지통 신청자 정리 완료: ${deleted}건`);
  },
});
