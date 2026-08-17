const { app } = require('@azure/functions');
const { randomUUID } = require('node:crypto');
const { AzureNamedKeyCredential, TableClient } = require('@azure/data-tables');
const { Resend } = require('resend');

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM || 'Hackers Ground <events@hackersground.kr>';
const SUBSCRIBERS_TABLE = 'NewsletterSubscribers';
const CAMPAIGNS_TABLE = 'NewsletterCampaigns';
const CONTENT_TABLE = 'SiteContent';
const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN
  || 'https://hackersground.kr,https://hackersground-kr.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CONTENT_KINDS = new Set(['post', 'event']);
const AFFILIATIONS = new Set(['developer', 'worker', 'representative', 'student']);
const INTERESTS = new Set(['ai', 'cloud', 'github', 'career', 'opensource']);

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Email',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

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

async function ensureCampaignsTable() {
  const client = getTableClient(CAMPAIGNS_TABLE);
  await client.createTable().catch((error) => {
    if (error.statusCode !== 409) {
      throw error;
    }
  });
  return client;
}

function getAdminEmail(request) {
  const email = (request.headers.get('x-admin-email') || '').trim().toLowerCase();
  if (!email) {
    return '';
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email)) {
    return '';
  }
  return email;
}

function asSubscriber(entity) {
  let interests = [];
  try {
    interests = JSON.parse(entity.interests || '[]');
  } catch {
    interests = [];
  }

  return {
    email: entity.email,
    affiliation: entity.affiliation || '',
    interests,
    status: entity.status || 'active',
    subscribedAt: entity.subscribedAt || '',
    updatedAt: entity.updatedAt || '',
    source: entity.source || '',
  };
}

function asCampaign(entity) {
  return {
    id: entity.rowKey,
    title: entity.title,
    subject: entity.subject,
    contentKind: entity.contentKind,
    contentSlug: entity.contentSlug,
    scheduledAt: entity.scheduledAt,
    status: entity.status,
    createdAt: entity.createdAt,
    createdBy: entity.createdBy,
    sentAt: entity.sentAt || '',
    recipientCount: Number(entity.recipientCount || 0),
    failureCount: Number(entity.failureCount || 0),
    targetAffiliations: parseSelection(entity.targetAffiliations),
    targetInterests: parseSelection(entity.targetInterests),
  };
}

