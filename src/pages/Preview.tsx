import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "../components/Header";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

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
  }

  return (
    <main className="screen">
      <Header title="Preview & Share" subtitle="Instagram feed style preview and caption tools." backTo="/edit" />

      <section className="panel preview-panel">
        <div className="ig-shell">{previewUrl ? <img src={previewUrl} alt="final preview" /> : <p>Rendering...</p>}</div>
      </section>

      <section className="panel">
        <label className="field-label" htmlFor="caption">
          Caption
        </label>
        <textarea
          id="caption"
          className="caption-box"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={4}
        />
        <Button variant="secondary" onClick={() => void handleCopyCaption()}>
          Copy Caption
        </Button>
      </section>

      <div className="bottom-cta">
        <Button onClick={() => void handleDownload()} disabled={working}>
          {working ? "Rendering PNG..." : "Download PNG (1080x1350)"}
        </Button>
      </div>
    </main>
  );
}
