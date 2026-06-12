"use client";

import useRoomStore from "@/store/roomStore";

/**
 * LoadingOverlay -- Full-screen overlay shown during 3D generation.
 * Displays a spinner and the current generation label.
 */
export default function LoadingOverlay() {
  const generatingLabel = useRoomStore((s) => s.generatingLabel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-xl panel-glass fade-in">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-accent/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-accent rounded-full spinner" />
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-sm font-medium text-white/80">
            {generatingLabel || "Generating 3D model"}
          </p>
          <p className="text-[11px] text-white/30 mt-1">
            Running Hunyuan3D inference. This may take 30-120 seconds.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-accent/40"
              style={{
                animation: "pulseRing 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


