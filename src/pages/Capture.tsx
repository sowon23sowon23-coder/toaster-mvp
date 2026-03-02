import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Button from "../components/Button";
import { captureVideoFrame, startPreferredCamera, stopCamera } from "../lib/camera";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Capture() {
  const navigate = useNavigate();
  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const setPhotos = usePhotoboothStore((state) => state.setPhotos);
  const resetPhotos = usePhotoboothStore((state) => state.resetPhotos);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    void requestCamera();
    return () => stopCamera(streamRef.current);
  }, []);

  if (!selectedTemplateId) return <Navigate to="/templates" replace />;

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
        setCaptureIndex(shot);
        await wait(260);
      }

      setPhotos(captured);
      trackEvent("capture_completed");
      navigate("/edit");
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Capture failed.");
    } finally {
      setCountdown(0);
      setIsCapturing(false);
    }
  }

  return (
    <main className="screen">
      <Header title="Capture 4 Photos" subtitle="3-second countdown for each shot." backTo="/templates" />

      {permissionError && (
        <div className="alert">
          <p>{permissionError}</p>
          <Button variant="secondary" onClick={() => void requestCamera()}>
            Retry Camera Permission
          </Button>
        </div>
      )}

      <section className="panel camera-panel">
        <div className="camera-view">
          <video ref={videoRef} autoPlay muted playsInline />
          {!cameraReady && <div className="camera-mask">Turn on camera permission to continue.</div>}
          {countdown > 0 && <div className="countdown">{countdown}</div>}
        </div>
        <p className="progress-label">Progress: {captureIndex}/4</p>
      </section>

      <div className="bottom-cta stack-row">
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
        <Button onClick={() => void runCaptureSequence()} disabled={!cameraReady || isCapturing}>
          {isCapturing ? "Capturing..." : "Start 4-Shot Countdown"}
        </Button>
      </div>
    </main>
  );
}
