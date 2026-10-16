/**
 * ============================================================================
 *  CODA Learning — Google Apps Script 백엔드 (Google Sheets 기반)
 * ============================================================================
 *  운영 서비스: GitHub Pages(정적 사이트) + Google Sheets + Google Apps Script
 *  Base44 / Supabase / Firebase / 별도 서버 호스팅을 사용하지 않습니다.
 *
 *  [설치]
 *   1) Google Sheets 새 문서 생성
 *   2) 확장 프로그램 > Apps Script 열기
 *   3) 이 파일 전체를 Code.gs 에 붙여넣기 (파일명은 Code.gs)
 *   4) setupSpreadsheet() 를 한 번 실행 → 시트/헤더 자동 생성 + onOpen 트리거 등록
 *      (최초 실행 시 권한 승인 필요)
 *   5) 시트를 새로고침하면 상단에 "CODA 관리" 메뉴가 생깁니다.
 *   6) 배포 > 새 배포 > 유형: 웹 앱
 *        - 실행 계정: 나
 *        - 액세스 권한: 모든 사용자
 *      → 생성된 /exec URL 을 사이트의 VITE_SHEETS_API_URL 에 넣습니다.
 *
 *  [보안 원칙]
 *   - 비밀번호는 평문으로 저장하지 않습니다 (학생별 랜덤 솔트 + 반복 HMAC-SHA256).
 *   - 비밀번호 정책은 "최소 4자리" 만 검사합니다. 문자 종류 조합(대소문자/숫자/
 *     특수문자)을 강제하지 않아 초등학생도 쉽게 로그인할 수 있습니다.
 *     초기 비밀번호는 관리자가 시트의 "CODA 관리" 메뉴에서 학생별로 설정합니다.
 *   - 세션 토큰 원문은 서버에 저장하지 않습니다 (SHA-256 해시만 저장).
 *   - student_id 는 항상 "토큰 → 서버 조회"로 결정합니다.
 *     클라이언트가 보낸 student_id 는 신뢰하지 않습니다.
 *   - 학생 명단 전체를 반환하는 API 는 존재하지 않습니다.
 *   - 관리자 기능(학생 추가, 비밀번호 재설정)은 웹 앱에 노출하지 않고
 *     시트의 "CODA 관리" 메뉴에서만 실행됩니다.
 *   - 이 파일에는 어떤 비밀키도 하드코딩하지 않습니다.
 * ============================================================================
 */

// ── 시트 이름 ────────────────────────────────────────────────────────────────
var SHEET_STUDENTS = 'Students';
var SHEET_PROGRESS = 'StudentProgress';
var SHEET_QUIZ = 'QuizResults';
var SHEET_MISSION = 'MissionSubmissions';
var SHEET_SESSIONS = '_Sessions';
var SHEET_ATTEMPTS = '_LoginAttempts';

// ── 정책 값 ──────────────────────────────────────────────────────────────────
var ALLOWED_SUBJECTS = ['python', 'junior_python', 'cpp'];
var SESSION_TTL_SECONDS = 12 * 60 * 60; // 세션 12시간
var HASH_ITERATIONS = 2000;             // 비밀번호 해시 반복 횟수
var MIN_PASSWORD_LENGTH = 4;            // 비밀번호 최소 길이 (복잡도 조건 없음)
var MAX_LOGIN_ATTEMPTS = 5;             // 로그인 실패 허용 횟수
var LOCKOUT_SECONDS = 15 * 60;          // 초과 시 잠금 시간
var MAX_STRING_FIELD = 200000;          // 제출 코드 등 저장 최대 길이

// ── 헤더 정의 (setupSpreadsheet 가 이 순서로 생성) ───────────────────────────
var HEADERS = {
  Students: ['student_id', 'name', 'login_id', 'password_hash', 'password_salt',
             'school', 'grade', 'subjects', 'status'],
  StudentProgress: ['student_id', 'subject', 'unit_id', 'completed', 'last_accessed', 'data'],
  QuizResults: ['student_id', 'subject', 'unit_id', 'score', 'submitted_at', 'item_number', 'answer', 'data'],
  MissionSubmissions: ['student_id', 'subject', 'unit_id', 'submission', 'submitted_at', 'mission_number', 'is_correct', 'data'],
  _Sessions: ['token_hash', 'student_id', 'created_at', 'expires_at'],
  _LoginAttempts: ['login_id', 'fail_count', 'first_fail_at', 'locked_until']
};

