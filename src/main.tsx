import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { GoogleAccess } from './components/GoogleAccess.tsx';
import './index.css';

const isNativeShell =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:' ||
    Boolean(
      (
        window as unknown as {
          Capacitor?: { isNativePlatform?: () => boolean };
        }
      ).Capacitor?.isNativePlatform?.()
    ));

if (!isNativeShell && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  import.meta.env.PROD && !isNativeShell ? <GoogleAccess /> : <App />,
);
