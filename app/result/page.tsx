"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get, set, del } from "idb-keyval";
import Link from "next/link";

type FrameId = "frame1" | "frame2" | "frame3" | "frame4";

type SavedState = {
  shots: Blob[]; // length 4
  frameId: FrameId;
  final?: Blob;
  savedAt: number;
};

const DB_KEY = "toaster_mvp_state_v1";

type SlotRect = { x: number; y: number; w: number; h: number };
type FrameConfig = {
  id: FrameId;
  label: string;
  src: string;
  slots?: SlotRect[]; // normalized 0..1 values against 1200x1800 output
};

const DEFAULT_SLOTS: SlotRect[] = [
  { x: 0.075, y: 0.2, w: 0.425, h: 0.2833333333 },
  { x: 0.5, y: 0.2, w: 0.425, h: 0.2833333333 },
  { x: 0.075, y: 0.5166666667, w: 0.425, h: 0.2833333333 },
  { x: 0.5, y: 0.5166666667, w: 0.425, h: 0.2833333333 },
];

const FRAMES: FrameConfig[] = [
  { id: "frame1", label: "Frame 1", src: "/frames/frame1.png" },
  {
    id: "frame2",
    label: "Frame 2",
    src: "/frames/frame2.png",
    // Detected from frame2.png black windows (1200x1800).
    slots: [
      { x: 0.105, y: 0.3261, w: 0.3675, h: 0.2433 },
      { x: 0.5142, y: 0.3261, w: 0.3683, h: 0.2433 },
      { x: 0.105, y: 0.5783, w: 0.3675, h: 0.2428 },
      { x: 0.5142, y: 0.5783, w: 0.3683, h: 0.2428 },
    ],
  },
  { id: "frame3", label: "Frame 3", src: "/frames/frame3.png" },
  {
    id: "frame4",
    label: "Frame 4",
    src: "/frames/frame4.png",
    // Tuned to the custom artwork's 4 windows.
    slots: [
      { x: 0.1016, y: 0.3242, w: 0.3721, h: 0.2474 },
      { x: 0.5107, y: 0.3242, w: 0.3721, h: 0.2474 },
      { x: 0.1016, y: 0.5762, w: 0.3721, h: 0.2474 },
      { x: 0.5107, y: 0.5762, w: 0.3721, h: 0.2474 },
    ],
  },
];

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
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getFrameConfig(frameId: FrameId): FrameConfig {
  return FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];
}

async function composeFinalPNG(shots: Blob[], frame: FrameConfig): Promise<Blob> {
  if (shots.length !== 4) throw new Error("Need exactly 4 shots");

  const W = 1200;
  const H = 1800;
  const slots = (frame.slots ?? DEFAULT_SLOTS).map((slot) => ({
    x: Math.round(slot.x * W),
    y: Math.round(slot.y * H),
    w: Math.round(slot.w * W),
    h: Math.round(slot.h * H),
  }));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const shotImgs = await Promise.all(shots.map(blobToImage));
  shotImgs.forEach((img, i) => {
    const { x, y, w, h } = slots[i];
    const scale = Math.max(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = x + (w - drawW) / 2;
    const dy = y + (h - drawH) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, w, h);
  });

  const frameImg = await loadImage(frame.src);
  ctx.drawImage(frameImg, 0, 0, W, H);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });

  return blob;
}

export default function ResultPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [shots, setShots] = useState<Blob[]>([]);
  const [shotUrls, setShotUrls] = useState<string[]>([]);

  const [frameId, setFrameId] = useState<FrameId>("frame1");
  const frame = useMemo(() => getFrameConfig(frameId), [frameId]);

  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  // load from DB on mount
  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = (await get(DB_KEY)) as SavedState | undefined;
        if (!data || !data.shots || data.shots.length !== 4) {
          setError("No capturing data found. Please take 4 photos on the capturing page first.");
          setShots([]);
          setFinalBlob(null);
          setLoadedAt(null);
          return;
        }
        setShots(data.shots);
        setFrameId(data.frameId ?? "frame1");
        setLoadedAt(data.savedAt ?? null);

        // Always recompute on load so updated frame images/slot coords are reflected.
        const selected = getFrameConfig(data.frameId ?? "frame1");
        const final = await composeFinalPNG(data.shots, selected);
        setFinalBlob(final);
      } catch (e: any) {
        setError(e?.message ?? "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // shots preview urls
  useEffect(() => {
    shotUrls.forEach((u) => URL.revokeObjectURL(u));
    const urls = shots.map((b) => URL.createObjectURL(b));
    setShotUrls(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots]);

  // final url
  useEffect(() => {
    if (finalUrl) URL.revokeObjectURL(finalUrl);
    if (finalBlob) setFinalUrl(URL.createObjectURL(finalBlob));
    else setFinalUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalBlob]);

  // recompute when frame changes (if we have 4 shots)
  useEffect(() => {
    (async () => {
      if (shots.length !== 4) return;
      try {
        const final = await composeFinalPNG(shots, frame);
        setFinalBlob(final);

        // also persist chosen frame (and cached final) to DB
        const payload: SavedState = {
          shots,
          frameId,
          final,
          savedAt: Date.now(),
        };
        await set(DB_KEY, payload);
        setLoadedAt(payload.savedAt);
      } catch (e: any) {
        setError(e?.message ?? "Compose failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);

  async function saveToDB() {
    setError(null);
    if (shots.length !== 4) return setError("4 photos are required.");
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

  async function clearDB() {
    setError(null);
    setSaving(true);
    try {
      await del(DB_KEY);
      setLoadedAt(null);
      setShots([]);
      setFinalBlob(null);
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

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Frame & Results</h1>
          <p style={styles.sub}>Select Frame → Auto Compose → Save/Download</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/capture">
            <button style={styles.btn}>← Back to Camera</button>
          </Link>
          <button style={styles.btn} onClick={saveToDB} disabled={saving || shots.length !== 4}>
            {saving ? "Saving..." : "SAVE(IndexedDB)"}
          </button>
          <button style={styles.primaryBtn} onClick={downloadFinal} disabled={!finalBlob}>
            PNG Download
          </button>
          <button style={styles.btnDanger} onClick={clearDB} disabled={saving}>
            Save Delete
          </button>
        </div>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.h2}>Select Frame (4 items)</h2>
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
                    setError(`Frame file not found.: ${f.src} (Make sure it exists in public/frames)`)
                  }
                />
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <h3 style={styles.h3}>Camera Preview</h3>
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

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
            {loadedAt ? `최근 저장/로드: ${new Date(loadedAt).toLocaleString()}` : "아직 저장 정보 없음"}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>Final Result</h2>
          <div style={styles.finalWrap}>
            {loading ? (
              <div style={styles.finalEmpty}>Loading…</div>
            ) : finalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={finalUrl} alt="final" style={styles.finalImg} />
            ) : (
              <div style={styles.finalEmpty}>No results yet. Please start by taking a photo.</div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
            • Frame PNGs look best at 1200×1800 with a transparent background.
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
  frameRow: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 10 },
  frameBtn: {
    textAlign: "left",
    padding: 10,
    borderRadius: 14,
    border: "2px solid rgba(0,0,0,0.15)",
    background: "#fff",
    cursor: "pointer",
  },
  shotsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 8 },
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
    marginTop: 10,
  },
  finalImg: { width: "100%", height: "100%", objectFit: "cover" },
  finalEmpty: { fontSize: 13, opacity: 0.6, padding: 16, textAlign: "center" },
};
