"use client";

import React, { useEffect, useRef, useState } from "react";
import { set } from "idb-keyval";
import Link from "next/link";

type FrameId = "frame1" | "frame2" | "frame3" | "frame4";
type SavedState = {
  shots: Blob[];
  frameId: FrameId;
  final?: Blob;
  savedAt: number;
};

const DB_KEY = "toaster_mvp_state_v1";
const GAME_BACKGROUNDS = ["/game-bg/game-bg-1.jpg", "/game-bg/game-bg-2.jpg"] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureFromVideo(video: HTMLVideoElement): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Video not ready");

  const canvas = document.createElement("canvas");
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [shotIndex, setShotIndex] = useState(0);
  const [shots, setShots] = useState<Blob[]>([]);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [gameBackground, setGameBackground] = useState<string>(GAME_BACKGROUNDS[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * GAME_BACKGROUNDS.length);
    setGameBackground(GAME_BACKGROUNDS[randomIndex]);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      shotUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    shotUrls.forEach((url) => URL.revokeObjectURL(url));
    const nextUrls = shots.map((blob) => URL.createObjectURL(blob));
    setShotUrls(nextUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not found");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setCameraOn(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start camera");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    setCameraOn(false);
    setIsShooting(false);
    setCountdown(0);
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }

  function reset() {
    setError(null);
    setIsShooting(false);
    setCountdown(0);
    setShotIndex(0);
    setShots([]);
  }

  async function shoot4WithPerShotCountdown() {
    setError(null);
    const video = videoRef.current;
    if (!video) return setError("No video element");
    if (!cameraOn) return setError("Camera is off");
    if (isShooting) return;

    setIsShooting(true);
    setShots([]);
    setShotIndex(0);
    const captured: Blob[] = [];

    try {
      for (let i = 0; i < 4; i += 1) {
        for (let c = 3; c >= 1; c -= 1) {
          setCountdown(c);
          await sleep(1000);
        }
        setCountdown(0);
        const blob = await captureFromVideo(video);
        captured.push(blob);
        setShots([...captured]);
        setShotIndex(captured.length);
        if (i < 3) await sleep(400);
      }

      const payload: SavedState = {
        shots: captured,
        frameId: "frame1",
        savedAt: Date.now(),
      };
      await set(DB_KEY, payload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Capture failed");
      setIsShooting(false);
      setCountdown(0);
      return;
    }

    setIsShooting(false);
    setCountdown(0);
  }

  const canGoNext = shots.length === 4 && !isShooting;

  return (
    <main className="capture-page" style={{ backgroundImage: `url(${gameBackground})` }}>
      <div className="capture-overlay">
        <section className="app-shell stack">
          <header className="capture-top stack">
            <div>
              <p className="brand-kicker">STEP 1. SNAP YOUR SWEET MOMENT</p>
              <h1 className="app-title">Photo Capture</h1>
              <p className="app-subtitle">
                3-second countdown and auto 4-shot capture. Keep your face centered for best
                results.
              </p>
            </div>
            <div className="chip-row">
              <span className="chip">Auto Countdown</span>
              <span className="chip">4 Shot Burst</span>
              <span className="chip">Mobile First</span>
            </div>
          </header>

          {error && <div className="alert">{error}</div>}

          <article className="surface capture-card stack">
            <div className="video-wrap">
              <video ref={videoRef} className="video" autoPlay muted playsInline />
              {!cameraOn && <div className="video-overlay">Turn on the camera to start</div>}
              {countdown > 0 && (
                <div className="countdown">
                  <div>
                    {countdown}
                    <small>
                      Shot {Math.min(shotIndex + 1, 4)} / 4
                    </small>
                  </div>
                </div>
              )}
              {isShooting && countdown === 0 && (
                <div className="shooting-hint">Capturing... ({shotIndex}/4)</div>
              )}
            </div>

            <div className="controls-grid">
              {!cameraOn ? (
                <button className="btn btn-primary" onClick={startCamera}>
                  Turn On Camera
                </button>
              ) : (
                <button className="btn" onClick={stopCamera}>
                  Turn Off Camera
                </button>
              )}
              <button className="btn" onClick={reset} disabled={isShooting}>
                Reset
              </button>
            </div>

            <button
              className="btn btn-primary"
              onClick={shoot4WithPerShotCountdown}
              disabled={!cameraOn || isShooting}
            >
              {isShooting ? "Shooting..." : "Start 4-Shot Capture"}
            </button>

            <div className="stack">
              <strong>Shot Preview</strong>
              <div className="preview-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shot-box">
                    {shotUrls[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shotUrls[i]} alt={`shot-${i + 1}`} />
                    ) : (
                      <div className="shot-empty">{i + 1}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/result"
              className="next-link btn btn-primary"
              style={{ pointerEvents: canGoNext ? "auto" : "none" }}
              aria-disabled={!canGoNext}
            >
              Next: Frame & Result
            </Link>

            <p className="muted-note">
              Step 2 unlocks automatically after all 4 shots are captured.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
