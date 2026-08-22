#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const eventPath = process.env.GITHUB_EVENT_PATH;
const webhookUrl = process.env.DISCORD_ARTICLE_WEBHOOK;

if (!eventPath || !webhookUrl) {
  throw new Error('GITHUB_EVENT_PATH, DISCORD_ARTICLE_WEBHOOK이 필요합니다.');
}

const event = JSON.parse(await readFile(eventPath, 'utf8'));
const body = event.issue.body || '';

function section(heading) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^#{2,3}\\s+${heading}\\s*$`).test(line));
  if (start < 0) return '';

  const end = lines.findIndex((line, index) => index > start && /^#{2,3}\s+/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

const slug = section('Slug').toLowerCase();
if (!slug) {
  throw new Error('Discord 안내에 필요한 Slug를 찾을 수 없습니다.');
}

const posts = JSON.parse(await readFile('posts/posts.json', 'utf8'));
const post = posts.find((item) => item.slug === slug);
if (!post?.shortId) {
  throw new Error(`게시글 ${slug}의 단축 URL 번호를 찾을 수 없습니다.`);
}

const url = `https://hackersground.kr/posts/${post.shortId}`;
const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: url,
  }),
});

if (!response.ok) {
  throw new Error(`Discord 안내 전송 실패 (${response.status}): ${await response.text()}`);
}

console.log(`Discord notification sent for post/${slug}`);
