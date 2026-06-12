/**
 * surfaceSnap.js -- compute the FLUSH placement (position + rotation) for
 * snapping a 3D object onto a specific room surface.
 *
 * The returned position places the object's bbox flush against the
 * surface's INNER face (submerge = 0). Use SceneObjectLayer's "Submerge"
 * slider to push it further in.
 *
 * `localHalfExtents` describes the mesh's local-space AABB half-extents
 * (defaults to [0.5, 0.5, 0.5] = unit cube). For Hunyuan-style meshes
 * where the actual bbox doesn't match a unit cube, pass the real
 * half-extents so the flush position aligns the actual geometry with the
 * wall.
 */
const DEFAULT_HE = [0.5, 0.5, 0.5];

export function computeSnapPlacement(target, dims, scale = [1, 1, 1], localHalfExtents = DEFAULT_HE) {
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth  / 2;
  const hd = roomDepth  / 2;

  const lhx = Number(localHalfExtents[0]) || 0.5;
  const lhy = Number(localHalfExtents[1]) || 0.5;
  const lhz = Number(localHalfExtents[2]) || 0.5;

  const halfX = Math.max(0.005, (scale[0] ?? 1) * lhx);
  const halfY = Math.max(0.005, (scale[1] ?? 1) * lhy);
  const halfZ = Math.max(0.005, (scale[2] ?? 1) * lhz);

  switch (target) {
    case "floor":
      // Bottom face at y=0
      return { position: [0, halfY, 0], rotation: [0, 0, 0] };

    case "ceiling":
      // Top face at y=roomHeight; flip so the local +Y face points down
      return { position: [0, roomHeight - halfY, 0], rotation: [Math.PI, 0, 0] };

    case "wall_back":
      // Back face at z = -hd (the inner face of the back wall)
      return { position: [0, roomHeight / 2, -hd + halfZ], rotation: [0, 0, 0] };

    case "wall_left":
      // Rotated +90 around Y: local -Z becomes world -X. World half-extent
      // along X = local halfZ.
      return {
        position: [-hw + halfZ, roomHeight / 2, 0],
        rotation: [0, Math.PI / 2, 0],
      };

    case "wall_right":
      // Rotated -90 around Y: local -Z becomes world +X. World half-extent
      // along X = local halfZ.
      return {
        position: [hw - halfZ, roomHeight / 2, 0],
        rotation: [0, -Math.PI / 2, 0],
      };

    case "center":
    default:
      return { position: [0, Math.max(halfY, 0.5), 0], rotation: [0, 0, 0] };
  }
}
