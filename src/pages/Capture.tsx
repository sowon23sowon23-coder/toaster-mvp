import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { captureVideoFrame, startPreferredCamera, stopCamera } from "../lib/camera";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SKIPPED_PHOTOS = Array.from({ length: 4 }, () => new Blob([], { type: "image/png" }));

export default function Capture() {
  const navigate = useNavigate();
  const setPhotos = usePhotoboothStore((state) => state.setPhotos);
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);
  const resetEdit = usePhotoboothStore((state) => state.resetEdit);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    void requestCamera();
    return () => stopCamera(streamRef.current);
  }, []);

  async function requestCamera() {
    setPermissionError(null);
    setCameraReady(false);
    try {
      const stream = await startPreferredCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready.");
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      setCameraReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera access failed.";
      setPermissionError(message);
    }
  }

  async function runCaptureSequence() {
    if (!cameraReady || isCapturing || !videoRef.current) return;
    setIsCapturing(true);
    setCaptureIndex(0);
    const captured: Blob[] = [];

    try {
      for (let shot = 1; shot <= 4; shot += 1) {
        for (let second = 3; second >= 1; second -= 1) {
          setCountdown(second);
          await wait(1000);
        }
        setCountdown(0);
        const blob = await captureVideoFrame(videoRef.current);
        captured.push(blob);
        setShowFlash(true);
        setCaptureIndex(shot);
        await wait(260);
        setShowFlash(false);
      }

      setPhotos(captured);
      resetEdit();
      trackEvent("capture_completed");
      navigate("/templates");
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Capture failed.");
    } finally {
      setCountdown(0);
      setIsCapturing(false);
    }
  }

  function handleSkipShoot() {
    if (isCapturing) return;
    stopCamera(streamRef.current);
    streamRef.current = null;
    resetPhotos();
    setPhotos(SKIPPED_PHOTOS);
    resetEdit();
    trackEvent("capture_skipped");
    navigate("/templates");
  }

  return (
    <main className="capture-page">
      <div className="capture-header">
        <button
          className="capture-back-btn"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span className="capture-header-title">
          {isCapturing ? `Shot ${captureIndex}/4` : "Take 4 Photos"}
        </span>

        <div className="capture-progress-dots" aria-label={`${captureIndex} of 4 captured`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`capture-dot${
                i < captureIndex ? " done" : i === captureIndex && isCapturing ? " current" : ""
              }`}
            />
          ))}
        </div>
      </div>

      <div className="capture-camera-wrap">
        <div className="capture-stage">
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="capture-shot-frame" aria-hidden="true" />
          {showFlash && <div className="capture-flash" aria-hidden="true" />}
        </div>

        {!cameraReady && !permissionError && (
          <div className="capture-mask">
            <div className="capture-mask-text">
              <span className="capture-mask-icon">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              <p className="capture-mask-label">Allow camera access to continue</p>
            </div>
          </div>
        )}

        {countdown > 0 && (
          <div className="countdown-overlay">
            <span key={countdown} className="countdown-number">
              {countdown}
            </span>
          </div>
        )}

        {permissionError && (
          <div className="capture-alert">
            <p style={{ marginBottom: 8, fontSize: "0.85rem" }}>{permissionError}</p>
            <Button variant="secondary" onClick={() => void requestCamera()}>
              Retry
            </Button>
          </div>
        )}
      </div>

      <div className="capture-actions">
        <Button
          variant="secondary"
          onClick={() => {
            resetPhotos();
            setCaptureIndex(0);
          }}
          disabled={isCapturing}
        >
          Retake
        </Button>
        <Button variant="secondary" onClick={handleSkipShoot} disabled={isCapturing}>
          Skip
        </Button>
        <Button
          onClick={() => void runCaptureSequence()}
          disabled={!cameraReady || isCapturing}
          className="capture-start-btn"
        >
          {isCapturing ? "Capturing..." : "Start Shoot"}
        </Button>
      </div>
    </main>
  );
}
