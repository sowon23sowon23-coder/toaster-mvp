import { create } from "zustand";
import { DEFAULT_CAPTION, FilterId, FontId, TemplateId } from "../lib/assets";

export type StickerItem = {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

type PhotoboothState = {
  selectedTemplateId: TemplateId | null;
  photos: Blob[];
  selectedFilterId: FilterId;
  stickers: StickerItem[];
  textLine: string;
  textFont: FontId;
  caption: string;
  setTemplate: (id: TemplateId) => void;
  setPhotos: (photos: Blob[]) => void;
  resetPhotos: () => void;
  setFilter: (filterId: FilterId) => void;
  addSticker: (src: string) => void;
  moveSticker: (id: string, x: number, y: number) => void;
  scaleSticker: (id: string, scale: number) => void;
  rotateSticker: (id: string, rotation: number) => void;
  transformSticker: (id: string, updates: Partial<Pick<StickerItem, "x" | "y" | "scale" | "rotation">>) => void;
  removeSticker: (id: string) => void;
  setTextLine: (value: string) => void;
  setTextFont: (value: FontId) => void;
  setCaption: (value: string) => void;
  resetEdit: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const usePhotoboothStore = create<PhotoboothState>((set) => ({
  selectedTemplateId: "signature",
  photos: [],
  selectedFilterId: "none",
  stickers: [],
  textLine: "",
  textFont: "sans",
  caption: DEFAULT_CAPTION,
  setTemplate: (id) => set({ selectedTemplateId: id }),
  setPhotos: (photos) => set({ photos }),
  resetPhotos: () => set({ photos: [] }),
  setFilter: (selectedFilterId) => set({ selectedFilterId }),
  addSticker: (src) =>
    set((state) => ({
      stickers: [
        ...state.stickers,
        {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          src,
          x: 0.5,
          y: 0.5,
          scale: 0.18,
          rotation: 0,
        },
      ],
    })),
  moveSticker: (id, x, y) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id
          ? { ...sticker, x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) }
          : sticker,
      ),
    })),
  scaleSticker: (id, scale) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id ? { ...sticker, scale: clamp(scale, 0.08, 0.42) } : sticker,
      ),
    })),
  rotateSticker: (id, rotation) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id ? { ...sticker, rotation } : sticker,
      ),
    })),
  transformSticker: (id, updates) =>
    set((state) => ({
      stickers: state.stickers.map((sticker) =>
        sticker.id === id
          ? {
              ...sticker,
              x: updates.x === undefined ? sticker.x : clamp(updates.x, 0.05, 0.95),
              y: updates.y === undefined ? sticker.y : clamp(updates.y, 0.05, 0.95),
              scale: updates.scale === undefined ? sticker.scale : clamp(updates.scale, 0.08, 0.42),
              rotation: updates.rotation === undefined ? sticker.rotation : updates.rotation,
            }
          : sticker,
      ),
    })),
  removeSticker: (id) =>
    set((state) => ({
      stickers: state.stickers.filter((sticker) => sticker.id !== id),
    })),
  setTextLine: (textLine) => set({ textLine: textLine.slice(0, 30) }),
  setTextFont: (textFont) => set({ textFont }),
  setCaption: (caption) => set({ caption }),
  resetEdit: () =>
    set({
      selectedFilterId: "none",
      stickers: [],
      textLine: "",
      textFont: "sans",
    }),
}));
