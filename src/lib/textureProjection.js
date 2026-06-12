/**
 * textureProjection.js -- Surface texture mapping utilities.
 *
 * Projects uploaded room images onto flat room planes as 2D textures.
 * Each surface type (floor, ceiling, walls) maps to a specific plane
 * orientation and UV coordinate system.
 *
 * These textures remain FLAT -- only bbox-selected objects become 3D geometry.
 */

/**
 * Surface plane definitions.
 * Each surface maps to a plane in 3D space with specific orientation and UV mapping.
 *
 * @param {string} surfaceKey
 * @param {{roomWidth:number, roomHeight:number, roomDepth:number}} dims
 * @returns {{
 *   planeArgs: [number, number],
 *   position: [number, number, number],
 *   rotation: [number, number, number],
 *   uvRepeat: [number, number],
 *   uvOffset: [number, number]
 * }}
 */
export function getSurfacePlaneConfig(surfaceKey, dims) {
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth / 2;
  const hd = roomDepth / 2;
  const wallThickness = 0.05;

  switch (surfaceKey) {
    case "floor":
      return {
        planeArgs: [roomWidth, roomDepth],
        position: [0, 0.001, 0],
        rotation: [-Math.PI / 2, 0, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };

    case "ceiling":
      return {
        planeArgs: [roomWidth, roomDepth],
        position: [0, roomHeight - 0.001, 0],
        rotation: [Math.PI / 2, 0, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };

    case "wall_back":
      return {
        planeArgs: [roomWidth, roomHeight],
        position: [0, roomHeight / 2, -hd + wallThickness],
        rotation: [0, 0, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };

    case "wall_left":
      return {
        planeArgs: [roomDepth, roomHeight],
        position: [-hw + wallThickness, roomHeight / 2, 0],
        rotation: [0, Math.PI / 2, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };

    case "wall_right":
      return {
        planeArgs: [roomDepth, roomHeight],
        position: [hw - wallThickness, roomHeight / 2, 0],
        rotation: [0, -Math.PI / 2, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };

    default:
      return {
        planeArgs: [roomWidth, roomHeight],
        position: [0, roomHeight / 2, 0],
        rotation: [0, 0, 0],
        uvRepeat: [1, 1],
        uvOffset: [0, 0],
      };
  }
}

/**
 * All surface keys in render order.
 */
export const SURFACE_KEYS = [
  "floor",
  "ceiling",
  "wall_back",
  "wall_left",
  "wall_right",
];

/**
 * Human-readable surface labels.
 */
export const SURFACE_LABELS = {
  floor: "Floor",
  ceiling: "Ceiling",
  wall_back: "Back Wall",
  wall_left: "Left Wall",
  wall_right: "Right Wall",
};

/**
 * Surface accent colors for UI and annotation overlays.
 */
export const SURFACE_COLORS = {
  floor: "#22c55e",
  ceiling: "#f59e0b",
  wall_back: "#6366f1",
  wall_left: "#ec4899",
  wall_right: "#06b6d4",
};


