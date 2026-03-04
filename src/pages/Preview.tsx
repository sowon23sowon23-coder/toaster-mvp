import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { FILTERS, FONTS, TEMPLATES } from "../lib/assets";
import { buildDownloadName, renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temp = document.createElement("textarea");
  temp.value = value;
  temp.setAttribute("readonly", "true");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
}

export default function Preview() {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const photos = usePhotoboothStore((state) => state.photos);
  const selectedFilterId = usePhotoboothStore((state) => state.selectedFilterId);
  const stickers = usePhotoboothStore((state) => state.stickers);
  const textLine = usePhotoboothStore((state) => state.textLine);
  const textFont = usePhotoboothStore((state) => state.textFont);
  const caption = usePhotoboothStore((state) => state.caption);
  const setCaption = usePhotoboothStore((state) => state.setCaption);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === selectedTemplateId) ?? TEMPLATES[0],
    [selectedTemplateId],
  );
  const filter = useMemo(
    () => FILTERS.find((item) => item.id === selectedFilterId) ?? FILTERS[0],
    [selectedFilterId],
  );
  const font = useMemo(() => FONTS.find((item) => item.id === textFont) ?? FONTS[0], [textFont]);

  useEffect(() => {
    if (photos.length !== 4) return;
    let canceled = false;

    void (async () => {
      const blob = await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers,
        textLine,
        textFont: font,
        frameSrc: template.frameSrc,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 540,
        height: 675,
      });

      if (canceled) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    })();

    return () => { canceled = true; };
  }, [template, photos, filter, stickers, textLine, font]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  if (photos.length !== 4) return <Navigate to="/capture" replace />;

  async function handleDownload() {
    setWorking(true);
    try {
      const blob = await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers,
        textLine,
        textFont: font,
        frameSrc: template.frameSrc,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 1080,
        height: 1350,
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildDownloadName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      trackEvent("download_clicked");
    } finally {
      setWorking(false);
    }
  }

  async function handleCopyCaption() {
    await copyText(caption);
    trackEvent("caption_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="preview-page">
      {/* Header */}
      <div className="page-header">
        <button
          className="page-header-back"
          type="button"
          onClick={() => navigate("/edit")}
          aria-label="뒤로"
        >
          ←
        </button>
        <div className="page-header-text">
          <div className="page-header-title">Preview & Share</div>
          <div className="page-header-sub">완성된 4컷을 저장하세요</div>
        </div>
      </div>

      {/* Preview image */}
      <div className="preview-image-wrap">
        <div className="preview-image-shell">
          {previewUrl ? (
            <img src={previewUrl} alt="완성된 4컷 사진" />
          ) : (
            <p className="preview-rendering-text">렌더링 중... ✨</p>
          )}
        </div>
      </div>

      {/* Scrollable content: caption */}
      <div className="preview-content-scroll">
        <div className="panel caption-card">
          <label className="caption-label" htmlFor="caption">
            📝 캡션
          </label>
          <textarea
            id="caption"
            className="caption-textarea"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={4}
          />
          <button
            className="caption-copy-btn"
            type="button"
            onClick={() => void handleCopyCaption()}
          >
            {copied ? "✓ 복사됨!" : "📋 캡션 복사"}
          </button>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="preview-bottom-cta">
        <Button onClick={() => void handleDownload()} disabled={working}>
          {working ? "렌더링 중..." : "⬇ PNG 저장 (1080×1350)"}
        </Button>
      </div>
    </main>
  );
}
