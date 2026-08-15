# 해커그라운드 커뮤니티 사이트

개발자들이 함께 배우고 만들고 공유하는 해커그라운드 커뮤니티 웹사이트입니다.

🌐 **사이트**: [hackersground-kr.github.io](https://hackersground-kr.github.io)

## 구조

```
/
├── index.html          # 메인 랜딩 페이지
├── events/
│   ├── index.html      # 행사 목록
│   └── *.html          # 개별 행사 페이지
├── posts/
│   ├── index.html      # 정보글 목록
│   └── *.html          # 개별 정보글
├── css/
│   └── style.css       # 공통 스타일
└── .github/
    ├── workflows/      # GitHub Actions (자동 배포)
    └── ISSUE_TEMPLATE/ # 행사/정보글 제안 템플릿
```

## 기여하기

### 행사 제안

새 행사나 워크샵을 제안하려면 [이슈 열기](https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=event.md)

### 정보글 제안

공유하고 싶은 팁이나 가이드가 있다면 [이슈 열기](https://github.com/hackersground-kr/hackersground-kr.github.io/issues/new?template=post.md)

### 직접 기여

1. 이 레포를 포크하세요
2. `events/` 또는 `posts/` 폴더에 새 HTML 파일을 만드세요
   - 기존 파일을 템플릿으로 복사해서 사용하면 편해요
3. 목록 페이지(`events/index.html` 또는 `posts/index.html`)에 카드를 추가하세요
4. PR을 열어주세요

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 GitHub Pages에 배포합니다.

## 라이선스

[MIT](./LICENSE)