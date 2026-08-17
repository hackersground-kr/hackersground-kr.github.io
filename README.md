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
├── _scripts/
│   └── build_sitemap.py        # sitemap.xml 자동 생성
│
├── api/                        # Azure Functions 백엔드
│   └── src/functions/
│       ├── register.js         # POST /api/register
│       ├── getRegistrations.js # GET  /api/registrations
│       └── content.js          # 게시글·행사 DB API
│
├── css/style.css               # 공통 스타일
├── js/main.js                  # 공통 스크립트
└── .github/
    ├── workflows/
    │   ├── main.yaml           # 배포 (push → sitemap 생성 → Pages 배포)
    │   └── sync-content-issue.yaml # 이슈 → DB·JSON 동기화
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
| 콘텐츠 | GitHub Issue Markdown → Azure Table Storage → DB 기반 목록·상세 페이지 |
| 어드민 | `/admin/` — Microsoft 계정 로그인, 신청자 목록 조회·CSV 다운로드 |
| SEO | `robots.txt` + `sitemap.xml` (배포 시 자동 최신화) |

---

## 새 정보글·행사 작성하기

GitHub Issue의 **정보글 발행** 또는 **행사 발행** 양식으로 Markdown을 작성한 뒤, 검토가 끝나면 이슈를 닫으세요. GitHub Actions가 Azure Table Storage에 저장하고 `posts.json` 또는 `events.json`을 자동 갱신합니다.

상세 형식과 Azure 설정은 [`docs/content-publishing.md`](docs/content-publishing.md)를 참고하세요.

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
