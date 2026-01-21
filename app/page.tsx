"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";

type FrameId = "frame1" | "frame2" | "frame3" | "frame4";

type SavedState = {
  shots: Blob[]; // length 4
  frameId: FrameId;
  final?: Blob;
  savedAt: number;
};

const FRAMES: { id: FrameId; label: string; src: string }[] = [
  { id: "frame1", label: "Frame 1", src: "/frames/frame1.png" },
  { id: "frame2", label: "Frame 2", src: "/frames/frame2.png" },
  { id: "frame3", label: "Frame 3", src: "/frames/frame3.png" },
  { id: "frame4", label: "Frame 4", src: "/frames/frame4.png" },
];

const DB_KEY = "toaster_mvp_state_v1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function composeFinalPNG(shots: Blob[], frameSrc: string): Promise<Blob> {
  if (shots.length !== 4) throw new Error("Need exactly 4 shots");

  const W = 1200;
  const H = 1800;

  const padding = 90;
  const gap = 60;

  const gridW = W - padding * 2;
  const cellW = Math.floor((gridW - gap) / 2);
  const cellH = cellW; // square
  const totalGridH = cellH * 2 + gap;

  const startX = padding;
  const startY = Math.floor((H - totalGridH) / 2);

  const positions = [
    { x: startX, y: startY },
    { x: startX + cellW + gap, y: startY },
    { x: startX, y: startY + cellH + gap },
    { x: startX + cellW + gap, y: startY + cellH + gap },
  ];

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const shotImgs = await Promise.all(shots.map(blobToImage));
  shotImgs.forEach((img, i) => {
    const { x, y } = positions[i];

    const scale = Math.max(cellW / img.width, cellH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = x + (cellW - drawW) / 2;
    const dy = y + (cellH - drawH) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, cellW, cellH);
  });

  const frameImg = await loadImage(frameSrc);
  ctx.drawImage(frameImg, 0, 0, W, H);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });

  return blob;
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

  // mirror capture
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

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [countdown, setCountdown] = useState<number>(0);
  const [isShooting, setIsShooting] = useState(false);

  const [shots, setShots] = useState<Blob[]>([]);
  const [shotUrls, setShotUrls] = useState<string[]>([]);

  const [frameId, setFrameId] = useState<FrameId>("frame1");
  const frameSrc = useMemo(
    () => FRAMES.find((f) => f.id === frameId)?.src ?? FRAMES[0].src,
    [frameId]
  );

  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      shotUrls.forEach((u) => URL.revokeObjectURL(u));
      if (finalUrl) URL.revokeObjectURL(finalUrl);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    shotUrls.forEach((u) => URL.revokeObjectURL(u));
    const urls = shots.map((b) => URL.createObjectURL(b));
    setShotUrls(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots]);

  useEffect(() => {
    if (finalUrl) URL.revokeObjectURL(finalUrl);
    if (finalBlob) setFinalUrl(URL.createObjectURL(finalBlob));
    else setFinalUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalBlob]);

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
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;

    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) video.srcObject = null;
  }

  function resetAll() {
    setError(null);
    setIsShooting(false);
    setCountdown(0);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;

    setShots([]);
    setFinalBlob(null);
  }

  async function shoot4WithCountdown() {
    setError(null);
    setFinalBlob(null);

    const video = videoRef.current;
    if (!video) return setError("No video element");
    if (!cameraOn) return setError("Camera is off");
    if (isShooting) return;

    setIsShooting(true);
    setShots([]);

    let c = 3;
    setCountdown(c);
    countdownTimerRef.current = window.setInterval(() => {
      c -= 1;
      setCountdown(clamp(c, 0, 3));
      if (c <= 0 && countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1000);

    await new Promise((r) => setTimeout(r, 3000));

    const captured: Blob[] = [];
    try {
      for (let i = 0; i < 4; i++) {
        const blob = await captureFromVideo(video);
        captured.push(blob);
        setShots([...captured]);
        if (i < 3) await new Promise((r) => setTimeout(r, 700));
      }
    } catch (e: any) {
      setError(e?.message ?? "Capture failed");
      setIsShooting(false);
      setCountdown(0);
      return;
    }

    setCountdown(0);
    setIsShooting(false);

    try {
      const final = await composeFinalPNG(captured, frameSrc);
      setFinalBlob(final);
    } catch (e: any) {
      setError(e?.message ?? "Compose failed (check frame PNG path)");
    }
  }

  async function recomputeFinal() {
    setError(null);
    if (shots.length !== 4) return setError("Need 4 shots first");
    try {
      const final = await composeFinalPNG(shots, frameSrc);
      setFinalBlob(final);
    } catch (e: any) {
      setError(e?.message ?? "Compose failed");
    }
  }

  async function saveToDB() {
    setError(null);
    if (shots.length !== 4) return setError("촬영 4장이 있어야 저장할 수 있어요.");
    setSaving(true);
    try {
      const payload: SavedState = {
        shots,
        frameId,
        final: finalBlob ?? undefined,
        savedAt: Date.now(),
      };
      await set(DB_KEY, payload);
      setLoadedAt(payload.savedAt);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function loadFromDB() {
    setError(null);
    setSaving(true);
    try {
      const data = (await get(DB_KEY)) as SavedState | undefined;
      if (!data) return setError("저장된 데이터가 없어요.");

      setFrameId(data.frameId);
      setShots(data.shots);

      if (data.final) setFinalBlob(data.final);
      else {
        const final = await composeFinalPNG(
          data.shots,
          FRAMES.find((f) => f.id === data.frameId)?.src ?? FRAMES[0].src
        );
        setFinalBlob(final);
      }
      setLoadedAt(data.savedAt);
    } catch (e: any) {
      setError(e?.message ?? "Load failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearDB() {
    setError(null);
    setSaving(true);
    try {
      await del(DB_KEY);
      setLoadedAt(null);
    } catch (e: any) {
      setError(e?.message ?? "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  function downloadFinal() {
    if (!finalBlob) return;
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toaster_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (shots.length === 4) recomputeFinal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Toaster MVP (A안)</h1>
          <p style={styles.sub}>
            웹캠 → 3초 카운트다운 → 4장 자동 촬영 → 프레임 → 합성 → 저장(IndexedDB)
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!cameraOn ? (
            <button style={styles.primaryBtn} onClick={startCamera}>
              웹캠 켜기
            </button>
          ) : (
            <button style={styles.btn} onClick={stopCamera}>
              웹캠 끄기
            </button>
          )}
          <button style={styles.btn} onClick={resetAll} disabled={isShooting}>
            리셋
          </button>
        </div>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.h2}>1) 촬영</h2>

          <div style={styles.videoWrap}>
            <video ref={videoRef} style={styles.video} autoPlay muted playsInline />
            {!cameraOn && <div style={styles.videoOverlay}>웹캠을 켜주세요</div>}
            {countdown > 0 && <div style={styles.countdown}>{countdown}</div>}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              style={styles.primaryBtn}
              onClick={shoot4WithCountdown}
              disabled={!cameraOn || isShooting}
            >
              {isShooting ? "촬영 중..." : "촬영 시작 (3초 후 4장)"}
            </button>
            <button style={styles.btn} onClick={recomputeFinal} disabled={shots.length !== 4}>
              합성 다시하기
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={styles.h3}>촬영 미리보기 (4컷)</h3>
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
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>2) 프레임 & 결과</h2>

          <div style={{ marginTop: 8 }}>
            <h3 style={styles.h3}>프레임 선택 (4개)</h3>
            <div style={styles.frameRow}>
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  style={{
                    ...styles.frameBtn,
                    borderColor: frameId === f.id ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.15)",
                  }}
                  onClick={() => setFrameId(f.id)}
                >
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{f.label}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.src}
                    alt={f.label}
                    style={{
                      width: "100%",
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.03)",
                    }}
                    onError={() =>
                      setError(`프레임 파일을 못 찾았어요: ${f.src} (public/frames에 넣었는지 확인)`)
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={styles.h3}>최종 합성 결과</h3>
            <div style={styles.finalWrap}>
              {finalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={finalUrl} alt="final" style={styles.finalImg} />
              ) : (
                <div style={styles.finalEmpty}>
                  {shots.length === 4
                    ? "합성 중이거나, 합성 버튼을 눌러주세요."
                    : "촬영 4장을 먼저 만들어주세요."}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button style={styles.primaryBtn} onClick={downloadFinal} disabled={!finalBlob}>
                PNG 다운로드
              </button>
              <button style={styles.btn} onClick={saveToDB} disabled={saving || shots.length !== 4}>
                {saving ? "저장 중..." : "저장하기(IndexedDB)"}
              </button>
              <button style={styles.btn} onClick={loadFromDB} disabled={saving}>
                불러오기
              </button>
              <button style={styles.btnDanger} onClick={clearDB} disabled={saving}>
                저장 삭제
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              {loadedAt ? (
                <span>최근 저장/로드: {new Date(loadedAt).toLocaleString()}</span>
              ) : (
                <span>아직 저장된 데이터 없음</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
            <b>팁</b>
            <div>• 프레임 PNG는 1200×1800, 투명 배경이면 가장 깔끔해요.</div>
            <div>• 모바일은 HTTPS에서만 웹캠이 정상 동작하는 경우가 많아요. (Vercel 배포 추천)</div>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
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
  grid: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
  },
  h2: { fontSize: 18, margin: 0, letterSpacing: -0.2 },
  h3: { fontSize: 13, margin: "0 0 8px 0", opacity: 0.8 },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,0,0.25)",
    background: "rgba(255,0,0,0.04)",
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
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
  },
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
    alignItems: "center",
    justifyContent: "center",
    fontSize: 80,
    fontWeight: 800,
    color: "#fff",
    textShadow: "0 6px 30px rgba(0,0,0,0.45)",
    background: "rgba(0,0,0,0.25)",
  },
  shotsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
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
  frameRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  frameBtn: {
    textAlign: "left",
    padding: 10,
    borderRadius: 14,
    border: "2px solid rgba(0,0,0,0.15)",
    background: "#fff",
    cursor: "pointer",
  },
  finalWrap: {
    width: "100%",
    aspectRatio: "2/3",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  finalImg: { width: "100%", height: "100%", objectFit: "cover" },
  finalEmpty: { fontSize: 13, opacity: 0.6, padding: 16, textAlign: "center" },
};