/* ==========================================================================
 *  웹 앱 진입점
 * ========================================================================== */

function doGet(e) {
  return handleRequest_(e, 'get');
}

function doPost(e) {
  return handleRequest_(e, 'post');
}

/**
 * GET/POST 공통 라우터.
 *  - 권장: POST + Content-Type: text/plain (CORS preflight 회피)
 *  - 호환: GET + ?action=...&payload=<JSON 문자열>
 * 요청 본문 예: { "action": "login", "login_id": "...", "password": "..." }
 */
function handleRequest_(e, method) {
  try {
    var payload = readPayload_(e, method);
    var action = String(payload.action || '').trim();
    if (!action) return fail_('missing_action', 'action 값이 필요합니다.');

    var route = {
      login: handleLogin_,
      validateSession: handleValidateSession_,
      logout: handleLogout_,
      getStudentProfile: handleGetStudentProfile_,
      getStudentSubjects: handleGetStudentSubjects_,
      getStudentProgress: handleGetStudentProgress_,
      saveStudentProgress: handleSaveStudentProgress_,
      saveQuizResult: handleSaveQuizResult_,
      saveMissionSubmission: handleSaveMissionSubmission_
    };
    var handler = route[action];
    if (!handler) return fail_('unknown_action', '지원하지 않는 action 입니다: ' + action);

    return handler(payload);
  } catch (err) {
    // 내부 오류 상세는 노출하지 않습니다.
    console.error('[CODA] ' + (err && err.stack ? err.stack : err));
    return fail_('server_error', '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

function readPayload_(e, method) {
  if (method === 'post') {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (err) { return {}; }
  }
  // GET 폴백: ?payload={"action":"..."}
  var p = (e && e.parameter && e.parameter.payload) || '';
  if (p) { try { return JSON.parse(p); } catch (err) { return {}; } }
  var q = (e && e.parameter) || {};
  return q.action ? q : {};
}

function ok_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==========================================================================
 *  인증: 로그인 / 세션
 * ========================================================================== */

function handleLogin_(p) {
  var loginId = String(p.login_id || '').trim();
  var password = String(p.password || '');
  if (!loginId || !password) return fail_('invalid_input', '아이디와 비밀번호를 입력해 주세요.');

  var lock = checkLock_(loginId);
  if (lock.locked) {
    return fail_('locked', '로그인 시도가 너무 많습니다. ' + Math.ceil(lock.remaining / 60) + '분 후 다시 시도해 주세요.');
  }

  var students = readRows_(SHEET_STUDENTS);
  var student = null;
  for (var i = 0; i < students.length; i++) {
    if (String(students[i].login_id || '').trim().toLowerCase() === loginId.toLowerCase()) {
      student = students[i];
      break;
    }
  }

  // 아이디가 없든 비밀번호가 틀리든 동일한 메시지를 반환합니다 (계정 존재 여부 노출 방지).
  var genericFail = function () {
    recordFailure_(loginId);
    return fail_('auth_failed', '아이디 또는 비밀번호가 올바르지 않습니다.');
  };

  if (!student) return genericFail();
  if (String(student.status || '').toLowerCase() !== 'active') {
    return fail_('inactive', '비활성화된 계정입니다. 관리자에게 문의해 주세요.');
  }
  if (!verifyPassword_(password, student.password_hash, student.password_salt)) {
    return genericFail();
  }

  clearFailures_(loginId);
  var session = createSession_(String(student.student_id));
  return ok_({
    token: session.token,
    expires_at: session.expires_at,
    student: publicStudent_(student)
  });
}

function handleValidateSession_(p) {
  var session = getSession_(p.token);
  if (!session) return ok_({ valid: false, student: null });
  var student = findStudentById_(session.student_id);
  if (!student || String(student.status || '').toLowerCase() !== 'active') {
    return ok_({ valid: false, student: null });
  }
  return ok_({ valid: true, student: publicStudent_(student) });
}

function handleLogout_(p) {
  if (p.token) deleteSession_(p.token);
  return ok_({ logged_out: true });
}

function handleGetStudentProfile_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  return ok_(publicStudent_(ctx.student));
}

function handleGetStudentSubjects_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  return ok_({ student_id: ctx.student.student_id, subjects: subjectList_(ctx.student) });
}

/* ==========================================================================
 *  학습 기록
 * ========================================================================== */

function handleGetStudentProgress_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  var sid = ctx.student.student_id;

  var mine = function (row) { return String(row.student_id) === String(sid); };
  var progress = readRows_(SHEET_PROGRESS).filter(mine);
  var quizzes = readRows_(SHEET_QUIZ).filter(mine);
  var missions = readRows_(SHEET_MISSION).filter(mine);

  if (p.subject) {
    var s = String(p.subject);
    progress = progress.filter(function (r) { return r.subject === s; });
    quizzes = quizzes.filter(function (r) { return r.subject === s; });
    missions = missions.filter(function (r) { return r.subject === s; });
  }

  return ok_({
    progress: progress.map(function (r) { return withParsedData_(r); }),
    quiz_results: quizzes.map(function (r) { return withParsedData_(r); }),
    mission_submissions: missions.map(function (r) { return withParsedData_(r); })
  });
}

