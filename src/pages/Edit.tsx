import { ReactNode, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import StickerCanvasOverlay from "../components/StickerCanvasOverlay";
import { FILTERS, FONTS, STICKER_ASSETS, TEMPLATES } from "../lib/assets";
import { renderPhotoboothImage } from "../lib/canvasRender";
import { usePhotoboothStore } from "../store/usePhotoboothStore";

type EditTab = "filter" | "sticker";

const FILTER_SWATCHES: Record<string, string> = {
  none: "linear-gradient(135deg, #f9c6d4, #fde8c0, #c8eafd)",
  soft: "linear-gradient(135deg, #fde8d8, #fce4e9, #fdf0e0)",
  vivid: "linear-gradient(135deg, #f472b6, #fb923c, #a78bfa)",
  cool: "linear-gradient(135deg, #86efac, #67e8f9, #818cf8)",
  mono: "linear-gradient(135deg, #d1d5db, #9ca3af, #6b7280)",
};

const TAB_ICONS: Record<EditTab, ReactNode> = {
  filter: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  sticker: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3l1.8 3.8L18 8.5l-3.2 2.9.8 4.2L12 13.7 8.4 15.6l.8-4.2L6 8.5l4.2-1.7L12 3z"
        fill="currentColor"
      />
    </svg>
  ),
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
  const transformSticker = usePhotoboothStore((state) => state.transformSticker);
  const removeSticker = usePhotoboothStore((state) => state.removeSticker);
  const setTextLine = usePhotoboothStore((state) => state.setTextLine);

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
    if (textLine) {
      setTextLine("");
    }
  }, [setTextLine, textLine]);

  useEffect(() => {
    if (photos.length !== 4) return;

    let canceled = false;
    void (async () => {
      const blob = await renderPhotoboothImage({
        photos,
        template,
        filter,
        stickers: [],
        textLine: "",
        textFont: font,
        watermarkSrc: "/brand/yogurtland_mark.png",
        width: 240,
        height: 684,
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
  }, [template, photos, filter, stickers, font]);

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
          aria-label="Back"
        >
          {"<"}
        </button>
        <div className="page-header-text">
          <div className="page-header-title">Edit Your Booth</div>
          <div className="page-header-sub">Choose a filter or place stickers</div>
        </div>
      </div>

      <div className="edit-workspace">
        <div className="edit-controls">
          <div className="edit-tab-bar" role="tablist">
            {(["filter", "sticker"] as EditTab[]).map((tab) => (
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
            {activeTab === "filter" && (
              <section className="panel edit-panel">
                <p className="edit-panel-hint">Tap to apply a filter</p>
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
                        <div className="filter-swatch" style={{ background: FILTER_SWATCHES[item.id] }} />
                        <span className="filter-name">{item.name}</span>
                        {isActive && <span className="filter-check">OK</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "sticker" && (
              <section className="panel edit-panel">
                <p className="edit-panel-hint">Tap a sticker to add it</p>
                <div className="sticker-grid">
                  {STICKER_ASSETS.map((src) => (
                    <button
                      key={src}
                      className="sticker-thumb-v2"
                      type="button"
                      onClick={() => addSticker(src)}
                    >
                      <img src={src} alt="sticker" />
                    </button>
                  ))}
                </div>
                {selectedSticker && (
                  <div className="sticker-editor">
                    <div className="sticker-editor-header">
                      <span className="sticker-editor-title">Edit Sticker</span>
                      <button
                        className="sticker-delete-btn"
                        type="button"
                        onClick={() => {
                          removeSticker(selectedSticker.id);
                          setSelectedStickerId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <p className="gesture-hint">
                      Drag with one finger. Use two fingers to resize and rotate.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="edit-actions">
            <Button onClick={() => navigate("/preview")}>Next: Preview</Button>
          </div>
        </div>

        <div className="edit-preview-wrap">
          <StickerCanvasOverlay
            previewSrc={previewUrl}
            stickers={stickers}
            selectedStickerId={selectedStickerId}
            onSelectSticker={setSelectedStickerId}
            onTransformSticker={(id, updates) => transformSticker(id, updates)}
          />
        </div>
      </div>
    </main>
  );
}
