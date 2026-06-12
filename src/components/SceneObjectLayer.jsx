"use client";

import { useState, useCallback } from "react";
import useRoomStore from "@/store/roomStore";
import { SURFACE_LABELS, SURFACE_COLORS } from "@/lib/textureProjection";
import { computeSnapPlacement } from "@/lib/surfaceSnap";
import {
  clampObjectPosition,
  getSubmergeDepth,
  setSubmergeDepth,
} from "@/lib/positionClamp";

/* ----------------------------------------------------------------- */
/* Helpers                                                           */
/* ----------------------------------------------------------------- */
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const fmt2 = (n) => Number(n).toFixed(2);

/* Surfaces where "submerge" makes physical sense */
const EMBED_SURFACES = new Set([
  "floor", "ceiling", "wall_back", "wall_left", "wall_right",
]);

export default function SceneObjectLayer() {
  const sceneModels           = useRoomStore((s) => s.sceneModels);
  const toggleModelVisibility = useRoomStore((s) => s.toggleModelVisibility);
  const removeSceneModel      = useRoomStore((s) => s.removeSceneModel);
  const updateSceneModel      = useRoomStore((s) => s.updateSceneModel);
  const clearSceneModels      = useRoomStore((s) => s.clearSceneModels);
  const wallThickness         = useRoomStore((s) => s.wallThickness);
  const setWallThickness      = useRoomStore((s) => s.setWallThickness);
  const lightsOn              = useRoomStore((s) => s.lightsOn);
  const toggleLights          = useRoomStore((s) => s.toggleLights);
  const lightColor            = useRoomStore((s) => s.lightColor);
  const setLightColor         = useRoomStore((s) => s.setLightColor);
  const lightIntensity        = useRoomStore((s) => s.lightIntensity);
  const setLightIntensity     = useRoomStore((s) => s.setLightIntensity);
  const objectBrightness      = useRoomStore((s) => s.objectBrightness);
  const setObjectBrightness   = useRoomStore((s) => s.setObjectBrightness);

  return (
    <div className="border-t border-white/5">

      {/* ---------------- ROOM SETTINGS (always visible) ---------------- */}
      <div className="p-4 space-y-3 border-b border-white/5">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
          Room
        </p>

        {/* Wall thickness */}
        <div className="space-y-1">
          <SliderRow
            label="Wall thickness"
            value={wallThickness}
            min={0.02} max={0.6} step={0.01}
            onChange={setWallThickness}
            unit="m"
            accent="amber"
          />
          <p className="text-[9px] text-white/30 leading-snug">
            Thicker walls give 3D objects more depth to submerge into without
            poking out of the room.
          </p>
        </div>

        {/* Lighting */}
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Lighting
            </span>
            <button
              onClick={toggleLights}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                ${lightsOn
                  ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30"
                  : "bg-white/5 text-white/40 ring-1 ring-white/10 hover:text-white/70"}`}
            >
              {lightsOn ? "On" : "Off"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <ColorBtn label="Warm"    swatch="#ffe1b3" active={lightColor === "warm"}    onClick={() => setLightColor("warm")} />
            <ColorBtn label="Neutral" swatch="#ffffff" active={lightColor === "neutral"} onClick={() => setLightColor("neutral")} />
            <ColorBtn label="Cool"    swatch="#cfe2ff" active={lightColor === "cool"}    onClick={() => setLightColor("cool")} />
          </div>

          <SliderRow
            label="Brightness"
            value={lightIntensity}
            min={0} max={3} step={0.05}
            onChange={setLightIntensity}
            unit="x"
            accent="amber"
          />
        </div>

        {/* Object brightness — a self-emissive "floor" applied to generated
            3D objects so their textures stay readable in dim corners. */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <SliderRow
            label="Object brightness"
            value={objectBrightness}
            min={0} max={1} step={0.05}
            onChange={setObjectBrightness}
            unit=""
            accent="indigo"
          />
          <p className="text-[9px] text-white/30 leading-snug">
            How much of an object's texture is always visible regardless of
            lighting. Push it up if generated objects look too dark.
          </p>
        </div>
      </div>

      {/* ---------------- SCENE OBJECTS ---------------- */}
      {sceneModels.length === 0 ? (
        <div className="p-4">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">
            Scene objects
          </p>
          <p className="text-xs text-white/20">
            No 3D objects placed yet. Generate one from a surface upload or
            from Object Only mode.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Scene objects ({sceneModels.length})
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/20">
                {sceneModels.filter((m) => m.visible).length} visible
              </span>
              {sceneModels.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Remove all ${sceneModels.length} objects?`)) {
                      clearSceneModels();
                    }
                  }}
                  className="text-[9px] text-white/30 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {sceneModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                onToggle={toggleModelVisibility}
                onRemove={removeSceneModel}
                onUpdate={updateSceneModel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/* ModelRow                                                          */
/* ----------------------------------------------------------------- */
function ModelRow({ model, onToggle, onRemove, onUpdate }) {
  const [expanded,   setExpanded]   = useState(false);
  const [showAdv,    setShowAdv]    = useState(false);
  const color = SURFACE_COLORS[model.surfaceKey] || "#6366f1";

  const roomWidth     = useRoomStore((s) => s.roomWidth);
  const roomHeight    = useRoomStore((s) => s.roomHeight);
  const roomDepth     = useRoomStore((s) => s.roomDepth);
  const wallThickness = useRoomStore((s) => s.wallThickness);
  const dims = { roomWidth, roomHeight, roomDepth };

  const pos   = model.position ?? [0, 0.5, 0];
  const rot   = model.rotation ?? [0, 0, 0];
  const scale = model.scale    ?? [1, 1, 1];
  // Local-space AABB half-extents, computed once by RoomViewer after the GLB
  // loads and stored on the model. When absent (mesh not yet loaded), we use
  // the unit-cube fallback inside the clamp/snap helpers.
  const lhe   = Array.isArray(model.bboxHalfExtents) ? model.bboxHalfExtents : undefined;

  /* All mutations go through clampObjectPosition to keep the object inside
   * the room (with submerge into a snapped wall allowed up to wallThickness). */
  const applyPosition = useCallback((nextPos, nextScale = scale, nextRot = rot) => {
    const clamped = clampObjectPosition(
      nextPos, model.surfaceKey, dims, nextScale, nextRot, wallThickness, lhe,
    );
    onUpdate(model.id, { position: clamped });
  }, [model.id, model.surfaceKey, dims, wallThickness, scale, rot, lhe, onUpdate]);

  const setPosAxis = (axis, val) => {
    const next = [...pos];
    next[axis] = val;
    applyPosition(next);
  };

  const nudgePos = (axis, delta) => setPosAxis(axis, pos[axis] + delta);

  const setRotAxis = (axis, val) => {
    const next = [...rot];
    next[axis] = val;
    const clamped = clampObjectPosition(pos, model.surfaceKey, dims, scale, next, wallThickness, lhe);
    onUpdate(model.id, { rotation: next, position: clamped });
  };

  const setScaleAxis = (axis, val) => {
    const next = [...scale];
    next[axis] = Math.max(0.05, val);
    const clamped = clampObjectPosition(pos, model.surfaceKey, dims, next, rot, wallThickness, lhe);
    onUpdate(model.id, { scale: next, position: clamped });
  };

  const setScaleUniform = (val) => {
    const v = Math.max(0.05, val);
    const next = [v, v, v];
    const clamped = clampObjectPosition(pos, model.surfaceKey, dims, next, rot, wallThickness, lhe);
    onUpdate(model.id, { scale: next, position: clamped });
  };

  /* Submerge */
  const submerge    = getSubmergeDepth(pos, model.surfaceKey, dims, scale, rot, lhe);
  const canSubmerge = submerge !== null && EMBED_SURFACES.has(model.surfaceKey);
  const setSubmerge = (depth) => {
    const nextPos = setSubmergeDepth(pos, depth, model.surfaceKey, dims, scale, rot, lhe);
    applyPosition(nextPos);
  };

  /* Snap */
  const snap = useCallback((target) => {
    const placement = computeSnapPlacement(target, dims, scale, lhe);
    onUpdate(model.id, {
      position:   placement.position,
      rotation:   placement.rotation,
      surfaceKey: target,
    });
  }, [model.id, dims, scale, lhe, onUpdate]);

  const unsnap = () => {
    const clamped = clampObjectPosition(pos, null, dims, scale, rot, wallThickness, lhe);
    onUpdate(model.id, { surfaceKey: null, position: clamped });
  };

  /* Quick rotation buttons (rotate around the surface-normal axis) */
  const surfaceAxis = (() => {
    switch (model.surfaceKey) {
      case "floor":
      case "ceiling":    return 1; // Y axis
      case "wall_back":  return 2; // Z axis
      case "wall_left":
      case "wall_right": return 0; // X axis
      default:           return 1;
    }
  })();
  const rotateBy = (deltaRad) => {
    const next = [...rot];
    next[surfaceAxis] = ((next[surfaceAxis] + deltaRad + Math.PI) % (2 * Math.PI)) - Math.PI;
    setRotAxis(surfaceAxis, next[surfaceAxis]);
  };

  const resetTransform = () => {
    onUpdate(model.id, {
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      surfaceKey: null,
    });
  };

  return (
    <div
      className={`rounded-lg overflow-hidden border transition-all
        ${model.visible ? "border-white/10 bg-white/5"
                        : "border-white/5 bg-white/[0.02] opacity-50"}`}
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          onClick={() => onToggle(model.id)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          title={model.visible ? "Hide" : "Show"}
        >
          {model.visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[11px] font-medium text-white/70 truncate">{model.label}</span>
          </div>
          <p className="text-[9px] text-white/30 font-mono mt-0.5">
            {model.surfaceKey
              ? <span style={{ color }}>{SURFACE_LABELS[model.surfaceKey] || model.surfaceKey}</span>
              : <span className="text-white/25">free</span>
            }
            <span className="text-white/20"> · </span>
            {fmt2(scale[0])}×{fmt2(scale[1])}×{fmt2(scale[2])} m
          </p>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-6 h-6 flex items-center justify-center rounded text-white/30
                     hover:text-white/70 hover:bg-white/10 transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▲" : "▼"}
        </button>

        <button
          onClick={() => { if (confirm(`Remove "${model.label}"?`)) onRemove(model.id); }}
          className="w-6 h-6 flex items-center justify-center rounded
                     text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove"
        >
          ✕
        </button>
      </div>

      {/* EXPANDED BODY */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-4 border-t border-white/5">

          {/* ============ SNAP TO SURFACE ============ */}
          <Section
            title="Attach to surface"
            right={
              model.surfaceKey
                ? <button
                    onClick={unsnap}
                    className="text-[9px] text-white/30 hover:text-white/70 transition-colors"
                  >
                    free-float
                  </button>
                : null
            }
          >
            <div className="grid grid-cols-3 gap-1">
              <SnapBtn label="Floor"   active={model.surfaceKey === "floor"}      onClick={() => snap("floor")}   />
              <SnapBtn label="Back"    active={model.surfaceKey === "wall_back"}  onClick={() => snap("wall_back")} />
              <SnapBtn label="Ceiling" active={model.surfaceKey === "ceiling"}    onClick={() => snap("ceiling")} />
              <SnapBtn label="Left"    active={model.surfaceKey === "wall_left"}  onClick={() => snap("wall_left")} />
              <SnapBtn label="Center"  active={model.surfaceKey === "center"}     onClick={() => snap("center")} />
              <SnapBtn label="Right"   active={model.surfaceKey === "wall_right"} onClick={() => snap("wall_right")} />
            </div>
          </Section>

          {/* ============ SUBMERGE (visible only when snapped to a wall/floor/ceiling) ============ */}
          {canSubmerge && (
            <Section title="Submerge into wall">
              <SliderRow
                label="Depth"
                value={Math.max(0, submerge)}
                min={0}
                max={wallThickness}
                step={0.005}
                onChange={setSubmerge}
                unit="m"
                accent="amber"
              />
              <div className="flex gap-1 mt-1">
                <PillBtn onClick={() => setSubmerge(0)}                  label="Flush" />
                <PillBtn onClick={() => setSubmerge(wallThickness / 2)}  label="Half" />
                <PillBtn onClick={() => setSubmerge(wallThickness)}      label="Max" />
              </div>
            </Section>
          )}

          {/* ============ SIZE ============ */}
          <Section
            title="Size"
            right={
              <button
                onClick={() => setShowAdv((v) => !v)}
                className="text-[9px] text-white/30 hover:text-white/70 transition-colors"
              >
                {showAdv ? "uniform" : "per-axis"}
              </button>
            }
          >
            {!showAdv ? (
              <SliderRow
                label="Scale"
                value={scale[0]}
                min={0.05} max={5} step={0.01}
                onChange={setScaleUniform}
                unit="m"
                accent="indigo"
              />
            ) : (
              <>
                <NumericRow label="Width  (X)" value={scale[0]} min={0.05} max={10} step={0.01} unit="m" onChange={(v) => setScaleAxis(0, v)} />
                <NumericRow label="Height (Y)" value={scale[1]} min={0.05} max={10} step={0.01} unit="m" onChange={(v) => setScaleAxis(1, v)} />
                <NumericRow label="Depth  (Z)" value={scale[2]} min={0.05} max={10} step={0.01} unit="m" onChange={(v) => setScaleAxis(2, v)} />
              </>
            )}
          </Section>

          {/* ============ POSITION ============ */}
          <Section
            title="Position"
            right={
              <button
                onClick={resetTransform}
                className="text-[9px] text-white/30 hover:text-white/70 transition-colors"
              >
                reset all
              </button>
            }
          >
            <PositionRow axis="X" idx={0} pos={pos} min={-roomWidth/2}  max={roomWidth/2}  setPos={setPosAxis} nudge={nudgePos} />
            <PositionRow axis="Y" idx={1} pos={pos} min={0}              max={roomHeight}   setPos={setPosAxis} nudge={nudgePos} />
            <PositionRow axis="Z" idx={2} pos={pos} min={-roomDepth/2}  max={roomDepth/2}  setPos={setPosAxis} nudge={nudgePos} />
          </Section>

          {/* ============ ROTATION (in degrees) ============ */}
          <Section title="Rotation">
            <div className="flex items-center gap-1 mb-1.5">
              <PillBtn onClick={() => rotateBy(-Math.PI / 2)} label="⟲ 90°" />
              <PillBtn onClick={() => rotateBy( Math.PI / 2)} label="90° ⟳" />
              <PillBtn onClick={() => rotateBy(Math.PI)}      label="Flip" />
              <PillBtn onClick={() => setRotAxis(surfaceAxis, 0)} label="0°" />
            </div>
            <NumericRow label="Pitch (X)" value={rot[0] * DEG} min={-180} max={180} step={1} unit="°" onChange={(v) => setRotAxis(0, v * RAD)} />
            <NumericRow label="Yaw   (Y)" value={rot[1] * DEG} min={-180} max={180} step={1} unit="°" onChange={(v) => setRotAxis(1, v * RAD)} />
            <NumericRow label="Roll  (Z)" value={rot[2] * DEG} min={-180} max={180} step={1} unit="°" onChange={(v) => setRotAxis(2, v * RAD)} />
          </Section>

        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/* Subcomponents                                                     */
/* ----------------------------------------------------------------- */

function Section({ title, right, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-white/30 uppercase tracking-wider">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function PositionRow({ axis, idx, pos, min, max, setPos, nudge }) {
  const step = 0.05;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-white/30 w-3 flex-shrink-0">{axis}</span>
      <button
        onClick={() => nudge(idx, -step)}
        className="w-5 h-5 flex items-center justify-center rounded
                   bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80
                   text-[10px] transition-colors flex-shrink-0"
        title={`-${step}m`}
      >−</button>
      <input
        type="range" min={min} max={max} step={step}
        value={pos[idx]}
        onChange={(e) => setPos(idx, parseFloat(e.target.value))}
        className="flex-1 accent-indigo-400 min-w-0"
      />
      <button
        onClick={() => nudge(idx, step)}
        className="w-5 h-5 flex items-center justify-center rounded
                   bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80
                   text-[10px] transition-colors flex-shrink-0"
        title={`+${step}m`}
      >+</button>
      <input
        type="number" min={min} max={max} step={step}
        value={fmt2(pos[idx])}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) setPos(idx, v);
        }}
        className="w-16 text-[10px] font-mono text-white/70 bg-white/5 border border-white/10
                   rounded px-1 py-0.5 text-right focus:outline-none focus:border-white/30"
      />
      <span className="text-[9px] text-white/30 w-3 flex-shrink-0">m</span>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, unit = "", accent = "indigo" }) {
  const accentClass = accent === "amber" ? "accent-amber-400" : "accent-indigo-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/40 flex-shrink-0" style={{ minWidth: 70 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`flex-1 ${accentClass} min-w-0`}
      />
      <span className="text-[10px] text-white/60 font-mono w-14 text-right">
        {fmt2(value)}{unit && <span className="text-white/30"> {unit}</span>}
      </span>
    </div>
  );
}

function NumericRow({ label, value, min, max, step, onChange, unit = "" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-white/40 flex-shrink-0" style={{ minWidth: 70 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-indigo-400 min-w-0"
      />
      <input
        type="number" min={min} max={max} step={step}
        value={Number.isFinite(value) ? Number(value).toFixed(step >= 1 ? 0 : 2) : "0"}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-16 text-[10px] font-mono text-white/70 bg-white/5 border border-white/10
                   rounded px-1 py-0.5 text-right focus:outline-none focus:border-white/30"
      />
      {unit && <span className="text-[9px] text-white/30 w-3 flex-shrink-0">{unit}</span>}
    </div>
  );
}

function SnapBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1.5 text-[10px] rounded transition-colors font-medium
        ${active
          ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/40"
          : "bg-white/5 hover:bg-indigo-500/20 text-white/60 hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function PillBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15
                 text-white/60 hover:text-white transition-colors"
    >
      {label}
    </button>
  );
}

function ColorBtn({ label, swatch, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded
                  font-medium transition-colors
        ${active
          ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40"
          : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"}`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
        style={{ background: swatch }}
      />
      {label}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
