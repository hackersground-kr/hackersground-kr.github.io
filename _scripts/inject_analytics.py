#!/usr/bin/env python3
"""
모든 HTML 파일에 Google Tag Manager & 네이버 서치어드바이저 태그를 자동 삽입합니다.
- <head> 최상단: GTM 스크립트 + 네이버 site-verification 메타태그
- <body> 직후: GTM noscript iframe

GitHub Actions(main.yaml)에서 배포 전 자동 실행됩니다.
이미 태그가 있는 파일은 건너뜁니다.
"""

import os
import re
import glob
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GTM_ID = "GTM-MZT9L6Z5"
NAVER_VERIFICATION = "713b4f34ec9a62ae39ba8e83e99fbab81d3faf89"

GTM_HEAD_SNIPPET = f"""    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':
    new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    }})(window,document,'script','dataLayer','{GTM_ID}');</script>
    <!-- End Google Tag Manager -->
    <meta name="naver-site-verification" content="{NAVER_VERIFICATION}" />"""

GTM_BODY_SNIPPET = f"""    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->"""

SKIP_DIRS = {".git", "node_modules", "_scripts", "api"}


def should_skip(path):
    rel = os.path.relpath(path, ROOT)
    for part in rel.split(os.sep):
        if part in SKIP_DIRS:
            return True
    return False


def inject(content):
    """GTM + 네이버 태그를 삽입합니다. 이미 있으면 그대로 반환."""
    if GTM_ID in content:
        return content, False

    # <head> 직후에 GTM head + naver meta 삽입
    content = re.sub(
        r'(<head(?:\s[^>]*)?>)',
        lambda m: m.group(0) + "\n" + GTM_HEAD_SNIPPET,
        content,
        count=1,
    )

    # <body> 직후에 GTM noscript 삽입
    content = re.sub(
        r'(<body(?:\s[^>]*)?>)',
        lambda m: m.group(0) + "\n" + GTM_BODY_SNIPPET,
        content,
        count=1,
    )

    return content, True


def main():
    html_files = sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True))
    html_files = [f for f in html_files if not should_skip(f)]

    updated, skipped = [], []
    for path in html_files:
        with open(path, "r", encoding="utf-8") as f:
            original = f.read()

        result, changed = inject(original)

        if changed:
            with open(path, "w", encoding="utf-8") as f:
                f.write(result)
            updated.append(os.path.relpath(path, ROOT))
        else:
            skipped.append(os.path.relpath(path, ROOT))

    print(f"[analytics] ✅ 주입 완료: {len(updated)}개 / ⏭  이미 적용: {len(skipped)}개")
    for p in updated:
        print(f"  + {p}")


if __name__ == "__main__":
    main()
