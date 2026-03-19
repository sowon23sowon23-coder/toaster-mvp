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
  // 알려진 인앱브라우저 UA 패턴
  if (/KAKAOTALK|NAVER|NaverSearch|Instagram|FB_IAB|FBAN|Line\/|MicroMessenger|DaumApps|Slack|Teams|kakaotalk|twitter/i.test(ua)) return true;
  // Android WebView 공통 신호: wv 플래그 또는 Version/x.x 없이 Chrome만 있는 경우
  if (/Android/i.test(ua) && /wv\b/.test(ua)) return true;
  return false;
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

  function closeSaveOverlay() {
    setSaveOverlayUrl(null);
  }

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
      } else if (isRestrictedWebView()) {
        // 카카오톡 등 인앱브라우저: Web Share 먼저 시도, 실패 시 이미지 직접 표시
        const file = new File([blob], filename, { type: "image/png" });
        let shared = false;
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            setSaveMessage("갤러리 앱에서 저장을 선택하세요.");
            shared = true;
          }
        } catch (err) {
          if ((err as DOMException).name === "AbortError") shared = true;
        }
        if (!shared) {
          // 공유 불가 → data URL로 변환 후 전체화면 표시 (길게 눌러 저장)
          // blob URL은 KakaoTalk WebView에서 길게 눌러도 저장이 안 될 수 있음
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setSaveOverlayUrl(dataUrl);
        }
      } else if (isAndroidDevice()) {
        const file = new File([blob], filename, { type: "image/png" });
        let shared = false;
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            setSaveMessage("갤러리 앱에서 저장을 선택하세요.");
            shared = true;
          }
        } catch (err) {
          if ((err as DOMException).name === "AbortError") shared = true; // 사용자가 직접 닫음
        }
        if (!shared) {
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
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setSaveMessage(`저장에 실패했습니다. (${detail})`);
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

      {saveOverlayUrl && (
        <div className="save-overlay" onClick={closeSaveOverlay}>
          <div className="save-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <p className="save-overlay-hint">이미지를 <strong>길게 눌러</strong> 저장하세요</p>
            <img src={saveOverlayUrl} alt="저장할 이미지" className="save-overlay-img" />
            <button type="button" className="save-overlay-close" onClick={closeSaveOverlay}>
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
