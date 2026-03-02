import { PointerEvent, useRef } from "react";
import { StickerItem } from "../store/usePhotoboothStore";

type StickerCanvasOverlayProps = {
  previewSrc: string | null;
  stickers: StickerItem[];
  selectedStickerId: string | null;
  onSelectSticker: (id: string | null) => void;
  onMoveSticker: (id: string, x: number, y: number) => void;
};

type DragState = {
  id: string;
};

export default function StickerCanvasOverlay({
  previewSrc,
  stickers,
  selectedStickerId,
  onSelectSticker,
  onMoveSticker,
}: StickerCanvasOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const updatePosition = (event: PointerEvent<HTMLDivElement>, stickerId: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onMoveSticker(stickerId, x, y);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, stickerId: string) => {
    event.preventDefault();
    dragRef.current = { id: stickerId };
    onSelectSticker(stickerId);
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePosition(event, stickerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    updatePosition(event, dragRef.current.id);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="preview-stage"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={() => onSelectSticker(null)}
    >
      {previewSrc ? <img className="preview-image" src={previewSrc} alt="Composed preview" /> : null}
      {stickers.map((sticker) => (
        <div
          key={sticker.id}
          className={`sticker${selectedStickerId === sticker.id ? " selected" : ""}`}
          style={{
            left: `${sticker.x * 100}%`,
            top: `${sticker.y * 100}%`,
            width: `${sticker.scale * 100}%`,
          }}
          onPointerDown={(event) => onPointerDown(event, sticker.id)}
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onSelectSticker(sticker.id);
          }}
        >
          <img src={sticker.src} alt="sticker" draggable={false} />
        </div>
      ))}
    </div>
  );
}
