"use client";

import React, { useImperativeHandle, useRef, useState, forwardRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useRouter } from "next/navigation";
import { useExcalidrawCollaboration } from "@/hooks/useExcalidrawCollaboration";
import { useSession } from "next-auth/react";
import type { ExcalidrawImperativeAPI, BinaryFiles, BinaryFileData } from "@excalidraw/excalidraw/types";
import { useSocket } from "@/hooks/useSocket";

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
  const { data: session } = useSession();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const latestSceneRef = useRef<SceneData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [projectId, setProjectId] = useState<string>(initialLoadId || "");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | "">("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingFromRemoteRef = useRef(false);
  const previousElementsRef = useRef<any[]>([]);
  const isFirstLoadRef = useRef(true);
  const { socket } = useSocket();
  const hasUnsavedChangesRef = useRef(false);
  const lastSaveRef = useRef<number>(0);
  const pendingChangesRef = useRef<SceneData | null>(null);
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  // Hook de colaboração
  const {
    collaborators,
    isConnected,
    joinProject,
    leaveProject,
    updateScene: broadcastScene,
    updateCursor,
    onSceneUpdate,
    onCursorUpdate,
    onUserJoined,
    onUserLeft
  } = useExcalidrawCollaboration();

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
      setIsDirty(false);
      hasUnsavedChangesRef.current = false;
      return emptyScene;
    }
    
    if (!res.ok) throw new Error("Failed to load scene");
    const json = await res.json();
    
    if (json) {
      updateSceneLocal(json);
      // Atualizar referência dos elementos carregados
      if (json.elements) {
        previousElementsRef.current = Array.from(json.elements);
      }
    }
    
    setProjectId(id);
    setIsDirty(false);
    hasUnsavedChangesRef.current = false;
    
    console.log('📥 Cena carregada do servidor:', json ? 'com dados' : 'vazia');
    
    return (json ?? {
      elements: [],
      appState: { viewModeEnabled: false, zenModeEnabled: false },
    }) as SceneData;
  };

  // Configurar colaboração em tempo real
  useEffect(() => {
    if (!projectId || !session?.user?.id || !isConnected) return;

    console.log('🚀 Iniciando colaboração para projeto:', projectId);
    setIsCollaborating(true);
    joinProject(projectId);

    // Configurar listeners de colaboração
    onSceneUpdate((data) => {
      if (data.socketId === socket?.id) return; // Ignorar próprias atualizações
      
      console.log('📥 Recebendo atualização de cena de:', data.socketId);
      isUpdatingFromRemoteRef.current = true;
      
      if (apiRef.current && data.elements && data.appState) {
        // Obter estado atual
        const currentAppState = apiRef.current.getAppState();
        const currentElements = apiRef.current.getSceneElements();
        
        // CONFLICT RESOLUTION: Verificar se há conflitos com mudanças locais pendentes
        const hasLocalChanges = pendingChangesRef.current !== null;
        
        if (hasLocalChanges) {
          console.log('⚠️ Resolvendo conflito: mudanças locais + remotas');
          // Cancelar broadcast pendente para evitar conflito
          if (broadcastTimeoutRef.current) {
            clearTimeout(broadcastTimeoutRef.current);
            broadcastTimeoutRef.current = null;
          }
        }
        
        // SMOOTH MERGE: Preservar viewport e configurações locais
        const mergedAppState = {
          ...data.appState,
          // Manter configurações de viewport do usuário atual
          scrollX: currentAppState.scrollX,
          scrollY: currentAppState.scrollY,
          zoom: currentAppState.zoom,
          // Manter configurações de UI
          viewModeEnabled: currentAppState.viewModeEnabled,
          zenModeEnabled: currentAppState.zenModeEnabled,
          gridSize: currentAppState.gridSize,
          theme: currentAppState.theme,
          // Preservar estado de edição local (usando type assertion segura)
          ...((currentAppState as any).editingElement && { editingElement: (currentAppState as any).editingElement }),
          ...((currentAppState as any).draggingElement && { draggingElement: (currentAppState as any).draggingElement }),
          ...((currentAppState as any).resizingElement && { resizingElement: (currentAppState as any).resizingElement })
        };
        
        // PERFORMANCE: Aplicar apenas se houver diferenças significativas
        const hasSignificantChanges = JSON.stringify(currentElements) !== JSON.stringify(data.elements);
        
        if (hasSignificantChanges) {
          // Aplicar elementos e estado com animação suave
          requestAnimationFrame(() => {
            apiRef.current?.updateScene({
              elements: data.elements,
              appState: mergedAppState
            });
          });
        }
        
        // Atualizar referência dos elementos anteriores
        previousElementsRef.current = data.elements;
        pendingChangesRef.current = null; // Limpar mudanças pendentes
      }
      
      // Reduzir tempo de bloqueio para melhor responsividade
      setTimeout(() => {
        isUpdatingFromRemoteRef.current = false;
      }, 50);
    });

    onUserJoined((data) => {
      console.log('👋 Usuário entrou na colaboração:', data.userName);
    });

    onUserLeft((data) => {
      console.log('👋 Usuário saiu da colaboração:', data.userName);
    });

    return () => {
      console.log('🚪 Saindo da colaboração do projeto:', projectId);
      leaveProject(projectId);
      setIsCollaborating(false);
    };
  }, [projectId, session?.user?.id, isConnected, joinProject, leaveProject, onSceneUpdate, onUserJoined, onUserLeft]);

  // Carrega automaticamente se houver projectId na URL
  useEffect(() => {
    if (initialLoadId) {
      setProjectId(initialLoadId);
      load(initialLoadId).then((loadedScene) => {
        // Inicializar referência dos elementos
        if (loadedScene?.elements) {
          previousElementsRef.current = Array.from(loadedScene.elements);
        }
        isFirstLoadRef.current = false;
      }).catch(console.error);
    }
  }, [initialLoadId]);

  // OPTIMIZED SAVE: Salvar automaticamente com performance melhorada
  const autoSave = useCallback(async (scene: SceneData, force = false) => {
    if (!projectId || (isUpdatingFromRemoteRef.current && !force) || (isFirstLoadRef.current && !force)) return;
    
    try {
      // PARALLEL OPERATIONS: Salvar e broadcast em paralelo para melhor performance
      const savePromise = fetch(`/api/projects/${projectId}/excalidraw`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      
      // Broadcast imediato para colaboradores (não esperar save)
      if (isCollaborating && scene.elements && scene.appState) {
        // DIFFERENTIAL BROADCAST: Enviar apenas se houver mudanças reais
        const hasChanges = JSON.stringify(previousElementsRef.current) !== JSON.stringify(scene.elements);
        
        if (hasChanges) {
          broadcastScene(projectId, scene, Array.from(scene.elements), scene.appState);
        }
      }
      
      // Aguardar save completar
      await savePromise;
      
      // Atualizar referência dos elementos anteriores
      if (scene.elements) {
        previousElementsRef.current = Array.from(scene.elements);
      }
      
      // Marcar como salvo
      hasUnsavedChangesRef.current = false;
      lastSaveRef.current = Date.now();
      
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(""), 1500); // Feedback mais rápido
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 2500);
    }
  }, [projectId, isCollaborating, broadcastScene]);

  // Função para salvar forçadamente (usado em beforeunload/visibilitychange)
  const forceSave = useCallback(() => {
    if (!apiRef.current || !projectId || !hasUnsavedChangesRef.current) return;
    
    const scene = getScene();
    if (scene) {
      console.log('🚨 Salvamento forçado antes de sair da página');
      
      // Usar fetch síncrono com sendBeacon como fallback
      try {
        // Tentar fetch síncrono primeiro
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `/api/projects/${projectId}/excalidraw`, false); // false = síncrono
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ scene }));
        
        if (xhr.status === 200) {
          hasUnsavedChangesRef.current = false;
          console.log('✅ Salvamento síncrono bem-sucedido');
        }
      } catch (error) {
        console.warn('⚠️ Fetch síncrono falhou, tentando sendBeacon:', error);
        
        // Fallback para sendBeacon (assíncrono mas mais confiável)
        if (navigator.sendBeacon) {
          const data = new Blob([JSON.stringify({ scene })], { type: 'application/json' });
          const sent = navigator.sendBeacon(`/api/projects/${projectId}/excalidraw`, data);
          
          if (sent) {
            hasUnsavedChangesRef.current = false;
            console.log('📡 Salvamento com sendBeacon enviado');
          }
        }
      }
    }
  }, [projectId]);

  // Implementar salvamento antes de sair da página (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        // Tentar salvar sincronamente
        forceSave();
        
        // Se ainda há mudanças não salvas após tentativa, mostrar diálogo
        if (hasUnsavedChangesRef.current) {
          event.preventDefault();
          return (event.returnValue = 'Você tem mudanças não salvas. Tem certeza que deseja sair?');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [forceSave]);

  // Implementar salvamento quando página fica invisível (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnsavedChangesRef.current) {
        console.log('👁️ Página ficou invisível, salvando mudanças...');
        forceSave();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceSave]);

  // Implementar salvamento quando componente é desmontado
  useEffect(() => {
    return () => {
      if (hasUnsavedChangesRef.current) {
        console.log('💾 Componente desmontado, salvando mudanças...');
        forceSave();
      }
    };
  }, [forceSave]);

  useImperativeHandle(ref, () => ({ getScene, updateScene: updateSceneLocal, save, load }), [title, projectId]);

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
            // Evitar loop de atualizações durante sincronização remota
            if (isUpdatingFromRemoteRef.current) return;
            
            const now = Date.now();
            const allFiles = files ?? (apiRef.current?.getFiles ? apiRef.current.getFiles() : undefined);
            const sceneData = {
              elements,
              appState: sanitizeAppState(appState),
              files: serializeFiles(allFiles),
            };
            
            // LOCAL ECHO: Atualizar imediatamente na interface (otimistic update)
            latestSceneRef.current = sceneData;
            setIsDirty(true);
            hasUnsavedChangesRef.current = true;
            
            // Armazenar mudanças pendentes para broadcast
            pendingChangesRef.current = sceneData;
            
            // Callback original (resposta imediata)
            onChange?.(sceneData);
            
            // DIFFERENTIAL SYNC: Broadcast otimizado com throttling inteligente
            const timeSinceLastBroadcast = now - lastBroadcastRef.current;
            
            // Verificação segura para detectar se está desenhando
            const appStateAny = appState as any;
            const isDrawing = appState.activeTool?.type === 'freedraw' || 
                             appState.activeTool?.type === 'line' || 
                             appState.activeTool?.type === 'rectangle' ||
                             appState.activeTool?.type === 'ellipse' ||
                             appStateAny.draggingElement ||
                             appStateAny.resizingElement ||
                             appStateAny.editingElement;
            
            // Throttling dinâmico baseado na atividade
            const throttleDelay = isDrawing ? 50 : 200; // Mais rápido durante desenho
            
            if (broadcastTimeoutRef.current) {
              clearTimeout(broadcastTimeoutRef.current);
            }
            
            broadcastTimeoutRef.current = setTimeout(() => {
              if (pendingChangesRef.current && timeSinceLastBroadcast >= throttleDelay) {
                // Auto-save e colaboração
                autoSave(pendingChangesRef.current);
                lastBroadcastRef.current = Date.now();
                pendingChangesRef.current = null;
              }
            }, throttleDelay);
            
            lastUpdateRef.current = now;
          }}
          onPointerUpdate={(payload) => {
            // ULTRA-SMOOTH CURSORS: Sistema de cursor em tempo real otimizado
            if (isCollaborating && payload.pointer && projectId && apiRef.current) {
              const now = Date.now();
              const timeSinceLastCursor = now - (window as any).lastCursorUpdate || 0;
              
              // 60fps para cursors ultra-fluidos
              if (timeSinceLastCursor >= 16) {
                updateCursor(projectId, {
                  x: payload.pointer.x,
                  y: payload.pointer.y
                });
                
                (window as any).lastCursorUpdate = now;
              }
            }
          }}
        />
        
        {/* REAL-TIME PRESENCE: Indicadores de colaboradores com cursors */}
        {isCollaborating && collaborators.length > 0 && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 border backdrop-blur-sm bg-white/90">
            <div className="text-xs font-medium text-gray-600 mb-2">
              🟢 Colaboradores online ({collaborators.length})
            </div>
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <div key={collaborator.userId} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: collaborator.color }}
                  />
                  <span className="text-gray-700 font-medium">{collaborator.userName}</span>
                  {collaborator.cursor && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-gray-500 text-xs">ativo</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* REAL-TIME CURSORS: Mostrar cursors de outros colaboradores */}
        {isCollaborating && collaborators.map((collaborator) => {
          if (!collaborator.cursor || collaborator.userId === session?.user?.id) return null;
          
          return (
            <div
              key={`cursor-${collaborator.userId}`}
              className="absolute pointer-events-none z-50"
              style={{
                left: collaborator.cursor.x,
                top: collaborator.cursor.y,
                transform: 'translate(-4px, -4px)',
                transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)' // Transição suave
              }}
            >
              {/* Cursor pointer com sombra */}
              <div className="relative">
                <div 
                  className="w-5 h-5 rotate-45 border-2 border-white shadow-xl"
                  style={{ 
                    backgroundColor: collaborator.color,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                  }}
                />
                {/* Pequeno ponto central */}
                <div 
                  className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                  style={{ backgroundColor: 'white' }}
                />
              </div>
              
              {/* Nome do colaborador com animação */}
              <div 
                className="absolute top-6 left-1 px-2 py-1 rounded-md text-xs font-medium text-white shadow-lg whitespace-nowrap animate-pulse"
                style={{ 
                  backgroundColor: collaborator.color,
                  boxShadow: `0 2px 8px ${collaborator.color}40`
                }}
              >
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
                  {collaborator.userName}
                </div>
              </div>
              
              {/* Rastro do cursor (efeito visual) */}
              <div 
                className="absolute -top-1 -left-1 w-6 h-6 rounded-full opacity-20 animate-ping"
                style={{ backgroundColor: collaborator.color }}
              />
            </div>
          );
        })}
        
        {/* PERFORMANCE STATUS: Indicador de status otimizado */}
        {saveStatus && (
          <div className={`absolute top-4 left-4 px-3 py-1 rounded-lg text-xs font-medium backdrop-blur-sm transition-all duration-300 ${
            saveStatus === 'success' 
              ? 'bg-green-100/90 text-green-800 border border-green-200 shadow-sm'
              : 'bg-red-100/90 text-red-800 border border-red-200 shadow-sm'
          }`}>
            {saveStatus === 'success' ? '⚡ Sincronizado' : '⚠️ Erro na sincronização'}
          </div>
        )}
        
        {/* CONNECTION STATUS: Indicador de conexão melhorado */}
        <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm transition-all duration-300 ${
          isConnected && isCollaborating
            ? 'bg-green-100/90 text-green-800 border border-green-200 shadow-sm'
            : 'bg-gray-100/90 text-gray-600 border border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected && isCollaborating ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            {isConnected && isCollaborating ? 'Tempo Real' : 'Offline'}
          </div>
        </div>
      </div>
    </div>
  );
}

const ExcalidrawClient = forwardRef(ExcalidrawClientInner);
export default ExcalidrawClient;
