// Sistema de merge inteligente baseado no padrão oficial do Excalidraw
// Implementa versionamento, tombstoning e resolução de conflitos

export interface ExcalidrawElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  strokeColor: string
  backgroundColor: string
  fillStyle: string
  strokeWidth: number
  strokeStyle: string
  roughness: number
  opacity: number
  groupIds: readonly string[]
  frameId: string | null
  roundness: null | { type: number }
  seed: number
  versionNonce: number
  isDeleted: boolean
  link: string | null
  locked: boolean
  // Campos adicionados para colaboração
  version: number
  [key: string]: any
}

export interface ExcalidrawAppState {
  viewBackgroundColor: string
  currentItemStrokeColor: string
  currentItemBackgroundColor: string
  currentItemFillStyle: string
  currentItemStrokeWidth: number
  currentItemStrokeStyle: string
  currentItemRoughness: number
  currentItemOpacity: number
  currentItemFontFamily: number
  currentItemFontSize: number
  currentItemTextAlign: string
  currentItemStartArrowhead: string | null
  currentItemEndArrowhead: string | null
  scrollX: number
  scrollY: number
  zoom: { value: number }
  currentItemRoundness: string
  gridSize: number | null
  colorPalette: Record<string, string>
  currentStrokeOptions: Record<string, any>
  previousGridSize: number | null
  frameRendering: { enabled: boolean; clip: boolean; name: boolean; outline: boolean }
  [key: string]: any
}

export interface ExcalidrawScene {
  elements: ExcalidrawElement[]
  appState: ExcalidrawAppState
  files?: Record<string, any>
}

/**
 * Adiciona campos de versionamento a um elemento se não existirem
 */
export function ensureVersioning(element: ExcalidrawElement): ExcalidrawElement {
  return {
    ...element,
    version: element.version ?? 1,
    versionNonce: element.versionNonce ?? Math.floor(Math.random() * 1000000),
    isDeleted: element.isDeleted ?? false
  }
}

/**
 * Incrementa a versão de um elemento quando ele é modificado
 */
export function incrementVersion(element: ExcalidrawElement): ExcalidrawElement {
  return {
    ...element,
    version: (element.version ?? 0) + 1,
    versionNonce: Math.floor(Math.random() * 1000000)
  }
}

/**
 * Marca um elemento como deletado (tombstoning)
 */
export function markAsDeleted(element: ExcalidrawElement): ExcalidrawElement {
  return incrementVersion({
    ...element,
    isDeleted: true
  })
}

/**
 * Compara dois elementos e retorna o mais recente baseado na versão
 */
export function getNewerElement(local: ExcalidrawElement, remote: ExcalidrawElement): ExcalidrawElement {
  // Garantir que ambos tenham versionamento
  const localVersioned = ensureVersioning(local)
  const remoteVersioned = ensureVersioning(remote)

  // Comparar versões
  if (localVersioned.version > remoteVersioned.version) {
    return localVersioned
  } else if (remoteVersioned.version > localVersioned.version) {
    return remoteVersioned
  } else {
    // Mesma versão - usar versionNonce para desempate (menor vence)
    return localVersioned.versionNonce <= remoteVersioned.versionNonce 
      ? localVersioned 
      : remoteVersioned
  }
}

/**
 * Faz merge de dois arrays de elementos seguindo o algoritmo oficial do Excalidraw
 */
export function mergeElements(
  localElements: ExcalidrawElement[], 
  remoteElements: ExcalidrawElement[]
): ExcalidrawElement[] {
  // Criar maps para acesso rápido por ID
  const localMap = new Map<string, ExcalidrawElement>()
  const remoteMap = new Map<string, ExcalidrawElement>()
  
  // Garantir versionamento em todos os elementos
  localElements.forEach(el => {
    localMap.set(el.id, ensureVersioning(el))
  })
  
  remoteElements.forEach(el => {
    remoteMap.set(el.id, ensureVersioning(el))
  })

  // Criar união de todos os IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  const mergedElements: ExcalidrawElement[] = []

  // Para cada ID, escolher a versão mais recente
  allIds.forEach(id => {
    const localElement = localMap.get(id)
    const remoteElement = remoteMap.get(id)

    if (localElement && remoteElement) {
      // Ambos existem - escolher o mais recente
      mergedElements.push(getNewerElement(localElement, remoteElement))
    } else if (localElement) {
      // Apenas local existe
      mergedElements.push(localElement)
    } else if (remoteElement) {
      // Apenas remoto existe
      mergedElements.push(remoteElement)
    }
  })

  // Filtrar elementos deletados para renderização (mas manter no array para sincronização)
  return mergedElements
}

/**
 * Filtra elementos deletados para renderização
 */
export function filterDeletedElements(elements: ExcalidrawElement[]): ExcalidrawElement[] {
  return elements.filter(el => !el.isDeleted)
}

/**
 * Faz merge de dois estados de aplicação, preservando configurações locais importantes
 */
export function mergeAppState(
  localAppState: ExcalidrawAppState, 
  remoteAppState: ExcalidrawAppState
): ExcalidrawAppState {
  return {
    ...remoteAppState,
    // Preservar configurações de viewport locais
    scrollX: localAppState.scrollX,
    scrollY: localAppState.scrollY,
    zoom: localAppState.zoom,
    // Preservar configurações de UI locais
    gridSize: localAppState.gridSize,
    frameRendering: localAppState.frameRendering,
    // Preservar configurações de tema
    viewBackgroundColor: localAppState.viewBackgroundColor
  }
}

/**
 * Faz merge completo de duas cenas do Excalidraw
 */
export function mergeScenes(localScene: ExcalidrawScene, remoteScene: ExcalidrawScene): ExcalidrawScene {
  return {
    elements: mergeElements(localScene.elements, remoteScene.elements),
    appState: mergeAppState(localScene.appState, remoteScene.appState),
    files: { ...localScene.files, ...remoteScene.files }
  }
}

/**
 * Prepara elementos para envio (incrementa versão dos elementos modificados)
 */
export function prepareElementsForBroadcast(
  elements: ExcalidrawElement[], 
  modifiedElementIds: Set<string>
): ExcalidrawElement[] {
  return elements.map(element => {
    if (modifiedElementIds.has(element.id)) {
      return incrementVersion(element)
    }
    return ensureVersioning(element)
  })
}

/**
 * Detecta quais elementos foram modificados comparando com versão anterior
 */
export function detectModifiedElements(
  currentElements: ExcalidrawElement[],
  previousElements: ExcalidrawElement[]
): Set<string> {
  const modifiedIds = new Set<string>()
  const previousMap = new Map(previousElements.map(el => [el.id, el]))

  currentElements.forEach(current => {
    const previous = previousMap.get(current.id)
    
    if (!previous) {
      // Elemento novo
      modifiedIds.add(current.id)
    } else {
      // Verificar se houve mudanças (excluindo campos de versionamento)
      const { version: currentVersion, versionNonce: currentNonce, ...currentData } = current
      const { version: previousVersion, versionNonce: previousNonce, ...previousData } = previous
      
      if (JSON.stringify(currentData) !== JSON.stringify(previousData)) {
        modifiedIds.add(current.id)
      }
    }
  })

  // Verificar elementos deletados
  previousElements.forEach(previous => {
    if (!currentElements.find(current => current.id === previous.id)) {
      modifiedIds.add(previous.id)
    }
  })

  return modifiedIds
}
