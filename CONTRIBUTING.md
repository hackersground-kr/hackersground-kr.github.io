# 해커그라운드 커뮤니티 사이트에 기여하기

개발자라면 누구나 정보글과 행사를 추가할 수 있어요!

---

## 📚 정보글 추가하기 (Markdown으로 간단하게!)

글을 HTML로 직접 쓸 필요 없어요. **Markdown 파일 하나**만 추가하면 GitHub Actions가 자동으로 HTML 페이지를 만들어줘요.

### 1단계 — 이 레포를 포크하세요

```
https://github.com/hackersground-kr/hackersground-kr.github.io
```

### 2단계 — `_posts/` 폴더에 파일 추가

파일명 규칙: `YYYY-MM-DD-영문-슬러그.md`

예시: `_posts/2025-08-15-my-first-post.md`

### 3단계 — Front Matter 작성

파일 맨 위에 아래 형식으로 정보를 채워요:

```markdown
---
title: "내 글 제목"
date: "2025-08-15"
emoji: "🚀"
tag: "azure"          # azure | github | career | opensource
excerpt: "한 줄 요약 (목록 페이지에 표시됩니다)"
author: "작성자 이름"
---

## 본문 시작

일반 Markdown 문법을 그대로 사용하면 돼요.

- 리스트
- **굵게**
- `코드`
- [링크](https://example.com)

> 인용문

```

### 4단계 — PR 열기

`main` 브랜치로 PR을 열어주세요. 머지되면 자동으로 빌드돼요.

---

## 🗓️ 행사 추가하기

### 방법 1 — GitHub Issue로 제안 (비개발자도 OK)

[행사 제안 이슈 열기](https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=event.md)

### 방법 2 — 직접 파일 추가 (개발자 추천)

#### 2-1. `events/` 폴더에 HTML 파일 추가

기존 파일 복사 후 내용 수정:

```bash
cp events/workshop-azure-ai.html events/my-new-event.html
```

#### 2-2. `events/index.html`의 이벤트 그리드에 카드 추가

```html
<div class="event-card" data-type="offline" data-status="upcoming">
    <div class="event-category handson">핸즈온</div>
    <h3 class="event-title">내 행사 이름</h3>
    ...
    <a href="my-new-event.html" class="event-button">자세히 보기</a>
</div>
```

#### 2-3. `events/register.html`의 `EVENTS` 객체에 행사 등록

```javascript
const EVENTS = {
    // 기존 행사들...
    'my-new-event': {
        name: '내 행사 이름',
        emoji: '🎯',
        date: '2025. 11. 01 (토)',
        location: '해커그라운드 (중앙로)',
        type: '오프라인',
        price: '무료',
        capacity: '선착순 30명',
        deadline: '2025.10.28 (화)',
    },
};
```

#### 2-4. `events/my-new-event.html`의 신청 버튼 링크 수정

```html
<a href="register.html?event=my-new-event" class="cta-button primary">신청하기</a>
```

---

## 🔧 Azure Functions API 배포 (관리자용)

행사 신청 폼은 Azure Functions + Azure Table Storage를 사용해요.

### 필요한 Azure 리소스

```
리소스 그룹: hackersground-community
  ├── Storage Account: hackersgroundstorage
  │     └── Table: EventRegistrations
  └── Function App: hackersground-api
        └── Function: register (HTTP trigger)
```

### 배포 방법

```bash
# 1. Azure CLI 로그인
az login

# 2. 리소스 그룹 생성 (해커그라운드 구독)
az group create \
  --name hackersground-community \
  --location koreacentral

# 3. Storage Account 생성
az storage account create \
  --name hackersgroundstorage \
  --resource-group hackersground-community \
  --sku Standard_LRS \
  --location koreacentral

# 4. Function App 생성 (Node.js 18)
az functionapp create \
  --name hackersground-api \
  --resource-group hackersground-community \
  --consumption-plan-location koreacentral \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --storage-account hackersgroundstorage \
  --os-type Linux

# 5. 환경 변수 설정
STORAGE_KEY=$(az storage account keys list \
  --account-name hackersgroundstorage \
  --resource-group hackersground-community \
  --query '[0].value' -o tsv)

az functionapp config appsettings set \
  --name hackersground-api \
  --resource-group hackersground-community \
  --settings \
    "AZURE_STORAGE_ACCOUNT_NAME=hackersgroundstorage" \
    "AZURE_STORAGE_ACCOUNT_KEY=$STORAGE_KEY" \
    "ALLOWED_ORIGIN=https://hackersground-kr.github.io"

# 6. CORS 설정
az functionapp cors add \
  --name hackersground-api \
  --resource-group hackersground-community \
  --allowed-origins "https://hackersground-kr.github.io"

# 7. 함수 배포
cd api && npm install
func azure functionapp publish hackersground-api
```

### 배포 후 events/register.html API URL 수정

```javascript
// 배포된 실제 URL로 변경
const API_URL = 'https://hackersground-api.azurewebsites.net/api/register';
```

### 신청자 목록 확인

Azure Portal → Storage Account → Table Storage → `EventRegistrations` 테이블에서 확인하거나:

```bash
az storage entity query \
  --account-name hackersgroundstorage \
  --table-name EventRegistrations \
  --filter "PartitionKey eq 'hackersground-2025'"
```

### 예상 비용

Azure Functions Consumption Plan:
- 월 100만 건 요청 무료
- 신청 수백 건 수준이면 **사실상 무료**

Table Storage:
- 1GB당 $0.045/월 → **거의 무료**

---

## 💬 질문이 있다면

[GitHub Discussions](https://github.com/hackersground-kr/hackersground-kr.github.io/discussions)에 남겨주세요!
