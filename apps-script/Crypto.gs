/**
 * ============================================================================
 *  CODA Learning — 비밀번호 검증용 암호 유틸 (순수 JS PBKDF2 / HMAC / SHA-256)
 * ============================================================================
 *  [왜 직접 구현하는가]
 *   Apps Script 에는 bcrypt / PBKDF2 / scrypt 가 없습니다.
 *   Utilities 가 제공하는 것은 "HMAC-SHA256 1회" 뿐입니다.
 *   PBKDF2 는 내부 반복 횟수만큼 HMAC 을 호출해야 하므로,
 *   Utilities 호출(Java 브리지)로 31만 회를 돌리면 로그인 한 번에 수 분이 걸립니다.
 *   그래서 SHA-256 / HMAC 을 순수 JS 로 구현해 한 실행 안에서 계산합니다.
 *   (Utilities 호출은 로그인당 1회 — 비밀번호 UTF-8 인코딩 — 만 사용)
 *
 *  [설치 주의]
 *   이 파일은 Code.gs 와 **같은 Apps Script 프로젝트**에 함께 있어야 합니다.
 *   Apps Script 는 프로젝트 안의 모든 .gs 파일이 전역 함수를 공유하므로
 *   파일을 나눠 두어도 서로 호출할 수 있습니다.
 *   (Crypto.gs 없이 Code.gs 만 붙여넣으면 로그인이 setup_incomplete 로 실패합니다)
 *
 *  [검증 방법]
 *   codaPbkdf2Hex_() 의 결과는 RFC 8018 PBKDF2-HMAC-SHA256 과 같은 값입니다.
 *   Node.js 기준 crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256') 과 동일합니다.
 * ============================================================================
 */

// ── SHA-256 라운드 상수 (FIPS 180-4) ────────────────────────────────────────
var CODA_SHA256_K_ = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

// 실행 중 재사용하는 스크래치 버퍼 (GC 부담 감소)
var _codaShaW_ = null;       // Int32Array(64) 메시지 스케줄
var _codaShaH_ = null;       // Int32Array(8)  중간 상태
var _codaShaBuf_ = null;     // Int32Array(16) 블록 버퍼
var _codaShaTail_ = null;    // 패딩용 바이트 배열
var _codaHmacInner_ = null;  // Array(32) HMAC 내부 해시

/* ── SHA-256 코어 ───────────────────────────────────────────────────────── */

function codaRotr_(x, n) { return (x >>> n) | (x << (32 - n)); }

function codaSha256Init_(h) {
  h[0] = 0x6a09e667; h[1] = 0xbb67ae85; h[2] = 0x3c6ef372; h[3] = 0xa54ff53a;
  h[4] = 0x510e527f; h[5] = 0x9b05688c; h[6] = 0x1f83d9ab; h[7] = 0x5be0cd19;
}

