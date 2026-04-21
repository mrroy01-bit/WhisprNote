import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

normalizeSinglePageAppUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function normalizeSinglePageAppUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const { pathname, search, hash } = window.location;
  const normalizedPathname = pathname === '/index.html' ? '/' : pathname;

  if (normalizedPathname === '/') {
    return;
  }

  window.history.replaceState({}, document.title, `/${search}${hash}`);
}