function handleSaveStudentProgress_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  var subject = validSubject_(p.subject);
  if (!subject) return fail_('invalid_subject', '허용되지 않은 과목입니다.');

  var unitId = String(p.unit_id || '').trim();
  if (!unitId) return fail_('invalid_input', 'unit_id 가 필요합니다.');

  var row = {
    student_id: ctx.student.student_id,     // 서버가 결정 — 클라이언트 값 무시
    subject: subject,
    unit_id: unitId,
    completed: p.completed === true,
    last_accessed: new Date().toISOString(),
    data: JSON.stringify(p.data || {})
  };
  upsertRow_(SHEET_PROGRESS, ['student_id', 'subject', 'unit_id'], row);
  return ok_({ saved: true });
}

function handleSaveQuizResult_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  var subject = validSubject_(p.subject);
  if (!subject) return fail_('invalid_subject', '허용되지 않은 과목입니다.');

  var unitId = String(p.unit_id || '').trim();
  if (!unitId) return fail_('invalid_input', 'unit_id 가 필요합니다.');

  var row = {
    student_id: ctx.student.student_id,
    subject: subject,
    unit_id: unitId,
    score: Number(p.score || 0),
    submitted_at: new Date().toISOString(),
    item_number: p.item_number === undefined || p.item_number === null ? '' : p.item_number,
    answer: truncate_(p.answer),
    data: JSON.stringify(p.data || {})
  };
  // 문항 단위 저장: 같은 unit + 문항 번호면 갱신
  upsertRow_(SHEET_QUIZ, ['student_id', 'subject', 'unit_id', 'item_number'], row);
  return ok_({ saved: true });
}

function handleSaveMissionSubmission_(p) {
  var ctx = requireSession_(p);
  if (ctx.error) return ctx.error;
  var subject = validSubject_(p.subject);
  if (!subject) return fail_('invalid_subject', '허용되지 않은 과목입니다.');

  var unitId = String(p.unit_id || '').trim();
  if (!unitId) return fail_('invalid_input', 'unit_id 가 필요합니다.');

  var row = {
    student_id: ctx.student.student_id,
    subject: subject,
    unit_id: unitId,
    submission: truncate_(p.submission),
    submitted_at: new Date().toISOString(),
    mission_number: p.mission_number === undefined || p.mission_number === null ? '' : p.mission_number,
    is_correct: p.is_correct === true,
    data: JSON.stringify(p.data || {})
  };
  upsertRow_(SHEET_MISSION, ['student_id', 'subject', 'unit_id', 'mission_number'], row);
  return ok_({ saved: true });
}

/* ==========================================================================
 *  세션 토큰
 * ========================================================================== */

