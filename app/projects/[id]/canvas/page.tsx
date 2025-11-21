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
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

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

  const handleChange = (data: Scene) => {
    if (!projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/excalidraw`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene: data }),
        });
      } finally {
        setSaving(false);
      }
    }, 800);
  };

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
        <div className="text-xs text-gray-500">{saving ? "Salvando..." : ""}</div>
      </div>

      <div className="flex-1 min-h-0">
        <ExcalidrawClient initialData={initialData} initialLoadId={projectId} onChange={handleChange} />
      </div>
    </div>
  );
}