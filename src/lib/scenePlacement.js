/**
 * scenePlacement.js
 */
export function refinePlacement(raw, surfaceKey, dims) {
  const [px, py, pz] = raw.position;
  const [rx, ry, rz] = raw.rotation;
  const [sx, sy, sz] = raw.scale;

  // Clamp position within room bounds only
  const hw = dims.roomWidth / 2 - 0.1;
  const hd = dims.roomDepth / 2 - 0.1;
  const clampX = Math.max(-hw, Math.min(hw, px));
  const clampY = Math.max(0, Math.min(dims.roomHeight, py));
  const clampZ = Math.max(-hd, Math.min(hd, pz));

  return {
    position: [clampX, clampY, clampZ],
    rotation: [rx, ry, rz],
    scale: [sx, sy, sz],
  };
}

export function dragOffset(surfaceKey, deltaX, deltaY, dims) {
  switch (surfaceKey) {
    case "floor":    return [deltaX * dims.roomWidth, 0, deltaY * dims.roomDepth];
    case "ceiling":  return [deltaX * dims.roomWidth, 0, deltaY * dims.roomDepth];
    case "wall_back":  return [deltaX * dims.roomWidth, -deltaY * dims.roomHeight, 0];
    case "wall_left":  return [0, -deltaY * dims.roomHeight, deltaX * dims.roomDepth];
    case "wall_right": return [0, -deltaY * dims.roomHeight, -deltaX * dims.roomDepth];
    default: return [0, 0, 0];
  }
}

export function getSurfaceNormal(surfaceKey) {
  switch (surfaceKey) {
    case "floor":      return [0, 1, 0];
    case "ceiling":    return [0, -1, 0];
    case "wall_back":  return [0, 0, 1];
    case "wall_left":  return [1, 0, 0];
    case "wall_right": return [-1, 0, 0];
    default:           return [0, 0, 1];
  }
}


