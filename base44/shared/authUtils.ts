// 비밀번호 해시/검증 유틸리티 (로컬 bcryptjs — Supabase 의존성 없음)
//
// bcryptjs(npm)를 사용하여 bcrypt 해시를 생성/검증합니다.
// 기존 Supabase crypt()에서 생성된 bcrypt 해시($2a$...)와 호환됩니다.
// PBKDF2 형식(pbkdf2:...)과 평문 비밀번호(레거시)도 검증 가능합니다.

import { hashSync, compareSync, genSaltSync } from "npm:bcryptjs@2.4.3";

// 비밀번호 해시 생성 — bcryptjs 로컬 해싱
export async function hashPassword(password: string): Promise<string> {
  const salt = genSaltSync(10);
  return hashSync(password, salt);
}

// 로컬 PBKDF2-SHA256 해시 생성 (레거시 호환용)
// 형식: pbkdf2:<iterations>:<salt_hex>:<hash_hex>
export async function hashPasswordLocal(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const iterations = 100000;
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

// 비밀번호 검증 — bcryptjs로 bcrypt 검증, PBKDF2/평문은 로컬 검증
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // bcrypt 해시인 경우 bcryptjs로 검증
  if (stored.startsWith("$2")) {
    try {
      return compareSync(password, stored);
    } catch {
      return false;
    }
  }
  // 구 PBKDF2 형식 (pbkdf2:iterations:salt_hex:hash_hex)
  if (stored.startsWith("pbkdf2:")) {
    try {
      return await verifyPbkdf2(password, stored);
    } catch {
      return false;
    }
  }
  // 평문 비밀번호 (레거시) — 직접 비교
  return password === stored;
}

// PBKDF2-SHA256 검증 (Web Crypto API 사용)
async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  if (isNaN(iterations) || iterations <= 0) return false;
  const saltHex = parts[2];
  const hashHex = parts[3];
  if (!saltHex || !hashHex) return false;

  const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };

  const salt = hexToBytes(saltHex);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const derivedHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return derivedHex === hashHex;
}