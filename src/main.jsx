import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';
import { appPath } from '@/lib/basePath';

class AppBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[CODA] 화면 오류', error); }
  render() {
    if (this.state.failed) return <div role="alert" style={{padding: 32, textAlign: 'center'}}>
      <h2>화면을 불러오지 못했습니다.</h2>
      <p>다시 시도해 주세요. 저장된 학습 기록은 삭제되지 않습니다.</p>
      <button onClick={() => window.location.reload()}>다시 불러오기</button>
      <p><a href={appPath('/')}>홈으로 이동</a></p>
    </div>;
    return this.props.children;
  }
}
function Ready() {
  useEffect(() => { window.codaAppReady?.(); }, []);
  return null;
}
ReactDOM.createRoot(document.getElementById('root')).render(<><AppBoundary><App /></AppBoundary><Ready /></>);
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register(appPath('/sw.js'), { updateViaCache: 'none' })
    .then(reg => reg.update()).catch(console.warn);
}
