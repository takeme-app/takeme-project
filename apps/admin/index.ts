import React from 'react';
import { registerRootComponent } from 'expo';
import App from './App';

function runWeb() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif;">Erro: elemento #root não encontrado.</div>';
    return;
  }
  try {
    const { createRoot } = require('react-dom/client');
    const root = createRoot(rootEl);
    root.render(React.createElement(App));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    rootEl.innerHTML = `<div style="padding:20px;font-family:sans-serif;color:#333;">Erro ao montar o app: ${msg}</div>`;
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runWeb);
  } else {
    runWeb();
  }
} else {
  registerRootComponent(App);
}
