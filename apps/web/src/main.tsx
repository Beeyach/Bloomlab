import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App';
import { updates, watchUpdates } from './pwa/updates';
import './styles/global.css';

// Keep the precache and API NetworkOnly behavior, but let the learner choose a safe reload.
updates.activator(
  registerSW({
    immediate: true,
    onNeedRefresh: updates.available,
    onNeedReload: updates.controlled,
    onRegisteredSW: (_url, registration) => updates.registered(registration),
  }),
);
watchUpdates();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
