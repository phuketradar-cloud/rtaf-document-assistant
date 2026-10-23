import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppDataProvider } from './state/AppData';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
);
