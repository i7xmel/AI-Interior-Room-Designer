"use client";

import { useCallback } from "react";
import useRoomStore from "@/store/roomStore";
import ImageMarker from "@/components/ImageMarker";
import { fileToBase64, cropImageRegion, generateShape, generateTexture, blobToBase64 } from "@/lib/hunyuan";

/**
 * ObjectOnlyUploadPanel
 * ---------------------
 * Upload an image purely as a source of 3D objects -- the image itself is
 * NEVER applied to any room surface as a texture. The user draws bboxes,
 * each bbox becomes a 3D model placed at the room centre (and can then be
 * snapped to a wall / repositioned via SceneObjectLayer).
 */
export default function ObjectOnlyUploadPanel() {
  const objectOnly                       = useRoomStore((s) => s.objectOnly);
  const setObjectOnlyImage               = useRoomStore((s) => s.setObjectOnlyImage);
  const clearObjectOnlyImage             = useRoomStore((s) => s.clearObjectOnlyImage);
  const addObjectOnlyAnnotation          = useRoomStore((s) => s.addObjectOnlyAnnotation);
  const removeObjectOnlyAnnotation       = useRoomStore((s) => s.removeObjectOnlyAnnotation);
  const updateObjectOnlyAnnotationStatus = useRoomStore((s) => s.updateObjectOnlyAnnotationStatus);
  const setGenerating                    = useRoomStore((s) => s.setGenerating);
  const addSceneModel                    = useRoomStore((s) => s.addSceneModel);
  const backendOk                        = useRoomStore((s) => s.backendOk);

  const { image, annotations } = objectOnly;
  const accentColor = "#a855f7"; // purple, distinct from surface colors

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const b64 = await fileToBase64(file);
      setObjectOnlyImage(b64);
    },
    [setObjectOnlyImage]
  );

  const handleNewAnnotation = useCallback(
    (bbox) => {
      const id = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addObjectOnlyAnnotation({
        id,
        ...bbox,
        label: `Object ${annotations.length + 1}`,
        status: "idle",
      });
    },
    [annotations.length, addObjectOnlyAnnotation]
  );

  const handleGenerate = useCallback(
    async (ann) => {
      if (!image || !backendOk) return;

      updateObjectOnlyAnnotationStatus(ann.id, "generating");
      setGenerating(true, `Generating ${ann.label}`);

      try {
        const cropped = await cropImageRegion(image, {
          x: ann.x, y: ann.y, w: ann.w, h: ann.h,
        });
        const shapeBlob = await generateShape(cropped);

        // ----- Texture pass -----------------------------------------------
        // The /generate endpoint returns an UNTEXTURED GLB. We now call
        // /texture with the cropped reference image to bake on a texture.
        // The backend runs Hunyuan3D-Paint when available (slow but high
        // quality, ~10 min on a 4 GB GPU with CPU offload) and falls back
        // to a UV-projection bake otherwise (~5 s, lower quality). If the
        // texture call itself fails, we still place the untextured mesh
        // so the user always gets *something*.
        let texturedBlob = shapeBlob;
        try {
          updateObjectOnlyAnnotationStatus(ann.id, "texturing");
          setGenerating(true, `Texturing ${ann.label}… (can take ~10 min on 4GB GPU)`);
          const glbBase64 = await blobToBase64(shapeBlob);
          texturedBlob = await generateTexture(glbBase64, cropped, { steps: 10 });
        } catch (texErr) {
          console.warn("[Object-Only] Texture failed, using untextured shape:", texErr);
          texturedBlob = shapeBlob;
        }

        const glbUrl = URL.createObjectURL(texturedBlob);

        // Place at room centre. User can snap to a wall / drag from there.
        addSceneModel({
          id: `model_${ann.id}`,
          glbUrl,
          position: [0, 0.5, 0],
          rotation: [0, 0, 0],
          scale:    [1, 1, 1],
          surfaceKey: null,   // not bound to any wall
          annId: ann.id,
          label: ann.label,
          visible: true,
          origin: "object_only",
        });

        updateObjectOnlyAnnotationStatus(ann.id, "done");
      } catch (err) {
        console.error("Object-only generation failed:", err);
        updateObjectOnlyAnnotationStatus(ann.id, "error");
      } finally {
        setGenerating(false);
      }
    },
    [
      image,
      backendOk,
      updateObjectOnlyAnnotationStatus,
      setGenerating,
      addSceneModel,
    ]
  );

  const handleGenerateAll = useCallback(async () => {
    const pending = annotations.filter(
      (a) => a.status === "idle" || a.status === "error"
    );
    for (const ann of pending) {
      // eslint-disable-next-line no-await-in-loop
      await handleGenerate(ann);
    }
  }, [annotations, handleGenerate]);

  return (
    <div className="space-y-3 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
          <span className="text-sm font-medium">Object Only</span>
        </div>
        {image && (
          <button
            onClick={() => {
              if (confirm("Clear this image and all its annotations?")) {
                clearObjectOnlyImage();
              }
            }}
            className="text-[10px] text-white/30 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-white/40 leading-relaxed">
        Upload any reference image. Mark objects to convert them to 3D models in the room.
        The image itself is <span className="text-white/60">not</span> applied to any wall.
      </p>

      {/* Upload / Image */}
      {!image ? (
        <label
          className="block border-2 border-dashed border-white/10 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400/40 transition-colors"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <div className="text-white/30 text-xs">
            Click to upload an image of any object(s)
          </div>
          <div className="text-white/20 text-[10px] mt-1">
            (this image will not appear in the 3D room)
          </div>
        </label>
      ) : (
        <div className="space-y-2">
          <ImageMarker
            imageSrc={image}
            annotations={annotations}
            onNewBbox={handleNewAnnotation}
            accentColor={accentColor}
          />

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
      {annotations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Marked Objects ({annotations.length})
            </span>
            {annotations.some((a) => a.status === "idle" || a.status === "error") && (
              <button
                onClick={handleGenerateAll}
                disabled={!backendOk}
                className="btn-primary text-[10px] py-1 px-2"
                style={{ background: accentColor }}
              >
                Generate All
              </button>
            )}
          </div>

          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-700/50"
            >
              <span className="text-xs text-white/70 flex-1 truncate">{ann.label}</span>

              <span className={`badge badge-${ann.status}`}>{ann.status}</span>

              {(ann.status === "idle" || ann.status === "error") && (
                <button
                  onClick={() => handleGenerate(ann)}
                  disabled={!backendOk}
                  className="text-[10px] hover:underline transition-colors"
                  style={{ color: accentColor }}
                >
                  {ann.status === "error" ? "Retry" : "Run"}
                </button>
              )}

              <button
                onClick={() => removeObjectOnlyAnnotation(ann.id)}
                className="text-[10px] text-white/20 hover:text-red-400 transition-colors"
                title="Remove annotation"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



