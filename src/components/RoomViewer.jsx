"use client";

import { useRef, useMemo, useEffect, Suspense, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import useRoomStore from "@/store/roomStore";
import { getSurfacePlaneConfig, SURFACE_KEYS } from "@/lib/textureProjection";
import { clampObjectPosition } from "@/lib/positionClamp";

/* ====================================================================
 * STENCIL CUTOUTS — embedded objects punch through walls only when the
 * camera is INSIDE the room.
 *
 * Each embedded object renders twice per frame:
 *   1. A "cutter" pre-pass that writes stencil=1 in the object silhouette,
 *      without touching the color or depth buffer.
 *   2. The normal coloured pass.
 *
 * Each wall's INNER face uses a stencil-aware material (test != 1, skip
 * pixels written by the cutter). Each wall's OUTER face uses a plain
 * opaque material with no stencil test — so from outside the room, 3D
 * objects inside are NOT visible through the walls. The open front of the
 * room is unaffected (no front wall exists), so embedded objects on the
 * back wall are still visible when looking through the open front,
 * because looking through that opening you see the INNER face of the back
 * wall (stencil-aware).
 * ==================================================================== */
const CUTTER_STENCIL_REF = 1;

/* Material factory. `withStencil` controls whether this face skips drawing
 * inside an embedded object's silhouette. The inner faces of the walls get
 * stencil=true; outer faces and edge faces get stencil=false. */
function makeWallMaterial(color, roughness = 0.85, withStencil = false) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    side: THREE.FrontSide,
  });
  if (withStencil) {
    m.stencilWrite = true;
    m.stencilRef   = CUTTER_STENCIL_REF;
    m.stencilFunc  = THREE.NotEqualStencilFunc;
    m.stencilFail  = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.stencilZPass = THREE.KeepStencilOp;
  }
  return m;
}

/* For a three.js boxGeometry, the material array order is:
 *   [ +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back) ]
 *
 * For each wall box, only the face that faces INTO the room gets the
 * stencil material; all other faces use the plain opaque material.
 *
 * Per-wall inner-face index:
 *   floor       → +Y (top)        → index 2
 *   ceiling     → -Y (bottom)     → index 3
 *   wall_back   → +Z (front)      → index 4
 *   wall_left   → +X (right)      → index 0
 *   wall_right  → -X (left)       → index 1
 */
function makeFaceArray(opaqueMat, innerMat, innerIndex) {
  const arr = [opaqueMat, opaqueMat, opaqueMat, opaqueMat, opaqueMat, opaqueMat];
  arr[innerIndex] = innerMat;
  return arr;
}

/* ====================================================================
 * Room shell — thick walls, open front, per-face stencil materials
 * ==================================================================== */
