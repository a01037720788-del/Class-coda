/**
 * 공통 에러 메시지 추출 helper
 * 서버 오류, API 응답, 일반 Error 등 다양한 형태의 에러에서
 * 사용자에게 표시할 일관된 메시지를 추출합니다.
 *
 * 사용법:
 *   import { getErrorMessage } from '@/lib/errorUtils';
 *   catch (err) {
 *     toast({ title: "오류", description: getErrorMessage(err), variant: "destructive" });
 *   }
 */

export function getErrorMessage(error, fallback = '알 수 없는 오류가 발생했습니다.') {
  if (!error) return fallback;

  // 1. string 자체인 경우
  if (typeof error === 'string') return error;

  // 2. response.data (axios/fetch wrapper)
  if (error.response?.data) {
    const d = error.response.data;
    if (typeof d === 'string') return d;
    if (d.message) return d.message;
    if (d.error) return d.error;
    if (d.detail) return d.detail;
  }

  // 3. Base44 function 응답 (res.data.error)
  if (error.data?.error) return error.data.error;
  if (error.data?.message) return error.data.message;

  // 4. Supabase REST 에러
  if (error.message?.includes('JWT')) return '인증이 만료되었습니다. 다시 로그인해주세요.';
  if (error.message?.includes('RLS')) return '데이터 접근 권한이 없습니다.';

  // 5. 일반 Error 객체
  if (error.message) return error.message;

  // 6. 기타
  try {
    return String(error) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Base44 function invoke 에러에서 실제 서버 메시지 추출
 * Base44 SDK가 "Request failed with status code 500"으로 가릴 때 사용.
 * 우선순위:
 *   error.response?.data?.error
 *   error.response?.data?.message
 *   error.data?.error
 *   error.data?.message
 *   error.message
 */
export function extractFunctionError(error, fallback = '요청 중 오류가 발생했습니다.') {
  if (!error) return fallback;

  // 1. response.data (axios/fetch wrapper)
  if (error.response?.data) {
    const d = error.response.data;
    if (typeof d === 'string') return d;
    if (d.error) return d.error;
    if (d.message) return d.message;
    if (d.detail) return d.detail;
  }

  // 2. data 직접 (Base44 invoke 응답)
  if (error.data) {
    if (error.data.error) return error.data.error;
    if (error.data.message) return error.data.message;
    if (error.data.detail) return error.data.detail;
  }

  // 3. Base44 SDK가 status code만 반환하는 경우 — message에서 추출
  if (error.message) {
    const msg = error.message;
    // "Request failed with status code 500" → 서버 응답 body가 없으면 안내
    if (msg.match(/Request failed with status code (\d+)/)) {
      const code = msg.match(/Request failed with status code (\d+)/)[1];
      return `서버 오류가 발생했습니다. (HTTP ${code})`;
    }
    return msg;
  }

  return getErrorMessage(error, fallback);
}

/**
 * 관리자 권한 검사 helper (priority 26)
 * admin과 super_admin 모두 관리자로 인식
 */
export function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin';
}