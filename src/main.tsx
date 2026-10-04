import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';

const queryClient = new QueryClient();

// The service worker makes the app installable and usable offline (see vite.config.ts).
// A new version waits until the user accepts it, so the page never reloads by itself.
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    useAppStore.getState().showToast({
      message: strings.update.available,
      actionLabel: strings.update.reload,
      action: () => void updateServiceWorker(true),
      sticky: true,
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