function RoomShell() {
  const surfaces      = useRoomStore((s) => s.surfaces);
  const roomWidth     = useRoomStore((s) => s.roomWidth);
  const roomHeight    = useRoomStore((s) => s.roomHeight);
  const roomDepth     = useRoomStore((s) => s.roomDepth);
  const wallThickness = useRoomStore((s) => s.wallThickness);

  const dims  = { roomWidth, roomHeight, roomDepth };
  const hw    = roomWidth / 2;
  const hd    = roomDepth / 2;
  const wallT = Math.max(0.02, wallThickness ?? 0.08);
  const frameT = 0.04;

  // Build BOTH variants of each material once. Opaque = no stencil → blocks
  // the view of 3D objects when the camera is outside the room. Inner =
  // stencil-aware → embedded objects punch through when viewed from inside.
  const matFloorOuter  = useMemo(() => makeWallMaterial("#1a1a26", 0.9,  false), []);
  const matFloorInner  = useMemo(() => makeWallMaterial("#1a1a26", 0.9,  true),  []);
  const matFloorFaces  = useMemo(() => makeFaceArray(matFloorOuter, matFloorInner, 2),
                                  [matFloorOuter, matFloorInner]);

  const matCeilingOuter = useMemo(() => makeWallMaterial("#12121a", 0.9,  false), []);
  const matCeilingInner = useMemo(() => makeWallMaterial("#12121a", 0.9,  true),  []);
  const matCeilingFaces = useMemo(() => makeFaceArray(matCeilingOuter, matCeilingInner, 3),
                                   [matCeilingOuter, matCeilingInner]);

  const matBackOuter   = useMemo(() => makeWallMaterial("#1a1a26", 0.85, false), []);
  const matBackInner   = useMemo(() => makeWallMaterial("#1a1a26", 0.85, true),  []);
  const matBackFaces   = useMemo(() => makeFaceArray(matBackOuter, matBackInner, 4),
                                  [matBackOuter, matBackInner]);

  const matLeftOuter   = useMemo(() => makeWallMaterial("#1e1e2e", 0.85, false), []);
  const matLeftInner   = useMemo(() => makeWallMaterial("#1e1e2e", 0.85, true),  []);
  const matLeftFaces   = useMemo(() => makeFaceArray(matLeftOuter, matLeftInner, 0),
                                  [matLeftOuter, matLeftInner]);

  const matRightOuter  = useMemo(() => makeWallMaterial("#1e1e2e", 0.85, false), []);
  const matRightInner  = useMemo(() => makeWallMaterial("#1e1e2e", 0.85, true),  []);
  const matRightFaces  = useMemo(() => makeFaceArray(matRightOuter, matRightInner, 1),
                                  [matRightOuter, matRightInner]);

  const matFrame = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2a2a3a", roughness: 0.7 }),
    []
  );

  return (
    <group>
      {/* Floor — thickness extends DOWN from y=0; inner face = +Y (top) */}
      <mesh position={[0, -wallT / 2, 0]} material={matFloorFaces} receiveShadow>
        <boxGeometry args={[roomWidth + wallT * 2, wallT, roomDepth + wallT * 2]} />
      </mesh>

      {/* Ceiling — thickness extends UP from y=roomHeight; inner face = -Y (bottom) */}
      <mesh position={[0, roomHeight + wallT / 2, 0]} material={matCeilingFaces}>
        <boxGeometry args={[roomWidth + wallT * 2, wallT, roomDepth + wallT * 2]} />
      </mesh>

      {/* Back wall — thickness extends in -Z; inner face = +Z (front) */}
      <mesh position={[0, roomHeight / 2, -hd - wallT / 2]} material={matBackFaces} receiveShadow>
        <boxGeometry args={[roomWidth + wallT * 2, roomHeight, wallT]} />
      </mesh>

      {/* >>> FRONT WALL OMITTED — room is open toward camera <<< */}

      {/* Left wall — thickness extends in -X; inner face = +X (right) */}
      <mesh position={[-hw - wallT / 2, roomHeight / 2, 0]} material={matLeftFaces} receiveShadow>
        <boxGeometry args={[wallT, roomHeight, roomDepth + wallT * 2]} />
      </mesh>

      {/* Right wall — thickness extends in +X; inner face = -X (left) */}
      <mesh position={[hw + wallT / 2, roomHeight / 2, 0]} material={matRightFaces} receiveShadow>
        <boxGeometry args={[wallT, roomHeight, roomDepth + wallT * 2]} />
      </mesh>

      {/* Open-front edge frame */}
      <mesh position={[0, roomHeight, hd]} material={matFrame}>
        <boxGeometry args={[roomWidth + wallT * 2, frameT, frameT]} />
      </mesh>
      <mesh position={[0, 0, hd]} material={matFrame}>
        <boxGeometry args={[roomWidth + wallT * 2, frameT, frameT]} />
      </mesh>
      <mesh position={[-hw, roomHeight / 2, hd]} material={matFrame}>
        <boxGeometry args={[frameT, roomHeight, frameT]} />
      </mesh>
      <mesh position={[hw, roomHeight / 2, hd]} material={matFrame}>
        <boxGeometry args={[frameT, roomHeight, frameT]} />
      </mesh>

      {/* Uploaded surface art (wallpaper / floor textures) */}
      {SURFACE_KEYS.map((key) => {
        const surf = surfaces[key];
        if (!surf?.textureUrl || !surf.showTexture) return null;
        return <TexturedPlane key={key} surfaceKey={key} src={surf.textureUrl} dims={dims} />;
      })}
    </group>
  );
}

/* ====================================================================
 * TexturedPlane — uploaded surface art (still stencil-cut from inside)
 * ==================================================================== */
function TexturedPlane({ surfaceKey, src, dims }) {
  const cfg = useMemo(() => getSurfacePlaneConfig(surfaceKey, dims), [surfaceKey, dims]);
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [src]);

  // The textured plane participates in stencil masking too, so wallpaper
  // gets hole-punched by embedded objects just like the wall itself. It's
  // a single-sided plane facing into the room, so it only renders from
  // inside — outside view sees the wall's outer face (opaque).
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.92,
      roughness: 0.6,
    });
    m.stencilWrite = true;
    m.stencilRef   = CUTTER_STENCIL_REF;
    m.stencilFunc  = THREE.NotEqualStencilFunc;
    return m;
  }, [texture]);

  return (
    <mesh position={cfg.position} rotation={cfg.rotation} material={material}>
      <planeGeometry args={cfg.planeArgs} />
    </mesh>
  );
}

