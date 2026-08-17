#!/usr/bin/env python3
"""
sitemap.xml 자동 생성 스크립트
posts/posts.json, events/events.json을 읽어서 sitemap.xml을 갱신합니다.
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

    # 행사 상세 페이지
    events_json = "events/events.json"
    if os.path.exists(events_json):
        with open(events_json, encoding="utf-8") as f:
            events = json.load(f)
        for event in events.values():
            urls.append(build_url(
                BASE_URL + event["url"],
                TODAY,
                "yearly",
                "0.6",
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
