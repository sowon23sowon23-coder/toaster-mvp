import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { trackEvent } from "../lib/analytics";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function Landing() {
  const navigate = useNavigate();
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function handleStart() {
    trackEvent("start_clicked");
    resetPhotos();
    resetEdit();
    navigate("/capture");
  }

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      trackEvent("install_prompt_accepted");
    }
    setInstallPrompt(null);
  }

  return (
    <main className="landing-page">
      <div className="landing-hero">
        <div className="landing-logo-wrap">
          <img src="/brand/logo_placeholder.png" alt="Yogurtland" />
        </div>

        <h1 className="landing-title">Sweet Moment{"\n"}Photo Booth</h1>
        <p className="landing-sub">
          Create your Yogurtland 4-cut photo
          <br />
          and share it on Instagram
        </p>

        <div className="landing-steps" aria-label="Capture, customize, and share">
          <div className="step-item">
            <span className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span className="step-label">Capture</span>
          </div>
          <span className="step-arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
          <div className="step-item">
            <span className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" opacity="0.4" stroke="none" />
              </svg>
            </span>
            <span className="step-label">Customize</span>
          </div>
          <span className="step-arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
          <div className="step-item">
            <span className="step-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </span>
            <span className="step-label">Share</span>
          </div>
        </div>

        {installPrompt && (
          <div className="landing-install panel">
            <p className="landing-install-title">Add this booth to your home screen</p>
            <p className="landing-install-copy">
              Launch it like an app for faster camera access during events.
            </p>
            <Button variant="secondary" onClick={() => void handleInstall()}>
              Add to Home Screen
            </Button>
          </div>
        )}
      </div>

      <div className="landing-cta">
        <Button onClick={handleStart}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Start Sweet Moment
          </span>
        </Button>
      </div>
    </main>
  );
}
