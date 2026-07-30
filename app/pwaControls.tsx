"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/types";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const tr = (language: Language, de: string, en: string) => language === "de" ? de : en;

export function PwaControls({ language }: { language: Language }) {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();
  const [iosInstall, setIosInstall] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker>();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOnline(navigator.onLine);
      setIosInstall(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches);
    });
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("beforeinstallprompt", installHandler);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting) setWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
          });
        });
      }).catch(() => undefined);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(undefined);
  };
  const update = () => {
    if (!waitingWorker) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(undefined);
  };

  return <div className="pwa-controls" aria-live="polite">
    {!online ? <span className="offline-pill"><i />{tr(language, "Offline – gespeicherte Inhalte verfügbar", "Offline – saved content available")}</span> : null}
    {waitingWorker ? <button className="pwa-action" onClick={update}>{tr(language, "Update laden", "Load update")}</button> : null}
    {installPrompt ? <button className="pwa-action" onClick={install}>{tr(language, "App installieren", "Install app")}</button> : null}
    {iosInstall && !installPrompt ? <details className="pwa-install-help"><summary>{tr(language, "App installieren", "Install app")}</summary><span>{tr(language, "In Safari: Teilen → Zum Home-Bildschirm.", "In Safari: Share → Add to Home Screen.")}</span></details> : null}
  </div>;
}
