#!/usr/bin/env python3
"""
_posts/*.md 파일을 posts/*.html로 변환하는 스크립트
GitHub Actions에서 자동 실행됩니다.

Front matter 형식 (YAML):
---
title: "글 제목"
date: "2025-08-15"
emoji: "🚀"
tag: "azure"          # azure | github | career | opensource | 기타
excerpt: "한 줄 요약"
author: "작성자 이름"
---
"""

import os
import re
import json
import sys

POSTS_DIR = "_posts"
OUTPUT_DIR = "posts"
INDEX_FILE = os.path.join(OUTPUT_DIR, "index.html")

TAG_LABELS = {
    "azure": ("Azure", "azure"),
    "github": ("GitHub", "github"),
    "career": ("커리어", "career"),
    "opensource": ("오픈소스", "opensource"),
}

TAG_COLORS = {
    "azure": ("rgba(59,130,246,0.08)", "rgba(59,130,246,0.1)", "#60a5fa"),
    "github": ("rgba(139,92,246,0.08)", "rgba(139,92,246,0.1)", "#a78bfa"),
    "career": ("rgba(245,158,11,0.08)", "rgba(245,158,11,0.1)", "#fbbf24"),
    "opensource": ("rgba(0,255,65,0.04)", "rgba(0,255,65,0.06)", "#00FF41"),
}


def parse_front_matter(content):
    """YAML front matter와 본문을 분리합니다."""
    fm = {}
    body = content
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
    if m:
        for line in m.group(1).strip().splitlines():
            if ':' in line:
                key, _, val = line.partition(':')
                fm[key.strip()] = val.strip().strip('"').strip("'")
        body = m.group(2).strip()
    return fm, body


def md_to_html(md):
    """간단한 Markdown → HTML 변환 (외부 라이브러리 없이)."""
    lines = md.split('\n')
    html_lines = []
    in_ul = False
    in_pre = False

    for line in lines:
        # 코드 블록
        if line.startswith('```'):
            if in_pre:
                html_lines.append('</code></pre>')
                in_pre = False
            else:
                lang = line[3:].strip()
                html_lines.append(f'<pre><code class="language-{lang}">')
                in_pre = True
            continue

        if in_pre:
            html_lines.append(line.replace('<', '&lt;').replace('>', '&gt;'))
            continue

        # 리스트 종료
        if in_ul and not line.startswith('- ') and not line.startswith('* '):
            html_lines.append('</ul>')
            in_ul = False

        # 헤딩
        if line.startswith('### '):
            html_lines.append(f'<h3>{inline_md(line[4:])}</h3>')
        elif line.startswith('## '):
            html_lines.append(f'<h2>{inline_md(line[3:])}</h2>')
        elif line.startswith('# '):
            html_lines.append(f'<h1>{inline_md(line[2:])}</h1>')
        # 인용
        elif line.startswith('> '):
            html_lines.append(f'<blockquote>{inline_md(line[2:])}</blockquote>')
        # 리스트
        elif line.startswith('- ') or line.startswith('* '):
            if not in_ul:
                html_lines.append('<ul>')
                in_ul = True
            html_lines.append(f'<li>{inline_md(line[2:])}</li>')
        # 빈 줄
        elif line.strip() == '':
            html_lines.append('')
        # 일반 단락
        else:
            html_lines.append(f'<p>{inline_md(line)}</p>')

    if in_ul:
        html_lines.append('</ul>')
    if in_pre:
        html_lines.append('</code></pre>')

    return '\n'.join(html_lines)


def inline_md(text):
    """인라인 Markdown 처리 (굵게, 이탤릭, 코드, 링크)."""
    # 코드
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # 굵게
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # 이탤릭
    text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
    # 링크
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank">\1</a>', text)
    return text


