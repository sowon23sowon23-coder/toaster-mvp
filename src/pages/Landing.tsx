import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { trackEvent } from "../lib/analytics";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

export default function Landing() {
  const navigate = useNavigate();
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);

  function handleStart() {
    trackEvent("start_clicked");
    resetPhotos();
    resetEdit();
    navigate("/capture");
  }

  return (
    <main className="landing-page">
      <div className="landing-hero">
        <div className="landing-logo-wrap">
          <img src="/brand/logo_placeholder.png" alt="Yogurtland" />
        </div>

        <h1 className="landing-title">Sweet Moment{"\n"}Photo Booth</h1>
        <p className="landing-sub">
          Create your Yogurtland 4-cut photo<br />and share it on Instagram 🍦
        </p>

        <div className="landing-steps">
          <div className="step-item">
            <span className="step-icon">📸</span>
            <span className="step-label">Capture</span>
          </div>
          <span className="step-arrow">›</span>
          <div className="step-item">
            <span className="step-icon">✨</span>
            <span className="step-label">Edit</span>
          </div>
          <span className="step-arrow">›</span>
          <div className="step-item">
            <span className="step-icon">📤</span>
            <span className="step-label">Share</span>
          </div>
        </div>
      </div>

      <div className="landing-cta">
        <Button onClick={handleStart}>Start Campaign →</Button>
      </div>
    </main>
  );
}
