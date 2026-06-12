import { create } from "zustand";
import { clampObjectPosition } from "@/lib/positionClamp";

const SURFACE_KEYS = ["floor", "ceiling", "wall_back", "wall_left", "wall_right"];

const makeSurface = () => ({
  image: null,          // base64 data url
  textureUrl: null,     // object url / data url for Three.js texture
  annotations: [],      // [{id, x, y, w, h, label, status}]
  showTexture: true,
});

const useRoomStore = create((set, get) => ({
  // ---------------- Surfaces (existing) ----------------
  surfaces: Object.fromEntries(SURFACE_KEYS.map((k) => [k, makeSurface()])),
  activeSurface: "wall_back",

  setActiveSurface: (key) => set({ activeSurface: key }),

  setSurfaceImage: (key, base64) => {
    const textureUrl = base64;
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [key]: { ...s.surfaces[key], image: base64, textureUrl },
      },
    }));
  },

  toggleSurfaceTexture: (key) => {
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [key]: { ...s.surfaces[key], showTexture: !s.surfaces[key].showTexture },
      },
    }));
  },

  addAnnotation: (surfaceKey, annotation) =>
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [surfaceKey]: {
          ...s.surfaces[surfaceKey],
          annotations: [...s.surfaces[surfaceKey].annotations, annotation],
        },
      },
    })),

  removeAnnotation: (surfaceKey, annId) =>
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [surfaceKey]: {
          ...s.surfaces[surfaceKey],
          annotations: s.surfaces[surfaceKey].annotations.filter(
            (a) => a.id !== annId
          ),
        },
      },
    })),

  updateAnnotationStatus: (surfaceKey, annId, status) =>
    set((s) => ({
      surfaces: {
        ...s.surfaces,
        [surfaceKey]: {
          ...s.surfaces[surfaceKey],
          annotations: s.surfaces[surfaceKey].annotations.map((a) =>
            a.id === annId ? { ...a, status } : a
          ),
        },
      },
    })),

  // ---------------- Object Only mode (NEW) ----------------
  // Image uploaded purely to extract objects from -- it is NEVER applied to a
  // room surface. Used by ObjectOnlyUploadPanel.
  objectOnly: {
    image: null,          // base64 data url
    annotations: [],      // [{id, x, y, w, h, label, status}]
  },

  setObjectOnlyImage: (base64) =>
    set((s) => ({
      objectOnly: { ...s.objectOnly, image: base64 },
    })),

  clearObjectOnlyImage: () =>
    set({ objectOnly: { image: null, annotations: [] } }),

  addObjectOnlyAnnotation: (annotation) =>
    set((s) => ({
      objectOnly: {
        ...s.objectOnly,
        annotations: [...s.objectOnly.annotations, annotation],
      },
    })),

  removeObjectOnlyAnnotation: (annId) =>
    set((s) => ({
      objectOnly: {
        ...s.objectOnly,
        annotations: s.objectOnly.annotations.filter((a) => a.id !== annId),
      },
    })),

  updateObjectOnlyAnnotationStatus: (annId, status) =>
    set((s) => ({
      objectOnly: {
        ...s.objectOnly,
        annotations: s.objectOnly.annotations.map((a) =>
          a.id === annId ? { ...a, status } : a
        ),
      },
    })),

  // ---------------- Room dimensions ----------------
  roomWidth: 6,
  roomHeight: 3,
  roomDepth: 5,

  /**
   * Update one room dimension AND proportionally rescale every scene model
   * so anchored content stays anchored when the user drags the room sliders.
   *
   * The axis being resized has scale factor s; the other two axes have s=1.
   * Every scene model's position and scale on the affected axis are
   * multiplied by s, then `clampObjectPosition` is called to keep the
   * object inside the new room bounds (and inside the wall it's snapped
   * to, if any).
   *
   * Why this works as the user expects:
   *   - For a snapped object at flush (e.g. wall_back, z = -D/2 + hz):
   *     new z = (-D/2 + hz) * sZ = -D'/2 + hz*sZ = -D'/2 + hz'.
   *     The object stays flush against the wall with a proportionally
   *     larger size on that axis. Submerge depth scales with the axis
   *     too, which the clamp then trims to [0, wallThickness].
   *   - For a free-floating object centred at [0, 1.5, 0] in a 6x3x5
   *     room, doubling the width to 12 gives [0, 1.5, 0] (no change in X
   *     because the position was already at the centre). The object's X
   *     scale doubles, matching the wider room.
   */
  setRoomDimension: (key, val) =>
    set((s) => {
      const oldDims = {
        roomWidth:  s.roomWidth,
        roomHeight: s.roomHeight,
        roomDepth:  s.roomDepth,
      };
      const newDims = { ...oldDims, [key]: Number(val) || oldDims[key] };
      if (newDims[key] === oldDims[key]) return { [key]: val };

      const sX = newDims.roomWidth  / oldDims.roomWidth;
      const sY = newDims.roomHeight / oldDims.roomHeight;
      const sZ = newDims.roomDepth  / oldDims.roomDepth;

      const newModels = s.sceneModels.map((m) => {
        const pos   = Array.isArray(m.position) ? m.position : [0, 0.5, 0];
        const scale = Array.isArray(m.scale)    ? m.scale    : [1, 1, 1];
        const rot   = Array.isArray(m.rotation) ? m.rotation : [0, 0, 0];
        const lhe   = Array.isArray(m.bboxHalfExtents) ? m.bboxHalfExtents : undefined;

        const newScale = [scale[0] * sX, scale[1] * sY, scale[2] * sZ];
        const scaledPos = [pos[0] * sX, pos[1] * sY, pos[2] * sZ];
        const clamped = clampObjectPosition(
          scaledPos, m.surfaceKey, newDims, newScale, rot, s.wallThickness, lhe,
        );
        return { ...m, position: clamped, scale: newScale };
      });

      return { [key]: newDims[key], sceneModels: newModels };
    }),

  // ---------------- Wall thickness (controls how deep objects can submerge) -------
  wallThickness: 0.12,
  setWallThickness: (val) =>
    set((s) => {
      const v = Math.max(0.02, Math.min(0.6, Number(val) || 0.08));
      if (v === s.wallThickness) return {};
      const dims = {
        roomWidth:  s.roomWidth,
        roomHeight: s.roomHeight,
        roomDepth:  s.roomDepth,
      };
      // Re-clamp embedded objects so they don't poke past a thinner wall's
      // outer face, and don't have a stale submerge depth that exceeds the
      // new thickness.
      const newModels = s.sceneModels.map((m) => {
        const pos   = Array.isArray(m.position) ? m.position : [0, 0.5, 0];
        const scale = Array.isArray(m.scale)    ? m.scale    : [1, 1, 1];
        const rot   = Array.isArray(m.rotation) ? m.rotation : [0, 0, 0];
        const lhe   = Array.isArray(m.bboxHalfExtents) ? m.bboxHalfExtents : undefined;
        const clamped = clampObjectPosition(pos, m.surfaceKey, dims, scale, rot, v, lhe);
        return { ...m, position: clamped };
      });
      return { wallThickness: v, sceneModels: newModels };
    }),

  // ---------------- Room lighting ----------------
  // lightsOn:  master switch for the inside-the-room lights
  // lightColor: "warm" | "neutral" | "cool"
  // lightIntensity: 0..2 multiplier on the base ceiling/fill light intensity
  // objectBrightness: 0..1 self-emissive "floor" added to generated 3D
  //   objects so their textures remain readable in dim corners. 0 = pure
  //   PBR lighting (objects can be very dark), 1 = always show texture at
  //   full brightness regardless of where the lights are.
  lightsOn: true,
  lightColor: "neutral",
  lightIntensity: 1,
  objectBrightness: 0.45,
  setLightsOn:     (v) => set({ lightsOn: !!v }),
  toggleLights:    () => set((s) => ({ lightsOn: !s.lightsOn })),
  setLightColor:   (c) => {
    const valid = c === "warm" || c === "neutral" || c === "cool" ? c : "neutral";
    set({ lightColor: valid });
  },
  setLightIntensity: (v) => {
    const x = Math.max(0, Math.min(3, Number(v) || 0));
    set({ lightIntensity: x });
  },
  setObjectBrightness: (v) => {
    const x = Math.max(0, Math.min(1, Number(v) || 0));
    set({ objectBrightness: x });
  },

  // ---------------- Generation state ----------------
  generating: false,
  generatingLabel: "",
  setGenerating: (flag, label = "") =>
    set({ generating: flag, generatingLabel: label }),

  // ---------------- Scene models ----------------
  sceneModels: [],

  addSceneModel: (model) =>
    set((s) => ({ sceneModels: [...s.sceneModels, model] })),

  removeSceneModel: (id) =>
    set((s) => ({
      sceneModels: s.sceneModels.filter((m) => m.id !== id),
    })),

  clearSceneModels: () => set({ sceneModels: [] }),

  toggleModelVisibility: (id) =>
    set((s) => ({
      sceneModels: s.sceneModels.map((m) =>
        m.id === id ? { ...m, visible: !m.visible } : m
      ),
    })),

  updateSceneModel: (id, changes) =>
    set((s) => ({
      sceneModels: s.sceneModels.map((m) =>
        m.id === id ? { ...m, ...changes } : m
      ),
    })),

  // ---------------- Backend health ----------------
  backendOk: false,
  backendInfo: null,

  checkBackend: async () => {
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/health"
      );
      if (res.ok) {
        const data = await res.json();
        set({ backendOk: true, backendInfo: data });
      } else {
        set({ backendOk: false });
      }
    } catch {
      set({ backendOk: false });
    }
  },
}));

export default useRoomStore;
