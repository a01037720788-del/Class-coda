# CODA Learning — Google Apps Script 백엔드

Google Sheets 를 데이터베이스로 사용하는 학생 전용 학습 사이트의 서버입니다.
운영 서비스는 **GitHub Pages + Google Sheets + Google Apps Script** 세 가지뿐입니다.

---

## 1. Google Sheets 구조

`setupSpreadsheet()` 를 실행하면 아래 시트가 자동 생성됩니다.

### `Students` (학생 명단 — 시트에서만 관리)

| 열 | 설명 |
| --- | --- |
| `student_id` | 고유 ID (추가 시 자동 생성) |
| `name` | 학생 이름 |
| `login_id` | 로그인 아이디 |
| `password_hash` | PBKDF2-HMAC-SHA256 해시 (평문 저장 안 함, hex 또는 base64) |
| `password_salt` | 학생별 랜덤 솔트 (hex 또는 base64) |
| `password_algorithm` | 해시 사양. 예: `PBKDF2-HMAC-SHA256:310000` (비어 있으면 310000회로 간주) |
| `school` | 학교 (선택) |
| `grade` | 학년 (선택) |
| `subjects` | 수강 과목. 예: `python,cpp` — 허용값: `python`, `junior_python`, `cpp` |
| `status` | `active` / `inactive` (inactive 는 로그인 차단) |

### `StudentProgress`

`student_id` · `subject` · `unit_id` · `completed` · `last_accessed` · `data`
(`data` 는 완료한 예제/문제/미션 목록 등 부가 진행 정보를 담는 JSON 열입니다.)

### `QuizResults`

`student_id` · `subject` · `unit_id` · `score` · `submitted_at` · `item_number` · `answer` · `data`

### `MissionSubmissions`

`student_id` · `subject` · `unit_id` · `submission` · `submitted_at` · `mission_number` · `is_correct` · `data`

### 내부 시트 (숨김)

`_Sessions` (세션 토큰 **해시**와 만료 시각) · `_LoginAttempts` (로그인 실패 횟수 / 잠금)

---

## 2. 설치 순서

1. Google Sheets 에서 새 스프레드시트를 만듭니다.
2. **확장 프로그램 → Apps Script** 를 엽니다.
3. `Code.gs` 파일 내용을 전부 지우고 이 폴더의 `Code.gs` 를 붙여넣습니다.
4. 왼쪽 **파일 + → 스크립트** 로 새 파일을 만들고 이름을 **`Crypto.gs`** 로 지정한 뒤,
   이 폴더의 `Crypto.gs` 내용을 붙여넣습니다.
   (PBKDF2-HMAC-SHA256 검증 구현입니다. 이 파일이 없으면 로그인이 `setup_incomplete` 로 실패합니다.)
5. 편집기에서 `setupSpreadsheet` 를 선택해 **한 번 실행**하고 권한을 승인합니다.
   → 시트 6개와 `onOpen` 트리거가 생성되고, 기존 시트에 빠진 열(`password_algorithm`)이 보완됩니다.
6. 스프레드시트를 새로고침하면 상단에 **CODA 관리** 메뉴가 나타납니다.
   먼저 **CODA 관리 → 보안 자체 점검 (PBKDF2 속도)** 를 실행해 실제 로그인 지연 시간을 확인하세요.
7. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
8. 발급된 `https://script.google.com/macros/s/…/exec` 주소를 복사해 아래 둘 중 한 곳에 넣습니다.
   - `src/lib/sheetsConfig.js` 의 `SHEETS_API_URL` (저장소에 함께 두는 방식)
   - 또는 저장소 Settings → Secrets 에 `VITE_SHEETS_API_URL` 로 등록 + 워크플로 `env` 에 연결
   (로컬 개발은 `.env.local` 에 `VITE_SHEETS_API_URL=...`)

> 코드를 수정하면 **배포 → 배포 관리 → 편집 → 버전: 새 버전** 으로 다시 배포해야 반영됩니다.

---

## 3. 관리자 기능 (웹사이트에 없음)

학생 등록·수정·비활성화·수강 과목 변경은 **시트의 CODA 관리 메뉴**에서만 실행됩니다.
이 함수들은 시트 소유자 권한으로 실행되며 웹 앱 API 로는 노출되지 않습니다.

- **학생 추가** — `이름,아이디,비밀번호,학교,학년,과목` 형식으로 입력 (아이디 중복 검사 포함)
- **학생 수정** — 이름/학교/학년
- **비밀번호 재설정** — 새 솔트 + 새 해시 생성
- **수강 과목 변경** — 허용값만 저장
- **계정 활성/비활성**
- **만료 세션 정리**
- **보안 자체 점검 (PBKDF2 속도)** — 현재 런타임에서 310,000회 계산에 걸리는 시간을 측정해 보여줍니다

---

## 4. 웹 앱 API

요청: `POST` + `Content-Type: text/plain;charset=utf-8`, 본문은 JSON 문자열입니다.
(응답은 `{ ok: true, data: … }` 또는 `{ ok: false, error, message }`)

```json
{ "action": "login", "login_id": "hong01", "password": "****", "token": "<세션 토큰>" }
```

