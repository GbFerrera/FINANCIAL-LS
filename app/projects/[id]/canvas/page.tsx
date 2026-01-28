"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ExcalidrawClient from "@/components/ExcalidrawClient";

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
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-2 py-1 text-sm rounded border hover:bg-gray-50"
          >
            Voltar
          </button>
          <span className="text-sm text-gray-500">Projeto: {projectId}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ExcalidrawClient initialData={initialData} initialLoadId={projectId} />
      </div>
    </div>
  );
}