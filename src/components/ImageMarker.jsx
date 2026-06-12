"use client";

import { useRef, useState, useCallback } from "react";

/**
 * ImageMarker -- Interactive bounding box annotation overlay.
 *
 * Users click and drag on the image to draw bounding boxes.
 * Existing annotations are displayed as color-coded overlays.
 */
export default function ImageMarker({
  imageSrc,
  annotations = [],
  onNewBbox,
  accentColor = "#6366f1",
}) {
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [startPt, setStartPt] = useState(null);
  const [currentPt, setCurrentPt] = useState(null);

  const getNormalizedCoords = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const pt = getNormalizedCoords(e);
      setStartPt(pt);
      setCurrentPt(pt);
      setDrawing(true);
    },
    [getNormalizedCoords]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!drawing) return;
      setCurrentPt(getNormalizedCoords(e));
    },
    [drawing, getNormalizedCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing || !startPt || !currentPt) {
      setDrawing(false);
      return;
    }

    const x = Math.min(startPt.x, currentPt.x);
    const y = Math.min(startPt.y, currentPt.y);
    const w = Math.abs(currentPt.x - startPt.x);
    const h = Math.abs(currentPt.y - startPt.y);

    // Minimum size threshold
    if (w > 0.02 && h > 0.02) {
      onNewBbox?.({ x, y, w, h });
    }

    setDrawing(false);
    setStartPt(null);
    setCurrentPt(null);
  }, [drawing, startPt, currentPt, onNewBbox]);

  // Draw rect for current drag
  const drawRect =
    drawing && startPt && currentPt
      ? {
          left: `${Math.min(startPt.x, currentPt.x) * 100}%`,
          top: `${Math.min(startPt.y, currentPt.y) * 100}%`,
          width: `${Math.abs(currentPt.x - startPt.x) * 100}%`,
          height: `${Math.abs(currentPt.y - startPt.y) * 100}%`,
        }
      : null;

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden select-none"
      style={{ cursor: "crosshair" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (drawing) handleMouseUp();
      }}
    >
      {/* Surface image */}
      <img
        src={imageSrc}
        alt="Surface"
        className="w-full h-auto block pointer-events-none"
        draggable={false}
      />

      {/* Existing annotations */}
      {annotations.map((ann) => {
        const statusColor =
          ann.status === "done"
            ? "#22c55e"
            : ann.status === "generating"
            ? "#818cf8"
            : ann.status === "error"
            ? "#ef4444"
            : accentColor;

        return (
          <div
            key={ann.id}
            className="absolute pointer-events-none"
            style={{
              left: `${ann.x * 100}%`,
              top: `${ann.y * 100}%`,
              width: `${ann.w * 100}%`,
              height: `${ann.h * 100}%`,
              border: `2px solid ${statusColor}`,
              background: `${statusColor}10`,
              borderRadius: 3,
            }}
          >
            {/* Label chip */}
            <div
              className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
              style={{ background: statusColor, color: "#fff" }}
            >
              {ann.label}
            </div>

            {/* Status dot */}
            {ann.status === "generating" && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-light pulse-ring" />
            )}
            {ann.status === "done" && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-success" />
            )}
            {ann.status === "error" && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />
            )}
          </div>
        );
      })}

      {/* Current drawing rect */}
      {drawRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            ...drawRect,
            border: `2px dashed ${accentColor}`,
            background: `${accentColor}15`,
            borderRadius: 3,
          }}
        />
      )}

      {/* Instructions overlay when no annotations */}
      {annotations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-white/20 bg-black/40 px-2 py-1 rounded">
            Click + drag to mark objects
          </span>
        </div>
      )}
    </div>
  );
}


