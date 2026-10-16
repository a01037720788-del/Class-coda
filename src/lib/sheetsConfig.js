/**
 * Google Apps Script 웹 앱(/exec) 주소.
 *
 * 우선순위: 빌드 환경변수 VITE_SHEETS_API_URL → 아래 SHEETS_API_URL 값
 *  - GitHub Pages 빌드는 워크플로 환경변수(.github/workflows/deploy.yml) 또는 이 파일로 지정합니다.
 *  - 로컬 개발은 .env.local 의 VITE_SHEETS_API_URL 을 사용합니다.
 *
 * 예) export const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
 *
 * ※ 이 주소는 브라우저 번들에 포함되므로 비밀로 취급하지 않습니다.
 *   실제 접근 제어는 서버(Apps Script)의 비밀번호 검증 + 세션 토큰이 담당합니다.
 */
export const SHEETS_API_URL = "";