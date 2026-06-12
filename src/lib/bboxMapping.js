/**
 * bboxMapping.js -- Map 2D normalized bounding boxes to 3D room positions.
 */
export function bboxToRoomPosition(bbox, surfaceKey, dims) {
  const { roomWidth, roomHeight, roomDepth } = dims;
  const hw = roomWidth / 2;
  const hd = roomDepth / 2;

  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;

  // Scale: bbox size maps to fraction of the wall dimension
  const scaleX = bbox.w * roomWidth;
  const scaleY = bbox.h * roomHeight;
  const scaleZ = Math.min(scaleX, scaleY) * 0.4; // depth

  switch (surfaceKey) {
    case "floor": {
      const px = (cx - 0.5) * roomWidth;
      const pz = (cy - 0.5) * roomDepth;
      const s = Math.max(bbox.w, bbox.h) * Math.max(roomWidth, roomDepth);
      return {
        position: [px, 0.01, pz],
        rotation: [0, 0, 0],
        scale: [s, s, s],
      };
    }
    case "ceiling": {
      const px = (cx - 0.5) * roomWidth;
      const pz = (cy - 0.5) * roomDepth;
      const s = Math.max(bbox.w, bbox.h) * Math.max(roomWidth, roomDepth);
      return {
        position: [px, roomHeight - 0.01, pz],
        rotation: [Math.PI, 0, 0],
        scale: [s, s, s],
      };
    }
    case "wall_back": {
      const px = (cx - 0.5) * roomWidth;
      const py = (1 - cy) * roomHeight;
      return {
        position: [px, py, -hd + 0.05],
        rotation: [0, 0, 0],
        scale: [scaleX, scaleY, scaleZ],
      };
    }
    case "wall_left": {
      const pz = (cx - 0.5) * roomDepth;
      const py = (1 - cy) * roomHeight;
      return {
        position: [-hw + 0.05, py, pz],
        rotation: [0, Math.PI / 2, 0],
        scale: [scaleZ, scaleY, scaleX],
      };
    }
    case "wall_right": {
      const pz = (0.5 - cx) * roomDepth;
      const py = (1 - cy) * roomHeight;
      return {
        position: [hw - 0.05, py, pz],
        rotation: [0, -Math.PI / 2, 0],
        scale: [scaleZ, scaleY, scaleX],
      };
    }
    default:
      return { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  }
}


