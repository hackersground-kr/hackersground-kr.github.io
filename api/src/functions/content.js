const { app } = require('@azure/functions');
const { AzureNamedKeyCredential, TableClient } = require('@azure/data-tables');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const STORAGE_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTENT_SYNC_TOKEN = process.env.CONTENT_SYNC_TOKEN || '';
const TABLE_NAME = 'SiteContent';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN
  || 'https://hackersground.kr,https://hackersground-kr.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CONTENT_KINDS = new Set(['post', 'event']);
const CONTENT_STATUSES = new Set(['draft', 'published']);
const MAX_MARKDOWN_LENGTH = 60 * 1024;

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function getTableClient() {
  if (!STORAGE_ACCOUNT || !STORAGE_KEY) {
    throw new Error('Storage 환경 변수가 설정되지 않았습니다.');
  }

  const credential = new AzureNamedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY);
  return new TableClient(
    `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
    TABLE_NAME,
    credential,
  );
}

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).match(/^[A-Za-z0-9_-]{11}$/)?.[0];
    }

    if (
      parsed.hostname === 'www.youtube.com'
      || parsed.hostname === 'youtube.com'
      || parsed.hostname === 'www.youtube-nocookie.com'
    ) {
      const videoId = parsed.searchParams.get('v')
        || parsed.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/)?.[1];
      return videoId?.match(/^[A-Za-z0-9_-]{11}$/)?.[0];
    }
  } catch {
    return undefined;
  }

  return undefined;
}

marked.use({
  extensions: [{
    name: 'youtube',
    level: 'block',
    start(source) {
      return source.match(/@\[youtube\]\(/i)?.index;
    },
    tokenizer(source) {
      const match = /^@\[youtube\]\((https?:\/\/[^\s)]+)\)\s*(?:\n|$)/i.exec(source);
      if (!match) {
        return undefined;
      }

      const videoId = getYouTubeId(match[1]);
      if (!videoId) {
        return undefined;
      }

      return {
        type: 'youtube',
        raw: match[0],
        videoId,
      };
    },
    renderer(token) {
      return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${token.videoId}" title="YouTube video player" loading="lazy" allowfullscreen></iframe></div>`;
    },
  }],
});

