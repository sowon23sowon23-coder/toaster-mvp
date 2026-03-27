import { PointerEvent, useRef } from "react";
import { StickerItem } from "../store/usePhotoboothStore";

type StickerCanvasOverlayProps = {
  previewSrc: string | null;
  stickers: StickerItem[];
  selectedStickerId: string | null;
  onSelectSticker: (id: string | null) => void;
  onTransformSticker: (
    id: string,
    updates: Partial<Pick<StickerItem, "x" | "y" | "scale" | "rotation">>,
  ) => void;
};

type PointerData = {
  x: number;
  y: number;
};

type GestureState = {
  id: string;
  startSticker: StickerItem;
  pointers: Map<number, PointerData>;
  startPointer?: PointerData;
  startCenter?: PointerData;
  startDistance?: number;
  startAngle?: number;
};

function getDistance(a: PointerData, b: PointerData) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getAngle(a: PointerData, b: PointerData) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function getCenter(a: PointerData, b: PointerData): PointerData {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export default function StickerCanvasOverlay({
  previewSrc,
  stickers,
  selectedStickerId,
  onSelectSticker,
  onTransformSticker,
}: StickerCanvasOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);

  const getNormalizedPoint = (event: PointerEvent<HTMLDivElement>): PointerData | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const beginSinglePointerGesture = (sticker: StickerItem, point: PointerData, pointerId: number) => {
    gestureRef.current = {
      id: sticker.id,
      startSticker: sticker,
      pointers: new Map([[pointerId, point]]),
      startPointer: point,
    };
  };

  const beginMultiPointerGesture = (sticker: StickerItem, pointers: Map<number, PointerData>) => {
    const [first, second] = Array.from(pointers.values());
    if (!first || !second) return;

    gestureRef.current = {
      id: sticker.id,
      startSticker: sticker,
      pointers,
      startCenter: getCenter(first, second),
      startDistance: getDistance(first, second),
      startAngle: getAngle(first, second),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, sticker: StickerItem) => {
    event.preventDefault();
    event.stopPropagation();

    const point = getNormalizedPoint(event);
    if (!point) return;

    onSelectSticker(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);

    const currentGesture = gestureRef.current;
    if (!currentGesture || currentGesture.id !== sticker.id) {
      beginSinglePointerGesture(sticker, point, event.pointerId);
      return;
    }

    const nextPointers = new Map(currentGesture.pointers);
    nextPointers.set(event.pointerId, point);

    if (nextPointers.size >= 2) {
      beginMultiPointerGesture(sticker, nextPointers);
      return;
    }

    gestureRef.current = {
      ...currentGesture,
      pointers: nextPointers,
      startPointer: point,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    const point = getNormalizedPoint(event);
    if (!point || !gesture.pointers.has(event.pointerId)) return;

    const nextPointers = new Map(gesture.pointers);
    nextPointers.set(event.pointerId, point);
    gesture.pointers = nextPointers;

    if (nextPointers.size === 1 && gesture.startPointer) {
      const deltaX = point.x - gesture.startPointer.x;
      const deltaY = point.y - gesture.startPointer.y;

      onTransformSticker(gesture.id, {
        x: gesture.startSticker.x + deltaX,
        y: gesture.startSticker.y + deltaY,
      });
      return;
    }

    if (nextPointers.size >= 2 && gesture.startCenter && gesture.startDistance && gesture.startAngle !== undefined) {
      const [first, second] = Array.from(nextPointers.values());
      if (!first || !second) return;

      const center = getCenter(first, second);
      const distance = getDistance(first, second);
      const angle = getAngle(first, second);
      const distanceRatio = distance / gesture.startDistance;
      const angleDelta = ((angle - gesture.startAngle) * 180) / Math.PI;

      onTransformSticker(gesture.id, {
        x: gesture.startSticker.x + (center.x - gesture.startCenter.x),
        y: gesture.startSticker.y + (center.y - gesture.startCenter.y),
        scale: gesture.startSticker.scale * distanceRatio,
        rotation: gesture.startSticker.rotation + angleDelta,
      });
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return;

    const nextPointers = new Map(gesture.pointers);
    nextPointers.delete(event.pointerId);

    if (nextPointers.size === 0) {
      gestureRef.current = null;
      return;
    }

    const sticker = stickers.find((item) => item.id === gesture.id);
    if (!sticker) {
      gestureRef.current = null;
      return;
    }

    if (nextPointers.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(nextPointers.entries())[0];
      beginSinglePointerGesture(sticker, remainingPoint, remainingPointerId);
      return;
    }

    beginMultiPointerGesture(sticker, nextPointers);
  };

  return (
    <div
      ref={containerRef}
      className="preview-stage"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
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
            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
          }}
          onPointerDown={(event) => onPointerDown(event, sticker)}
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