/* ====================================================================
 * SelectableModel — cutter clone + visible clone, both in one group
 * ==================================================================== */
function SelectableModel({ model, isSelected, transformMode, onSelect }) {
  const groupRef     = useRef();
  const { camera, gl } = useThree();
  const updateSceneModel = useRoomStore((s) => s.updateSceneModel);
  const roomWidth     = useRoomStore((s) => s.roomWidth);
  const roomHeight    = useRoomStore((s) => s.roomHeight);
  const roomDepth     = useRoomStore((s) => s.roomDepth);
  const wallThickness = useRoomStore((s) => s.wallThickness);

  const objectBrightness = useRoomStore((s) => s.objectBrightness);

  const { scene } = useGLTF(model.glbUrl);

  /* Visible coloured clone with original textures.
   *
   * The materials are cloned (so multiple instances don't share state) and
   * given a *self-emissive* component derived from their own diffuse map
   * or base colour. This keeps the texture readable even in dim corners
   * of the room -- without it, PBR materials from Hunyuan-Paint go very
   * dark anywhere the point lights don't reach directly. Lighting still
   * adds on top, so well-lit areas get brighter; the emissive just sets a
   * minimum floor at `objectBrightness * 100%` of the texture's colour. */
  const visibleScene = useMemo(() => {
    const c = scene.clone(true);

    const boost = (m) => {
      const nm = m.clone();
      nm.side = THREE.DoubleSide;
      // Emit from the diffuse map if it exists, otherwise from the flat
      // base colour. emissiveIntensity is the "minimum brightness floor".
      if (nm.map) {
        nm.emissiveMap = nm.map;
        nm.emissive = new THREE.Color(0xffffff);
      } else if (nm.color) {
        nm.emissive = nm.color.clone();
      } else {
        nm.emissive = new THREE.Color(0xffffff);
      }
      nm.emissiveIntensity = objectBrightness;
      // Cap metalness so the material doesn't read as a mirror in low light.
      if (typeof nm.metalness === "number") nm.metalness = Math.min(nm.metalness, 0.15);
      nm.needsUpdate = true;
      return nm;
    };

    c.traverse((child) => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(boost);
        } else if (child.material) {
          child.material = boost(child.material);
        }
        child.castShadow = true;
        child.receiveShadow = true;
        child.renderOrder = 1;
        // Don't let three.js cull the visible mesh when the object is
        // deeply submerged into a wall and its bounding sphere drifts
        // outside the camera frustum -- if the cutter writes stencil but
        // the visible mesh skips its draw, the user sees a clean hole in
        // the wall with nothing inside it.
        child.frustumCulled = false;
      }
    });
    return c;
  }, [scene, objectBrightness]);

  /* Stencil cutter clone — silhouette-only, writes stencil=1 */
  const isEmbedded = !!model.surfaceKey && model.surfaceKey !== "center";
  const cutterScene = useMemo(() => {
    if (!isEmbedded) return null;
    const c = scene.clone(true);
    const cutterMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    cutterMat.colorWrite    = false;
    cutterMat.depthWrite    = false;
    cutterMat.depthTest     = false;
    cutterMat.stencilWrite  = true;
    cutterMat.stencilFunc   = THREE.AlwaysStencilFunc;
    cutterMat.stencilRef    = CUTTER_STENCIL_REF;
    cutterMat.stencilFail   = THREE.KeepStencilOp;
    cutterMat.stencilZFail  = THREE.ReplaceStencilOp;
    cutterMat.stencilZPass  = THREE.ReplaceStencilOp;

    c.traverse((child) => {
      if (child.isMesh) {
        child.material      = cutterMat;
        child.renderOrder   = -10;
        child.castShadow    = false;
        child.receiveShadow = false;
        child.frustumCulled = false;
      }
    });
    return c;
  }, [scene, isEmbedded]);

  /* Compute the GLB's local-space AABB once. Used to:
   *   1. Centre the visible+cutter clones at the model's origin via an
   *      inner offset group, so model.position cleanly means "world
   *      position of the bbox centre" regardless of where the GLB's
   *      authored origin sits.
   *   2. Inform the store of the half-extents so clamp / snap / resize
   *      math respects the real geometry instead of the unit-cube
   *      fallback. */
  const bboxInfo = useMemo(() => {
    if (!scene) return null;
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return null;
    const c = new THREE.Vector3(); box.getCenter(c);
    const s = new THREE.Vector3(); box.getSize(s);
    return {
      center:      [c.x, c.y, c.z],
      halfExtents: [s.x / 2, s.y / 2, s.z / 2],
    };
  }, [scene]);

  // Publish the half-extents (and re-clamp the current position) the first
  // time the mesh loads. Guarded so it only fires once per model.
  useEffect(() => {
    if (!bboxInfo) return;
    if (Array.isArray(model.bboxHalfExtents) &&
        model.bboxHalfExtents.length === 3) return;
    const dims = { roomWidth, roomHeight, roomDepth };
    const clamped = clampObjectPosition(
      model.position || [0, 0.5, 0],
      model.surfaceKey,
      dims,
      model.scale    || [1, 1, 1],
      model.rotation || [0, 0, 0],
      wallThickness,
      bboxInfo.halfExtents,
    );
    updateSceneModel(model.id, {
      bboxHalfExtents: bboxInfo.halfExtents,
      position:        clamped,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bboxInfo, model.id]);

  const handleTransformEnd = useCallback(() => {
    if (!groupRef.current) return;
    const obj = groupRef.current;
    const dims = { roomWidth, roomHeight, roomDepth };
    const lhe = bboxInfo ? bboxInfo.halfExtents : undefined;
    const clamped = clampObjectPosition(
      [obj.position.x, obj.position.y, obj.position.z],
      model.surfaceKey,
      dims,
      [obj.scale.x, obj.scale.y, obj.scale.z],
      [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      wallThickness,
      lhe,
    );
    obj.position.set(clamped[0], clamped[1], clamped[2]);
    updateSceneModel(model.id, {
      position: clamped,
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale:    [obj.scale.x,    obj.scale.y,    obj.scale.z],
    });
  }, [model.id, model.surfaceKey, roomWidth, roomHeight, roomDepth, wallThickness, bboxInfo, updateSceneModel]);

  // Inner offset so the mesh's bbox centre sits at the parent group's
  // origin. Without this, a window mesh authored with origin at one
  // corner would never go flush against a wall -- the clamp would think
  // the bbox is centred at the origin but in reality the geometry sits
  // entirely on one side of the origin.
  const innerOffset = bboxInfo
    ? [-bboxInfo.center[0], -bboxInfo.center[1], -bboxInfo.center[2]]
    : [0, 0, 0];

  return (
    <>
      <group
        ref={groupRef}
        position={model.position}
        rotation={model.rotation}
        scale={model.scale}
        onClick={(e) => { e.stopPropagation(); onSelect(model.id); }}
      >
        <group position={innerOffset}>
          {cutterScene && <primitive object={cutterScene} />}
          <primitive object={visibleScene} />
        </group>
      </group>

      {isSelected && (
        <TransformControls
          object={groupRef}
          mode={transformMode || "translate"}
          camera={camera}
          domElement={gl.domElement}
          size={0.75}
          onMouseUp={handleTransformEnd}
        />
      )}
    </>
  );
}

function SceneModels({ selectedId, onSelect, transformMode }) {
  const models = useRoomStore((s) => s.sceneModels);
  return (
    <>
      {models.filter((m) => m.visible).map((m) => (
        <Suspense key={m.id} fallback={null}>
          <SelectableModel
            model={m}
            isSelected={m.id === selectedId}
            transformMode={transformMode}
            onSelect={onSelect}
          />
        </Suspense>
      ))}
    </>
  );
}

/* ====================================================================
 * RoomLights — toggleable, colour-selectable interior lights
 *
 * Layout:
 *   - Ceiling key light at top centre (main illumination)
 *   - Soft fill light from front (so back-wall objects aren't dark)
 *   - Two side bounce lights for depth
 *   - Always-on low ambient so the room is not pitch black when lights
 *     are switched off
 *   - A subtle exterior "sun" through the open front gives a slight blue
 *     cast and is unaffected by the inside-light toggle
 * ==================================================================== */
const LIGHT_COLOR_HEX = {
  warm:    "#ffe1b3",  // ~2700 K incandescent
  neutral: "#ffffff",  // 5500 K daylight
  cool:    "#cfe2ff",  // ~7000 K cold daylight
};

function RoomLights() {
  const lightsOn       = useRoomStore((s) => s.lightsOn);
  const lightColor     = useRoomStore((s) => s.lightColor);
  const lightIntensity = useRoomStore((s) => s.lightIntensity);
  const roomWidth      = useRoomStore((s) => s.roomWidth);
  const roomHeight     = useRoomStore((s) => s.roomHeight);
  const roomDepth      = useRoomStore((s) => s.roomDepth);

  const color = LIGHT_COLOR_HEX[lightColor] || LIGHT_COLOR_HEX.neutral;
  const k = lightsOn ? lightIntensity : 0;
  // Ambient now scales with the brightness slider too, with a small floor
  // when lights are off so the room isn't pitch black.
  const ambI = lightsOn ? 0.55 * Math.max(0.4, lightIntensity) : 0.08;
  const farLight = Math.max(roomWidth, roomDepth) * 1.6;

  return (
    <>
      <ambientLight intensity={ambI} color={color} />

      {/* Ceiling key light */}
      <pointLight
        position={[0, roomHeight - 0.15, 0]}
        intensity={1.6 * k}
        color={color}
        distance={farLight}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Front fill */}
      <pointLight
        position={[0, roomHeight * 0.7, roomDepth * 0.4]}
        intensity={0.6 * k}
        color={color}
        distance={roomDepth * 1.5}
        decay={2}
      />

      {/* Side bounce lights */}
      <pointLight
        position={[-roomWidth * 0.4, roomHeight * 0.5, 0]}
        intensity={0.45 * k}
        color={color}
        distance={roomWidth * 1.4}
        decay={2}
      />
      <pointLight
        position={[ roomWidth * 0.4, roomHeight * 0.5, 0]}
        intensity={0.45 * k}
        color={color}
        distance={roomWidth * 1.4}
        decay={2}
      />

      {/* Exterior daylight through the open front -- gentle, unaffected
          by the inside-light toggle so the room keeps a sense of "world
          outside" even with lights off. */}
      <directionalLight
        position={[2, roomHeight + 3, roomDepth + 2]}
        intensity={0.22}
        color="#d8e7ff"
      />
    </>
  );
}

/* ====================================================================
 * Transform-mode toolbar
 * ==================================================================== */
function TransformToolbar({ mode, setMode, onDeselect }) {
  const btn = (m, label) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`px-3 py-1.5 text-xs rounded font-medium transition-all
        ${mode === m
          ? "bg-indigo-500 text-white shadow-lg"
          : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20
                    flex items-center gap-1 px-2 py-1.5 rounded-xl
                    bg-black/70 backdrop-blur border border-white/10 shadow-xl">
      {btn("translate", "Move")}
      {btn("rotate",    "Rotate")}
      {btn("scale",     "Scale")}
      <div className="w-px h-5 bg-white/20 mx-1" />
      <button
        onClick={onDeselect}
        className="px-3 py-1.5 text-xs text-white/40 hover:text-white
                   hover:bg-white/10 rounded transition-colors"
      >
        Done
      </button>
    </div>
  );
}

/* ====================================================================
 * Main export
 * ==================================================================== */
export default function RoomViewer() {
  const roomWidth  = useRoomStore((s) => s.roomWidth);
  const roomHeight = useRoomStore((s) => s.roomHeight);
  const roomDepth  = useRoomStore((s) => s.roomDepth);

  const [selectedId, setSelectedId] = useState(null);
  const [transformMode, setTransformMode] = useState("translate");

  const handleSelect   = useCallback((id) => setSelectedId(id), []);
  const handleDeselect = useCallback(() => setSelectedId(null), []);

  return (
    <div className="room-canvas w-full h-full relative">
      {selectedId && (
        <TransformToolbar
          mode={transformMode}
          setMode={setTransformMode}
          onDeselect={handleDeselect}
        />
      )}

      <Canvas
        shadows
        camera={{
          position: [roomWidth * 0.6, roomHeight * 0.8, roomDepth * 1.4],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          stencil: true,                  // REQUIRED for cutter masking
          preserveDrawingBuffer: false,
        }}
        onPointerMissed={handleDeselect}
      >
        <color attach="background" args={["#0a0a0f"]} />
        <fog attach="fog" args={["#0a0a0f", 12, 35]} />

        <RoomLights />

        <RoomShell />

        <SceneModels
          selectedId={selectedId}
          onSelect={handleSelect}
          transformMode={transformMode}
        />

        <OrbitControls
          target={[0, roomHeight / 2, 0]}
          maxDistance={25}
          minDistance={1}
          maxPolarAngle={Math.PI * 0.85}
          enableDamping
          dampingFactor={0.08}
          enabled={!selectedId}
        />
      </Canvas>
    </div>
  );
}
