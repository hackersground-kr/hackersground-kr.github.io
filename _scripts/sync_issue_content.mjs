#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const eventPath = process.env.GITHUB_EVENT_PATH;
const endpoint = process.env.CONTENT_SYNC_URL;
const token = process.env.CONTENT_SYNC_TOKEN;

if (!eventPath || !endpoint || !token) {
  throw new Error('GITHUB_EVENT_PATH, CONTENT_SYNC_URL, CONTENT_SYNC_TOKEN이 필요합니다.');
}

const event = JSON.parse(await readFile(eventPath, 'utf8'));
const issue = event.issue;
const labels = new Set(issue.labels.map((label) => label.name));
const kind = labels.has('event') ? 'event' : 'post';

function section(body, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^#{2,3} ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=^#{2,3} |$(?![\\s\\S]))`, 'm').exec(body);
  return match?.[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim() || '';
}

function requiredSection(body, heading) {
  const value = section(body, heading);
  if (!value) {
    throw new Error(`이슈의 "${heading}" 항목을 입력해야 합니다.`);
  }
  return value;
}

function optionalIssueTitle(prefix) {
  return issue.title.replace(prefix, '').trim();
}

const body = issue.body || '';
const slug = (section(body, 'Slug') || `${kind}-${issue.number}`).toLowerCase();
const title = section(body, '제목') || optionalIssueTitle(kind === 'post' ? '[정보글]' : '[행사]');
const markdown = section(body, '본문 (Markdown)') || body.trim();
if (!markdown) {
  throw new Error('이슈 본문을 작성해야 합니다.');
}
const payload = {
  title,
  markdown,
  excerpt: section(body, '한 줄 요약') || markdown.split(/\n\s*\n/)[0].replace(/^#+\s*/, '').slice(0, 140),
  emoji: section(body, '이모지') || (kind === 'event' ? '🗓️' : '📝'),
  tag: section(body, '태그') || 'other',
  status: 'published',
  sourceIssueNumber: issue.number,
  sourceIssueUrl: issue.html_url,
};

if (kind === 'event') {
  payload.event = {
    startAt: section(body, '시작 시각'),
    endAt: section(body, '종료 시각'),
    location: section(body, '장소'),
    eventType: section(body, '유형'),
    price: section(body, '참가비'),
    capacity: section(body, '모집 인원'),
    registrationUrl: section(body, '신청 링크'),
  };
}

const response = await fetch(`${endpoint.replace(/\/$/, '')}/content/${kind}/${slug}`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
const responseBody = await response.json();
if (!response.ok) {
  throw new Error(`콘텐츠 API 동기화 실패 (${response.status}): ${responseBody.error || '알 수 없는 오류'}`);
}

const content = responseBody.content;
if (kind === 'post') {
  const postsPath = 'posts/posts.json';
  const posts = JSON.parse(await readFile(postsPath, 'utf8'));
  const nextPost = {
    slug: content.slug,
    title: content.title,
    date: content.publishedAt.slice(0, 10),
    emoji: content.emoji,
    tag: content.tag,
    excerpt: content.excerpt,
    url: `/posts/content.html?slug=${encodeURIComponent(content.slug)}`,
  };
  const nextPosts = [nextPost, ...posts.filter((post) => post.slug !== content.slug)]
    .sort((left, right) => right.date.localeCompare(left.date));
  await writeFile(postsPath, `${JSON.stringify(nextPosts, null, 2)}\n`, 'utf8');
} else {
  const eventsPath = 'events/events.json';
  const events = JSON.parse(await readFile(eventsPath, 'utf8'));
  events[content.slug] = {
    name: content.title,
    emoji: content.emoji,
    date: content.event.startAt,
    location: content.event.location,
    type: content.event.eventType,
    price: content.event.price,
    capacity: content.event.capacity,
    deadline: '',
    url: `/events/content.html?slug=${encodeURIComponent(content.slug)}`,
  };
  await writeFile(eventsPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
}

console.log(`${kind}/${slug} synced from issue #${issue.number}`);
