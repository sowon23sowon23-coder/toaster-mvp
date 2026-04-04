import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { FILTERS, FONTS, TEMPLATES } from "../lib/assets";
import { buildDownloadName, renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

const isRestrictedWebView = () => {
  const ua = navigator.userAgent;
  if (
    /KAKAOTALK|NAVER|NaverSearch|Instagram|FB_IAB|FBAN|Line\/|MicroMessenger|DaumApps|Slack|Teams|kakaotalk|twitter/i.test(
      ua,
    )
  ) {
    return true;
  }

  return /Android/i.test(ua) && /wv\b/.test(ua);
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

export default function Preview() {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullResBlob, setFullResBlob] = useState<Blob | null>(null);
  const [working, setWorking] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveOverlayUrl, setSaveOverlayUrl] = useState<string | null>(null);

  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const photos = usePhotoboothStore((state) => state.photos);
  const selectedFilterId = usePhotoboothStore((state) => state.selectedFilterId);
  const stickers = usePhotoboothStore((state) => state.stickers);
  const textLine = usePhotoboothStore((state) => state.textLine);
  const textFont = usePhotoboothStore((state) => state.textFont);

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
    setFullResBlob(null);

    void (async () => {
      const previewBlob = await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers,
        textLine,
        textFont: font,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 240,
        height: 684,
      });

      if (canceled) return;
      const url = URL.createObjectURL(previewBlob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      const highResBlob = await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers,
        textLine,
        textFont: font,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 480,
        height: 1367,
      });

      if (canceled) return;
      setFullResBlob(highResBlob);
    })();

    return () => {
      canceled = true;
    };
  }, [template, photos, filter, stickers, textLine, font]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function closeSaveOverlay() {
    setSaveOverlayUrl(null);
  }

  if (photos.length !== 4) return <Navigate to="/capture" replace />;

  async function handleDownload() {
    setWorking(true);
    setSaveMessage(null);
    try {
      const blob = fullResBlob ?? await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers,
        textLine,
        textFont: font,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 480,
        height: 1367,
      });

      const filename = buildDownloadName();
      const pickerWindow = window as SaveFilePickerWindow;

      if (pickerWindow.showSaveFilePicker && !isIosDevice() && !isAndroidDevice()) {
        try {
          const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setSaveMessage("Saved to your device.");
          trackEvent("download_clicked");
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return;
        }
      }

      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          setSaveMessage("Select Save in your gallery app.");
          trackEvent("download_clicked");
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return;
        }
      }

      if (isRestrictedWebView() || isIosDevice()) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setSaveOverlayUrl(dataUrl);
        setSaveMessage("If sharing is blocked, open this page in Safari or Chrome.");
        trackEvent("download_clicked");
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setSaveMessage("Download started.");
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);

      trackEvent("download_clicked");
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setSaveMessage(`Save failed. (${detail})`);
      console.error("Download failed:", err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="preview-page">
      <div className="page-header">
        <button
          className="page-header-back"
          type="button"
          onClick={() => navigate("/edit")}
          aria-label="Back"
        >
          {"<"}
        </button>
        <div className="page-header-text">
          <div className="page-header-title">Preview & Share</div>
          <div className="page-header-sub">Save your finished 4-cut</div>
        </div>
      </div>

      <div className="preview-image-wrap preview-image-wrap-only">
        <div className="preview-image-shell">
          {previewUrl ? (
            <img src={previewUrl} alt="Final 4-cut preview" />
          ) : (
            <p className="preview-rendering-text">Rendering...</p>
          )}
        </div>
      </div>

      <div className="preview-bottom-cta">
        <Button onClick={() => void handleDownload()} disabled={working || !fullResBlob}>
          {working ? "Saving..." : !fullResBlob ? "Preparing..." : (
            <span className="btn-save-label">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save Photo
            </span>
          )}
        </Button>
        {saveMessage && (
          <div className="preview-save-toast">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {saveMessage}
          </div>
        )}
        <p className="preview-save-hint">Long press the image to save it.</p>
      </div>

      {saveOverlayUrl && (
        <div className="save-sheet-backdrop" onClick={closeSaveOverlay}>
          <div className="save-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="save-sheet-header">
              <span className="save-sheet-title">Save your photo</span>
              <button
                type="button"
                className="save-sheet-x"
                onClick={closeSaveOverlay}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <p className="save-sheet-hint">
              <strong>Long press to save.</strong> Press and hold the full image below.
            </p>
            <div className="save-sheet-img-wrap">
              <img src={saveOverlayUrl} alt="Save this image" className="save-sheet-img" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
