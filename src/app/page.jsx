"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import useRoomStore from "@/store/roomStore";
import MultiUploadPanel from "@/components/MultiUploadPanel";
import LoadingOverlay from "@/components/LoadingOverlay";
import ObjectExtractionPanel from "@/components/ObjectExtractionPanel";
import SceneObjectLayer from "@/components/SceneObjectLayer";

const RoomViewer = dynamic(() => import("@/components/RoomViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-surface-900">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full spinner mx-auto mb-3" />
        <p className="text-xs text-white/40 font-mono">Loading 3D engine</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [objectPanelOpen, setObjectPanelOpen] = useState(false);
  const backendOk = useRoomStore((s) => s.backendOk);
  const checkBackend = useRoomStore((s) => s.checkBackend);
  const generating = useRoomStore((s) => s.generating);

  useEffect(() => {
    checkBackend();
    const iv = setInterval(checkBackend, 10000);
    return () => clearInterval(iv);
  }, [checkBackend]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-surface-900">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 h-10 flex items-center px-4 panel-glass">
        <span className="font-mono text-xs font-semibold tracking-wider text-white/70">
          ROOM3D
        </span>
        <span className="ml-2 text-[10px] text-white/30">hybrid 2D+3D viewer</span>

        <div className="flex items-center gap-3 ml-auto">
          {/* Scene objects toggle */}
          <button
            onClick={() => setObjectPanelOpen(!objectPanelOpen)}
            className="btn-ghost text-[11px]"
          >
            {objectPanelOpen ? "Hide Objects" : "Scene Objects"}
          </button>

          {/* Backend status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                backendOk ? "bg-success" : "bg-danger pulse-ring"
              }`}
            />
            <span className="text-[10px] font-mono text-white/40">
              {backendOk ? "Backend OK" : "Backend offline"}
            </span>
          </div>

          {/* Panel toggle */}
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="btn-ghost text-[11px]"
          >
            {panelOpen ? "Hide Panel" : "Show Panel"}
          </button>
        </div>
      </div>

      {/* 3D Viewer */}
      <div className="absolute inset-0 pt-10">
        <RoomViewer />
      </div>

      {/* Upload + Annotation Panel */}
      {panelOpen && (
        <div className="absolute top-10 right-0 bottom-0 w-[380px] z-20 panel-glass overflow-y-auto">
          <MultiUploadPanel />
        </div>
      )}

      {/* Object Extraction Panel */}
      {objectPanelOpen && (
        <div className="absolute top-10 left-0 bottom-0 w-[320px] z-20 panel-glass overflow-y-auto">
          <ObjectExtractionPanel />
          <SceneObjectLayer />
        </div>
      )}

      {/* Loading overlay */}
      {generating && <LoadingOverlay />}
    </main>
  );
}
