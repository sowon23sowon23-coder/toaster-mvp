import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FILTERS, FONTS, TEMPLATES, TemplateId } from "../lib/assets";
import {
  TemplateLayout,
  getDefaultPhotoOverscan,
  getTemplateLayout,
  renderPhotoboothImage,
} from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

const PHOTO_VERTICAL_ANCHOR_DEFAULT = 0.3;

function createPlaceholderPhotoBlob(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is not supported."));

  ctx.fillStyle = "#e7e1d8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Horizontal reference lines every 100px so crop position is easy to read.
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.font = "26px sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let y = 0; y < canvas.height; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    ctx.fillText(String(y), 10, y + 24);
  }

  // A simple face-like shape positioned like a typical portrait selfie.
  ctx.fillStyle = "#caa07a";
  ctx.beginPath();
  ctx.ellipse(540, 430, 240, 300, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2b2320";
  ctx.beginPath();
  ctx.ellipse(450, 400, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(630, 400, 22, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7a4a35";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(540, 520, 70, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = "#3d2a1f";
  ctx.beginPath();
  ctx.ellipse(540, 160, 280, 160, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SAMPLE PHOTO 1080x1350", canvas.width / 2, canvas.height - 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Failed to render placeholder."));
      resolve(blob);
    }, "image/png");
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const storePhotos = usePhotoboothStore((state) => state.photos);

  const [templateId, setTemplateId] = useState<TemplateId>(TEMPLATES[0].id);
  const [layout, setLayout] = useState<TemplateLayout>(() => getTemplateLayout(TEMPLATES[0].id));
  const [photoOverscan, setPhotoOverscan] = useState(() => getDefaultPhotoOverscan(TEMPLATES[0].id));
  const [verticalAnchor, setVerticalAnchor] = useState(PHOTO_VERTICAL_ANCHOR_DEFAULT);

  const [placeholderPhotos, setPlaceholderPhotos] = useState<Blob[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0],
    [templateId],
  );

  useEffect(() => {
    void createPlaceholderPhotoBlob().then((blob) => setPlaceholderPhotos([blob, blob, blob, blob]));
  }, []);

  function selectTemplate(id: TemplateId) {
    setTemplateId(id);
    setLayout(getTemplateLayout(id));
    setPhotoOverscan(getDefaultPhotoOverscan(id));
    setVerticalAnchor(PHOTO_VERTICAL_ANCHOR_DEFAULT);
  }

  const photos = storePhotos.length === 4 ? storePhotos : placeholderPhotos;

  useEffect(() => {
    if (!photos) return;
    let canceled = false;
    const timer = window.setTimeout(() => {
      void renderPhotoboothImage({
        photos,
        template,
        filter: FILTERS[0],
        stickers: [],
        textLine: "",
        textFont: FONTS[0],
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 483,
        height: 1376,
        layoutOverride: layout,
        photoOverscanOverride: photoOverscan,
        verticalAnchorOverride: verticalAnchor,
      }).then((blob) => {
        if (canceled) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      });
    }, 120);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [photos, template, layout, photoOverscan, verticalAnchor]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateLayout(key: keyof TemplateLayout, value: number) {
    setLayout((prev) => ({ ...prev, [key]: value }));
  }

  function copySnippet() {
    const snippet = `slotLeft: ${layout.slotLeft},
slotTop: ${layout.slotTop},
slotWidth: ${layout.slotWidth},
slotHeight: ${layout.slotHeight},
slotGap: ${layout.slotGap},
// photoOverscan: ${photoOverscan.toFixed(2)} (shared const, not per-template)
// verticalAnchor: ${verticalAnchor.toFixed(2)} (shared const, not per-template)`;
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  const sliders: Array<{ key: keyof TemplateLayout; label: string; min: number; max: number; step: number }> = [
    { key: "slotLeft", label: "Slot Left", min: 0, max: 200, step: 1 },
    { key: "slotTop", label: "Slot Top", min: 0, max: 300, step: 1 },
    { key: "slotWidth", label: "Slot Width", min: 100, max: 420, step: 1 },
    { key: "slotHeight", label: "Slot Height", min: 100, max: 350, step: 1 },
    { key: "slotGap", label: "Slot Gap", min: 0, max: 40, step: 1 },
  ];

  return (
    <main style={{ minHeight: "100dvh", padding: "12px 14px", maxWidth: 980, margin: "0 auto" }}>
      <div className="page-header">
        <button
          className="page-header-back"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="page-header-text">
          <div className="page-header-title">Frame Layout Admin</div>
          <div className="page-header-sub">
            {storePhotos.length === 4 ? "Using your captured photos" : "Using placeholder photo (capture 4 photos first to preview with real shots)"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(220px, 320px)", gap: 20, marginTop: 14, alignItems: "start" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: "0.85rem" }}>Template</label>
            <select
              value={templateId}
              onChange={(e) => selectTemplate(e.target.value as TemplateId)}
              style={{ width: "100%", marginTop: 6, padding: 8, borderRadius: 10, border: "1px solid var(--line)" }}
            >
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {sliders.map(({ key, label, min, max, step }) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700 }}>
                <span>{label}</span>
                <span>{layout[key]}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={layout[key]}
                onChange={(e) => updateLayout(key, Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          ))}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700 }}>
              <span>Photo Overscan</span>
              <span>{photoOverscan.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={1.5}
              step={0.01}
              value={photoOverscan}
              onChange={(e) => setPhotoOverscan(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700 }}>
              <span>Vertical Crop Anchor (0=top, 0.5=center)</span>
              <span>{verticalAnchor.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={verticalAnchor}
              onChange={(e) => setVerticalAnchor(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>canvasRender.ts snippet</span>
              <button
                type="button"
                onClick={copySnippet}
                style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre style={{ marginTop: 6, background: "#1f1a24", color: "#f4eef8", padding: 10, borderRadius: 10, fontSize: "0.72rem", overflowX: "auto" }}>
{`slotLeft: ${layout.slotLeft},
slotTop: ${layout.slotTop},
slotWidth: ${layout.slotWidth},
slotHeight: ${layout.slotHeight},
slotGap: ${layout.slotGap},`}
            </pre>
            <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 4 }}>
              Overscan/anchor are shared constants across templates in the current code
              (<code>getDefaultPhotoOverscan</code>, <code>PHOTO_VERTICAL_ANCHOR</code>) — say so if you want
              them made per-template too.
            </p>
          </div>
        </div>

        <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Live layout preview" style={{ width: "100%", borderRadius: 12, display: "block" }} />
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Rendering...</p>
          )}
        </div>
      </div>
    </main>
  );
}
