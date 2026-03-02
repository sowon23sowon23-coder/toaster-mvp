import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import StickerCanvasOverlay from "../components/StickerCanvasOverlay";
import Button from "../components/Button";
import { FILTERS, FONTS, STICKER_ASSETS, TEMPLATES } from "../lib/assets";
import { renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

type EditTab = "filter" | "sticker" | "text";

export default function Edit() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EditTab>("filter");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedTemplateId = usePhotoboothStore((state) => state.selectedTemplateId);
  const photos = usePhotoboothStore((state) => state.photos);
  const selectedFilterId = usePhotoboothStore((state) => state.selectedFilterId);
  const stickers = usePhotoboothStore((state) => state.stickers);
  const textLine = usePhotoboothStore((state) => state.textLine);
  const textFont = usePhotoboothStore((state) => state.textFont);
  const setFilter = usePhotoboothStore((state) => state.setFilter);
  const addSticker = usePhotoboothStore((state) => state.addSticker);
  const moveSticker = usePhotoboothStore((state) => state.moveSticker);
  const scaleSticker = usePhotoboothStore((state) => state.scaleSticker);
  const removeSticker = usePhotoboothStore((state) => state.removeSticker);
  const setTextLine = usePhotoboothStore((state) => state.setTextLine);
  const setTextFont = usePhotoboothStore((state) => state.setTextFont);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );
  const filter = useMemo(
    () => FILTERS.find((item) => item.id === selectedFilterId) ?? FILTERS[0],
    [selectedFilterId],
  );
  const font = useMemo(() => FONTS.find((item) => item.id === textFont) ?? FONTS[0], [textFont]);
  const selectedSticker = useMemo(
    () => stickers.find((sticker) => sticker.id === selectedStickerId) ?? null,
    [selectedStickerId, stickers],
  );

  useEffect(() => {
    if (!template || photos.length !== 4) return;

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

  if (!template) return <Navigate to="/templates" replace />;
  if (photos.length !== 4) return <Navigate to="/capture" replace />;

  return (
    <main className="screen">
      <Header title="Edit Your Booth" subtitle="Filter, stickers, and one-line text." backTo="/capture" />

      <StickerCanvasOverlay
        previewSrc={previewUrl}
        stickers={stickers}
        selectedStickerId={selectedStickerId}
        onSelectSticker={setSelectedStickerId}
        onMoveSticker={moveSticker}
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { id: "filter", label: "Filter" },
          { id: "sticker", label: "Sticker" },
          { id: "text", label: "Text" },
        ]}
      />

      {activeTab === "filter" && (
        <section className="panel control-panel">
          <div className="chip-grid">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                className={`chip-btn${item.id === selectedFilterId ? " active" : ""}`}
                type="button"
                onClick={() => setFilter(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "sticker" && (
        <section className="panel control-panel">
          <div className="sticker-picker">
            {STICKER_ASSETS.map((src) => (
              <button key={src} className="sticker-thumb" type="button" onClick={() => addSticker(src)}>
                <img src={src} alt="sticker option" />
              </button>
            ))}
          </div>
          {selectedSticker && (
            <div className="sticker-controls">
              <label htmlFor="scale">Scale</label>
              <input
                id="scale"
                type="range"
                min={0.08}
                max={0.42}
                step={0.01}
                value={selectedSticker.scale}
                onChange={(event) => scaleSticker(selectedSticker.id, Number(event.target.value))}
              />
              <Button variant="danger" onClick={() => removeSticker(selectedSticker.id)}>
                Delete Sticker
              </Button>
            </div>
          )}
        </section>
      )}

      {activeTab === "text" && (
        <section className="panel control-panel">
          <label className="field-label" htmlFor="lineText">
            Caption Text (max 30 chars)
          </label>
          <input
            id="lineText"
            maxLength={30}
            value={textLine}
            onChange={(event) => setTextLine(event.target.value)}
            placeholder="Sweet moment!"
            className="text-input"
          />
          <div className="chip-grid">
            {FONTS.map((item) => (
              <button
                key={item.id}
                className={`chip-btn${item.id === textFont ? " active" : ""}`}
                onClick={() => setTextFont(item.id)}
                type="button"
                style={{ fontFamily: item.cssFamily }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="bottom-cta">
        <Button onClick={() => navigate("/preview")}>Next: Preview</Button>
      </div>
    </main>
  );
}
