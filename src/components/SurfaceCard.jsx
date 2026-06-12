"use client";

import { useCallback } from "react";
import useRoomStore from "@/store/roomStore";
import ImageMarker from "@/components/ImageMarker";
import { SURFACE_LABELS, SURFACE_COLORS } from "@/lib/textureProjection";
import { fileToBase64, cropImageRegion, generateShape, generateTexture, blobToBase64 } from "@/lib/hunyuan";
import { bboxToRoomPosition } from "@/lib/bboxMapping";
import { refinePlacement } from "@/lib/scenePlacement";

export default function SurfaceCard({ surfaceKey }) {
  const surface = useRoomStore((s) => s.surfaces[surfaceKey]);
  const setSurfaceImage = useRoomStore((s) => s.setSurfaceImage);
  const toggleSurfaceTexture = useRoomStore((s) => s.toggleSurfaceTexture);
  const addAnnotation = useRoomStore((s) => s.addAnnotation);
  const removeAnnotation = useRoomStore((s) => s.removeAnnotation);
  const updateAnnotationStatus = useRoomStore((s) => s.updateAnnotationStatus);
  const setGenerating = useRoomStore((s) => s.setGenerating);
  const addSceneModel = useRoomStore((s) => s.addSceneModel);
  const backendOk = useRoomStore((s) => s.backendOk);
  const roomWidth = useRoomStore((s) => s.roomWidth);
  const roomHeight = useRoomStore((s) => s.roomHeight);
  const roomDepth = useRoomStore((s) => s.roomDepth);

  const dims = { roomWidth, roomHeight, roomDepth };
  const color = SURFACE_COLORS[surfaceKey];

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const b64 = await fileToBase64(file);
      setSurfaceImage(surfaceKey, b64);
    },
    [surfaceKey, setSurfaceImage]
  );

  const handleNewAnnotation = useCallback(
    (bbox) => {
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addAnnotation(surfaceKey, {
        id,
        ...bbox,
        label: `Object ${surface.annotations.length + 1}`,
        status: "idle",
      });
    },
    [surfaceKey, surface.annotations.length, addAnnotation]
  );

  const handleGenerate = useCallback(
    async (ann) => {
      if (!surface.image || !backendOk) return;

      updateAnnotationStatus(surfaceKey, ann.id, "generating");
      setGenerating(true, `Generating ${ann.label}`);

      try {
        // Crop
        const cropped = await cropImageRegion(surface.image, {
          x: ann.x, y: ann.y, w: ann.w, h: ann.h,
        });

        // Shape
        const shapeBlob = await generateShape(cropped);

        // Texture
        let finalBlob = shapeBlob;
        try {
          setGenerating(true, `Texturing ${ann.label}…`);
          const glbBase64 = await blobToBase64(shapeBlob);
          finalBlob = await generateTexture(glbBase64, cropped, { steps: 10 });
        } catch (texErr) {
          console.warn("Texture failed, using untextured mesh:", texErr);
        }

        const glbUrl = URL.createObjectURL(finalBlob);

        // Placement
        const rawPos = bboxToRoomPosition(
          { x: ann.x, y: ann.y, w: ann.w, h: ann.h },
          surfaceKey,
          dims
        );
        const placement = refinePlacement(rawPos, surfaceKey, dims);

        addSceneModel({
          id: `model_${ann.id}`,
          glbUrl,
          position: placement.position,
          rotation: placement.rotation,
          scale: placement.scale,
          surfaceKey,
          annId: ann.id,
          label: ann.label,
          visible: true,
        });

        updateAnnotationStatus(surfaceKey, ann.id, "done");
      } catch (err) {
        console.error("Generation failed:", err);
        updateAnnotationStatus(surfaceKey, ann.id, "error");
      } finally {
        setGenerating(false);
      }
    },
    [
      surface.image,
      backendOk,
      surfaceKey,
      dims,
      updateAnnotationStatus,
      setGenerating,
      addSceneModel,
    ]
  );

  const handleGenerateAll = useCallback(async () => {
    const idle = surface.annotations.filter((a) => a.status === "idle" || a.status === "error");
    for (const ann of idle) {
      await handleGenerate(ann);
    }
  }, [surface.annotations, handleGenerate]);

  return (
    <div className="space-y-3 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium">{SURFACE_LABELS[surfaceKey]}</span>
        </div>
        {surface.image && (
          <button
            onClick={() => toggleSurfaceTexture(surfaceKey)}
            className="btn-ghost text-[10px]"
          >
            {surface.showTexture ? "Hide Texture" : "Show Texture"}
          </button>
        )}
      </div>

      {/* Upload / Image */}
      {!surface.image ? (
        <label className="block border-2 border-dashed border-white/10 rounded-lg p-6 text-center cursor-pointer hover:border-accent/40 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <div className="text-white/20 text-xs">
            Click to upload {SURFACE_LABELS[surfaceKey].toLowerCase()} image
          </div>
        </label>
      ) : (
        <div className="space-y-2">
          {/* Image with annotation overlay */}
          <ImageMarker
            imageSrc={surface.image}
            annotations={surface.annotations}
            onNewBbox={handleNewAnnotation}
            accentColor={color}
          />

          {/* Re-upload */}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <span className="text-[10px] text-white/30 hover:text-white/50 cursor-pointer transition-colors">
              Replace image
            </span>
          </label>
        </div>
      )}

      {/* Annotations list */}
      {surface.annotations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Marked Objects ({surface.annotations.length})
            </span>
            {surface.annotations.some((a) => a.status === "idle" || a.status === "error") && (
              <button
                onClick={handleGenerateAll}
                disabled={!backendOk}
                className="btn-primary text-[10px] py-1 px-2"
              >
                Generate All
              </button>
            )}
          </div>

          {surface.annotations.map((ann) => (
            <div
              key={ann.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-700/50"
            >
              <span className="text-xs text-white/70 flex-1 truncate">{ann.label}</span>

              <span className={`badge badge-${ann.status}`}>
                {ann.status}
              </span>

              {(ann.status === "idle" || ann.status === "error") && (
                <button
                  onClick={() => handleGenerate(ann)}
                  disabled={!backendOk}
                  className="text-[10px] text-accent hover:text-accent-light transition-colors"
                >
                  {ann.status === "error" ? "Retry" : "Run"}
                </button>
              )}

              <button
                onClick={() => removeAnnotation(surfaceKey, ann.id)}
                className="text-[10px] text-white/20 hover:text-danger transition-colors"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
