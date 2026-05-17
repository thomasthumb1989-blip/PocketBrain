'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem('pocketbrain-install-dismissed');
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        setDismissed(true);
        return;
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Show iOS prompt after 3 seconds
    if (isIOSDevice && !standalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // Chrome/Edge/Opera install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pocketbrain-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed, dismissed, or no prompt available
  if (isStandalone || dismissed || !showPrompt) return null;

  // iOS — show manual instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-down">
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Install PocketBrain</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Tap <Share className="w-3 h-3 inline" /> then "Add to Home Screen" to install
                </p>
              </div>
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chrome/Edge/Opera — native install prompt
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-down">
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Install PocketBrain</p>
                <p className="text-muted-foreground text-xs mt-1">Add to your home screen for quick access</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Install
                </Button>
                <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
