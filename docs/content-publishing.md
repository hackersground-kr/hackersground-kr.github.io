# DB 콘텐츠 발행

정보글과 행사는 Azure Table Storage의 `SiteContent` 테이블을 원본으로 사용합니다. 정적 페이지는 콘텐츠 API를 호출하며, 네트워크 장애 때만 기존 정적 목록을 대신 보여줍니다.

## 데이터와 API

| 구분 | 값 |
|---|---|
| Table Storage 테이블 | `SiteContent` |
| PartitionKey | `post` 또는 `event` |
| RowKey | 영문 소문자·숫자·하이픈으로 만든 slug |
| 공개 목록 | `GET /api/content/post`, `GET /api/content/event` |
| 공개 상세 | `GET /api/content/{kind}/{slug}` |
| 조회수 증가 | `POST /api/content/{kind}/{slug}` |
| 발행/수정 | `PUT /api/content/{kind}/{slug}` |

각 엔터티는 제목, 요약, Markdown 원문, 안전하게 렌더링한 HTML, 제작 시각(`createdAt`), 최종 수정 시각(`updatedAt`), 발행 시각(`publishedAt`), 조회수(`viewCount`)를 저장합니다. 행사에는 시작/종료 시각, 장소, 유형, 참가비, 정원, 신청 링크도 함께 저장합니다.

Azure Table Storage의 문자열 속성은 64 KiB 제한이 있으므로 본문 Markdown은 60 KiB 이하로 작성합니다. 이를 초과하는 대용량 첨부 파일은 Blob Storage에 두고 Markdown에서 링크하세요.

## GitHub Issue로 발행하기

1. GitHub에서 **New issue**를 누릅니다.
2. **정보글 발행** 또는 **행사 발행** 양식을 고릅니다.
3. `Slug`, 제목, 메타데이터와 본문 Markdown을 작성합니다.
4. 검토가 끝나면 이슈를 닫습니다.

이슈에는 `content-publish`와 `post` 또는 `event` 레이블이 자동으로 붙습니다. 닫힌 이슈를 `.github/workflows/sync-content-issue.yaml`이 처리하여 DB에 upsert하고, `posts/posts.json` 또는 `events/events.json`도 함께 갱신합니다. 같은 slug로 다시 발행하면 제작 시각과 조회수는 보존하고 본문 및 최종 수정 시각만 갱신합니다.

## Markdown 지원 범위

GitHub Flavored Markdown을 지원합니다.

- 제목, 단락, 인용, 목록, 코드 블록
- 이미지: `![대체 텍스트](https://...)`
- 테이블
- 링크
- YouTube: 한 줄에 `@[youtube](https://www.youtube.com/watch?v=VIDEO_ID)` 또는 `https://youtu.be/VIDEO_ID`

본문은 서버에서 허용 목록 기반으로 정제됩니다. 임의 HTML, 스크립트, 임의 iframe은 제거되고 YouTube iframe만 허용됩니다.

## 필요한 GitHub/Azure 설정

GitHub Actions가 콘텐츠 API를 호출할 수 있도록 다음 값을 설정하세요.

| 위치 | 이름 | 값 |
|---|---|---|
| GitHub repository variable | `CONTENT_SYNC_URL` | `https://hackersground-api.azurewebsites.net/api` |
| GitHub repository secret | `CONTENT_SYNC_TOKEN` | 충분히 긴 무작위 문자열 |
| GitHub repository secret | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | 기존 API 배포 자격 증명 |
| GitHub repository secret | `RESEND_API_KEY` | 기존 신청 확인 메일 키 |

`CONTENT_SYNC_TOKEN`은 GitHub Secret과 Function App 설정에 같은 값으로 설정해야 합니다. `deploy-api.yaml`은 API 배포 시 Function App의 `CONTENT_SYNC_TOKEN`도 갱신합니다.

```bash
az functionapp config appsettings set \
  --name hackersground-api \
  --resource-group hackersground-community \
  --settings "CONTENT_SYNC_TOKEN=<동일한-무작위-문자열>"
```

콘텐츠 상세 페이지는 `/posts/content.html?slug=<slug>` 또는 `/events/content.html?slug=<slug>`입니다. 개별 정적 콘텐츠 파일은 DB 이관 뒤 유지하지 않으므로, 새 링크 형식을 사용하세요.

## 뉴스레터 구독자

메인 페이지와 게시글 상세 CTA의 구독 폼은 `NewsletterSubscribers` 테이블에 구독자를 저장합니다. 이메일 주소의 SHA-256 해시를 RowKey로 사용하고, 이메일·소속(개발자/직장인/대표자/학생)·관심사(AI/Cloud/GitHub/Career/Open Source)·구독 상태·동의 시각·제출 경로를 함께 관리합니다.

안내 메일은 월 1~2회만 발송합니다. 발송 시에는 수신자가 쉽게 구독을 해지할 수 있는 안내를 포함해야 하며, 해지 요청이 들어오면 해당 엔터티의 `status`를 `unsubscribed`로 변경하세요.
