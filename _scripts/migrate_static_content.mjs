#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.CONTENT_SYNC_URL;
const token = process.env.CONTENT_SYNC_TOKEN;

if (!endpoint || !token) {
  throw new Error('CONTENT_SYNC_URL, CONTENT_SYNC_TOKEN이 필요합니다.');
}

const root = process.cwd();
const endpointBase = endpoint.replace(/\/$/, '');
const ignoredEventPages = new Set(['content', 'index', 'register', 'thank-you']);
const aiBuilderMetadata = {
  name: 'AI 빌더 모임',
  emoji: '🤖',
  date: '2026-09-10T07:00:00+09:00',
  location: '오프라인 (회차별 상이)',
  type: 'offline',
  price: '무료',
  capacity: '',
  deadline: '',
};

function unescapeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToMarkdown(html) {
  return unescapeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function parsePost(source) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/m.exec(source);
  if (!match) {
    throw new Error('Post front matter를 찾을 수 없습니다.');
  }

  const metadata = Object.fromEntries(
    match[1].split('\n')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const separator = line.indexOf(':');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );
  return { metadata, markdown: match[2].trim() };
}

async function sync(kind, slug, payload) {
  const response = await fetch(`${endpointBase}/content/${kind}/${slug}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${kind}/${slug} 이관 실패: ${body.error || response.status}`);
  }
  return body.content;
}

async function removeLegacyIssuePost() {
  const response = await fetch(`${endpointBase}/content/post/post-15`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`post-15 정리 실패: ${response.status}`);
  }
}

async function migratePosts() {
  const postsDir = path.join(root, '_posts');
  const files = (await readdir(postsDir)).filter((file) => file.endsWith('.md')).sort();
  const migrated = [];

  for (const file of files) {
    const source = await readFile(path.join(postsDir, file), 'utf8');
    const { metadata, markdown } = parsePost(source);
    const slug = path.basename(file, '.md');
    const content = await sync('post', slug, {
      title: metadata.title,
      markdown,
      excerpt: metadata.excerpt || '',
      emoji: metadata.emoji || '📝',
      tag: metadata.tag || 'other',
      status: 'published',
    });
    migrated.push({
      slug,
      title: content.title,
      date: metadata.date || content.publishedAt.slice(0, 10),
      emoji: content.emoji,
      tag: content.tag,
      excerpt: content.excerpt,
      url: `/posts/content.html?slug=${encodeURIComponent(slug)}`,
    });
  }

  migrated.sort((left, right) => right.date.localeCompare(left.date));
  await writeFile(path.join(root, 'posts/posts.json'), `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  return migrated.length;
}

async function migrateEvents() {
  const eventsDir = path.join(root, 'events');
  const knownEvents = JSON.parse(await readFile(path.join(eventsDir, 'events.json'), 'utf8'));
  const files = (await readdir(eventsDir))
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.basename(file, '.html'))
    .filter((slug) => !ignoredEventPages.has(slug))
    .sort();
  const migrated = {};

  for (const slug of files) {
    const html = await readFile(path.join(eventsDir, `${slug}.html`), 'utf8');
    const metadata = knownEvents[slug] || aiBuilderMetadata;
    const title = metadata.name || html.match(/<title>(.*?)\s*·/i)?.[1] || slug;
    const markdown = htmlToMarkdown(html);
    const content = await sync('event', slug, {
      title,
      markdown,
      excerpt: markdown.split(/\n\s*\n/)[0].replace(/^#+\s*/, '').slice(0, 140),
      emoji: metadata.emoji || '🗓️',
      tag: 'event',
      status: 'published',
      event: {
        startAt: metadata.date || '',
        location: metadata.location || '',
        eventType: metadata.type || '',
        price: metadata.price || '',
        capacity: metadata.capacity || '',
      },
    });
    migrated[slug] = {
      name: content.title,
      emoji: content.emoji,
      date: content.event.startAt,
      location: content.event.location,
      type: content.event.eventType,
      price: content.event.price,
      capacity: content.event.capacity,
      deadline: metadata.deadline || '',
      url: `/events/content.html?slug=${encodeURIComponent(slug)}`,
    };
  }

  await writeFile(path.join(root, 'events/events.json'), `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  return files.length;
}

await removeLegacyIssuePost();
const postCount = await migratePosts();
const eventCount = await migrateEvents();
console.log(`Migrated ${postCount} posts and ${eventCount} events.`);