function createSession_(studentId) {
  purgeExpiredSessions_();
  var token = makeToken_();
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  appendRow_(SHEET_SESSIONS, {
    token_hash: hashToken_(token),   // 원문 토큰은 저장하지 않습니다
    student_id: studentId,
    created_at: now.toISOString(),
    expires_at: expires.toISOString()
  });
  return { token: token, expires_at: expires.toISOString() };
}

function getSession_(token) {
  if (!token) return null;
  var hash = hashToken_(String(token));
  var rows = readRows_(SHEET_SESSIONS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].token_hash) === hash) {
      var exp = new Date(rows[i].expires_at);
      if (!exp || exp.getTime() < Date.now()) return null;
      return rows[i];
    }
  }
  return null;
}

function deleteSession_(token) {
  var hash = hashToken_(String(token));
  var sheet = getSheet_(SHEET_SESSIONS);
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === hash) sheet.deleteRow(i + 1);
  }
}

function purgeExpiredSessions_() {
  var sheet = getSheet_(SHEET_SESSIONS);
  var values = sheet.getDataRange().getValues();
  var now = Date.now();
  for (var i = values.length - 1; i >= 1; i--) {
    var exp = new Date(values[i][3]);
    if (!exp || exp.getTime() < now) sheet.deleteRow(i + 1);
  }
}

/** 토큰 검증 후 { student, error } 형태로 반환합니다. */
function requireSession_(p) {
  var session = getSession_(p && p.token);
  if (!session) {
    return { error: fail_('invalid_session', '세션이 만료되었습니다. 다시 로그인해 주세요.') };
  }
  var student = findStudentById_(session.student_id);
  if (!student || String(student.status || '').toLowerCase() !== 'active') {
    return { error: fail_('inactive', '사용할 수 없는 계정입니다.') };
  }
  return { student: student };
}

/* ==========================================================================
 *  로그인 시도 제한
 * ========================================================================== */

function checkLock_(loginId) {
  var rows = readRows_(SHEET_ATTEMPTS);
  var key = loginId.toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].login_id).toLowerCase() !== key) continue;
    var until = new Date(rows[i].locked_until);
    if (until && until.getTime() > Date.now()) {
      return { locked: true, remaining: Math.ceil((until.getTime() - Date.now()) / 1000) };
    }
  }
  return { locked: false, remaining: 0 };
}

function recordFailure_(loginId) {
  var sheet = getSheet_(SHEET_ATTEMPTS);
  var values = sheet.getDataRange().getValues();
  var key = loginId.toLowerCase();
  var now = Date.now();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() !== key) continue;
    var firstFail = new Date(values[i][2]);
    var windowExpired = !firstFail || (now - firstFail.getTime()) > LOCKOUT_SECONDS * 1000;
    var count = windowExpired ? 1 : Number(values[i][1] || 0) + 1;
    var lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? new Date(now + LOCKOUT_SECONDS * 1000) : '';
    sheet.getRange(i + 1, 1, 1, 4).setValues([[
      loginId, count, windowExpired ? new Date().toISOString() : values[i][2], lockedUntil
    ]]);
    return;
  }
  appendRow_(SHEET_ATTEMPTS, {
    login_id: loginId, fail_count: 1, first_fail_at: new Date().toISOString(), locked_until: ''
  });
}

function clearFailures_(loginId) {
  var sheet = getSheet_(SHEET_ATTEMPTS);
  var values = sheet.getDataRange().getValues();
  var key = loginId.toLowerCase();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]).toLowerCase() === key) sheet.deleteRow(i + 1);
  }
}

/* ==========================================================================
 *  비밀번호 정책 · 해시
 *  (Apps Script 에는 bcrypt/PBKDF2 라이브러리가 없어
 *   salt + 반복 HMAC-SHA256 으로 구현합니다. 강도 한계는 README 참고)
 * ========================================================================== */

/**
 * 비밀번호 정책 검사 — "최소 길이" 만 봅니다.
 * 초등학생이 4자리 숫자만으로도 쓸 수 있게 하기 위해
 * 문자 종류(영문 대소문자/숫자/특수문자) 조합은 요구하지 않습니다.
 * @returns {string|null} 문제가 있으면 안내 문구, 정상이면 null
 */
