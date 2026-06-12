"use client";

import useRoomStore from "@/store/roomStore";
import SurfaceCard from "@/components/SurfaceCard";
import ObjectOnlyUploadPanel from "@/components/ObjectOnlyUploadPanel";
import { SURFACE_LABELS, SURFACE_COLORS } from "@/lib/textureProjection";

/* surface keys + extra "object_only" mode tab */
const TAB_KEYS = [
  "floor",
  "ceiling",
  "wall_back",
  "wall_left",
  "wall_right",
  "object_only",
];

const TAB_LABELS = {
  ...SURFACE_LABELS,
  object_only: "Object Only",
};

const TAB_COLORS = {
  ...SURFACE_COLORS,
  object_only: "#a855f7",  // purple
};

export default function MultiUploadPanel() {
  const activeSurface    = useRoomStore((s) => s.activeSurface);
  const setActiveSurface = useRoomStore((s) => s.setActiveSurface);
  const surfaces         = useRoomStore((s) => s.surfaces);
  const objectOnly       = useRoomStore((s) => s.objectOnly);
  const roomWidth        = useRoomStore((s) => s.roomWidth);
  const roomHeight       = useRoomStore((s) => s.roomHeight);
  const roomDepth        = useRoomStore((s) => s.roomDepth);
  const setDim           = useRoomStore((s) => s.setRoomDimension);

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex gap-1 p-3 border-b border-white/5 overflow-x-auto">
        {TAB_KEYS.map((key) => {
          const isActive = key === activeSurface;
          const isObjectOnly = key === "object_only";
          const hasImage = isObjectOnly
            ? !!objectOnly.image
            : !!surfaces[key]?.image;
          const annCount = isObjectOnly
            ? objectOnly.annotations.length
            : surfaces[key]?.annotations.length || 0;

          return (
            <button
              key={key}
              onClick={() => setActiveSurface(key)}
              className={`
                flex-shrink-0 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all
                ${isActive ? "text-white" : "text-white/40 hover:text-white/60"}
              `}
              style={{
                background:  isActive ? TAB_COLORS[key] + "22" : "transparent",
                borderBottom: isActive ? `2px solid ${TAB_COLORS[key]}` : "2px solid transparent",
              }}
            >
              {TAB_LABELS[key]}
              {hasImage && (
                <span className="ml-1 text-[9px] opacity-60">
                  {annCount > 0 ? `(${annCount})` : "img"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body -- swap between SurfaceCard and the new Object-Only panel */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeSurface === "object_only" ? (
          <ObjectOnlyUploadPanel />
        ) : (
          <SurfaceCard surfaceKey={activeSurface} />
        )}
      </div>

      {/* Room dimensions footer */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
          Room Dimensions (meters)
        </p>
        <DimensionSlider label="Width"  value={roomWidth}  onChange={(v) => setDim("roomWidth",  v)} min={2} max={15} />
        <DimensionSlider label="Height" value={roomHeight} onChange={(v) => setDim("roomHeight", v)} min={2} max={6}  />
        <DimensionSlider label="Depth"  value={roomDepth}  onChange={(v) => setDim("roomDepth",  v)} min={2} max={15} />
      </div>
    </div>
  );
}

function DimensionSlider({ label, value, onChange, min, max }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-white/50 w-12">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 appearance-none rounded bg-surface-600 cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
      />
      <span className="text-[11px] font-mono text-white/60 w-8 text-right">{value}m</span>
    </div>
  );
}


