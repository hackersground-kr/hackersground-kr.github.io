# 해커그라운드 커뮤니티 사이트

개발자들이 함께 배우고 만들고 공유하는 해커그라운드 커뮤니티 웹사이트입니다.

🌐 **사이트**: [hackersground.kr](https://hackersground.kr)

---

## 아키텍처

```
GitHub Pages (정적 호스팅)
  ├─ index.html / events / posts / admin
  └─ CSS · JS · 이미지

Azure Functions (API 서버)
  ├─ POST /api/register    ← 행사 신청
  └─ GET  /api/registrations ← 신청자 조회 (어드민 전용)
  └─ GET/PUT /api/content  ← 정보글·행사 콘텐츠

Azure Table Storage
  └─ EventRegistrations 테이블 (신청 데이터)
  └─ SiteContent 테이블 (정보글·행사, Markdown·조회수·시각)
```

---

## 프로젝트 구조

```
/
├── index.html                  # 메인 랜딩 (다가오는 행사 자동 필터)
├── robots.txt                  # 검색엔진 크롤러 설정
├── sitemap.xml                 # 검색엔진 사이트맵 (배포 시 자동 갱신)
│
├── events/
│   ├── index.html              # 행사 목록 (날짜순 자동 정렬)
│   ├── events.json             # ✏️ 행사 메타데이터 (신청폼 연동용)
│   ├── register.html           # 행사 신청 폼 (?event=ID)
│   ├── ai-builder-meetup.html  # AI 빌더 정기모임 시리즈
│   ├── vibe-coding-workshop.html
│   └── *.html                  # 개별 행사 페이지
│
├── posts/
│   ├── index.html              # 정보글 목록
│   ├── posts.json              # 정보글 메타데이터 (자동 갱신)
│   └── *.html                  # 개별 정보글 (자동 생성)
│
├── admin/
│   └── index.html              # 어드민 대시보드 (Microsoft 로그인 필요)
│
├── _posts/                     # ✏️ Markdown 정보글 원본
│   └── YYYY-MM-DD-slug.md
│
├── _scripts/
│   ├── build_posts.py          # MD → HTML 변환 + posts.json 갱신
│   └── build_sitemap.py        # sitemap.xml 자동 생성
│
├── api/                        # Azure Functions 백엔드
│   └── src/functions/
│       ├── register.js         # POST /api/register
│       └── getRegistrations.js # GET  /api/registrations
│
├── css/style.css               # 공통 스타일
├── js/main.js                  # 공통 스크립트
└── .github/
    ├── workflows/
    │   ├── main.yaml           # 배포 (push → sitemap 생성 → Pages 배포)
    │   └── build-posts.yaml    # MD 변경 시 HTML + posts.json 자동 빌드
    └── ISSUE_TEMPLATE/
        ├── event.md
        └── post.md
```

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| 행사 목록 | 날짜 기준 자동 정렬, 지난 행사 "종료" 배지 표시 |
| 메인 행사 섹션 | 오늘 이전 행사 자동 숨김 |
| 행사 신청 | HTML 폼 → Azure Functions → Table Storage 저장 |
| 정보글 | `_posts/*.md` 작성 → 자동으로 HTML 변환 및 배포 |
| 어드민 | `/admin/` — Microsoft 계정 로그인, 신청자 목록 조회·CSV 다운로드 |
| SEO | `robots.txt` + `sitemap.xml` (배포 시 자동 최신화) |

---

## 새 행사 추가하기

### 1. 행사 페이지 생성

`events/` 폴더에 HTML 파일을 추가하세요. 기존 파일을 템플릿으로 복사하면 편해요.

```
events/my-new-event.html
```

### 2. 행사 신청 폼 연동

`events/events.json`에 항목을 추가하면 신청 폼에서 행사 정보가 자동으로 표시됩니다.

```json
{
  "my-new-event": {
    "name": "행사명",
    "emoji": "🎯",
    "date": "2026. 10. 00",
    "location": "장소",
    "type": "오프라인",
    "price": "무료",
    "capacity": "선착순 30명",
    "deadline": "2026.09.28"
  }
}
```

신청 버튼 URL: `/events/register.html?event=my-new-event`

### 3. 행사 목록 카드 추가

`events/index.html`의 `.events-grid` 안에 카드를 추가하세요. `data-date` 속성이 있어야 날짜순 정렬이 적용됩니다.

```html
<div class="event-card" data-date="2026-10-00" data-type="offline" data-status="upcoming">
  ...
</div>
```

---

## 새 정보글 작성하기

`_posts/` 폴더에 Markdown 파일을 추가하면 GitHub Actions가 자동으로 HTML을 생성하고 `posts.json`을 갱신합니다.

**파일명**: `YYYY-MM-DD-slug.md`

**Front matter**:

```yaml
---
title: "글 제목"
date: "2026-08-15"
emoji: "🚀"
tag: "azure"          # azure | github | career | opensource
excerpt: "한 줄 요약 (목록에 표시됩니다)"
author: "작성자 이름"
---

본문 내용 (Markdown)
```

파일을 push하면 자동으로:
- `posts/YYYY-MM-DD-slug.html` 생성
- `posts/posts.json` 갱신
- GitHub Pages 재배포

---

## AI 빌더 정기모임 정보글 연결

회차가 끝난 후 정보글을 작성하면 `events/ai-builder-meetup.html`의 `sessions` 배열에 `postUrl`을 추가하세요.

```js
{ date: '2026-08-13', postUrl: '/posts/2026-08-13-ai-builder-1.html' }
```

---

## 어드민 페이지

`/admin/` — Microsoft 계정으로 로그인해야 접근할 수 있습니다.

**어드민 이메일 추가 방법**:
```
Azure Portal → Entra ID → 엔터프라이즈 애플리케이션
→ hackersground-admin 검색 → 사용자 및 그룹 → + 추가
```

**기능**: 행사별 신청자 목록 조회, CSV 다운로드

---

## Azure 인프라

| 리소스 | 이름 | 비고 |
|---|---|---|
| 구독 | Hackers Ground | `bfa39d86-...` |
| 리소스 그룹 | `hackersground-community` | koreacentral |
| Storage Account | `hackersgroundstorage` | Table Storage |
| Function App | `hackersground-api` | Node 22, Linux |
| App Registration | `hackersground-admin` | Microsoft 로그인용 |

**API 엔드포인트**: `https://hackersground-api.azurewebsites.net/api`

---

## GitHub Actions 워크플로우

| 워크플로우 | 트리거 | 동작 |
|---|---|---|
| `main.yaml` | `main` 브랜치 push | sitemap.xml 생성 → GitHub Pages 배포 |
| `build-posts.yaml` | `_posts/**` 변경 | MD → HTML 변환 + posts.json 갱신 후 commit |

---

## 기여하기

- **행사 제안**: [이슈 열기](https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=event.md)
- **정보글 제안**: [이슈 열기](https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=post.md)
- **직접 기여**: 위 가이드 참고 후 PR 열기

자세한 기여 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

---

## 라이선스

[MIT](./LICENSE)