function checkPasswordPolicy_(password) {
  var pw = String(password || '');
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return '비밀번호는 ' + MIN_PASSWORD_LENGTH + '자 이상이어야 합니다.';
  }
  return null;
}

function makeSalt_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function hashPassword_(password, salt) {
  var bytes = Utilities.newBlob(String(password) + ':' + String(salt)).getBytes();
  var key = Utilities.computeHmacSha256Signature(bytes, String(salt));
  for (var i = 1; i < HASH_ITERATIONS; i++) {
    key = Utilities.computeHmacSha256Signature(key, bytes);
  }
  return bytesToHex_(key);
}

function verifyPassword_(password, storedHash, salt) {
  if (!storedHash || !salt) return false;
  var computed = hashPassword_(password, salt);
  return timingSafeEqual_(computed, String(storedHash));
}

function bytesToHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

/** 길이 노출을 줄이기 위한 상수 시간 비교 */
function timingSafeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function makeToken_() {
  return (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function hashToken_(token) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token)));
}

/* ==========================================================================
 *  시트 읽기/쓰기 헬퍼
 * ========================================================================== */

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = HEADERS[name] || ['student_id'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRows_(name) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row || row.join('') === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[String(headers[c])] = row[c];
    out.push(obj);
  }
  return out;
}

function appendRow_(name, obj) {
  var sheet = getSheet_(name);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    var v = obj[String(h)];
    return v === undefined || v === null ? '' : v;
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { sheet.appendRow(row); } finally { lock.releaseLock(); }
}

/**
 * keyFields 로 기존 행을 찾아 갱신하고, 없으면 추가합니다.
 * (학습 기록 중복 저장 방지)
 */
function upsertRow_(name, keyFields, obj) {
  var sheet = getSheet_(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idx = {};
  for (var c = 0; c < headers.length; c++) idx[String(headers[c])] = c;

  var sameKey = function (row) {
    for (var k = 0; k < keyFields.length; k++) {
      var f = keyFields[k];
      if (String(row[idx[f]]) !== String(obj[f])) return false;
    }
    return true;
  };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    for (var r = 1; r < values.length; r++) {
      if (values[r].join('') === '') continue;
      if (sameKey(values[r])) {
        var newRow = values[r].slice();
        for (var h = 0; h < headers.length; h++) {
          var key = String(headers[h]);
          if (obj[key] !== undefined && obj[key] !== null) newRow[h] = obj[key];
        }
        sheet.getRange(r + 1, 1, 1, headers.length).setValues([newRow]);
        return;
      }
    }
    var fresh = headers.map(function (h) {
      var v = obj[String(h)];
      return v === undefined || v === null ? '' : v;
    });
    sheet.appendRow(fresh);
  } finally {
    lock.releaseLock();
  }
}

/* ==========================================================================
 *  값 정규화 / 공개 데이터
 * ========================================================================== */

/** student_id 를 반드시 서버(시트) 기준으로 찾습니다. */
function findStudentById_(studentId) {
  var rows = readRows_(SHEET_STUDENTS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].student_id) === String(studentId)) return rows[i];
  }
  return null;
}

/** 클라이언트로 내보내도 안전한 필드만 반환합니다 (해시/솔트 제외). */
function publicStudent_(student) {
  return {
    student_id: String(student.student_id || ''),
    name: String(student.name || ''),
    login_id: String(student.login_id || ''),
    school: String(student.school || ''),
    grade: String(student.grade || ''),
    subjects: subjectList_(student),
    status: String(student.status || '')
  };
}

/** subjects 열("python,cpp")을 허용 목록으로 필터링합니다. */
function subjectList_(student) {
  var raw = String(student.subjects || '').split(',');
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var s = raw[i].trim().toLowerCase();
    if (s && ALLOWED_SUBJECTS.indexOf(s) !== -1 && out.indexOf(s) === -1) out.push(s);
  }
  return out;
}

function validSubject_(value) {
  var s = String(value || '').trim().toLowerCase();
  return ALLOWED_SUBJECTS.indexOf(s) === -1 ? null : s;
}

