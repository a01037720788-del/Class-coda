# CODA Learning — GitHub Pages + Google Sheets 독립 운영 전환 현황

목표: Base44 는 제작 도구로만 쓰고, 완성된 사이트는 **GitHub Pages + Google Sheets + Google Apps Script** 만으로 운영합니다.

> ⚠️ 이 대화에 `coda-student (1).zip` 파일이 전달되지 않았습니다.
> 현재 프로젝트(동일한 CODA 코드베이스)를 기준으로 작업했습니다. 다른 버전이라면 내용을 확인해 주세요.

---

## 1단계 — 완료 (이번 작업)

### 단원 콘텐츠를 저장소로 이동 ✅
- `public/data/units/python.json` (45개 단원)
- `public/data/units/junior_python.json` (2개 단원)
- `public/data/units/cpp.json` (21개 단원)
- 단원 설명·학습목표·개념·표·예제·문제·정답·퀴즈·미션·테스트케이스가 그대로 들어 있습니다.
- **관리자 전용 `missions[].answer_code` 는 내보낼 때 제거**했습니다. (정답 채점은 `expected_output` 비교로 동작하므로 학습 기능에는 영향이 없습니다.)
- 숨김 테스트케이스는 내용 없이 `{ "hidden": true }` 로만 남겨 노출을 막았습니다.

### Google Apps Script 백엔드 ✅
`apps-script/Code.gs` — 요청하신 기능을 모두 포함합니다.
- `login` · `validateSession` · `logout`
- `getStudentProfile` · `getStudentSubjects` · `getStudentProgress`
- `saveStudentProgress` · `saveQuizResult` · `saveMissionSubmission`
- 아이디 중복 검사, 비활성 계정 차단, 세션 만료(12시간), 로그인 5회 실패 시 15분 잠금
- 비밀번호: 평문 저장 없음 (학생별 랜덤 솔트 + 반복 HMAC-SHA256)
- 비밀번호 정책: **최소 4자리**만 검사, 복잡도 조건 없음 (초등학생용)
- 초기 비밀번호는 관리자가 시트의 "CODA 관리" 메뉴에서 학생별로 설정 (사이트에 회원가입 없음)
- 세션: 서버에는 토큰의 SHA-256 **해시만** 저장
- 소유권: `student_id` 는 항상 토큰에서 서버가 결정 → 다른 학생 기록 접근 불가
- 관리자 기능(학생 추가·비밀번호 재설정·과목 변경·비활성)은 **시트의 "CODA 관리" 메뉴에서만** 실행되며 웹 API 로 노출되지 않습니다.

설치·API 명세·보안 한계는 `apps-script/README.md` 참고.

### 클라이언트 API 모듈 ✅
- `src/lib/sheetsApi.js` — Apps Script 호출 (Base44 미사용)
- `src/lib/unitsRepo.js` — 정적 JSON 단원 로더 (Base44 미사용)

### GitHub Pages 배포 설정 ✅
- `vite.config.js` — `VITE_BASE_PATH` 로 하위 경로 base 지정, GitHub 빌드에서는 Base44 플러그인 제외
- `github-pages/deploy.yml` → 저장소의 `.github/workflows/deploy.yml` 로 복사
- 검증 완료:
  - 일반 빌드 성공 (Base44 미리보기용)
  - `CODA_TARGET=github-pages VITE_BASE_PATH=/coda-student/` 빌드 성공
  - 빌드 결과 `index.html` 에 Base44 런타임 참조 없음
  - 하위 경로에서도 열리도록 `dist/404.html` 사본 생성

---

## 2단계 — 남은 작업 (다음 턴)

**지금 클라이언트를 전환하면 사이트가 동작하지 않습니다.** 학생 로그인이 Google Apps Script 를 바라보게 되는데, 아직 그 주소가 없기 때문입니다.
아래 순서로 진행합니다.

1. **Apps Script 배포** (사용자 작업) → `/exec` 주소 확보
2. 주소를 `VITE_SHEETS_API_URL` 로 설정
3. 그다음 제가 처리:
   - 로그인 화면을 Sheets 인증으로 전환 (`src/pages/Login.jsx`, `src/lib/auth.js`)
   - `src/lib/dataAccess.js` 를 Sheets + 정적 JSON 기반으로 교체
   - **관리자 페이지·관리자 로그인·관리자 라우트 전부 삭제**
   - `@base44/sdk` / `@/api/base44Client` / Base44 백엔드 함수 호출 제거
   - 학습 기록 저장을 Sheets 로 연결
   - 최종 검수 체크리스트 실행

---

## 코드 실행 현황

