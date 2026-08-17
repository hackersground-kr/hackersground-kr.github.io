#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const endpoint = process.env.CONTENT_SYNC_URL?.replace(/\/$/, '');
const token = process.env.CONTENT_SYNC_TOKEN;
const sourceRef = process.env.LEGACY_EVENT_SOURCE_REF || 'c6a377b0ad70384bed7c614e6543f0e7c47b1523';
const slugs = [
  'ai-builder-meetup',
  'chatgpt-workshop',
  'docker-workshop',
  'growth-story',
  'hackersground-2025',
  'networking-party',
  'vibe-coding-workshop',
  'workshop-azure-ai',
];

if (!endpoint || !token) {
  throw new Error('CONTENT_SYNC_URL, CONTENT_SYNC_TOKEN이 필요합니다.');
}

async function request(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} 요청 실패 (${response.status}): ${body.error || '알 수 없는 오류'}`);
  }
  return body;
}

async function legacyEventHtml(slug) {
  const { stdout } = await execFileAsync('git', [
    'show',
    `${sourceRef}:events/${slug}.html`,
  ]);
  return stdout;
}

const events = JSON.parse(await readFile('events/events.json', 'utf8'));

for (const slug of slugs) {
  const [source, current] = await Promise.all([
    legacyEventHtml(slug),
    request(`/content/event/${encodeURIComponent(slug)}`),
  ]);
  const metadata = events[slug] || {};
  const existing = current.content;
  const payload = {
    title: metadata.name || existing.title,
    markdown: source,
    excerpt: existing.excerpt,
    emoji: metadata.emoji || existing.emoji,
    tag: existing.tag || 'event',
    status: 'published',
    event: existing.event,
  };

  await request(`/content/event/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const repaired = (await request(`/content/event/${encodeURIComponent(slug)}`)).content;
  if (
    repaired.bodyFormat !== 'legacy-html'
    || repaired.renderedHtml.includes('<pre><code>')
    || !repaired.renderedHtml.includes('event-detail-hero')
  ) {
    throw new Error(`${slug}의 레거시 행사 콘텐츠 검증에 실패했습니다.`);
  }

  console.log(`Repaired event/${slug} (${repaired.renderedHtml.length} bytes)`);
}
