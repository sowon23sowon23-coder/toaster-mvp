import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import StickerCanvasOverlay from "../components/StickerCanvasOverlay";
import Button from "../components/Button";
import { FILTERS, FONTS, STICKER_ASSETS, TEMPLATES } from "../lib/assets";
import { renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

type EditTab = "filter" | "sticker" | "text";

const FILTER_SWATCHES: Record<string, string> = {
  none: "linear-gradient(135deg, #f9c6d4, #fde8c0, #c8eafd)",
  soft: "linear-gradient(135deg, #fde8d8, #fce4e9, #fdf0e0)",
  vivid: "linear-gradient(135deg, #f472b6, #fb923c, #a78bfa)",
  cool: "linear-gradient(135deg, #86efac, #67e8f9, #818cf8)",
  mono: "linear-gradient(135deg, #d1d5db, #9ca3af, #6b7280)",
};

const TAB_ICONS: Record<EditTab, string> = {
  filter: "🎨",
  sticker: "✨",
  text: "✍️",
};

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
    () => TEMPLATES.find((item) => item.id === selectedTemplateId) ?? TEMPLATES[0],
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

  return (
    <main className="edit-screen">
      <div className="page-header">
        <button
          className="page-header-back"
          type="button"
          onClick={() => navigate("/capture")}
          aria-label="뒤로"
        >
          ←
        </button>
        <div className="page-header-text">
          <div className="page-header-title">Edit Your Booth</div>
          <div className="page-header-sub">필터 · 스티커 · 텍스트</div>
        </div>
      </div>

      <div className="edit-preview-wrap">
        <StickerCanvasOverlay
          previewSrc={previewUrl}
          stickers={stickers}
          selectedStickerId={selectedStickerId}
          onSelectSticker={setSelectedStickerId}
          onMoveSticker={moveSticker}
        />
      </div>

      <div className="edit-controls">
        {/* Tab Bar */}
        <div className="edit-tab-bar" role="tablist">
          {(["filter", "sticker", "text"] as EditTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`edit-tab-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="edit-tab-icon">{TAB_ICONS[tab]}</span>
              <span className="edit-tab-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="edit-panel-scroll">
          {/* Filter Panel */}
          {activeTab === "filter" && (
            <section className="panel edit-panel">
              <p className="edit-panel-hint">탭하여 필터를 적용하세요</p>
              <div className="filter-grid">
                {FILTERS.map((item) => {
                  const isActive = item.id === selectedFilterId;
                  return (
                    <button
                      key={item.id}
                      className={`filter-card${isActive ? " active" : ""}`}
                      type="button"
                      onClick={() => setFilter(item.id)}
                    >
                      <div
                        className="filter-swatch"
                        style={{ background: FILTER_SWATCHES[item.id] }}
                      />
                      <span className="filter-name">{item.name}</span>
                      {isActive && <span className="filter-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Sticker Panel */}
          {activeTab === "sticker" && (
            <section className="panel edit-panel">
              <p className="edit-panel-hint">스티커를 탭해서 추가하세요</p>
              <div className="sticker-grid">
                {STICKER_ASSETS.map((src) => (
                  <button key={src} className="sticker-thumb-v2" type="button" onClick={() => addSticker(src)}>
                    <img src={src} alt="sticker" />
                  </button>
                ))}
              </div>
              {selectedSticker && (
                <div className="sticker-editor">
                  <div className="sticker-editor-header">
                    <span className="sticker-editor-title">스티커 편집</span>
                    <button
                      className="sticker-delete-btn"
                      type="button"
                      onClick={() => { removeSticker(selectedSticker.id); setSelectedStickerId(null); }}
                    >
                      🗑 삭제
                    </button>
                  </div>
                  <div className="scale-row">
                    <span className="scale-icon">🔍</span>
                    <input
                      id="scale"
                      type="range"
                      className="scale-slider"
                      min={0.08}
                      max={0.42}
                      step={0.01}
                      value={selectedSticker.scale}
                      onChange={(event) => scaleSticker(selectedSticker.id, Number(event.target.value))}
                    />
                    <span className="scale-icon">🔎</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Text Panel */}
          {activeTab === "text" && (
            <section className="panel edit-panel">
              <div className="text-input-wrapper">
                <input
                  id="lineText"
                  maxLength={30}
                  value={textLine}
                  onChange={(event) => setTextLine(event.target.value)}
                  placeholder="Sweet moment! 🍦"
                  className="text-input-v2"
                  style={{ fontFamily: font.cssFamily }}
                />
                <span className="char-counter">{textLine.length}/30</span>
              </div>
              <p className="edit-panel-hint" style={{ marginTop: 12 }}>폰트 선택</p>
              <div className="font-grid">
                {FONTS.map((item) => {
                  const isActive = item.id === textFont;
                  return (
                    <button
                      key={item.id}
                      className={`font-card${isActive ? " active" : ""}`}
                      onClick={() => setTextFont(item.id)}
                      type="button"
                      style={{ fontFamily: item.cssFamily }}
                    >
                      <span className="font-preview">Aa</span>
                      <span className="font-name">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>{/* edit-panel-scroll */}
      </div>{/* edit-controls */}

      <div className="edit-bottom-cta">
        <Button onClick={() => navigate("/preview")}>Next: Preview →</Button>
      </div>
    </main>
  );
}
