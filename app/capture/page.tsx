// Test change
"use client";

import React, { useEffect, useRef, useState } from "react";
import { set } from "idb-keyval";
import Link from "next/link";

type FrameId = "frame1" | "frame2" | "frame3" | "frame4";
type SavedState = {
  shots: Blob[]; // length 4
  frameId: FrameId;
  final?: Blob;
  savedAt: number;
};
const DB_KEY = "toaster_mvp_state_v1";
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  // mirror capture (selfie)
  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.restore();
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
  return blob;
}
export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [shotIndex, setShotIndex] = useState<number>(0); // 0~4
  const [shots, setShots] = useState<Blob[]>([]);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  useEffect(() => {
    return () => {
      stopCamera();
      shotUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // revoke old
    shotUrls.forEach((u) => URL.revokeObjectURL(u));
    const urls = shots.map((b) => URL.createObjectURL(b));
    setShotUrls(urls);
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
    } catch (e: any) {
      setError(e?.message ?? "Failed to start camera");
      setCameraOn(false);
    }
  }
  function stopCamera() {
    setCameraOn(false);
    setIsShooting(false);
    setCountdown(0);
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
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
      for (let i = 0; i < 4; i++) {
        // per-shot countdown 3..2..1
        for (let c = 3; c >= 1; c--) {
          setCountdown(c);
          await sleep(1000);
        }
        setCountdown(0);
        // capture
        const blob = await captureFromVideo(video);
        captured.push(blob);
        setShots([...captured]);
        setShotIndex(captured.length);
        // small pause between shots (optional)
        if (i < 3) await sleep(400);
      }
      // Save shots immediately so /result can read them
      const payload: SavedState = {
        shots: captured,
        frameId: "frame1", // default
        savedAt: Date.now(),
      };
      await set(DB_KEY, payload);
    } catch (e: any) {
      setError(e?.message ?? "Capture failed");
      setIsShooting(false);
      setCountdown(0);
      return;
    }
    setIsShooting(false);
    setCountdown(0);
  }
  const canGoNext = shots.length === 4 && !isShooting;
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>shooting</h1>
          <p style={styles.sub}>Automatic shooting after a 3-second countdown for each photo (4 photos total)</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!cameraOn ? (
            <button style={styles.primaryBtn} onClick={startCamera}>
              Turn on the webcam
            </button>
          ) : (
            <button style={styles.btn} onClick={stopCamera}>
              Turn off the webcam
            </button>
          )}
          <button style={styles.btn} onClick={reset} disabled={isShooting}>
            Reset
          </button>
          <Link href="/result" style={{ pointerEvents: canGoNext ? "auto" : "none" }}>
            <button style={styles.btn} disabled={!canGoNext}>
              Next →
            </button>
          </Link>
        </div>
      </header>
      {error && <div style={styles.errorBox}>{error}</div>}
      <section style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.videoWrap}>
            <video ref={videoRef} style={styles.video} autoPlay muted playsInline />
            {!cameraOn && <div style={styles.videoOverlay}>Start camera</div>}
            {countdown > 0 && (
              <div style={styles.countdown}>
                {countdown}
                <div style={{ fontSize: 14, marginTop: 10, opacity: 0.9 }}>
                  {shotIndex + 1} / 4 Ready to shoot
                </div>
              </div>
            )}
            {isShooting && countdown === 0 && (
              <div style={styles.shootingHint}>Shooting… ({shotIndex}/4)</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              style={styles.primaryBtn}
              onClick={shoot4WithPerShotCountdown}
              disabled={!cameraOn || isShooting}
            >
              {isShooting ? "Shooting…" : "Start shooting"}
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <h3 style={styles.h3}>Photo Preview (4 shots)</h3>
            <div style={styles.shotsRow}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={styles.shotBox}>
                  {shotUrls[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shotUrls[i]} alt={`shot-${i + 1}`} style={styles.shotImg} />
                  ) : (
                    <div style={styles.shotEmpty}>{i + 1}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            • After 4 shots, tap top right <b>Next →</b> Button enabled.
          </div>
        </div>
      </section>
    </main>
  );
}
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(245,245,245,1) 100%)",
    color: "#111",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 18px auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  h1: { fontSize: 26, margin: 0, letterSpacing: -0.5 },
  sub: { margin: "6px 0 0 0", opacity: 0.75, fontSize: 13 },
  grid: { maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 16 },
  card: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
  },
  h3: { fontSize: 13, margin: "0 0 8px 0", opacity: 0.8 },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  errorBox: {
    maxWidth: 1100,
    margin: "0 auto 12px auto",
    padding: "10px 12px",
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.18)",
    borderRadius: 12,
    color: "rgba(130,0,0,0.9)",
    fontSize: 13,
  },
  videoWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "16/9",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(0,0,0,0.06)",
    border: "1px solid rgba(0,0,0,0.10)",
  },
  video: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" },
  videoOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    opacity: 0.7,
  },
  countdown: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 86,
    fontWeight: 900,
    color: "#fff",
    textShadow: "0 6px 30px rgba(0,0,0,0.45)",
    background: "rgba(0,0,0,0.28)",
  },
  shootingHint: {
    position: "absolute",
    left: 12,
    bottom: 12,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 12,
  },
  shotsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  shotBox: {
    width: "100%",
    aspectRatio: "1/1",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
  },
  shotImg: { width: "100%", height: "100%", objectFit: "cover" },
  shotEmpty: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    opacity: 0.3,
    fontSize: 18,
  },
};
