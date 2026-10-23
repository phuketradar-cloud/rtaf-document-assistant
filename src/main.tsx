import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppDataProvider } from './state/AppData';
import App from './App';
import './styles.css';
import './theme-hud.css';
import { loadSettings } from './lib/storage';

// ใส่ธีมก่อนแสดงผลครั้งแรก เพื่อไม่ให้หน้าจอกะพริบเป็นธีมอื่นชั่วขณะ
try {
  document.documentElement.dataset.theme = loadSettings().theme;
} catch {
  document.documentElement.dataset.theme = 'default';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
);
