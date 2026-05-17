'use client';

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // No 'load' wrapper — useEffect already runs after mount, load event already fired
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('SW registered:', registration.scope);
    })
    .catch((error) => {
      console.log('SW registration failed:', error);
    });
}
