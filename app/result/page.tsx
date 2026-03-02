"use client";

import React, { useEffect, useMemo, useState } from "react";
import { del, get, set } from "idb-keyval";
import Link from "next/link";

type FrameId = "frame1" | "frame2" | "frame3" | "frame4";
type SavedState = {
  shots: Blob[];
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
  slots?: SlotRect[];
};

const DEFAULT_SLOTS: SlotRect[] = [
  { x: 0.075, y: 0.2, w: 0.425, h: 0.2833333333 },
  { x: 0.5, y: 0.2, w: 0.425, h: 0.2833333333 },
  { x: 0.075, y: 0.5166666667, w: 0.425, h: 0.2833333333 },
  { x: 0.5, y: 0.5166666667, w: 0.425, h: 0.2833333333 },
];

const FRAMES: FrameConfig[] = [
  { id: "frame1", label: "Frame 1", src: "/frames/frame1.png" },
  { id: "frame2", label: "Frame 2", src: "/frames/frame2.png" },
  { id: "frame3", label: "Frame 3", src: "/frames/frame3.png" },
  { id: "frame4", label: "Frame 4", src: "/frames/frame4.png" },
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
  return FRAMES.find((frame) => frame.id === frameId) ?? FRAMES[0];
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

  const shotImages = await Promise.all(shots.map(blobToImage));
  shotImages.forEach((img, i) => {
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

  const frameImage = await loadImage(frame.src);
  ctx.drawImage(frameImage, 0, 0, W, H);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export default function ResultPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shots, setShots] = useState<Blob[]>([]);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [frameId, setFrameId] = useState<FrameId>("frame1");
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const frame = useMemo(() => getFrameConfig(frameId), [frameId]);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = (await get(DB_KEY)) as SavedState | undefined;
        if (!data || !data.shots || data.shots.length !== 4) {
          setError("No capture data found. Take 4 photos first.");
          setShots([]);
          setFinalBlob(null);
          setLoadedAt(null);
          return;
        }
        setShots(data.shots);
        setFrameId(data.frameId ?? "frame1");
        setLoadedAt(data.savedAt ?? null);
        const selected = getFrameConfig(data.frameId ?? "frame1");
        const final = await composeFinalPNG(data.shots, selected);
        setFinalBlob(final);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    shotUrls.forEach((url) => URL.revokeObjectURL(url));
    const urls = shots.map((blob) => URL.createObjectURL(blob));
    setShotUrls(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots]);

  useEffect(() => {
    if (finalUrl) URL.revokeObjectURL(finalUrl);
    if (finalBlob) setFinalUrl(URL.createObjectURL(finalBlob));
    else setFinalUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalBlob]);

  useEffect(() => {
    (async () => {
      if (shots.length !== 4) return;
      try {
        const final = await composeFinalPNG(shots, frame);
        setFinalBlob(final);

        const payload: SavedState = {
          shots,
          frameId,
          final,
          savedAt: Date.now(),
        };
        await set(DB_KEY, payload);
        setLoadedAt(payload.savedAt);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Compose failed");
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  }

  function downloadFinal() {
    if (!finalBlob) return;
    const url = URL.createObjectURL(finalBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `toaster_${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <section className="app-shell stack">
        <header className="stack">
          <div>
            <p className="brand-kicker">STEP 2. PICK A FRAME, SAVE THE FUN</p>
            <h1 className="app-title">Frame & Result</h1>
            <p className="app-subtitle">
              Choose your favorite style frame, then save or download your final photobooth cut.
            </p>
          </div>
          <div className="chip-row">
            <span className="chip">Frame Select</span>
            <span className="chip">Instant Compose</span>
            <span className="chip">PNG Export</span>
          </div>
          <div className="controls-grid">
            <Link href="/capture" className="btn">
              Back to Capture
            </Link>
            <button className="btn" onClick={saveToDB} disabled={saving || shots.length !== 4}>
              {saving ? "Saving..." : "Save Session"}
            </button>
            <button className="btn btn-primary" onClick={downloadFinal} disabled={!finalBlob}>
              Download PNG
            </button>
            <button className="btn btn-danger" onClick={clearDB} disabled={saving}>
              Clear Saved
            </button>
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        <section className="result-grid">
          <article className="surface result-card stack">
            <strong>Pick Your Frame</strong>
            <div className="frame-scroll">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  className={`frame-btn${frameId === f.id ? " active" : ""}`}
                  onClick={() => setFrameId(f.id)}
                >
                  <div className="muted-note">{f.label}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.src}
                    alt={f.label}
                    onError={() => setError(`Frame file missing: ${f.src}`)}
                  />
                </button>
              ))}
            </div>

            <strong>Your 4 Shots</strong>
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

            <p className="muted-note">
              {loadedAt
                ? `Last saved: ${new Date(loadedAt).toLocaleString()}`
                : "No saved session yet."}
            </p>
          </article>

          <article className="surface result-card stack">
            <strong>Final Sweet Cut</strong>
            <div className="final-wrap">
              {loading ? (
                <div className="empty-state">Loading...</div>
              ) : finalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={finalUrl} alt="final output" />
              ) : (
                <div className="empty-state">
                  No final output yet. Capture 4 photos first, then come back here.
                </div>
              )}
            </div>
            <p className="muted-note">Output size: 1200x1800 PNG. Great for sharing or printing.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