def generate_post_html(fm, body_html, slug):
    tag = fm.get('tag', 'opensource')
    tag_label, tag_class = TAG_LABELS.get(tag, (tag, tag))
    bg1, bg2, color = TAG_COLORS.get(tag, TAG_COLORS['opensource'])
    title = fm.get('title', '제목 없음')
    date = fm.get('date', '')
    emoji = fm.get('emoji', '📝')
    author = fm.get('author', '해커그라운드')

    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} · 해커그라운드</title>
    <link rel="stylesheet" href="../css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        .post-hero {{ padding: 8rem 0 4rem; background: linear-gradient(135deg, {bg1}, rgba(0,0,0,0.95)); min-height: 45vh; display: flex; align-items: center; }}
        .post-content-section {{ padding: 4rem 0; background: var(--dark-bg); }}
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-logo">
                <a href="/"><img src="../images/1920x480-1.png" alt="해커그라운드 로고" class="logo-image"></a>
            </div>
            <ul class="nav-menu">
                <li class="nav-item"><a href="/" class="nav-link">Home</a></li>
                <li class="nav-item"><a href="/events/" class="nav-link">Events</a></li>
                <li class="nav-item"><a href="/posts/" class="nav-link" style="color: var(--primary-green);">Posts</a></li>
                <li class="nav-item"><a href="/#about" class="nav-link">About</a></li>
            </ul>
            <div class="nav-toggle" id="mobile-menu">
                <span class="bar"></span><span class="bar"></span><span class="bar"></span>
            </div>
        </div>
    </nav>

    <section class="post-hero">
        <div class="container" style="max-width: 860px;">
            <div class="breadcrumb"><a href="/">Home</a><span class="sep">›</span><a href="/posts/">Posts</a><span class="sep">›</span><span style="color:#9ca3af;">{title[:20]}...</span></div>
            <span class="badge" style="background: {bg2}; color: {color}; border: 1px solid {color}40; margin-bottom: 1.5rem; display: inline-block;">{tag_label}</span>
            <h1 class="hero-title" style="font-size: clamp(1.8rem, 4vw, 3rem);">{emoji} {title}</h1>
            <p class="hero-subtitle" style="font-size: 1rem;">{fm.get("excerpt", "")} · {date} · {author}</p>
        </div>
    </section>

    <section class="post-content-section">
        <div class="container" style="max-width: 860px;">
            <article class="prose">
{body_html}
            </article>

            <div class="community-cta" style="margin-top: 4rem;">
                <h3>공유하고 싶은 팁이 있다면?</h3>
                <p>정보글을 직접 제안하거나 기여할 수 있어요!</p>
                <div class="btn-group">
                    <a href="/posts/" class="btn-primary">← 정보글 목록으로</a>
                    <a href="https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=post.md" target="_blank" class="btn-secondary">글 제안하기</a>
                </div>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo"><img src="../images/1920x480-1.png" alt="해커그라운드 로고" class="footer-logo-image"></div>
                <div class="footer-info">
                    <h3>Contact</h3>
                    <p>📧 events@hackersground.kr</p>
                    <div class="social-links">
                        <a href="https://github.com/hackersground-kr" target="_blank" class="social-link"><span>📱 GitHub</span></a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom"><p>&copy; 2025 해커그라운드(Hackers Ground). All rights reserved.</p></div>
        </div>
    </footer>
    <script src="../js/main.js"></script>
</body>
</html>'''


def slug_from_filename(filename):
    return os.path.splitext(filename)[0]


def process_posts():
    posts_meta = []

    if not os.path.exists(POSTS_DIR):
        print(f"[skip] {POSTS_DIR} 폴더 없음")
        return

    for filename in sorted(os.listdir(POSTS_DIR)):
        if not filename.endswith('.md'):
            continue

        slug = slug_from_filename(filename)
        src = os.path.join(POSTS_DIR, filename)
        dst = os.path.join(OUTPUT_DIR, f"{slug}.html")

        with open(src, 'r', encoding='utf-8') as f:
            content = f.read()

        fm, body = parse_front_matter(content)
        body_html = md_to_html(body)
        post_html = generate_post_html(fm, body_html, slug)

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(post_html)

        posts_meta.append({
            'slug': slug,
            'title': fm.get('title', slug),
            'date': fm.get('date', ''),
            'emoji': fm.get('emoji', '📝'),
            'tag': fm.get('tag', 'opensource'),
            'excerpt': fm.get('excerpt', ''),
        })
        print(f"[OK] {filename} → {dst}")

    # posts/posts.json 자동 갱신 (날짜 역순)
    posts_sorted = sorted(posts_meta, key=lambda p: p['date'], reverse=True)
    for p in posts_sorted:
        p['url'] = f"/posts/{p['slug']}.html"
    json_path = os.path.join(OUTPUT_DIR, 'posts.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(posts_sorted, f, ensure_ascii=False, indent=2)
    print(f"[OK] posts/posts.json 갱신 ({len(posts_sorted)}개)")

    # posts/index.html의 포스트 목록 섹션 자동 업데이트
    update_posts_index(posts_meta)


def update_posts_index(posts_meta):
    """posts/index.html의 posts-list 섹션을 최신 포스트 목록으로 업데이트합니다."""
    if not os.path.exists(INDEX_FILE):
        return

    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        index_html = f.read()

    # 포스트 목록 아이템 HTML 생성 (날짜 역순)
    posts_sorted = sorted(posts_meta, key=lambda p: p['date'], reverse=True)
    items_html = ''
    for p in posts_sorted:
        tag_label, tag_class = TAG_LABELS.get(p['tag'], (p['tag'], p['tag']))
        items_html += f'''                <a href="{p['slug']}.html" class="post-item" data-tag="{p['tag']}">
                    <span class="post-emoji">{p['emoji']}</span>
                    <div>
                        <div class="post-meta">
                            <span class="post-tag {tag_class}">{tag_label}</span>
                            <span class="post-date">{p['date']}</span>
                        </div>
                        <div class="post-title">{p['title']}</div>
                        <div class="post-excerpt">{p['excerpt']}</div>
                    </div>
                </a>\n'''

    # posts-list 섹션 교체
    updated = re.sub(
        r'(<div class="posts-list">).*?(</div>\s*\n\s*\n\s*<div class="community-cta")',
        lambda m: m.group(1) + '\n' + items_html + '            ' + m.group(2),
        index_html,
        flags=re.DOTALL
    )

    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        f.write(updated)

    print(f"[OK] posts/index.html 업데이트 완료 ({len(posts_meta)}개 포스트)")


if __name__ == '__main__':
    process_posts()
    print("✅ 변환 완료")
