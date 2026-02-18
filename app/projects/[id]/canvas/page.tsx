"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ExcalidrawClient from "@/components/ExcalidrawClient";
import type { ExcalidrawClientHandle } from "@/components/ExcalidrawClient";

type Scene = {
  elements?: readonly any[];
  appState?: any;
  files?: Record<string, any>;
};

export default function ProjectCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = String(params?.id ?? "");
  const [initialData, setInitialData] = useState<Scene | null>(null);
  const excalRef = useRef<ExcalidrawClientHandle | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/excalidraw`, { cache: "no-store" });
        const json = await res.json();
        setInitialData(json ?? null);
      } catch (err) {
        setInitialData(null);
      }
    };
    load();
  }, [projectId]);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden relative">

      <div className="flex-1 min-h-0 min-w-0">
        <ExcalidrawClient
          ref={excalRef}
          initialData={initialData}
          initialLoadId={projectId}
          onChange={() => setUnsaved(true)}
        />
      </div>
      
      <div className="fixed bottom-2 right-0 z-50 ">
        <div className="flex items-center justify-between px-5 py-3 bg-card border-t shadow">
          <div className="flex items-center gap-2">
          
  
          </div>
          <div className="flex items-center gap-3">
           
            <button
              onClick={async () => {
                setSaving(true);
                setSaveError(null);
                try {
                  await excalRef.current?.save(undefined, projectId);
                  setUnsaved(false);
                } catch (e) {
                  setSaveError("Falha ao salvar");
                } finally {
                  setSaving(false);
                }
              }}
              className={`px-3 py-1.5 text-sm rounded border ${
                saving
                  ? 'bg-blue-300 text-white cursor-not-allowed border-blue-300'
                  : unsaved
                    ? 'bg-yellow-500 text-black hover:bg-yellow-600 border-yellow-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600'
              }`}
              disabled={saving}
              title={unsaved ? "Há alterações não salvas" : "Salvar Canvas"}
            >
              {saving ? 'Salvando...' : unsaved ? 'Salvar alterações' : 'Salvar'}
            </button>

              <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-2 py-1 text-sm rounded border hover:bg-card"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
      {saveError && (
        <div className="absolute top-4 right-4 px-3 py-2 rounded-lg text-sm font-medium shadow-lg bg-red-100 text-red-800 border border-red-200">
          {saveError}
        </div>
      )}
    </div>
  );
}
