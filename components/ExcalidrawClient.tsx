"use client";

import React, { useImperativeHandle, useRef, useState, forwardRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
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
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const latestSceneRef = useRef<SceneData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [projectId, setProjectId] = useState<string>(initialLoadId || "");
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | "saving" | "">("")
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);

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

  const updateSceneLocal = (data: SceneData) => {
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
    // Sempre buscar versão mais recente com headers anti-cache
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}/excalidraw`, { 
      cache: "no-store",
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (res.status === 404) {
      // Projeto não encontrado: mantém ID, usa cena vazia
      const emptyScene: SceneData = {
        elements: [],
        appState: { viewModeEnabled: false, zenModeEnabled: false },
      };
      setProjectId(id);
      updateSceneLocal(emptyScene);
      hasUnsavedChangesRef.current = false;
      return emptyScene;
    }
    
    if (!res.ok) throw new Error("Failed to load scene");
    const json = await res.json();
    
    if (json) {
      updateSceneLocal(json);
    }
    
    setProjectId(id);
    hasUnsavedChangesRef.current = false;
    
    console.log('📥 Cena carregada do servidor:', json ? 'com dados' : 'vazia');
    
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

  // SIMPLIFIED SAVE: Auto-save direto e confiável
  const autoSave = useCallback(async (scene: SceneData) => {
    if (!projectId || isSavingRef.current) return;
    
    isSavingRef.current = true;
    setSaveStatus("saving");
    
    try {
      const response = await fetch(`/api/projects/${projectId}/excalidraw`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }
      
      hasUnsavedChangesRef.current = false;
      setSaveStatus("success");
      console.log('✅ Canvas salvo com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao salvar canvas:', error);
      setSaveStatus("error");
    } finally {
      isSavingRef.current = false;
      setTimeout(() => setSaveStatus(""), 1500);
    }
  }, [projectId]);

  // Cleanup quando componente é desmontado
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Salvar mudanças pendentes usando sendBeacon
      if (hasUnsavedChangesRef.current && projectId) {
        const scene = getScene();
        if (scene && navigator.sendBeacon) {
          const data = new Blob([JSON.stringify({ scene })], { type: 'application/json' });
          navigator.sendBeacon(`/api/projects/${projectId}/excalidraw`, data);
        }
      }
    };
  }, [projectId]);

  useImperativeHandle(ref, () => ({ getScene, updateScene: updateSceneLocal, save, load }), [projectId]);

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
            const sceneData = {
              elements,
              appState: sanitizeAppState(appState),
              files: serializeFiles(allFiles),
            };
            
            latestSceneRef.current = sceneData;
            hasUnsavedChangesRef.current = true;
            onChange?.(sceneData);
            
            // Auto-save com debounce de 2 segundos
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
              autoSave(sceneData);
            }, 2000);
          }}
        />
        
        {/* Save Status Indicator */}
        {saveStatus && (
          <div className={`absolute top-4 left-4 px-3 py-2 rounded-lg text-sm font-medium shadow-lg z-50 ${
            saveStatus === 'saving' 
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : saveStatus === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveStatus === 'saving' ? '💾 Salvando...' : saveStatus === 'success' ? '✅ Salvo!' : '❌ Erro ao salvar'}
          </div>
        )}
      </div>
    </div>
  );
}

const ExcalidrawClient = forwardRef(ExcalidrawClientInner);
export default ExcalidrawClient;
