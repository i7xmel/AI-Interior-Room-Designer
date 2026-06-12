"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import useRoomStore from "@/store/roomStore";
import { SURFACE_LABELS, SURFACE_COLORS } from "@/lib/textureProjection";
import { cropImageRegion, blobToBase64, generateShape, generateTexture } from "@/lib/hunyuan";

export default function ObjectExtractionPanel() {
  const surfaces = useRoomStore((s) => s.surfaces);

  const allAnnotations = useMemo(() => {
    const result = [];
    for (const [key, surf] of Object.entries(surfaces)) {
      for (const ann of surf.annotations) {
        result.push({ ...ann, surfaceKey: key, hasImage: !!surf.image });
      }
    }
    return result;
  }, [surfaces]);

  if (allAnnotations.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">
          Object Extractions
        </p>
        <p className="text-xs text-white/20">
          No objects marked yet. Upload a surface image and draw bounding boxes to select objects.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
        Object Extractions ({allAnnotations.length})
      </p>
      <div className="space-y-2">
        {allAnnotations.map((ann) => (
          <ExtractionCard key={ann.id} annotation={ann} />
        ))}
      </div>
    </div>
  );
}

function ExtractionCard({ annotation }) {
  const surfaces      = useRoomStore((s) => s.surfaces);
  const addSceneModel = useRoomStore((s) => s.addSceneModel);
  const updateAnnotationStatus = useRoomStore((s) => s.updateAnnotationStatus);

  const [cropPreview, setCropPreview] = useState(null);
  const [status, setStatus]           = useState(annotation.status || "pending");
  const [progress, setProgress]       = useState("");
  const [generating, setGenerating]   = useState(false);

  const surface = surfaces[annotation.surfaceKey];
  const color   = SURFACE_COLORS[annotation.surfaceKey];

  // Generate crop preview
  useEffect(() => {
    if (!surface?.image) return;
    let cancelled = false;
    cropImageRegion(surface.image, {
      x: annotation.x, y: annotation.y,
      w: annotation.w, h: annotation.h,
    })
      .then((dataUrl) => { if (!cancelled) setCropPreview(dataUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [surface?.image, annotation.x, annotation.y, annotation.w, annotation.h]);

  const handleGenerate = useCallback(async () => {
    if (!cropPreview || generating) return;

    setGenerating(true);
    setStatus("generating");
    updateAnnotationStatus(annotation.surfaceKey, annotation.id, "generating");

    try {
      // ── Step 1: Shape ──────────────────────────────────────────
      setProgress("Generating shape…");
      const shapeBlob = await generateShape(cropPreview, {
        steps: 30,
        guidance: 7.5,
        seed: -1,
      });

      // ── Step 2: Texture ────────────────────────────────────────
      setProgress("Applying texture… (this takes ~5–10 min)");
      let finalBlob = shapeBlob;
      try {
        const glbBase64 = await blobToBase64(shapeBlob);
        finalBlob = await generateTexture(glbBase64, cropPreview, { steps: 10 });
      } catch (texErr) {
        console.warn("[ExtractionCard] Texture failed, using untextured mesh:", texErr);
        setProgress("Texture failed — using shape mesh.");
      }

      // ── Step 3: Place in scene ─────────────────────────────────
      const glbUrl = URL.createObjectURL(finalBlob);
      addSceneModel({
        id:         `model_${annotation.id}_${Date.now()}`,
        glbUrl,
        position:   [0, 0.5, 0],
        rotation:   [0, 0, 0],
        scale:      [1, 1, 1],
        surfaceKey: annotation.surfaceKey,
        annId:      annotation.id,
        label:      annotation.label || annotation.surfaceKey,
        visible:    true,
      });

      setStatus("done");
      setProgress("Done!");
      updateAnnotationStatus(annotation.surfaceKey, annotation.id, "done");

    } catch (err) {
      console.error("[ExtractionCard] Generation failed:", err);
      setStatus("error");
      setProgress(`Error: ${err.message}`);
      updateAnnotationStatus(annotation.surfaceKey, annotation.id, "error");
    } finally {
      setGenerating(false);
    }
  }, [cropPreview, generating, annotation, addSceneModel, updateAnnotationStatus]);

  return (
    <div className="flex flex-col gap-2 p-2 rounded-lg bg-surface-700/30 fade-in">
      <div className="flex items-start gap-2">
        {/* Crop preview */}
        <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-surface-800">
          {cropPreview ? (
            <img src={cropPreview} alt={annotation.label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[8px] text-white/20">crop</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px] font-medium text-white/80 truncate">
              {annotation.label}
            </span>
          </div>
          <p className="text-[10px] text-white/30 mt-0.5">
            {SURFACE_LABELS[annotation.surfaceKey]}
          </p>
          <div className="mt-1">
            <span className={`badge badge-${status}`}>{status}</span>
          </div>
        </div>
      </div>

      {/* Progress text */}
      {progress && (
        <p className="text-[10px] text-white/40 font-mono px-1">{progress}</p>
      )}

      {/* Generate button */}
      {status !== "done" && (
        <button
          onClick={handleGenerate}
          disabled={generating || !cropPreview}
          className={`w-full py-1.5 rounded text-xs font-medium transition-all
            ${generating
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer"
            }`}
        >
          {generating ? "Generating…" : status === "error" ? "Retry" : "Generate 3D"}
        </button>
      )}

      {/* Re-generate button if already done */}
      {status === "done" && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-1.5 rounded text-xs font-medium bg-white/5
                     text-white/40 hover:bg-white/10 hover:text-white/70 transition-all"
        >
          Re-generate
        </button>
      )}
    </div>
  );
}


