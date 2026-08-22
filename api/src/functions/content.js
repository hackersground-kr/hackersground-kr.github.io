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
const SHORT_ID_COUNTER_PARTITION = 'content-short-id';

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

function isValidShortId(shortId) {
  return Number.isSafeInteger(shortId) && shortId > 0;
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

function normalizeYouTubeMarkdown(markdown) {
  const embed = (url) => getYouTubeId(url) ? `@[youtube](${url})` : undefined;

  return markdown
    .replace(
      /\[!\[[^\]]*]\([^)\n]+\)\]\((https?:\/\/[^\s)]+)\)/gi,
      (match, url) => embed(url) || match,
    )
    .replace(
      /(^|[^!@])\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim,
      (match, prefix, label, url) => embed(url) ? `${prefix}${embed(url)}` : match,
    )
    .replace(
      /^\s*<?(https?:\/\/[^\s<>]+)>?\s*$/gim,
      (match, url) => embed(url) || match,
    );
}

function renderMarkdown(markdown) {
  const rendered = marked.parse(normalizeYouTubeMarkdown(markdown), {
    async: false,
    gfm: true,
    breaks: false,
  });
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

function isLegacyHtmlDocument(content) {
  return /<!doctype\s+html\b|<html(?:\s|>)/i.test(content);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLegacySessions(document) {
  const source = /const\s+sessions\s*=\s*\[([\s\S]*?)\];/.exec(document)?.[1];
  if (!source) {
    return document;
  }

  const sessions = [...source.matchAll(/\{([\s\S]*?)\}/g)].map((match) => {
    const values = {};
    for (const field of ['date', 'label', 'status', 'note', 'postUrl']) {
      const value = new RegExp(`${field}\\s*:\\s*(?:'([^']*)'|null)`).exec(match[1]);
      values[field] = value?.[1] || '';
    }
    return values;
  }).filter((session) => session.date && session.label && session.status && session.note);

  if (!sessions.length) {
    return document;
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const sessionHtml = sessions.map((session) => {
    const date = new Date(`${session.date}T00:00:00`);
    const formattedDate = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')} (${dayNames[date.getDay()]})`;
    const badge = session.status === 'past'
      ? '<span class="session-badge badge-closed">종료</span>'
      : session.status === 'next'
        ? '<span class="session-badge badge-next">▶ 다음 회차 · 마감</span>'
        : '<span class="session-badge badge-upcoming">예정</span>';
    const post = session.postUrl
      ? `<a href="${escapeHtml(session.postUrl)}" class="session-post-link">📝 정보글 보기</a>`
      : session.status === 'past'
        ? '<span class="session-post-placeholder">📝 정보글 준비 중...</span>'
        : '';

    return `<div class="session-item ${escapeHtml(session.status)}"><div class="session-date"><div class="date-num">${escapeHtml(session.label)}</div><div class="date-sub">오전 7:00</div></div><div class="session-body">${badge}<div class="session-title">${formattedDate}</div><div class="session-note">${escapeHtml(session.note)}</div>${post}</div></div>`;
  }).join('');

  return document.replace(
    /(<div\b[^>]*\bid=(["'])session-list\2[^>]*>)[\s\S]*?<\/div>/i,
    `$1${sessionHtml}</div>`,
  );
}

function extractLegacyHtmlDocument(document) {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(document)?.[1] || document;
  return renderLegacySessions(body)
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
}

function renderLegacyHtml(document) {
  return sanitizeHtml(extractLegacyHtmlDocument(document), {
    allowedTags: [
      'a', 'article', 'blockquote', 'br', 'button', 'code', 'del', 'details', 'div', 'em',
      'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'iframe',
      'img', 'li', 'ol', 'p', 'pre', 'section', 'span', 'strong', 'summary', 'table', 'tbody',
      'td', 'th', 'thead', 'tr', 'ul',
    ],
    allowedAttributes: {
      '*': ['class', 'id', 'style'],
      a: ['href', 'name', 'rel', 'target', 'title'],
      button: ['type'],
      iframe: ['allow', 'allowfullscreen', 'class', 'frameborder', 'height', 'loading', 'src', 'title', 'width'],
      img: ['alt', 'height', 'loading', 'src', 'title', 'width'],
      ol: ['start'],
      td: ['align', 'colspan', 'rowspan'],
      th: ['align', 'colspan', 'rowspan'],
    },
    allowedStyles: {
      '*': {
        background: [/^(?!.*(?:expression|javascript:|url\s*\()).+$/i],
        border: [/^(?!.*(?:expression|javascript:|url\s*\()).+$/i],
        'border-bottom': [/^(?!.*(?:expression|javascript:|url\s*\()).+$/i],
        'border-radius': [/^[\w.%(),+\-\s]+$/i],
        'border-top': [/^(?!.*(?:expression|javascript:|url\s*\()).+$/i],
        color: [/^(?!.*(?:expression|javascript:|url\s*\()).+$/i],
        display: [/^[a-z-]+$/i],
        'font-size': [/^[\w.%(),+\-\s]+$/i],
        'font-weight': [/^[\w-]+$/i],
        gap: [/^[\w.%(),+\-\s]+$/i],
        'grid-template-columns': [/^[\w.%(),+\-\s]+$/i],
        'line-height': [/^[\w.%(),+\-\s]+$/i],
        margin: [/^[\w.%(),+\-\s]+$/i],
        'margin-bottom': [/^[\w.%(),+\-\s]+$/i],
        'margin-left': [/^[\w.%(),+\-\s]+$/i],
        'margin-right': [/^[\w.%(),+\-\s]+$/i],
        'margin-top': [/^[\w.%(),+\-\s]+$/i],
        'max-width': [/^[\w.%(),+\-\s]+$/i],
        padding: [/^[\w.%(),+\-\s]+$/i],
        'padding-bottom': [/^[\w.%(),+\-\s]+$/i],
        'padding-top': [/^[\w.%(),+\-\s]+$/i],
        'text-align': [/^(?:left|right|center|justify)$/i],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube-nocookie.com'],
    transformTags: {
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

function renderContent(content) {
  return isLegacyHtmlDocument(content)
    ? { bodyFormat: 'legacy-html', renderedHtml: renderLegacyHtml(content) }
    : { bodyFormat: 'markdown', renderedHtml: renderMarkdown(content) };
}

function asPublicContent(entity, includeBody = false) {
  const content = {
    kind: entity.partitionKey,
    slug: entity.rowKey,
    shortId: isValidShortId(Number(entity.shortId)) ? Number(entity.shortId) : undefined,
    title: entity.title,
    excerpt: entity.excerpt || '',
    emoji: entity.emoji || '📝',
    tag: entity.tag || 'other',
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    publishedAt: entity.publishedAt,
    viewCount: Number(entity.viewCount || 0),
    bodyFormat: entity.bodyFormat || 'markdown',
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

async function allocateShortId(tableClient, kind) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const counter = await tableClient.getEntity(SHORT_ID_COUNTER_PARTITION, kind);
      const shortId = Number(counter.lastShortId || 0) + 1;
      await tableClient.updateEntity(
        {
          partitionKey: SHORT_ID_COUNTER_PARTITION,
          rowKey: kind,
          lastShortId: shortId,
        },
        'Merge',
        { etag: counter.etag },
      );
      return shortId;
    } catch (error) {
      if (error.statusCode === 404) {
        let lastShortId = 0;
        for await (const entity of tableClient.listEntities({
          queryOptions: { filter: `PartitionKey eq '${kind}'` },
        })) {
          lastShortId = Math.max(lastShortId, Number(entity.shortId || 0));
        }

        const shortId = lastShortId + 1;
        try {
          await tableClient.createEntity({
            partitionKey: SHORT_ID_COUNTER_PARTITION,
            rowKey: kind,
            lastShortId: shortId,
          });
          return shortId;
        } catch (createError) {
          if (createError.statusCode !== 409 || attempt === 2) {
            throw createError;
          }
        }
      } else if (error.statusCode !== 412 || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('단축 URL 번호를 할당할 수 없습니다.');
}

async function migrateShortIds(tableClient, kind) {
  const entities = [];
  for await (const entity of tableClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${kind}'` },
  })) {
    entities.push(entity);
  }

  entities.sort((left, right) => String(left.publishedAt || left.createdAt)
    .localeCompare(String(right.publishedAt || right.createdAt)));

  let assigned = 0;
  for (const entity of entities) {
    if (isValidShortId(Number(entity.shortId))) {
      continue;
    }

    const shortId = await allocateShortId(tableClient, kind);
    await tableClient.updateEntity(
      { partitionKey: kind, rowKey: entity.rowKey, shortId },
      'Merge',
      { etag: entity.etag },
    );
    assigned += 1;
  }

  return assigned;
}

app.http('contentShort', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'content/{kind}/short/{shortId}',
  handler: async (request, context) => {
    const headers = corsHeaders(request.headers.get('origin') || '');
    if (request.method === 'OPTIONS') {
      return { status: 204, headers };
    }

    const kind = request.params.kind;
    const shortId = Number(request.params.shortId);
    if (!CONTENT_KINDS.has(kind) || !isValidShortId(shortId)) {
      return { status: 400, headers, jsonBody: { error: '올바른 콘텐츠 종류와 단축 URL 번호가 필요합니다.' } };
    }

    try {
      const tableClient = getTableClient();
      const entities = tableClient.listEntities({
        queryOptions: {
          filter: `PartitionKey eq '${kind}' and shortId eq ${shortId}`,
        },
      });
      for await (const entity of entities) {
        if (entity.status === 'published') {
          return { status: 200, headers, jsonBody: { content: asPublicContent(entity, true) } };
        }
      }
      return { status: 404, headers, jsonBody: { error: '콘텐츠를 찾을 수 없습니다.' } };
    } catch (error) {
      context.error('단축 URL 콘텐츠 조회 오류:', error);
      return { status: 500, headers, jsonBody: { error: '콘텐츠를 처리하는 중 오류가 발생했습니다.' } };
    }
  },
});

app.http('contentShortIdMigration', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'content/{kind}/short-id-migration',
  handler: async (request, context) => {
    const headers = corsHeaders(request.headers.get('origin') || '');
    if (request.method === 'OPTIONS') {
      return { status: 204, headers };
    }

    const kind = request.params.kind;
    if (!CONTENT_KINDS.has(kind)) {
      return { status: 400, headers, jsonBody: { error: 'kind는 post 또는 event여야 합니다.' } };
    }
    if (!isAuthorized(request)) {
      return { status: 401, headers, jsonBody: { error: '콘텐츠 동기화 권한이 없습니다.' } };
    }

    try {
      const tableClient = getTableClient();
      await tableClient.createTable().catch(() => {});
      const assigned = await migrateShortIds(tableClient, kind);
      context.log(`[content] ${kind} short ID migration: ${assigned} assigned`);
      return { status: 200, headers, jsonBody: { assigned } };
    } catch (error) {
      context.error('단축 URL 번호 마이그레이션 오류:', error);
      return { status: 500, headers, jsonBody: { error: '단축 URL 번호를 할당하는 중 오류가 발생했습니다.' } };
    }
  },
});

app.http('content', {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

      if (request.method === 'DELETE') {
        await tableClient.deleteEntity(kind, slug);
        return { status: 204, headers };
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
      const rendered = renderContent(markdown);
      const shortId = isValidShortId(Number(existing?.shortId))
        ? Number(existing.shortId)
        : await allocateShortId(tableClient, kind);
      const entity = {
        partitionKey: kind,
        rowKey: slug,
        status,
        title,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : '',
        emoji: typeof body.emoji === 'string' ? body.emoji.trim() : '',
        tag: typeof body.tag === 'string' ? body.tag.trim().toLowerCase() : 'other',
        markdown,
        bodyFormat: rendered.bodyFormat,
        renderedHtml: rendered.renderedHtml,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        publishedAt: status === 'published' ? existing?.publishedAt || now : '',
        viewCount: Number(existing?.viewCount || 0),
        sourceIssueNumber: Number.isInteger(body.sourceIssueNumber)
          ? body.sourceIssueNumber
          : Number(existing?.sourceIssueNumber || 0),
        sourceIssueUrl: typeof body.sourceIssueUrl === 'string'
          ? body.sourceIssueUrl
          : existing?.sourceIssueUrl || '',
        shortId,
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
