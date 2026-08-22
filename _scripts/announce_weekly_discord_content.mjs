#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const postWebhookUrl = process.env.DISCORD_ARTICLE_WEBHOOK;
const eventWebhookUrl = process.env.DISCORD_EVENT_WEBHOOK;
const statePath = '.github/discord-announcement-state.json';

if (!postWebhookUrl || !eventWebhookUrl) {
  throw new Error('DISCORD_ARTICLE_WEBHOOK, DISCORD_EVENT_WEBHOOK이 필요합니다.');
}

const posts = JSON.parse(await readFile('posts/posts.json', 'utf8'));
const events = Object.values(JSON.parse(await readFile('events/events.json', 'utf8')));
const state = JSON.parse(await readFile(statePath, 'utf8'));

function contentWithShortId(items, sentIds) {
  return items
    .filter((item) => Number.isSafeInteger(item.shortId) && item.shortId > 0)
    .filter((item) => !sentIds.includes(item.shortId))
    .sort((left, right) => left.shortId - right.shortId);
}

async function sendLinks(webhookUrl, kind, items) {
  for (const item of items) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `https://hackersground.kr/${kind}/${item.shortId}` }),
    });
    if (!response.ok) {
      throw new Error(`${kind}/${item.shortId} Discord 안내 전송 실패 (${response.status}): ${await response.text()}`);
    }
  }
}

const newPosts = contentWithShortId(posts, state.posts);
const newEvents = contentWithShortId(events, state.events);

await sendLinks(postWebhookUrl, 'posts', newPosts);
await sendLinks(eventWebhookUrl, 'events', newEvents);

state.posts = [...new Set([...state.posts, ...newPosts.map((post) => post.shortId)])].sort((left, right) => left - right);
state.events = [...new Set([...state.events, ...newEvents.map((event) => event.shortId)])].sort((left, right) => left - right);
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

console.log(`Discord weekly announcements sent: ${newPosts.length} posts, ${newEvents.length} events`);
