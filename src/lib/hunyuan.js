/**
 * hunyuan.js -- API client for the Flask backend
 * 
 * This is the SINGLE source of truth for all backend API calls.
 * All texture and shape generation goes through the Next.js proxy.
 */

const API_BASE = "/api/generate3d";

/* ===========================================
   CORE API FUNCTIONS
   =========================================== */

/**
 * Generate a 3D shape from an image.
 * @param {string} imageBase64 - base64 encoded image (with or without data URI prefix)
 * @param {object} opts - { steps, guidance, seed }
 * @returns {Promise<Blob>} GLB file as a Blob
 */
export async function generateShape(imageBase64, opts = {}) {
  const res = await fetch(`${API_BASE}?endpoint=generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: imageBase64,
      steps: opts.steps || 30,
      guidance: opts.guidance || 7.5,
      seed: opts.seed ?? -1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Shape generation failed (${res.status})`);
  }

  return await res.blob();
}

/**
 * Apply texture to a GLB mesh.
 * @param {string} glbBase64 - base64 encoded GLB (with or without data URI prefix)
 * @param {string} imageBase64 - reference image (optional)
 * @param {object} opts - { steps }
 * @returns {Promise<Blob>} Textured GLB as a Blob
 */
export async function generateTexture(glbBase64, imageBase64 = null, opts = {}) {
  const body = {
    glb: glbBase64,
    steps: opts.steps || 20,
  };
  if (imageBase64) body.image = imageBase64;

  const res = await fetch(`${API_BASE}?endpoint=texture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Texture generation failed (${res.status})`);
  }

  return await res.blob();
}

/**
 * Check backend health.
 * @returns {Promise<object>} Health status JSON
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}?endpoint=health`);
    if (!res.ok) throw new Error("Backend unhealthy");
    return await res.json();
  } catch (error) {
    console.warn("Health check failed:", error);
    return null;
  }
}

/* ===========================================
   UTILITY FUNCTIONS
   =========================================== */

/**
 * Convert a File to base64 data URL.
 * @param {File} file
 * @returns {Promise<string>} data URL string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a Blob to base64 data URL.
 * @param {Blob} blob
 * @returns {Promise<string>} data URL string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Blob read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Crop an image region using browser canvas.
 * @param {string} imageSrc - source image data URL
 * @param {{x:number, y:number, w:number, h:number}} bbox - normalized 0-1 coordinates
 * @returns {Promise<string>} cropped image as base64 data URL
 */
export function cropImageRegion(imageSrc, bbox) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(bbox.x * img.width);
      const sy = Math.round(bbox.y * img.height);
      const sw = Math.round(bbox.w * img.width);
      const sh = Math.round(bbox.h * img.height);

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageSrc;
  });
}

/* ===========================================
   CONVENIENCE WRAPPERS (for compatibility)
   =========================================== */

/**
 * Texture a GLB blob (convenience wrapper for generateTexture).
 * This accepts a Blob instead of base64 string for convenience.
 * @param {Blob} glbBlob - GLB blob from generateShape
 * @param {string} imageBase64 - reference image
 * @param {object} opts - options
 * @returns {Promise<Blob>}
 */
export async function textureShape(glbBlob, imageBase64, opts = {}) {
  const glbBase64 = await blobToBase64(glbBlob);
  return generateTexture(glbBase64, imageBase64, opts);
}

/**
 * Get texture mode info (for UI messaging).
 * @returns {Promise<object>}
 */
export async function getTextureInfo() {
  const health = await checkHealth();
  if (!health) return null;
  
  return {
    mode: health.texture_mode || "unknown",
    message: health.texture_mode === "hunyuan" 
      ? "Hunyuan3D-Paint pipeline active (full quality)"
      : "Using fallback texture (faster, lower quality)",
  };
}



