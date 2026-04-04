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

        <div className="landing-steps" aria-label="Capture, edit, and share">
          <div className="step-item">
            <span className="step-icon">1</span>
            <span className="step-label">Capture</span>
          </div>
          <span className="step-arrow">-&gt;</span>
          <div className="step-item">
            <span className="step-icon">2</span>
            <span className="step-label">Edit</span>
          </div>
          <span className="step-arrow">-&gt;</span>
          <div className="step-item">
            <span className="step-icon">3</span>
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
        <Button onClick={handleStart}>Start Campaign</Button>
      </div>
    </main>
  );
}