function withParsedData_(row) {
  var copy = {};
  for (var k in row) { if (Object.prototype.hasOwnProperty.call(row, k)) copy[k] = row[k]; }
  try { copy.data = row.data ? JSON.parse(row.data) : {}; } catch (err) { copy.data = {}; }
  return copy;
}

function truncate_(value) {
  var s = value === undefined || value === null ? '' : String(value);
  return s.length > MAX_STRING_FIELD ? s.slice(0, MAX_STRING_FIELD) : s;
}

/* ==========================================================================
 *  관리자 기능 — 시트 메뉴에서만 실행 (웹 앱에 노출하지 않음)
 * ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CODA 관리')
    .addItem('① 최초 설정 (시트 생성)', 'setupSpreadsheet')
    .addSeparator()
    .addItem('학생 추가', 'adminAddStudent')
    .addItem('학생 수정(이름/학교/학년)', 'adminEditStudent')
    .addItem('비밀번호 재설정', 'adminResetPassword')
    .addItem('수강 과목 변경', 'adminSetSubjects')
    .addItem('계정 활성/비활성', 'adminToggleStatus')
    .addSeparator()
    .addItem('만료 세션 정리', 'adminPurgeSessions')
    .addToUi();
}

function setupSpreadsheet() {
  Object.keys(HEADERS).forEach(function (name) { getSheet_(name); });
  // 내부 시트는 숨김 처리
  [SHEET_SESSIONS, SHEET_ATTEMPTS].forEach(function (name) {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (s) s.hideSheet();
  });
  // onOpen 트리거 등록 (중복 방지)
  var already = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onOpen'; });
  if (!already) ScriptApp.newTrigger('onOpen').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
  SpreadsheetApp.getUi().alert('설정 완료: Students / StudentProgress / QuizResults / MissionSubmissions 시트가 준비되었습니다.');
}

function adminAddStudent() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('학생 추가',
    '이름,로그인아이디,비밀번호,학교,학년,과목(python,cpp)\n형식으로 입력하세요. 학교/학년은 비워도 됩니다.\n비밀번호는 ' + MIN_PASSWORD_LENGTH + '자 이상이면 되고, 숫자만 써도 됩니다.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var parts = res.getResponseText().split(',');
  if (parts.length < 3) return ui.alert('형식 오류: 최소 이름,아이디,비밀번호 가 필요합니다.');

  var name = parts[0].trim();
  var loginId = parts[1].trim();
  var password = parts[2].trim();
  var school = (parts[3] || '').trim();
  var grade = (parts[4] || '').trim();
  var subjects = normalizeSubjectInput_(parts[5] || '');

  if (!name || !loginId || !password) return ui.alert('이름, 아이디, 비밀번호는 필수입니다.');
  var policyError = checkPasswordPolicy_(password);
  if (policyError) return ui.alert(policyError);
  if (findByLoginId_(loginId)) return ui.alert('이미 사용 중인 아이디입니다: ' + loginId);
  if (!subjects) return ui.alert('과목은 python, junior_python, cpp 중 하나 이상이어야 합니다.');

  var salt = makeSalt_();
  appendRow_(SHEET_STUDENTS, {
    student_id: Utilities.getUuid(),
    name: name,
    login_id: loginId,
    password_hash: hashPassword_(password, salt),
    password_salt: salt,
    school: school,
    grade: grade,
    subjects: subjects,
    status: 'active'
  });
  ui.alert('추가 완료: ' + name + ' (' + loginId + ')');
}

function adminEditStudent() {
  var ui = SpreadsheetApp.getUi();
  var id = ui.prompt('학생 수정', '수정할 student_id 를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton() !== ui.Button.OK) return;
  var row = findRowIndexByStudentId_(id.getResponseText().trim());
  if (row < 0) return ui.alert('해당 student_id 를 찾을 수 없습니다.');
  var info = ui.prompt('학생 수정', '이름,학교,학년 형식으로 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (info.getSelectedButton() !== ui.Button.OK) return;
  var parts = info.getResponseText().split(',');
  updateStudentField_(row, 'name', (parts[0] || '').trim());
  updateStudentField_(row, 'school', (parts[1] || '').trim());
  updateStudentField_(row, 'grade', (parts[2] || '').trim());
  ui.alert('수정 완료');
}

function adminResetPassword() {
  var ui = SpreadsheetApp.getUi();
  var id = ui.prompt('비밀번호 재설정', 'student_id 를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton() !== ui.Button.OK) return;
  var row = findRowIndexByStudentId_(id.getResponseText().trim());
  if (row < 0) return ui.alert('해당 student_id 를 찾을 수 없습니다.');

  var pw = ui.prompt('비밀번호 재설정',
    '새 비밀번호를 입력하세요. (' + MIN_PASSWORD_LENGTH + '자 이상, 숫자만 써도 됩니다)',
    ui.ButtonSet.OK_CANCEL);
  if (pw.getSelectedButton() !== ui.Button.OK) return;
  var newPassword = pw.getResponseText().trim();
  var policyError = checkPasswordPolicy_(newPassword);
  if (policyError) return ui.alert(policyError);

  var salt = makeSalt_();
  updateStudentField_(row, 'password_salt', salt);
  updateStudentField_(row, 'password_hash', hashPassword_(newPassword, salt));
  ui.alert('비밀번호가 재설정되었습니다.');
}

function adminSetSubjects() {
  var ui = SpreadsheetApp.getUi();
  var id = ui.prompt('수강 과목 변경', 'student_id 를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton() !== ui.Button.OK) return;
  var row = findRowIndexByStudentId_(id.getResponseText().trim());
  if (row < 0) return ui.alert('해당 student_id 를 찾을 수 없습니다.');

  var sub = ui.prompt('수강 과목 변경', '과목을 입력하세요 (예: python,cpp / junior_python)', ui.ButtonSet.OK_CANCEL);
  if (sub.getSelectedButton() !== ui.Button.OK) return;
  var subjects = normalizeSubjectInput_(sub.getResponseText());
  if (!subjects) return ui.alert('과목은 python, junior_python, cpp 중 하나 이상이어야 합니다.');
  updateStudentField_(row, 'subjects', subjects);
  ui.alert('수강 과목이 변경되었습니다: ' + subjects);
}

function adminToggleStatus() {
  var ui = SpreadsheetApp.getUi();
  var id = ui.prompt('계정 활성/비활성', 'student_id 를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (id.getSelectedButton() !== ui.Button.OK) return;
  var row = findRowIndexByStudentId_(id.getResponseText().trim());
  if (row < 0) return ui.alert('해당 student_id 를 찾을 수 없습니다.');
  var sheet = getSheet_(SHEET_STUDENTS);
  var col = HEADERS.Students.indexOf('status') + 1;
  var current = String(sheet.getRange(row, col).getValue() || 'active');
  var next = current === 'active' ? 'inactive' : 'active';
  sheet.getRange(row, col).setValue(next);
  ui.alert('상태 변경: ' + current + ' → ' + next);
}

function adminPurgeSessions() {
  purgeExpiredSessions_();
  SpreadsheetApp.getUi().alert('만료된 세션을 정리했습니다.');
}

/** 같은 로그인 아이디가 이미 있는지 확인 */
function findByLoginId_(loginId) {
  var rows = readRows_(SHEET_STUDENTS);
  var key = String(loginId).toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].login_id || '').toLowerCase() === key) return rows[i];
  }
  return null;
}

function findRowIndexByStudentId_(studentId) {
  var sheet = getSheet_(SHEET_STUDENTS);
  var values = sheet.getDataRange().getValues();
  var col = values[0].indexOf('student_id');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col]) === String(studentId)) return r + 1;
  }
  return -1;
}

function updateStudentField_(rowIndex, field, value) {
  var col = HEADERS.Students.indexOf(field) + 1;
  if (col < 1) return;
  getSheet_(SHEET_STUDENTS).getRange(rowIndex, col).setValue(value);
}

function normalizeSubjectInput_(raw) {
  var parts = String(raw || '').split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i].trim().toLowerCase();
    if (s && ALLOWED_SUBJECTS.indexOf(s) !== -1 && out.indexOf(s) === -1) out.push(s);
  }
  return out.join(',');
}