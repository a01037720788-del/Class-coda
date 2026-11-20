# CODA 학습 사이트

운영 주소: https://a01037720788-del.github.io/Class-coda/

## 운영 구조
- **GitHub Pages**: React/Vite 프런트엔드 배포
- **Google Apps Script**: 별도 프로젝트에서 로그인, 학생 관리, 학습 기록 및 AI API 처리
- **Google Sheets**: 학생 및 학습 데이터 보관

Google Apps Script는 GitHub 저장소에서 관리하거나 자동 배포하지 않습니다.

## 개발 및 배포

```bash
npm ci
npm run dev
npm run build
```

GitHub Actions의 `.github/workflows/deploy.yml`이 `main` 브랜치에서 배포합니다.
GitHub Pages의 프로젝트 경로는 `/Class-coda/`이며 빌드 시 `CODA_TARGET=github-pages`와 `VITE_BASE_PATH=/Class-coda/`를 사용합니다.

API 주소는 `VITE_SHEETS_API_URL`(GitHub Actions 변수) 또는 `src/lib/sheetsConfig.js`에서 설정합니다. URL은 비밀키가 아니며 Apps Script가 모든 권한을 서버에서 검증해야 합니다.

## 이전 데이터 주의

`base44/` 폴더는 과거 백엔드 정의의 사본입니다. 현재 프런트엔드의 실행 의존성은 아니지만, **과거 Base44 데이터가 Google Sheets로 자동 이전되는 것은 아닙니다.** 삭제 전에 필요한 데이터와 기능을 별도로 확인하세요.

## GitHub Pages 새로고침

배포 워크플로에서 `dist/index.html`을 `dist/404.html`로 복사하여 SPA 라우팅을 지원합니다. `public/_redirects`는 GitHub Pages에서 사용되지 않습니다.
