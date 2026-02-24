import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initAnalytics } from '@/services/analytics';
import App from './App';
import './styles.css';

initAnalytics({
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  isProduction: import.meta.env.PROD,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
