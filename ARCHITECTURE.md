# CODA 운영 아키텍처

- 프런트엔드: GitHub Pages / React / Vite
- 백엔드: 독립 Google Apps Script 웹 앱
- 데이터: Google Sheets
- 로그인: Apps Script 발급 세션 토큰
- 학습 단원: 프로젝트에 포함된 정적 JSON 및 Google Sheets 단원 수정사항
- Python 코드 실행: 브라우저 Pyodide(서버 보안 채점과 다름)

Google Apps Script 프로젝트는 GitHub Pages 프로젝트와 별도로 관리합니다.
미구현 관리 기능은 `src/lib/dataAccess.js`에서 오류를 반환합니다.
