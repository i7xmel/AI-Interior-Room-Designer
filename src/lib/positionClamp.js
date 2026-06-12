/**
 * positionClamp.js
 *
 * Clamp a 3D object's centre position so its bounding box stays inside the
 * room. When the object is snapped to a surface, allow it to submerge into
 * that surface up to `wallThickness` metres -- but never past the OUTER
 * face of the wall.
 *
 * `localHalfExtents` describes the mesh's local-space AABB half-extents
 * (defaults to [0.5, 0.5, 0.5] = unit cube). For meshes that are NOT
 * unit-cube (most Hunyuan output: a window might be 1.0 x 1.0 x 0.08),
 * pass the actual half-extents so the clamp aligns the real geometry with
 * the wall instead of an imagined unit cube.
 *
 * The mesh is assumed to be centred at the origin of its local space; the
 * RoomViewer ensures this by wrapping the GLB clones in an inner <group>
 * offset by -bboxCenter.
 *
 * Rotation is handled with the standard |R| · h formula, so a rotated
 * object is clamped using its true world-axis-aligned footprint.
 */
import * as THREE from "three";

const _euler = new THREE.Euler();
const _mat   = new THREE.Matrix4();

const DEFAULT_HE = [0.5, 0.5, 0.5];

function _he(localHalfExtents) {
  const h = Array.isArray(localHalfExtents) ? localHalfExtents : DEFAULT_HE;
  return [
    Math.max(0.001, Number(h[0]) || 0.5),
    Math.max(0.001, Number(h[1]) || 0.5),
    Math.max(0.001, Number(h[2]) || 0.5),
  ];
}

/**
 * World-axis half-extents for an object after applying `scale` and then
 * `rotation` (XYZ Euler radians). The local-space half-extents default to
 * [0.5, 0.5, 0.5] (unit cube) when not provided.
 */
export function worldAabbHalfExtents(scale = [1, 1, 1], rotation = [0, 0, 0], localHalfExtents = DEFAULT_HE) {
  const [lhx, lhy, lhz] = _he(localHalfExtents);
  const sx = (scale[0] ?? 1) * lhx;
  const sy = (scale[1] ?? 1) * lhy;
  const sz = (scale[2] ?? 1) * lhz;

  _euler.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0, "XYZ");
  _mat.makeRotationFromEuler(_euler);
  const el = _mat.elements; // column-major; R[row][col] = el[col*4 + row]

  const hx = Math.abs(el[0]) * sx + Math.abs(el[4]) * sy + Math.abs(el[8])  * sz;
  const hy = Math.abs(el[1]) * sx + Math.abs(el[5]) * sy + Math.abs(el[9])  * sz;
  const hz = Math.abs(el[2]) * sx + Math.abs(el[6]) * sy + Math.abs(el[10]) * sz;
  return [hx, hy, hz];
}

/**
 * Clamp object centre position so the AABB stays inside the room (with
 * optional submerge into the snapped wall up to `wallThickness`).
 *
 * @param {number[]} position
 * @param {string|null} surfaceKey - "floor" | "ceiling" | "wall_back" | "wall_left" | "wall_right" | "center" | null
 * @param {{roomWidth:number, roomHeight:number, roomDepth:number}} dims
 * @param {number[]} scale
 * @param {number[]} rotation - XYZ Euler radians
 * @param {number}   wallThickness - metres
 * @param {number[]} [localHalfExtents=[0.5,0.5,0.5]] - mesh's local AABB
 */
export function clampObjectPosition(position, surfaceKey, dims, scale, rotation, wallThickness, localHalfExtents = DEFAULT_HE) {
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth  / 2;
  const hd = roomDepth  / 2;
  const T  = Math.max(0, wallThickness ?? 0.08);

  const [hx, hy, hz] = worldAabbHalfExtents(scale, rotation, localHalfExtents);

  let [x, y, z] = position;

  // X bounds (submerge into a left/right wall when snapped to it)
  const xMin = (surfaceKey === "wall_left")  ? -hw - T + hx : -hw + hx;
  const xMax = (surfaceKey === "wall_right") ?  hw + T - hx :  hw - hx;
  if (xMin <= xMax) x = Math.max(xMin, Math.min(xMax, x));

  // Y bounds (submerge into floor/ceiling when snapped to it)
  const yMin = (surfaceKey === "floor")   ? hy - T              : hy;
  const yMax = (surfaceKey === "ceiling") ? roomHeight - hy + T : roomHeight - hy;
  if (yMin <= yMax) y = Math.max(yMin, Math.min(yMax, y));

  // Z bounds (submerge into the back wall when snapped; front is open)
  const zMin = (surfaceKey === "wall_back") ? -hd - T + hz : -hd + hz;
  const zMax = hd - hz;
  if (zMin <= zMax) z = Math.max(zMin, Math.min(zMax, z));

  return [x, y, z];
}

/**
 * Current submerge depth of a snapped object (0 = flush with inner wall
 * face; positive = sunk into wall thickness toward outer face). Returns
 * null if not snapped to any wall/floor/ceiling.
 */
export function getSubmergeDepth(position, surfaceKey, dims, scale, rotation, localHalfExtents = DEFAULT_HE) {
  if (!surfaceKey || surfaceKey === "center") return null;
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth  / 2;
  const hd = roomDepth  / 2;
  const [hx, hy, hz] = worldAabbHalfExtents(scale, rotation, localHalfExtents);
  const [x, y, z] = position;

  switch (surfaceKey) {
    case "floor":      return hy - y;
    case "ceiling":    return (y + hy) - roomHeight;
    case "wall_back":  return -hd - (z - hz);
    case "wall_left":  return -hw - (x - hx);
    case "wall_right": return (x + hx) - hw;
    default:           return null;
  }
}

/**
 * Set submerge depth for a snapped object. Non-submerge axes preserved.
 */
export function setSubmergeDepth(position, depth, surfaceKey, dims, scale, rotation, localHalfExtents = DEFAULT_HE) {
  if (!surfaceKey || surfaceKey === "center") return position;
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth  / 2;
  const hd = roomDepth  / 2;
  const [hx, hy, hz] = worldAabbHalfExtents(scale, rotation, localHalfExtents);
  const [x, y, z] = position;

  switch (surfaceKey) {
    case "floor":      return [x, hy - depth, z];
    case "ceiling":    return [x, roomHeight - hy + depth, z];
    case "wall_back":  return [x, y, -hd + hz - depth];
    case "wall_left":  return [-hw + hx - depth, y, z];
    case "wall_right": return [ hw - hx + depth, y, z];
    default:           return position;
  }
}
