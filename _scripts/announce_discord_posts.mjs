#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const webhookUrl = process.env.DISCORD_ARTICLE_WEBHOOK;
const shortIds = (process.env.POST_SHORT_IDS || '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0);

if (!webhookUrl) {
  throw new Error('DISCORD_ARTICLE_WEBHOOK이 필요합니다.');
}
if (!shortIds.length) {
  throw new Error('POST_SHORT_IDS에 하나 이상의 게시글 번호를 입력해야 합니다.');
}
if (new Set(shortIds).size !== shortIds.length) {
  throw new Error('POST_SHORT_IDS에 중복된 게시글 번호가 있습니다.');
}

const posts = JSON.parse(await readFile('posts/posts.json', 'utf8'));
for (const shortId of shortIds) {
  const post = posts.find((item) => item.shortId === shortId);
  if (!post) {
    throw new Error(`게시글 번호 ${shortId}을 찾을 수 없습니다.`);
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `https://hackersground.kr/posts/${post.shortId}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`게시글 ${shortId} Discord 안내 전송 실패 (${response.status}): ${await response.text()}`);
  }
}

console.log(`Discord announcements sent for posts: ${shortIds.join(', ')}`);
