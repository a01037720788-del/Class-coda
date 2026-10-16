import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    // react/react-dom이 여러 사본으로 로드되면 hooks(useEffect 등)가 null이 되는
    // "Cannot read properties of null (reading 'useEffect')" 에러가 발생한다.
    // dedupe로 항상 단일 사본을 사용하도록 강제한다.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  },
  optimizeDeps: {
    // 핵심 수정: Base44 플러그인의 optimizeDeps.include는 isRunningInSandbox가
    // true일 때만 적용된다. 샌드박스 모드가 아닐 때는 react/react-dom이
    // include 목록에 없어 Vite가 런타임에 의존성을 발견하며, 이때 react-dom이
    // react와 다른 최적화 패스에서 번들링되어 React 중복 인스턴스가 생성된다.
    // 이 include 목록은 샌드박스 모드 여부와 관계없이 항상 적용되어
    // 모든 React 의존 패키지를 첫 번째 최적화 패스에 포함시킨다.
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
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});