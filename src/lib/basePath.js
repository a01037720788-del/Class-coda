// 배포 환경별 base 경로를 한 곳에서 관리합니다.
//  - Base44(미리보기/게시): Vite base = '/'
//  - GitHub Pages: Vite base = '/Class-coda/' (vite.config.js 참고)
// Vite 가 빌드 시 import.meta.env.BASE_URL 을 주입하므로 두 환경 모두 자동으로 맞습니다.
export const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/+$/, ''); // '' 또는 '/Class-coda'

// 앱 내부 경로('/student/home')를 현재 배포 base 에 맞는 실제 URL 로 변환합니다.
// window.location.href 로 이동할 때는 반드시 이 함수를 거쳐야
// 서브패스 배포(GitHub Pages)에서도 올바른 주소로 이동합니다.
export function appPath(path = '/') {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${p}` || '/';
}