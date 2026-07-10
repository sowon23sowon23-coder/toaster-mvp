import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FILTERS, FONTS, TEMPLATES, TemplateId } from "../lib/assets";
import { captureVideoFrame, startPreferredCamera, stopCamera } from "../lib/camera";
import {
  TemplateLayout,
  getDefaultPhotoOverscan,
  getDefaultVerticalAnchor,
  getTemplateLayout,
  renderPhotoboothImage,
} from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

export default function Admin() {
  const navigate = useNavigate();
  const storePhotos = usePhotoboothStore((state) => state.photos);

  const [templateId, setTemplateId] = useState<TemplateId>(TEMPLATES[0].id);
  const [layout, setLayout] = useState<TemplateLayout>(() => getTemplateLayout(TEMPLATES[0].id));
  const [photoOverscan, setPhotoOverscan] = useState(() => getDefaultPhotoOverscan(TEMPLATES[0].id));
  const [verticalAnchor, setVerticalAnchor] = useState(() => getDefaultVerticalAnchor(TEMPLATES[0].id));

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0],
    [templateId],
  );

  useEffect(() => {
    return () => stopCamera(streamRef.current);
  }, []);

  useEffect(() => {
    if (!capturedPhoto) {
      setCapturedPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(capturedPhoto);
    setCapturedPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capturedPhoto]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await startPreferredCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready.");
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      setCameraActive(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Camera access failed.");
    }
  }

  async function takePhoto() {
    if (!videoRef.current) return;
    try {
      const blob = await captureVideoFrame(videoRef.current);
      setCapturedPhoto(blob);
      stopCamera(streamRef.current);
      streamRef.current = null;
      setCameraActive(false);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Capture failed.");
    }
  }

  function retakePhoto() {
    setCapturedPhoto(null);
    void startCamera();
  }

  function selectTemplate(id: TemplateId) {
    setTemplateId(id);
    setLayout(getTemplateLayout(id));
    setPhotoOverscan(getDefaultPhotoOverscan(id));
    setVerticalAnchor(getDefaultVerticalAnchor(id));
  }

  const photos = capturedPhoto
    ? [capturedPhoto, capturedPhoto, capturedPhoto, capturedPhoto]
    : storePhotos.length === 4
      ? storePhotos
      : null;

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
    const snippet = `// ${templateId}
slotLeft: ${layout.slotLeft},
slotTop: ${layout.slotTop},
slotWidth: ${layout.slotWidth},
slotHeight: ${layout.slotHeight},
slotGap: ${layout.slotGap},
// add to PHOTO_OVERSCAN_BY_TEMPLATE: ${templateId}: ${photoOverscan.toFixed(2)},
// add to VERTICAL_ANCHOR_BY_TEMPLATE: ${templateId}: ${verticalAnchor.toFixed(2)},`;
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
            {capturedPhoto
              ? "Using the photo you just took"
              : storePhotos.length === 4
                ? "Using your captured photos"
                : "Take a photo below to preview with a real shot"}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontWeight: 700, fontSize: "0.85rem" }}>Test Photo</label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 160, aspectRatio: "4 / 5", background: "#000", borderRadius: 10, overflow: "hidden", position: "relative" }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraActive ? "block" : "none" }}
            />
            {!cameraActive && capturedPhotoUrl && (
              <img
                src={capturedPhotoUrl}
                alt="Captured test photo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {!cameraActive && !capturedPhoto && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "0.7rem", textAlign: "center", padding: 8 }}>
                No camera yet
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!cameraActive && !capturedPhoto && (
              <button
                type="button"
                onClick={() => void startCamera()}
                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", fontWeight: 700, cursor: "pointer" }}
              >
                카메라 켜기
              </button>
            )}
            {cameraActive && (
              <button
                type="button"
                onClick={() => void takePhoto()}
                style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "var(--primary, #d1477a)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                촬영
              </button>
            )}
            {capturedPhoto && (
              <button
                type="button"
                onClick={retakePhoto}
                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", fontWeight: 700, cursor: "pointer" }}
              >
                다시 찍기
              </button>
            )}
            {cameraError && (
              <p style={{ fontSize: "0.72rem", color: "#c0392b", maxWidth: 220 }}>{cameraError}</p>
            )}
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
{`// ${templateId}
slotLeft: ${layout.slotLeft},
slotTop: ${layout.slotTop},
slotWidth: ${layout.slotWidth},
slotHeight: ${layout.slotHeight},
slotGap: ${layout.slotGap},
// PHOTO_OVERSCAN_BY_TEMPLATE.${templateId} = ${photoOverscan.toFixed(2)}
// VERTICAL_ANCHOR_BY_TEMPLATE.${templateId} = ${verticalAnchor.toFixed(2)}`}
            </pre>
            <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 4 }}>
              Overscan/anchor now support per-template overrides in
              <code> PHOTO_OVERSCAN_BY_TEMPLATE</code>/<code>VERTICAL_ANCHOR_BY_TEMPLATE</code> in
              canvasRender.ts — paste these lines there for this template.
            </p>
          </div>
        </div>

        <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          {!photos ? (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>
              위에서 사진을 한 장 찍으면 미리보기가 나타납니다.
            </p>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Live layout preview" style={{ width: "100%", borderRadius: 12, display: "block" }} />
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Rendering...</p>
          )}
        </div>
      </div>
    </main>
  );
}
