import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
// GitHub Pages 경로를 사용하며 별도 플랫폼 빌드 플러그인은 필요하지 않습니다.
const IS_GITHUB_PAGES = process.env.CODA_TARGET === 'github-pages';
// GitHub Pages 하위 경로(base). GH Pages 빌드의 기본값은 /저장소이름/ 입니다.
// CODA_TARGET 이 없으면 기본 경로 '/' 를 사용합니다.
const BASE_PATH = process.env.VITE_BASE_PATH || (IS_GITHUB_PAGES ? '/Class-coda/' : '/');

export default defineConfig({
  base: BASE_PATH,
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // react/react-dom이 여러 사본으로 로드되면 hooks(useEffect 등)가 null이 되는
    // "Cannot read properties of null (reading 'useEffect')" 에러가 발생한다.
    // dedupe로 항상 단일 사본을 사용하도록 강제한다.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  },
  optimizeDeps: {
    // React 관련 패키지를 한 번에 사전 번들링하여 중복 로드를 방지합니다.
    include: [
      'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime',
      '@tanstack/react-query', 'react-router-dom',
      'react-hook-form', 'recharts', 'framer-motion', 'lucide-react',
      '@hello-pangea/dnd', 'react-day-picker', 'react-resizable-panels',
      'react-hot-toast', 'sonner', 'next-themes', 'cmdk', 'vaul', 'input-otp',
      '@monaco-editor/react',
    ],
  },
  plugins: [
    react(),
  ]
});