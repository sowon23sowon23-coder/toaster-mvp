import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { FILTERS, FONTS, TEMPLATES } from "../lib/assets";
import { buildDownloadName, renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";
import { trackEvent } from "../lib/analytics";

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

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
      // 프리뷰 렌더링
      const previewBlob = await renderPhotoboothImage({
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
      const url = URL.createObjectURL(previewBlob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      // 고해상도 미리 렌더링 (클릭 즉시 다운로드 가능하도록)
      const highResBlob = await renderPhotoboothImage({
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

  if (photos.length !== 4) return <Navigate to="/capture" replace />;

  async function handleDownload() {
    setWorking(true);
    setSaveMessage(null);
    try {
      // 미리 렌더된 고해상도 blob 사용, 없으면 즉시 렌더링
      const blob = fullResBlob ?? await renderPhotoboothImage({
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

      const filename = buildDownloadName();
      const pickerWindow = window as SaveFilePickerWindow;

      if (pickerWindow.showSaveFilePicker) {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "PNG image",
              accept: { "image/png": [".png"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setSaveMessage("Saved to your device.");
      } else if (isAndroidDevice()) {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: filename });
            setSaveMessage("이미지를 갤러리에 저장하세요.");
          } catch (err) {
            if ((err as DOMException).name !== "AbortError") {
              // 공유가 취소되지 않은 경우 anchor 다운로드로 폴백
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = filename;
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              setSaveMessage("다운로드가 시작되었습니다. 갤러리 앱에서 확인하세요.");
              window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
            }
          }
        } else {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setSaveMessage("다운로드가 시작되었습니다. 갤러리 앱에서 확인하세요.");
          window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        if (isIosDevice()) {
          setSaveMessage("iPhone may block direct downloads. If nothing downloads, open in Safari and use Share > Save to Photos.");
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          setSaveMessage("Download started.");
          window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        }
      }

      trackEvent("download_clicked");
    } catch (err) {
      setSaveMessage("저장에 실패했습니다. 다시 시도해 주세요.");
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
          ←
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
          {working ? "Saving..." : !fullResBlob ? "Preparing..." : "Save PNG (1080x1350)"}
        </Button>
        {saveMessage && <p className="preview-save-message">{saveMessage}</p>}
      </div>
    </main>
  );
}
