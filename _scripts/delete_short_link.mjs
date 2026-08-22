#!/usr/bin/env node

import { readFile, rm, writeFile } from 'node:fs/promises';

const kind = process.env.CONTENT_KIND;
const slug = process.env.CONTENT_SLUG;
const shortId = Number(process.env.CONTENT_SHORT_ID);

if (!['post', 'event'].includes(kind)) {
  throw new Error('CONTENT_KIND는 post 또는 event여야 합니다.');
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) {
  throw new Error('CONTENT_SLUG가 올바르지 않습니다.');
}
if (!Number.isSafeInteger(shortId) || shortId < 1) {
  throw new Error('CONTENT_SHORT_ID가 올바르지 않습니다.');
}

const directory = `${kind === 'post' ? 'posts' : 'events'}/${shortId}`;
await rm(directory, { recursive: true, force: true });

if (kind === 'post') {
  const path = 'posts/posts.json';
  const posts = JSON.parse(await readFile(path, 'utf8'));
  const nextPosts = posts.filter((post) => post.slug !== slug);
  await writeFile(path, `${JSON.stringify(nextPosts, null, 2)}\n`, 'utf8');
} else {
  const path = 'events/events.json';
  const events = JSON.parse(await readFile(path, 'utf8'));
  delete events[slug];
  await writeFile(path, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
}

console.log(`${kind}/${slug}의 정적 단축 URL과 메타데이터를 제거했습니다.`);
