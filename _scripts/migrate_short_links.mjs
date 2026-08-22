#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const endpoint = process.env.CONTENT_SYNC_URL;
const token = process.env.CONTENT_SYNC_TOKEN;

if (!endpoint || !token) {
  throw new Error('CONTENT_SYNC_URL, CONTENT_SYNC_TOKEN이 필요합니다.');
}

function shortUrl(kind, shortId) {
  return `/${kind === 'post' ? 'posts' : 'events'}/${shortId}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    throw new Error(`콘텐츠 API 요청 실패 (${response.status}): ${body?.error || '알 수 없는 오류'}`);
  }
  return body;
}

async function writeShortLink(kind, shortId, slug) {
  if (!Number.isSafeInteger(shortId) || shortId < 1) {
    throw new Error(`${kind}/${slug}의 단축 URL 번호가 올바르지 않습니다.`);
  }

  const directory = `${kind === 'post' ? 'posts' : 'events'}/${shortId}`;
  const destination = `/${kind === 'post' ? 'posts' : 'events'}/content.html?slug=${encodeURIComponent(slug)}`;
  const page = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${destination}">
  <title>해커그라운드 콘텐츠로 이동합니다</title>
</head>
<body>
  <p><a href="${destination}">콘텐츠로 이동합니다.</a></p>
  <script>location.replace(${JSON.stringify(destination)});</script>
</body>
</html>
`;

  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, page, 'utf8');
}

async function migrate(kind) {
  const { assigned } = await request(`/content/${kind}/short-id-migration`, { method: 'POST' });
  const { items } = await request(`/content/${kind}`);
  await Promise.all(items.map((item) => writeShortLink(kind, item.shortId, item.slug)));

  if (kind === 'post') {
    const path = 'posts/posts.json';
    const posts = JSON.parse(await readFile(path, 'utf8'));
    const shortIds = new Map(items.map((item) => [item.slug, item.shortId]));
    const nextPosts = posts.map((post) => ({
      ...post,
      shortId: shortIds.get(post.slug) || post.shortId,
    }));
    await writeFile(path, `${JSON.stringify(nextPosts, null, 2)}\n`, 'utf8');
  } else {
    const path = 'events/events.json';
    const events = JSON.parse(await readFile(path, 'utf8'));
    const shortIds = new Map(items.map((item) => [item.slug, item.shortId]));
    for (const [slug, event] of Object.entries(events)) {
      events[slug] = { ...event, shortId: shortIds.get(slug) || event.shortId };
    }
    await writeFile(path, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
  }

  console.log(`${kind}: ${assigned}개 번호 할당, ${items.length}개 단축 URL 생성`);
}

await migrate('post');
await migrate('event');
