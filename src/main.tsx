import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { mapSettled } from './map/settled';
import './index.css';
import { useAppStore } from './state/store';
import { strings } from './strings/pt-BR';

const queryClient = new QueryClient();

// The service worker makes the app installable and usable offline (see vite.config.ts).
// A new version waits until the user accepts it, so the page never reloads by itself.
// Installing it downloads the app and all campus data (about 3 MB), so it waits for the
// map's first screen; without a map (the reviewers' page, a map that failed) it waits a while.
const SW_WITHOUT_MAP_MS = 15_000;
void Promise.race([mapSettled, new Promise((resolve) => setTimeout(resolve, SW_WITHOUT_MAP_MS))]).then(() => {
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
});

// `?revisar` opens the reviewers' page instead of the map; its code is only fetched then.
const reviewing = new URLSearchParams(window.location.search).has('revisar');
const ReviewPage = lazy(() => import('./features/review/ReviewPage').then((module) => ({ default: module.ReviewPage })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {reviewing ? (
        <Suspense fallback={null}>
          <ReviewPage />
        </Suspense>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