function parseSelection(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateSelection(value, allowedValues) {
  if (!Array.isArray(value) || value.some((item) => !allowedValues.has(item))) {
    return undefined;
  }
  return [...new Set(value)];
}

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function listActiveSubscribers() {
  const subscribers = [];
  const client = getTableClient(SUBSCRIBERS_TABLE);
  for await (const entity of client.listEntities({
    queryOptions: { filter: "PartitionKey eq 'newsletter' and status eq 'active'" },
  })) {
    subscribers.push(entity);
  }
  return subscribers;
}

function subscriberMatchesCampaign(subscriber, campaign) {
  const affiliations = parseSelection(campaign.targetAffiliations);
  const interests = parseSelection(campaign.targetInterests);
  if (affiliations.length > 0 && !affiliations.includes(subscriber.affiliation)) {
    return false;
  }
  if (interests.length === 0) {
    return true;
  }
  return parseSelection(subscriber.interests).some((interest) => interests.includes(interest));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function newsletterHtml(content) {
  return `
    <div style="max-width:680px;margin:0 auto;padding:32px 24px;font-family:Arial,'Noto Sans KR',sans-serif;color:#1f2937;line-height:1.7">
      <p style="margin:0 0 24px;color:#00a83a;font-weight:700">Hackers Ground</p>
      <h1 style="font-size:28px;line-height:1.35;margin:0 0 28px">${escapeHtml(content.title)}</h1>
      <article>${content.renderedHtml || ''}</article>
      <hr style="margin:40px 0 20px;border:0;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#6b7280;font-size:12px">
        해커그라운드 소식 수신에 동의해 주셔서 보내드리는 메일입니다. 수신 해지를 원하시면 이 메일에 회신해주세요.
      </p>
    </div>`;
}

async function sendWithConcurrency(recipients, send) {
  const workers = Array.from({ length: Math.min(5, recipients.length) }, async () => {
    while (recipients.length > 0) {
      const recipient = recipients.pop();
      await send(recipient);
    }
  });
  await Promise.all(workers);
}

async function deliverCampaign(campaign, context) {
  const campaigns = getTableClient(CAMPAIGNS_TABLE);
  const contentClient = getTableClient(CONTENT_TABLE);
  const content = await contentClient.getEntity(campaign.contentKind, campaign.contentSlug);
  if (content.status !== 'published') {
    throw new Error('발송할 콘텐츠가 발행 상태가 아닙니다.');
  }

  const recipients = (await listActiveSubscribers())
    .filter((subscriber) => subscriberMatchesCampaign(subscriber, campaign));
  const resend = new Resend(RESEND_API_KEY);
  let sent = 0;
  let failed = 0;
  await sendWithConcurrency([...recipients], async (recipient) => {
    try {
      await resend.emails.send({
        from: NEWSLETTER_FROM,
        to: recipient.email,
        subject: campaign.subject,
        html: newsletterHtml(content),
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      context.error(`[newsletter] delivery failed for ${recipient.rowKey}:`, error);
    }
  });

  const now = new Date().toISOString();
  await campaigns.updateEntity({
    partitionKey: 'campaign',
    rowKey: campaign.rowKey,
    status: failed > 0 ? 'partial' : 'sent',
    sentAt: now,
    recipientCount: sent,
    failureCount: failed,
    updatedAt: now,
  }, 'Merge');
}

app.http('newsletterAdmin', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'newsletter/{resource}',
  handler: async (request, context) => {
    const headers = corsHeaders(request.headers.get('origin') || '');
    if (request.method === 'OPTIONS') {
      return { status: 204, headers };
    }

    const adminEmail = getAdminEmail(request);
    if (!adminEmail) {
      return { status: 403, headers, jsonBody: { error: '관리자 로그인 또는 권한이 필요합니다.' } };
    }

    const { resource } = request.params;
    try {
      if (request.method === 'GET' && resource === 'subscribers') {
        const all = [];
        let active = 0;
        const client = getTableClient(SUBSCRIBERS_TABLE);
        for await (const entity of client.listEntities({
          queryOptions: { filter: "PartitionKey eq 'newsletter'" },
        })) {
          if (entity.status === 'active') {
            active += 1;
          }
          all.push(asSubscriber(entity));
        }
        all.sort((left, right) => String(right.subscribedAt).localeCompare(String(left.subscribedAt)));
        return {
          status: 200,
          headers,
          jsonBody: {
            total: all.length,
            active,
            subscribers: all,
          },
        };
      }

      if (request.method === 'GET' && resource === 'campaigns') {
        const campaigns = [];
        const client = await ensureCampaignsTable();
        for await (const entity of client.listEntities({
          queryOptions: { filter: "PartitionKey eq 'campaign'" },
        })) {
          campaigns.push(asCampaign(entity));
        }
        campaigns.sort((left, right) => String(right.scheduledAt).localeCompare(String(left.scheduledAt)));
        return { status: 200, headers, jsonBody: { campaigns } };
      }

      if (request.method === 'POST' && resource === 'campaigns') {
        const body = await request.json();
        const contentKind = body.contentKind;
        const contentSlug = body.contentSlug;
        const scheduledAt = new Date(body.scheduledAt);
        const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
        const targetAffiliations = validateSelection(body.targetAffiliations, AFFILIATIONS);
        const targetInterests = validateSelection(body.targetInterests, INTERESTS);

        if (!CONTENT_KINDS.has(contentKind) || !isValidSlug(contentSlug)) {
          return { status: 400, headers, jsonBody: { error: '발송할 콘텐츠를 선택해주세요.' } };
        }
        if (!subject || subject.length > 140) {
          return { status: 400, headers, jsonBody: { error: '제목은 1~140자로 입력해주세요.' } };
        }
        if (!targetAffiliations || !targetInterests) {
          return { status: 400, headers, jsonBody: { error: '수신 대상 선택값이 올바르지 않습니다.' } };
        }
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000) {
          return { status: 400, headers, jsonBody: { error: '예약 시각은 지금부터 1분 이후여야 합니다.' } };
        }

        const content = await getTableClient(CONTENT_TABLE).getEntity(contentKind, contentSlug);
        if (content.status !== 'published') {
          return { status: 400, headers, jsonBody: { error: '발행된 콘텐츠만 예약 발송할 수 있습니다.' } };
        }

        const now = new Date().toISOString();
        const client = await ensureCampaignsTable();
        const campaign = {
          partitionKey: 'campaign',
          rowKey: randomUUID(),
          title: content.title,
          subject,
          contentKind,
          contentSlug,
          scheduledAt: scheduledAt.toISOString(),
          status: 'scheduled',
          createdAt: now,
          createdBy: adminEmail,
          updatedAt: now,
          recipientCount: 0,
          failureCount: 0,
          targetAffiliations: JSON.stringify(targetAffiliations),
          targetInterests: JSON.stringify(targetInterests),
        };
        await client.createEntity(campaign);
        return { status: 201, headers, jsonBody: { campaign: asCampaign(campaign) } };
      }

      return { status: 404, headers, jsonBody: { error: '요청한 뉴스레터 관리 기능을 찾을 수 없습니다.' } };
    } catch (error) {
      context.error('[newsletter-admin] request failed:', error);
      return { status: 500, headers, jsonBody: { error: '뉴스레터 관리 요청을 처리하지 못했습니다.' } };
    }
  },
});

app.timer('sendNewsletterCampaigns', {
  schedule: '0 */5 * * * *',
  handler: async (timer, context) => {
    if (!RESEND_API_KEY) {
      context.error('[newsletter] RESEND_API_KEY is not configured; scheduled delivery skipped.');
      return;
    }

    const now = new Date().toISOString();
    const campaigns = await ensureCampaignsTable();
    const due = [];
    for await (const entity of campaigns.listEntities({
      queryOptions: { filter: "PartitionKey eq 'campaign' and status eq 'scheduled'" },
    })) {
      if (entity.scheduledAt <= now) {
        due.push(entity);
      }
    }

    for (const campaign of due) {
      try {
        await campaigns.updateEntity({
          partitionKey: campaign.partitionKey,
          rowKey: campaign.rowKey,
          status: 'sending',
          startedAt: new Date().toISOString(),
        }, 'Merge', { etag: campaign.etag });
      } catch (error) {
        if (error.statusCode === 412) {
          continue;
        }
        throw error;
      }

      try {
        await deliverCampaign(campaign, context);
      } catch (error) {
        context.error(`[newsletter] campaign ${campaign.rowKey} failed:`, error);
        await campaigns.updateEntity({
          partitionKey: campaign.partitionKey,
          rowKey: campaign.rowKey,
          status: 'failed',
          updatedAt: new Date().toISOString(),
        }, 'Merge');
      }
    }
  },
});
