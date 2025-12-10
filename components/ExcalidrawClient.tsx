"use client";

import React, { useImperativeHandle, useRef, useState, forwardRef, useEffect } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useRouter } from "next/navigation";
import type { ExcalidrawImperativeAPI, BinaryFiles, BinaryFileData } from "@excalidraw/excalidraw/types";

// Define uma interface mínima local para a API imperativa do Excalidraw
type ExcalidrawAPI = ExcalidrawImperativeAPI;

type SceneData = {
  elements?: readonly any[];
  appState?: any;
  files?: BinaryFiles;
};

export type ExcalidrawClientHandle = {
  getScene: () => SceneData | null;
  updateScene: (data: SceneData) => void;
  save: (title?: string, id?: string) => Promise<string>;
  load: (id: string) => Promise<SceneData>;
};

type Props = {
  initialData?: SceneData | null;
  initialLoadId?: string;
  onChange?: (data: SceneData) => void;
};

const ExcalidrawComponent = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

function ExcalidrawClientInner({ initialData, initialLoadId, onChange }: Props, ref: React.Ref<ExcalidrawClientHandle>) {
  const router = useRouter();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const latestSceneRef = useRef<SceneData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [projectId, setProjectId] = useState<string>(initialLoadId || "");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | "">("");

  const sanitizeAppState = (appState: any) => {
    if (!appState) return appState;
    const { collaborators, ...rest } = appState; // Map não serializa em JSON
    return rest;
  };

  const safeInitialData = initialData
    ? {
        ...initialData,
        appState: {
          viewModeEnabled: false,
          zenModeEnabled: false,
          ...(sanitizeAppState(initialData.appState) ?? {}),
        },
      }
    : {
        appState: {
          viewModeEnabled: false,
          zenModeEnabled: false,
        },
      };

  const serializeFiles = (files?: BinaryFiles) => {
    if (!files) return undefined;
    const out: BinaryFiles = {} as BinaryFiles;
    for (const [id, f] of Object.entries(files)) {
      out[id] = {
        id: (f as any).id ?? id,
        created: (f as any).created ?? Date.now(),
        mimeType: (f as any).mimeType ?? "image/png",
        dataURL: String((f as any).dataURL ?? ""),
      } as BinaryFileData;
    }
    return out;
  };

  const getScene = () => {
    const api = apiRef.current;
    if (!api) return latestSceneRef.current;
    const elements = api.getSceneElements();
    const appState = sanitizeAppState(api.getAppState());
    const files = api.getFiles ? serializeFiles(api.getFiles()) : undefined;
    return { elements, appState, files } as SceneData;
  };

  const updateScene = (data: SceneData) => {
    const api = apiRef.current;
    if (!api) return;
    if (data.files && api.addFiles) {
      const arr: BinaryFileData[] = Object.values(data.files as Record<string, BinaryFileData>);
      api.addFiles(arr);
    }
    api.updateScene({ elements: data.elements, appState: data.appState } as any);
  };

  const save = async (maybeTitle?: string, maybeId?: string) => {
    const scene = getScene();
    if (!scene) throw new Error("Editor ainda inicializando. Tente novamente.");
    const pid = maybeId || projectId;
    if (!pid) throw new Error("ProjectId ausente");
    const res = await fetch(`/api/projects/${pid}/excalidraw`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
    });
    if (!res.ok) throw new Error("Failed to save scene");
    return pid;
  };

  const load = async (id: string) => {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}/excalidraw`, { cache: "no-store" });
    if (res.status === 404) {
      // Projeto não encontrado: mantém ID, usa cena vazia
      const emptyScene: SceneData = {
        elements: [],
        appState: { viewModeEnabled: false, zenModeEnabled: false },
      };
      setProjectId(id);
      updateScene(emptyScene);
      setIsDirty(false);
      return emptyScene;
    }
    if (!res.ok) throw new Error("Failed to load scene");
    const json = await res.json();
    if (json) updateScene(json);
    setProjectId(id);
    setIsDirty(false);
    return (json ?? {
      elements: [],
      appState: { viewModeEnabled: false, zenModeEnabled: false },
    }) as SceneData;
  };

  // Carrega automaticamente se houver projectId na URL
  useEffect(() => {
    if (initialLoadId) {
      setProjectId(initialLoadId);
      load(initialLoadId).catch(console.error);
    }
  }, [initialLoadId]);

  useImperativeHandle(ref, () => ({ getScene, updateScene, save, load }), [title, projectId]);

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", minHeight: 0, margin: 0, padding: 0 }}>
     
      <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <ExcalidrawComponent
          excalidrawAPI={(api) => {
            apiRef.current = api;
            setIsReady(true);
          }}
          initialData={safeInitialData}
          onChange={(elements, appState, files) => {
            const allFiles = files ?? (apiRef.current?.getFiles ? apiRef.current.getFiles() : undefined);
            latestSceneRef.current = {
              elements,
              appState: sanitizeAppState(appState),
              files: serializeFiles(allFiles),
            };
            setIsDirty(true);
            onChange?.(latestSceneRef.current);
          }}
        />
      </div>
    </div>
  );
}

const ExcalidrawClient = forwardRef(ExcalidrawClientInner);
export default ExcalidrawClient;
