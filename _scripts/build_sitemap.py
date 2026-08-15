#!/usr/bin/env python3
"""
sitemap.xml 자동 생성 스크립트
posts/posts.json, events/events.json을 읽어서 sitemap.xml을 갱신합니다.

GitHub Actions에서 build_posts.py 이후 실행합니다.
"""

import json
import os
from datetime import date

BASE_URL = "https://hackersground.kr"
TODAY = date.today().isoformat()

# 고정 페이지 (우선순위 순)
STATIC_PAGES = [
    {"path": "/",          "changefreq": "weekly",  "priority": "1.0"},
    {"path": "/events/",   "changefreq": "weekly",  "priority": "0.9"},
    {"path": "/posts/",    "changefreq": "weekly",  "priority": "0.9"},
]

# 행사 고정 페이지 (events.json에 없는 것)
EVENT_PAGES = [
    "vibe-coding-workshop",
    "ai-builder-meetup",
    "hackersground-2025",
    "workshop-azure-ai",
    "docker-workshop",
    "growth-story",
    "networking-party",
    "chatgpt-workshop",
]


def build_url(loc, lastmod, changefreq, priority):
    return (
        f"  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


def main():
    urls = []

    # 고정 페이지
    for page in STATIC_PAGES:
        urls.append(build_url(
            BASE_URL + page["path"],
            TODAY,
            page["changefreq"],
            page["priority"],
        ))

    # 행사 페이지 (events.json 있으면 참조, 없으면 고정 목록)
    events_json = "events/events.json"
    event_ids = list(EVENT_PAGES)
    if os.path.exists(events_json):
        with open(events_json, encoding="utf-8") as f:
            events = json.load(f)
        # events.json에 있는 ID + 고정 목록 합산 (중복 제거)
        event_ids = list(dict.fromkeys(list(events.keys()) + EVENT_PAGES))

    for eid in event_ids:
        priority = "0.8" if eid in ("vibe-coding-workshop", "ai-builder-meetup") else "0.6"
        changefreq = "monthly" if priority == "0.8" else "yearly"
        urls.append(build_url(
            f"{BASE_URL}/events/{eid}.html",
            TODAY,
            changefreq,
            priority,
        ))

    # 정보글 (posts/posts.json)
    posts_json = "posts/posts.json"
    if os.path.exists(posts_json):
        with open(posts_json, encoding="utf-8") as f:
            posts = json.load(f)
        for post in posts:
            urls.append(build_url(
                BASE_URL + post["url"],
                post.get("date", TODAY),
                "yearly",
                "0.7",
            ))

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n'
        + "\n\n".join(urls)
        + "\n\n</urlset>\n"
    )

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap)

    print(f"✅ sitemap.xml 생성 완료 ({len(urls)}개 URL)")


if __name__ == "__main__":
    main()