| action | 필수 값 | 설명 |
| --- | --- | --- |
| `login` | `login_id`, `password` | 성공 시 `token`, `expires_at`, `student` 반환 |
| `validateSession` | `token` | `{ valid, student }` |
| `logout` | `token` | 세션 삭제 |
| `getStudentProfile` | `token` | 본인 프로필 |
| `getStudentSubjects` | `token` | 본인 수강 과목 배열 |
| `getStudentProgress` | `token` (`subject` 선택) | 본인 진행/퀴즈/미션 기록 |
| `saveStudentProgress` | `token`, `subject`, `unit_id`, `completed`, `data` | 진행 저장 |
| `saveQuizResult` | `token`, `subject`, `unit_id`, `item_number`, `score`, `answer` | 퀴즈 결과 저장 |
| `saveMissionSubmission` | `token`, `subject`, `unit_id`, `mission_number`, `submission`, `is_correct` | 미션 제출 저장 |

GET 호출도 지원합니다(`?payload=<JSON>`). 다만 토큰이 URL 에 남으므로 **POST 를 권장**합니다.

---

## 5. 보안 설계

- **비밀번호 저장**: 평문을 저장하지 않습니다. `PBKDF2-HMAC-SHA256:310000` (학생별 랜덤 솔트) 해시만 저장합니다.
  검증은 서버에서만 수행하고, `password_hash` / `password_salt` 는 어떤 응답에도 포함되지 않습니다.
  Apps Script 에 PBKDF2 라이브러리가 없어 `Crypto.gs` 에 RFC 8018 구현을 두었습니다(순수 JS, Node 의 `crypto.pbkdf2Sync` 와 같은 값).
- **비밀번호 정책**: **최소 4자리**만 검사합니다. 영문 대소문자·숫자·특수문자 조합을 강제하지 않습니다.
  초등학생이 `1234` 같은 비밀번호를 쓸 수 있게 하기 위한 결정입니다.
- **초기 비밀번호**: 관리자가 시트의 **CODA 관리** 메뉴에서 학생별로 직접 설정합니다.
  사이트에는 회원가입 기능이 없어 학생이 스스로 계정을 만들 수 없습니다.
- **세션 토큰**: 128자 랜덤 토큰을 발급하고 서버에는 SHA-256 **해시만** 저장합니다. 토큰 만료는 12시간입니다.
- **소유권**: 모든 학습 기록 API 는 토큰에서 `student_id` 를 서버가 결정합니다.
  요청 본문의 `student_id` 는 **무시**되므로 다른 학생의 기록을 읽거나 쓸 수 없습니다.
- **명단 노출 차단**: 전체 학생 목록을 반환하는 API 가 존재하지 않습니다.
  `getStudentProfile` 등도 항상 토큰 소유자 1명만 반환합니다.
- **로그인 제한**: 동일 아이디 5회 실패 시 15분 잠금.
- **계정 존재 여부 비노출**: 아이디 없음/비밀번호 오류 메시지가 동일합니다.
- **비활성 차단**: `status != active` 는 로그인과 세션 검증 모두에서 거부됩니다.
- **저장소에 비밀 없음**: 코드에 API 키·비밀번호·관리자 자격증명이 없습니다.

### 알아두어야 할 한계

- PBKDF2 310,000회는 **로그인 1회당 서버 CPU 를 몇 초 사용**합니다(런타임에 따라 다름).
  실행 한도(6분/실행)에는 여유가 있지만, 학생은 로그인 버튼에서 그 시간만큼 기다리게 됩니다.
  `보안 자체 점검` 으로 실측한 값이 5초를 넘으면 `Code.gs` 의 `PBKDF2_ITERATIONS` 를 낮추고
  (예: `100000`) 학생 비밀번호를 재설정하세요. 시트의 `password_algorithm` 값이 행마다 우선하므로
  학생별로 다른 반복 횟수도 함께 쓸 수 있습니다.
- 세션 토큰은 `github.io` 와 `script.google.com` 이 **서로 다른 도메인이라 HttpOnly 쿠키를 쓸 수 없습니다.**
  그래서 토큰은 브라우저 localStorage 에 보관되고(12시간 만료 · 서버에서 즉시 폐기 가능),
  XSS 방어는 사이트 코드 품질에 의존합니다.
- 웹 앱을 "모든 사용자"로 배포해야 브라우저에서 호출할 수 있습니다.
  그래서 서버는 **모든 요청을 토큰으로 검증**하고, 관리자 기능은 아예 웹에 노출하지 않습니다.
- 실행 계정 소유자의 권한으로 동작하므로 이 스크립트 프로젝트를 공유하지 마세요.

---

## 6. 배포 전 확인

- [ ] `Students` 시트에 테스트 학생 1명 추가 (예: `python,cpp`)
- [ ] 3자리 비밀번호는 거부되고 4자리는 통과하는가 (학생 추가·비밀번호 재설정 모두)
- [ ] `login` 호출이 `token` 을 반환하는가
- [ ] 틀린 비밀번호로 5회 실패 시 잠기는가
- [ ] `status` 를 `inactive` 로 바꾸면 로그인이 막히는가
- [ ] 다른 학생의 토큰으로 `getStudentProgress` 를 호출해도 본인 기록만 나오는가
- [ ] 응답 헤더에 비밀번호 해시/솔트가 없는가
- [ ] `보안 자체 점검` 실측 시간이 몇 초인가 (5초 초과면 `PBKDF2_ITERATIONS` 조정 후 재설정)
- [ ] 학생 추가 · 비밀번호 재설정 후 `password_algorithm` 에 `PBKDF2-HMAC-SHA256:310000` 이 기록되는가
- [ ] 로그아웃한 토큰으로 `validateSession` 을 호출하면 `valid:false` 인가