### Python — 브라우저에서 동작 (Base44 불필요) ✅
`src/lib/codeRunner.js` 가 이미 **Pyodide(Web Worker)** 로 브라우저에서 실제 Python 3 를 실행합니다.
서버 호출이 아니며 Base44 와 무관합니다. 시간 제한과 무한 루프 시 Worker 종료 처리도 들어 있습니다.
Base44 폴백 경로만 제거하면 완전히 독립됩니다.

### C++ — 실행 미지원으로 확정 ✅
브라우저만으로 C++ 를 컴파일할 수 없어(WebAssembly 툴체인 100MB 이상, JS 인터프리터는 결과 부정확)
**실행 기능을 제공하지 않습니다.** 서비스 제한(GitHub·Sheets·Apps Script)을 그대로 지킵니다.

- `runCpp()` 은 실행을 시도하지 않고 "미지원" 결과를 즉시 반환합니다 (네트워크 요청 없음).
- 외부 실행 서비스(Judge0) 의존과 Base44 `runCppCode` 백엔드 함수 호출을 완전히 제거했습니다.
- 학생 화면에 **"C++ 코드 실행은 지원하지 않습니다"** 를 명확히 표시합니다.
  (C++ Unit 헤더, 코드 편집기, 예제 영역, 개념 코드 블록, 미션 영역)
- C++ 입력(stdin) 입력란도 제거했습니다. 실행하지 않는데 입력을 받는 UI 는 오해를 주기 때문입니다.

**그대로 동작하는 C++ 학습 기능**: 개념·표·예제 코드 열람, 코드 작성 및 자동 저장,
예제 완성 코드와의 비교 확인(‘작성 확인’), 문제 풀이, 메모, 미션 코드 제출(제출 기록 저장).

C++ 미션은 자동 채점을 하지 않습니다. 정답/오답을 표시하지 않고
"제출되었습니다 · 선생님이 직접 확인합니다" 로 안내하며, 완료 처리도 하지 않습니다.

> Pyodide 는 jsdelivr CDN 에서 정적 파일로 로드됩니다(백엔드 아님). 외부 요청을 완전히 없애려면 Pyodide 배포본을 저장소에 포함해 자체 호스팅할 수 있습니다.

---

## 배포 절차

1. Google Sheets 생성 → Apps Script 에 `apps-script/Code.gs` 붙여넣기 → `setupSpreadsheet()` 실행
2. 시트의 **CODA 관리** 메뉴에서 학생 추가 (`python,cpp` 형식)
3. 웹 앱 배포 → `/exec` 주소 복사
4. GitHub 저장소 → Settings > Secrets and variables > Actions > Variables 에 `VITE_SHEETS_API_URL` 추가
5. Settings > Pages > Source 를 **GitHub Actions** 로 설정
6. `.github/workflows/deploy.yml` 생성 ( `github-pages/deploy.yml` 복사 )
7. `main` 브랜치에 push → 자동 배포

---

## 최종 검수 체크리스트

| 항목 | 상태 |
| --- | --- |
| Base44 없이 사이트가 실행되는가? | ⏳ 2단계 (빌드는 이미 Base44 런타임 없이 성공) |
| GitHub Pages 에서 접속 가능한가? | ⏳ 워크플로 파일 준비됨, 저장소 설정 필요 |
| Google Sheets 학생 정보로 로그인 가능한가? | ⏳ 2단계 (서버 코드 완성) |
| 학생별 과목 권한이 적용되는가? | ⏳ 2단계 (서버가 `subjects` 로 판정) |
| Python 단원이 정상 표시되는가? | ✅ 데이터 45개 내보냄 |
| 저학년 Python 단원이 표시되는가? | ✅ 데이터 2개 내보냄 |
| C++ 단원이 표시되는가? | ✅ 데이터 21개 내보냄 |
| 기존 단원 내용이 유지되는가? | ✅ 설명·예제·문제·퀴즈·미션 전부 포함 |
| Python 코드 실행이 가능한가? | ✅ Pyodide(브라우저) 동작 |
| C++ 코드 실행이 가능한가? | ✅ 미지원으로 명확히 표시 (실행 기능 없음, 외부 서비스 미사용) |
| 학습 기록이 Google Sheets 에 저장되는가? | ⏳ 2단계 (서버 저장 함수 완성) |
| 다른 학생의 기록에 접근할 수 없는가? | ✅ 서버가 토큰으로 `student_id` 결정 |
| 비밀번호 정책이 초등학생용인가? (4자리 허용) | ✅ 최소 4자리, 복잡도 조건 없음, 평문 미저장 |
| GitHub 에 인증 비밀정보가 없는가? | ✅ 비밀키 없음, 공개 설정값만 사용 |