/** 16워드 블록 하나를 압축합니다. */
function codaSha256Compress_(h, m, off) {
  var W = _codaShaW_ || (_codaShaW_ = new Int32Array(64));
  var K = CODA_SHA256_K_;
  var i;
  for (i = 0; i < 16; i++) W[i] = m[off + i] | 0;
  for (i = 16; i < 64; i++) {
    var w15 = W[i - 15], w2 = W[i - 2];
    var s0 = codaRotr_(w15, 7) ^ codaRotr_(w15, 18) ^ (w15 >>> 3);
    var s1 = codaRotr_(w2, 17) ^ codaRotr_(w2, 19) ^ (w2 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }

  var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
  for (i = 0; i < 64; i++) {
    var S1 = codaRotr_(e, 6) ^ codaRotr_(e, 11) ^ codaRotr_(e, 25);
    var ch = (e & f) ^ (~e & g);
    var t1 = (hh + S1 + ch + K[i] + W[i]) | 0;
    var S0 = codaRotr_(a, 2) ^ codaRotr_(a, 13) ^ codaRotr_(a, 22);
    var maj = (a & b) ^ (a & c) ^ (b & c);
    var t2 = (S0 + maj) | 0;
    hh = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
}

function codaSha256DigestBytes_(h, out) {
  for (var i = 0; i < 8; i++) {
    out[i * 4]     = (h[i] >>> 24) & 255;
    out[i * 4 + 1] = (h[i] >>> 16) & 255;
    out[i * 4 + 2] = (h[i] >>> 8) & 255;
    out[i * 4 + 3] = h[i] & 255;
  }
  return out;
}

/**
 * 64바이트 prefix 블록 + 32바이트 메시지 → SHA-256 (32바이트).
 * HMAC 반복 루프에서 가장 자주 쓰이는 경로라 배열 할당 없이 계산합니다.
 */
function codaSha256Prefix32_(prefixWords, msg32, out32) {
  var h = _codaShaH_ || (_codaShaH_ = new Int32Array(8));
  var blk = _codaShaBuf_ || (_codaShaBuf_ = new Int32Array(16));
  codaSha256Init_(h);
  codaSha256Compress_(h, prefixWords, 0);

  for (var i = 0; i < 8; i++) {
    var o = i * 4;
    blk[i] = (msg32[o] << 24) | (msg32[o + 1] << 16) | (msg32[o + 2] << 8) | msg32[o + 3];
  }
  blk[8] = 0x80000000;
  for (var z = 9; z < 15; z++) blk[z] = 0;
  blk[15] = 96 * 8;                      // (64 + 32) 바이트 = 768 비트

  codaSha256Compress_(h, blk, 0);
  return codaSha256DigestBytes_(h, out32);
}

/**
 * prefix 블록(없으면 null) + 임의 길이 메시지 → SHA-256 (32바이트).
 */
function codaSha256PrefixMsg_(prefixWords, msgBytes, out32) {
  var h = _codaShaH_ || (_codaShaH_ = new Int32Array(8));
  var blk = _codaShaBuf_ || (_codaShaBuf_ = new Int32Array(16));
  codaSha256Init_(h);

  var prefixLen = prefixWords ? 64 : 0;
  if (prefixWords) codaSha256Compress_(h, prefixWords, 0);

  var len = msgBytes.length, i = 0;
  while (i + 64 <= len) {
    for (var j = 0; j < 16; j++) {
      blk[j] = (msgBytes[i] << 24) | (msgBytes[i + 1] << 16) | (msgBytes[i + 2] << 8) | msgBytes[i + 3];
      i += 4;
    }
    codaSha256Compress_(h, blk, 0);
  }

  var rem = len - i;
  var total = prefixLen + len;
  var tail = _codaShaTail_ || (_codaShaTail_ = []);
  tail.length = 0;
  for (var r = 0; r < rem; r++) tail.push(msgBytes[i + r]);
  tail.push(0x80);
  while ((tail.length % 64) !== 56) tail.push(0);
  var bitsHi = Math.floor(total / 536870912);   // total*8 상위 32비트
  var bitsLo = (total * 8) >>> 0;               // total*8 하위 32비트
  tail.push(
    (bitsHi >>> 24) & 255, (bitsHi >>> 16) & 255, (bitsHi >>> 8) & 255, bitsHi & 255,
    (bitsLo >>> 24) & 255, (bitsLo >>> 16) & 255, (bitsLo >>> 8) & 255, bitsLo & 255
  );

  for (var t = 0; t < tail.length; t += 64) {
    for (var w = 0; w < 16; w++) {
      blk[w] = (tail[t + w * 4] << 24) | (tail[t + w * 4 + 1] << 16) |
               (tail[t + w * 4 + 2] << 8) | tail[t + w * 4 + 3];
    }
    codaSha256Compress_(h, blk, 0);
  }
  return codaSha256DigestBytes_(h, out32);
}

/* ── HMAC-SHA256 ─────────────────────────────────────────────────────────── */

/** 키의 ipad / opad 블록을 미리 계산합니다 (반복 루프에서 재사용). */
function codaHmacPads_(keyBytes) {
  var key = keyBytes;
  if (key.length > 64) {
    var reduced = new Array(32);
    codaSha256PrefixMsg_(null, key, reduced);
    key = reduced;
  }
  var ip = new Int32Array(16), op = new Int32Array(16);
  for (var i = 0; i < 16; i++) {
    var b0 = (i * 4     < key.length ? key[i * 4]     : 0) & 255;
    var b1 = (i * 4 + 1 < key.length ? key[i * 4 + 1] : 0) & 255;
    var b2 = (i * 4 + 2 < key.length ? key[i * 4 + 2] : 0) & 255;
    var b3 = (i * 4 + 3 < key.length ? key[i * 4 + 3] : 0) & 255;
    ip[i] = ((b0 ^ 0x36) << 24) | ((b1 ^ 0x36) << 16) | ((b2 ^ 0x36) << 8) | (b3 ^ 0x36);
    op[i] = ((b0 ^ 0x5c) << 24) | ((b1 ^ 0x5c) << 16) | ((b2 ^ 0x5c) << 8) | (b3 ^ 0x5c);
  }
  return { ip: ip, op: op };
}

/** HMAC-SHA256(pads, 32바이트 메시지) → out32 */
function codaHmac32_(pads, msg32, out32) {
  var inner = _codaHmacInner_ || (_codaHmacInner_ = new Array(32));
  codaSha256Prefix32_(pads.ip, msg32, inner);
  return codaSha256Prefix32_(pads.op, inner, out32);
}

/** HMAC-SHA256(pads, 임의 길이 메시지) → out32 */
function codaHmacBytes_(pads, msgBytes, out32) {
  var inner = _codaHmacInner_ || (_codaHmacInner_ = new Array(32));
  codaSha256PrefixMsg_(pads.ip, msgBytes, inner);
  return codaSha256Prefix32_(pads.op, inner, out32);
}

/* ── 바이트 변환 ─────────────────────────────────────────────────────────── */

function codaCryptoBytesToHex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 255;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}

/** 16진 문자열 → 바이트 배열. 형식이 아니면 빈 배열. */
function codaCryptoHexToBytes_(hex) {
  var s = String(hex || '').trim();
  if (!s || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return [];
  var out = [];
  for (var i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
  return out;
}

/** 비밀번호를 UTF-8 바이트로 변환합니다. */
function codaUtf8Bytes_(text) {
  return Utilities.newBlob(String(text)).getBytes();
}

/* ── PBKDF2-HMAC-SHA256 ──────────────────────────────────────────────────── */

/**
 * RFC 8018 PBKDF2-HMAC-SHA256 → 16진 문자열.
 * @param {string} password 평문 비밀번호 (UTF-8 로 인코딩)
 * @param {Array}  saltBytes 솔트 바이트 배열
 * @param {number} iterations 반복 횟수 (예: 310000)
 * @param {number} dkLen 출력 길이(바이트, 기본 32)
 */
function codaPbkdf2Hex_(password, saltBytes, iterations, dkLen) {
  var keyLen = dkLen || 32;
  var hLen = 32;
  var pads = codaHmacPads_(codaUtf8Bytes_(password));
  var blockCount = Math.ceil(keyLen / hLen);
  var iters = Number(iterations);
  if (!(iters >= 1)) iters = 1;

  var u = new Array(hLen), acc = new Array(hLen);
  var out = [];
  var saltLen = saltBytes.length;
  var first = new Array(saltLen + 4);
  for (var s = 0; s < saltLen; s++) first[s] = saltBytes[s] & 255;
  for (var b = 1; b <= blockCount; b++) {
    first[saltLen] = (b >>> 24) & 255;
    first[saltLen + 1] = (b >>> 16) & 255;
    first[saltLen + 2] = (b >>> 8) & 255;
    first[saltLen + 3] = b & 255;
    codaHmacBytes_(pads, first, u);
    for (var i = 0; i < hLen; i++) acc[i] = u[i];
    for (var c = 1; c < iters; c++) {
      codaHmac32_(pads, u, u);              // U_c = HMAC(P, U_{c-1})
      for (var k = 0; k < hLen; k++) acc[k] ^= u[k];
    }
    for (var x = 0; x < hLen; x++) out.push(acc[x]);
  }
  return codaCryptoBytesToHex_(out.slice(0, keyLen));
}