function renderMarkdown(markdown) {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  return sanitizeHtml(rendered, {
    allowedTags: [
      'a', 'article', 'blockquote', 'br', 'code', 'del', 'details', 'div', 'em',
      'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'iframe',
      'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'summary', 'table', 'tbody',
      'td', 'th', 'thead', 'tr', 'ul',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'title'],
      code: ['class'],
      div: ['class'],
      iframe: ['allow', 'allowfullscreen', 'class', 'frameborder', 'height', 'loading', 'src', 'title', 'width'],
      img: ['alt', 'height', 'loading', 'src', 'title', 'width'],
      ol: ['start'],
      span: ['class'],
      table: ['class'],
      td: ['align', 'colspan', 'rowspan'],
      th: ['align', 'colspan', 'rowspan'],
    },
    allowedClasses: {
      code: ['language-*'],
      div: ['video-embed'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube-nocookie.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

function asPublicContent(entity, includeBody = false) {
  const content = {
    kind: entity.partitionKey,
    slug: entity.rowKey,
    title: entity.title,
    excerpt: entity.excerpt || '',
    emoji: entity.emoji || '📝',
    tag: entity.tag || 'other',
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    publishedAt: entity.publishedAt,
    viewCount: Number(entity.viewCount || 0),
    event: entity.partitionKey === 'event' ? {
      startAt: entity.eventStartAt || '',
      endAt: entity.eventEndAt || '',
      location: entity.location || '',
      eventType: entity.eventType || '',
      price: entity.price || '',
      capacity: entity.capacity || '',
      registrationUrl: entity.registrationUrl || '',
    } : undefined,
  };

  if (includeBody) {
    content.renderedHtml = entity.renderedHtml || '';
  }

  return content;
}

function isAuthorized(request) {
  if (!CONTENT_SYNC_TOKEN) {
    return false;
  }

  return request.headers.get('authorization') === `Bearer ${CONTENT_SYNC_TOKEN}`;
}

async function incrementViewCount(tableClient, kind, slug) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const entity = await tableClient.getEntity(kind, slug);
    const viewCount = Number(entity.viewCount || 0) + 1;

    try {
      await tableClient.updateEntity(
        { partitionKey: kind, rowKey: slug, viewCount },
        'Merge',
        { etag: entity.etag },
      );
      return viewCount;
    } catch (error) {
      if (error.statusCode !== 412 || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('조회수를 갱신할 수 없습니다.');
}

app.http('content', {
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'content/{kind}/{slug?}',
  handler: async (request, context) => {
    const headers = corsHeaders(request.headers.get('origin') || '');

    if (request.method === 'OPTIONS') {
      return { status: 204, headers };
    }

    const kind = request.params.kind;
    const slug = request.params.slug;
    if (!CONTENT_KINDS.has(kind)) {
      return { status: 400, headers, jsonBody: { error: 'kind는 post 또는 event여야 합니다.' } };
    }

    try {
      const tableClient = getTableClient();
      await tableClient.createTable().catch(() => {});

      if (request.method === 'GET' && !slug) {
        const items = [];
        for await (const entity of tableClient.listEntities({
          queryOptions: {
            filter: `PartitionKey eq '${kind}' and status eq 'published'`,
          },
        })) {
          items.push(asPublicContent(entity));
        }
        items.sort((left, right) => String(right.publishedAt).localeCompare(String(left.publishedAt)));
        return { status: 200, headers, jsonBody: { items } };
      }

      if (!isValidSlug(slug)) {
        return { status: 400, headers, jsonBody: { error: '올바른 slug가 필요합니다.' } };
      }

      if (request.method === 'GET') {
        const entity = await tableClient.getEntity(kind, slug);
        if (entity.status !== 'published') {
          return { status: 404, headers, jsonBody: { error: '콘텐츠를 찾을 수 없습니다.' } };
        }
        return { status: 200, headers, jsonBody: { content: asPublicContent(entity, true) } };
      }

      if (request.method === 'POST') {
        const viewCount = await incrementViewCount(tableClient, kind, slug);
        return { status: 200, headers, jsonBody: { viewCount } };
      }

      if (!isAuthorized(request)) {
        return { status: 401, headers, jsonBody: { error: '콘텐츠 동기화 권한이 없습니다.' } };
      }

      const body = await request.json();
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const markdown = typeof body.markdown === 'string' ? body.markdown.trim() : '';
      const status = body.status || 'published';

      if (!title || !markdown) {
        return { status: 400, headers, jsonBody: { error: 'title과 markdown은 필수입니다.' } };
      }
      if (markdown.length > MAX_MARKDOWN_LENGTH) {
        return { status: 400, headers, jsonBody: { error: 'Markdown은 60KB 이하로 작성해야 합니다.' } };
      }
      if (!CONTENT_STATUSES.has(status)) {
        return { status: 400, headers, jsonBody: { error: 'status는 draft 또는 published여야 합니다.' } };
      }

      let existing;
      try {
        existing = await tableClient.getEntity(kind, slug);
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      const now = new Date().toISOString();
      const entity = {
        partitionKey: kind,
        rowKey: slug,
        status,
        title,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : '',
        emoji: typeof body.emoji === 'string' ? body.emoji.trim() : '',
        tag: typeof body.tag === 'string' ? body.tag.trim().toLowerCase() : 'other',
        markdown,
        renderedHtml: renderMarkdown(markdown),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        publishedAt: status === 'published' ? existing?.publishedAt || now : '',
        viewCount: Number(existing?.viewCount || 0),
        sourceIssueNumber: Number.isInteger(body.sourceIssueNumber) ? body.sourceIssueNumber : 0,
        sourceIssueUrl: typeof body.sourceIssueUrl === 'string' ? body.sourceIssueUrl : '',
        eventStartAt: typeof body.event?.startAt === 'string' ? body.event.startAt : '',
        eventEndAt: typeof body.event?.endAt === 'string' ? body.event.endAt : '',
        location: typeof body.event?.location === 'string' ? body.event.location : '',
        eventType: typeof body.event?.eventType === 'string' ? body.event.eventType : '',
        price: typeof body.event?.price === 'string' ? body.event.price : '',
        capacity: typeof body.event?.capacity === 'string' ? body.event.capacity : '',
        registrationUrl: typeof body.event?.registrationUrl === 'string' ? body.event.registrationUrl : '',
      };

      await tableClient.upsertEntity(entity, 'Replace');
      context.log(`[content] ${kind}/${slug} synced from issue #${entity.sourceIssueNumber || 'manual'}`);

      return {
        status: existing ? 200 : 201,
        headers,
        jsonBody: { content: asPublicContent(entity) },
      };
    } catch (error) {
      if (error.statusCode === 404) {
        return { status: 404, headers, jsonBody: { error: '콘텐츠를 찾을 수 없습니다.' } };
      }
      context.error('콘텐츠 API 오류:', error);
      return { status: 500, headers, jsonBody: { error: '콘텐츠를 처리하는 중 오류가 발생했습니다.' } };
    }
  },
});
