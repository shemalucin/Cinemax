import React, { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { useApp } from "../context/AppContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Path to the built Android package. The file must exist at the site root
 * (website/public/cinemax.apk) so browsers download it directly when the
 * header "Install APK" button is clicked. Same-origin download works on
 * every browser and honors the anchor's `download` attribute for the
 * chosen filename — no backend Content-Disposition header required.
 */
const APK_URL = "/cinemax.apk";
const APK_FILENAME = "cinemax.apk";

const API_BASE =
  (typeof import.meta === "object" && (import.meta as any).env?.VITE_API_BASE_URL)
    ? String((import.meta as any).env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";

/**
 * Surfaces app-install options. The `header` variant always renders a
 * direct "Install APK" download link pointing at the .apk file hosted in
 * the site's public/ folder — ideal for Android side-loading.
 *
 * The `sidebar` / `card` variants keep the original PWA "Add to Home
 * Screen" flow using the browser's native beforeinstallprompt event.
 */
export const InstallAppButton: React.FC<{ variant?: "sidebar" | "card" | "header"; label?: string }> = ({
  variant = "sidebar",
  label = "Install App",
}) => {
  const { addNotification } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [showFallbackInfo, setShowFallbackInfo] = useState(false);
  const [apkBusy, setApkBusy] = useState(false);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    if (isIOS) {
      setShowIOSTip((v) => !v);
    } else {
      setShowFallbackInfo((v) => !v);
    }
  };

  const handleApkDownload = async () => {
    setApkBusy(true);
    try {
      // Try backend API first
      if (API_BASE) {
        try {
          const res = await fetch(`${API_BASE}/api/download-apk`, {
            method: "GET",
            credentials: "include",
          });
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = APK_FILENAME;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            addNotification({
              type: "system",
              title: "APK Download Started",
              message: "Cinemax APK is being downloaded to your device.",
            });
            return;
          }
        } catch (apiErr) {
          console.warn("Backend APK download failed, trying direct URL:", apiErr);
        }
      }

      // Fallback to direct public file
      try {
        const res = await fetch(APK_URL);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = APK_FILENAME;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          addNotification({
            type: "system",
            title: "APK Download Started",
            message: "Cinemax APK is being downloaded to your device.",
          });
          return;
        }
      } catch (directErr) {
        console.warn("Direct APK download failed:", directErr);
      }

      // Final fallback: open direct link
      window.open(APK_URL, "_blank");
      addNotification({
        type: "system",
        title: "APK Download",
        message: "Opening APK download in new tab. If download doesn't start, check your browser's download settings.",
      });
    } catch (err) {
      console.error("APK download completely failed:", err);
      setShowFallbackInfo(true);
      addNotification({
        type: "system",
        title: "Download Failed",
        message: "Unable to download APK. Please try again or contact support.",
      });
    } finally {
      setApkBusy(false);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !(window.navigator as any).standalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (variant === "header") {
    return (
      <div className="relative">
      <button
        id="install-apk-btn"
        type="button"
        onClick={handleApkDownload}
        disabled={apkBusy}
        className="flex items-center gap-2 bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] px-4 py-2 rounded-2xl text-xs font-bold hover:bg-[#39FF14]/20 transition-all cursor-pointer"
      >
        <Download className="h-4 w-4" />
        <span>{apkBusy ? "Preparing..." : label}</span>
      </button>
      {showFallbackInfo && (
        <div className="absolute right-0 top-full mt-2 w-72 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          <strong className="text-[#39FF14]">Native APK not configured</strong><br />
          Add an APK URL in Admin Settings or use the browser&apos;s PWA install icon.
        </div>
      )}
      </div>
    );
  }

  if (installed) {
    return (
      <div
        id="install-app-installed"
        className="flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg text-[#39FF14]"
      >
        <Check className="h-4 w-4" />
        <span>App Installed</span>
      </div>
    );
  }

  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="relative">
      <button
        id="install-app-btn"
        onClick={handleInstall}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-4 px-4 py-2.5 text-sm rounded-lg hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            : "neon-btn flex items-center gap-2 font-extrabold px-5 py-3 rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
        }
      >
        <Download className="h-4 w-4 text-neutral-500" />
        <span>{label}</span>
      </button>
      {showIOSTip && (
        <div className="absolute left-0 bottom-full mb-2 w-64 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          On iOS: tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong>.
        </div>
      )}
      {showFallbackInfo && !isIOS && (
        <div className="absolute left-0 bottom-full mb-2 w-72 glass-card rounded-xl p-3 text-[11px] text-neutral-300 leading-relaxed shadow-xl z-50">
          <strong className="text-[#39FF14]">Cinemax is a PWA</strong><br />
          Look for the install icon in your browser's address bar, or use the "Add to Home Screen" option in your browser menu.
        </div>
      )}
    </div>
  );
};
