import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'achantes-room-v3'
const SIDEBAR_SIZE_KEY = 'achantes-sidebar-size-v1'
const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 520

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const isFormField = (element) => {
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

const defaultRoom = {
  name: 'Mi Achante',
  description: 'Un cuarto nostálgico para panas',
  wallColor: '#2f2648',
  style: 'grunge-neon',
  background: { type: 'color', value: '#2f2648', fit: 'cover', locked: false },
  layers: [
    { id: 'layer-bg', name: 'Fondo', kind: 'background', visible: true, locked: true },
    { id: 'layer-collage', name: 'Imágenes/GIFs', kind: 'media', visible: true, locked: false },
    { id: 'layer-draw', name: 'Dibujo', kind: 'drawing', visible: true, locked: false },
  ],
  activeLayerId: 'layer-draw',
  items: [],
  strokes: [],
}

const initialHistory = (snapshot) => ({ undoStack: [snapshot], redoStack: [] })

function App() {
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [history, setHistory] = useState(initialHistory(defaultRoom))
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([])
  const [tool, setTool] = useState('move')
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [currentStroke, setCurrentStroke] = useState([])
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_SIZE_KEY)) || 320)

  const mainRef = useRef(null)
  const drawCanvasRef = useRef(null)
  const panDragRef = useRef(null)
  // =========================
  // Historial global unificado
  // =========================
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const skipHistoryRef = useRef(false)

  const snapshotRoom = (value) => JSON.parse(JSON.stringify(value))
  const pushHistorySnapshot = (value) => {
    if (skipHistoryRef.current) return
    undoStackRef.current.push(snapshotRoom(value))
    if (undoStackRef.current.length > 120) undoStackRef.current.shift()
    redoStackRef.current = []
  }

  const drawEnabled = tool === 'brush' || tool === 'pencil' || tool === 'marker' || tool === 'eraser'
  const handMode = tool === 'hand' || spacePressed

  const commitRoom = (updater) => {
    setRoom((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        setHistory((h) => ({ undoStack: [...h.undoStack, next], redoStack: [] }))
      }
      return next
    })
  }

    const onNativeWheel = (event) => {
      if (event.shiftKey && !event.ctrlKey) {
        event.preventDefault()
        setView((prev) => {
          const minPanX = Math.min(0, viewport.width - WORLD_WIDTH * prev.zoom)
          return { ...prev, panX: clamp(prev.panX - event.deltaY, minPanX, 0) }
        })
        return
      }
      if (!event.ctrlKey) return
      event.preventDefault()
      const rect = host.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top

  const redo = () => {
    setHistory((h) => {
      if (h.redoStack.length === 0) return h
      const [next, ...rest] = h.redoStack
      setRoom(next)
      return { undoStack: [...h.undoStack, next], redoStack: rest }
    })
  }

  const getCanvasPoint = (event) => {
    const rect = mainRef.current.getBoundingClientRect()
    return { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom }
  }

  useEffect(() => localStorage.setItem(SIDEBAR_SIZE_KEY, String(sidebarWidth)), [sidebarWidth])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      setRoom({ ...defaultRoom, ...parsed })
      setHistory(initialHistory({ ...defaultRoom, ...parsed }))
      setStage('room')
    } catch { localStorage.removeItem(STORAGE_KEY) }
  }, [])

  useEffect(() => { if (stage === 'room') localStorage.setItem(STORAGE_KEY, JSON.stringify(room)) }, [room, stage])

  useEffect(() => {
    if (stage !== 'room') return
    pushHistorySnapshot(room)
  }, [room, stage])

  const getCanvasPoint = (event) => {
    const rect = mainRef.current.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left - view.panX) / view.zoom,
      y: (event.clientY - rect.top - view.panY) / view.zoom,
    }
  }

  const getMaxZ = () => {
    const layerMax = room.collage.layers.reduce((max, layer) => Math.max(max, layer.z || Z_BASE_BACKGROUND), Z_BASE_BACKGROUND)
    const itemMax = room.items.reduce((max, item) => Math.max(max, item.z || Z_BASE_ITEM), Z_BASE_ITEM)
    return clamp(Math.max(layerMax, itemMax), Z_BASE_BACKGROUND, MAX_LAYER_Z)
  }

  const updateItem = (id, patch) => {
    setRoom((prevRoom) => ({
      ...prevRoom,
      items: prevRoom.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const updateLayer = (id, patch) => {
    setRoom((prevRoom) => ({
      ...prevRoom,
      collage: {
        ...prevRoom.collage,
        layers: prevRoom.collage.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
      },
    }))
  }

  const removeSelectedEntity = () => {
    if (selectedItemId) {
      setRoom((prevRoom) => ({ ...prevRoom, items: prevRoom.items.filter((item) => item.id !== selectedItemId) }))
      setSelectedItemId(null)
      return
    }

    if (selectedLayerId) {
      setRoom((prevRoom) => ({
        ...prevRoom,
        collage: { ...prevRoom.collage, layers: prevRoom.collage.layers.filter((layer) => layer.id !== selectedLayerId) },
      }))
      setSelectedLayerId(null)
    }
  }

  const moveSelectedZ = (mode) => {
    const selectedType = selectedItemId ? 'item' : selectedLayerId ? 'layer' : null
    const selectedId = selectedItemId || selectedLayerId
    if (!selectedType || !selectedId) return

    const maxZ = getMaxZ()
    const minZ = selectedType === 'item' ? Z_BASE_ITEM : Z_BASE_BACKGROUND

    if (selectedType === 'item') {
      const selected = room.items.find((item) => item.id === selectedId)
      if (!selected) return
      const current = selected.z || Z_BASE_ITEM
      const target = mode === 'front' ? maxZ + 1 : mode === 'back' ? minZ : mode === 'forward' ? current + 1 : current - 1
      updateItem(selectedId, { z: clamp(target, minZ, MAX_LAYER_Z) })
      return
    }

    const selected = room.collage.layers.find((layer) => layer.id === selectedId)
    if (!selected) return
    const current = selected.z || Z_BASE_BACKGROUND
    const target = mode === 'front' ? maxZ + 1 : mode === 'back' ? minZ : mode === 'forward' ? current + 1 : current - 1
    updateLayer(selectedId, { z: clamp(target, minZ, MAX_LAYER_Z) })
  }

  const addItem = (type) => {
    const nextItem = {
      id: randomId(),
      type,
      x: 80,
      y: 80,
      w: 180,
      h: 120,
      content: '',
      editUrl: '',
      z: clamp(getMaxZ() + 1, Z_BASE_ITEM, MAX_LAYER_Z),
      ...defaultItemsByType[type],
    }

    setRoom((prevRoom) => ({ ...prevRoom, items: [...prevRoom.items, nextItem] }))
    setSelectedItemId(nextItem.id)
    setSelectedLayerId(null)
  }

  const addBackgroundImage = (src, x = 50, y = 60) => {
    setRoom((prevRoom) => ({
      ...prevRoom,
      collage: {
        ...prevRoom.collage,
        layers: [
          ...prevRoom.collage.layers,
          { id: randomId(), src, x, y, w: 240, h: 180, z: clamp(getMaxZ() + 1, Z_BASE_BACKGROUND, MAX_LAYER_Z) },
        ],
      },
    }))
  }

  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    canvas.width = WORLD_WIDTH
    canvas.height = WORLD_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    ;[...room.strokes, ...(currentStroke.length > 1 ? [{ id: 'preview', points: currentStroke, color: brushColor, size: brushSize, opacity: brushOpacity }] : [])].forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return
      ctx.globalAlpha = stroke.opacity ?? 1
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      ctx.globalAlpha = 1
    })
  }

  const startStroke = (event) => {
    // Solo click izquierdo dibuja. Click derecho y rueda quedan reservados.
    if (event.button !== 0) return
    if (drawMode && !handMode) setCurrentStroke([getCanvasPoint(event)])
  }

  const moveStroke = (event) => {
    if (drawMode && currentStroke.length > 0) setCurrentStroke((prev) => [...prev, getCanvasPoint(event)])
  }

  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) {
      setCurrentStroke([])
      return
    }

    const key = drawTargetRef.current === 'back' ? 'strokesBack' : 'strokesFront'
    setRoom((prevRoom) => ({
      ...prevRoom,
      collage: {
        ...prevRoom.collage,
        [key]: [...prevRoom.collage[key], { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }],
      },
    }))
    setCurrentStroke([])
  }

  const undoGlobal = () => {
    if (undoStackRef.current.length < 2) return
    const current = undoStackRef.current.pop()
    const previous = undoStackRef.current[undoStackRef.current.length - 1]
    if (!previous) return
    redoStackRef.current.push(current)
    skipHistoryRef.current = true
    setRoom(snapshotRoom(previous))
    requestAnimationFrame(() => { skipHistoryRef.current = false })
  }

  const redoGlobal = () => {
    if (redoStackRef.current.length === 0) return
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(snapshotRoom(next))
    skipHistoryRef.current = true
    setRoom(snapshotRoom(next))
    requestAnimationFrame(() => { skipHistoryRef.current = false })
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const activeField = isFormField(document.activeElement)
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        undoGlobal()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault()
        redoGlobal()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === '0') {
        event.preventDefault()
        const fitZoom = clamp(Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT), MIN_ZOOM, MAX_ZOOM)
        setView({ zoom: fitZoom, panX: (viewport.width - WORLD_WIDTH * fitZoom) / 2, panY: (viewport.height - WORLD_HEIGHT * fitZoom) / 2 })
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === '1') {
        event.preventDefault()
        setView((prev) => ({ ...prev, zoom: 1 }))
        return
      }
      if (!activeField && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        removeSelectedEntity()
        return
      }
      if (!activeField && key === ' ') {
        event.preventDefault()
        setSpacePressed(true)
        return
      }
      if (!activeField && key === 'a') {
        event.preventDefault()
        setHandMode((value) => !value)
        setDrawMode(false)
        return
      }
      if (!activeField && key === 'b') { setDrawMode(true); setHandMode(false); return }
      if (!activeField && key === 'h') { setHandMode(true); setDrawMode(false); return }
      if (key === 'escape') {
        setSelectedItemId(null)
        setSelectedLayerId(null)
        setDrawMode(false)
      }
    }

    const onKeyUp = (event) => {
      if (event.key === ' ') setSpacePressed(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [selectedItemId, selectedLayerId, currentStroke, drawMode, handMode, viewport.width, viewport.height])

  useEffect(() => {
    const onPaste = (event) => {
      if (stage !== 'room' || isFormField(event.target)) return
      const clipboardItems = event.clipboardData?.items
      if (!clipboardItems) return

      for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = () => addBackgroundImage(reader.result)
          reader.readAsDataURL(file)
          continue
        }

        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            const cleanText = text.trim()
            if (/https?:\/\//.test(cleanText)) addBackgroundImage(cleanText)
          })
        }
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage, room, view])

  const createRoom = (e) => { e.preventDefault(); setStage('room') }

  return stage === 'landing' ? <div className="landing"><form className="card" onSubmit={createRoom}><button type="submit">Entrar a la sala</button></form></div> : (
    <div className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}>
      <aside>
        <button className="menu-toggle" onClick={() => setMenuCollapsed((value) => !value)}>
          {menuCollapsed ? '▶ Abrir menú' : '◀ Ocultar menú'}
        </button>

        {!menuCollapsed && (
          <>
            <h3>{room.name}</h3>
            <p>{room.description}</p>
            <button onClick={copyInvite}>{copied ? '¡Copiado!' : 'Copiar invitación'}</button>
            <hr />

            <h4>Capas</h4>
            <button onClick={() => moveSelectedZ('forward')}>Traer adelante</button>
            <button onClick={() => moveSelectedZ('backward')}>Enviar atrás</button>
            <button onClick={() => moveSelectedZ('front')}>Traer al frente</button>
            <button onClick={() => moveSelectedZ('back')}>Enviar al fondo</button>
            <button onClick={() => setShowLayerLabels((value) => !value)}>
              {showLayerLabels ? 'Ocultar IDs capa' : 'Mostrar IDs capa'}
            </button>
            <small>Selecciona primero un objeto/capa para ordenarlo.</small>
            <hr />

            <h4>Collage fondo</h4>
            <button onClick={() => { setDrawMode((value) => !value); setHandMode(false) }}>
              {drawMode ? 'Salir dibujo' : 'Dibujar'}
            </button>
            <button onClick={() => { setHandMode((value) => !value); setDrawMode(false) }}>
              {handMode ? 'Mano activa (A)' : 'Activar mano (A)'}
            </button>
            <label>
              Capa dibujo
              <select value={drawTarget} onChange={(event) => setDrawTarget(event.target.value)}>
                <option value="back">Detrás de imágenes</option>
                <option value="front">Encima de imágenes</option>
              </select>
            </label>
            <label>
              Color
              <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
            </label>
            <label>
              Tamaño
              <input type="range" min="1" max="30" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
            <button onClick={() => undoGlobal()}>Deshacer global (Ctrl/Cmd+Z)</button>
            <button onClick={() => redoGlobal()}>Rehacer global (Ctrl/Cmd+Y)</button>
            <input placeholder="URL imagen o GIF" value={pastingUrl} onChange={(event) => setPastingUrl(event.target.value)} />
            <button onClick={() => pastingUrl.trim() && addBackgroundImage(pastingUrl.trim(), 60, 60)}>
              Agregar al fondo
            </button>
            {selectedLayerId && <button onClick={removeSelectedEntity}>Eliminar capa seleccionada</button>}
            <button onClick={() => setRoom((prevRoom) => ({ ...prevRoom, collage: { ...prevRoom.collage, layers: [], strokesBack: [], strokesFront: [] } }))}>
              Limpiar todo el fondo
            </button>
            <small>Pega imágenes/GIFs con Ctrl/Cmd+V. Pan: rueda presionada o espacio+drag. Zoom: Ctrl+rueda sobre canvas.</small>
            <hr />

            <h4>Módulos flotantes</h4>
            {moduleOptions.map((module) => (
              <button key={module.type} onClick={() => addItem(module.type)}>{module.label}</button>
            ))}
          </>
        )}
      </aside>

      <main
        ref={mainRef}
        style={{ background: roomGradient }}
        className={isPanning ? 'is-panning' : ''}
        onMouseMove={onMainMove}
        onMouseUp={clearDraggingState}
        onMouseLeave={clearDraggingState}
        onWheelCapture={(event) => { if (event.ctrlKey) event.preventDefault() }}
        onMouseDown={(event) => {
          const shouldPan = event.button === 1 || (event.button === 0 && (spacePressed || handMode))
          if (!shouldPan) return
          event.preventDefault()
          setIsPanning(true)
          panDragRef.current = {
            pointerStartX: event.clientX,
            pointerStartY: event.clientY,
            panStartX: view.panX,
            panStartY: view.panY,
          }
        }}
      >
        <div className="viewport-tools">
          <button onClick={() => setView((prevView) => ({ ...prevView, zoom: clamp(prevView.zoom * 1.1, MIN_ZOOM, MAX_ZOOM) }))}>+</button>
          <button onClick={() => setView((prevView) => ({ ...prevView, zoom: clamp(prevView.zoom * 0.9, MIN_ZOOM, MAX_ZOOM) }))}>-</button>
          <button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>Restablecer vista</button>
          <button onClick={() => {
            const fitZoom = clamp(Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT), MIN_ZOOM, MAX_ZOOM)
            setView({ zoom: fitZoom, panX: (viewport.width - WORLD_WIDTH * fitZoom) / 2, panY: (viewport.height - WORLD_HEIGHT * fitZoom) / 2 })
          }}>
            Ajustar a pantalla
          </button>
        </div>
        <label>Tamaño<input type="range" min="1" max="40" value={brushSize} onChange={(e)=>setBrushSize(Number(e.target.value))} /></label>
        <label>Opacidad<input type="range" min="0.1" max="1" step="0.05" value={brushOpacity} onChange={(e)=>setBrushOpacity(Number(e.target.value))} /></label>
        <label>Color<input type="color" value={brushColor} onChange={(e)=>setBrushColor(e.target.value)} /></label>
      </aside>
      <div className="sidebar-resizer" onMouseDown={(e)=>{sidebarResizeRef.current={startX:e.clientX,startW:sidebarWidth}}} />
      <main ref={mainRef} onMouseMove={(event)=>{
        if (sidebarResizeRef.current) { const delta = event.clientX - sidebarResizeRef.current.startX; setSidebarWidth(clamp(sidebarResizeRef.current.startW + delta, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)); return }
        if (panDragRef.current) { const dX = event.clientX - panDragRef.current.x; const dY = event.clientY - panDragRef.current.y; setView((v)=>({...v, panX: panDragRef.current.panX + dX, panY: panDragRef.current.panY + dY})); return }
        if (dragEntityRef.current?.type === 'item') {
          const point = getCanvasPoint(event)
          const id = dragEntityRef.current.id
          commitRoom((r)=>({ ...r, items: r.items.map((it)=>it.id===id?{...it,x:point.x-50,y:point.y-20}:it) }))
        }
        if (drawEnabled && currentStroke.length > 0) setCurrentStroke((prev) => [...prev, getCanvasPoint(event)])
      }} onMouseUp={()=>{ sidebarResizeRef.current = null; panDragRef.current = null; dragEntityRef.current = null; if (currentStroke.length>1) commitRoom((r)=>({ ...r, strokes:[...r.strokes,{id:randomId(), points: currentStroke, color: brushColor, size: brushSize, opacity: brushOpacity}] })); setCurrentStroke([]); setIsPanning(false) }}
      onWheel={(e)=>{
        if (e.ctrlKey) { e.preventDefault(); const f = e.deltaY>0?0.9:1.1; setView((v)=>({...v,zoom:clamp(v.zoom*f,MIN_ZOOM,MAX_ZOOM)})); return }
        if (e.shiftKey) setView((v)=>({...v, panX:v.panX-e.deltaY}))
      }}>
        <div className="viewport-tools"><button onClick={fitToContent}>Ajustar pantalla</button></div>
        <div className="design-surface" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
          {room.items.map((item) => <div key={item.id} className={`item ${selectedItemIds.includes(item.id)?'selected':''}`} style={{left:item.x,top:item.y,width:item.w,height:item.h}} onMouseDown={(e)=>{ if (e.button!==0) return; setSelectedItemIds([item.id]); if (tool==='move') dragEntityRef.current={type:'item',id:item.id}; }}>{item.type==='gif'||item.type==='image'?<img src={item.content} draggable={false} alt="media"/>:item.content}</div>)}
          <canvas ref={drawCanvasRef} className="bg-canvas front drawing" onMouseDown={(e)=>{ if (e.button!==0) return; if (handMode){ setIsPanning(true); panDragRef.current={x:e.clientX,y:e.clientY,panX:view.panX,panY:view.panY}; return } if (drawEnabled) setCurrentStroke([getCanvasPoint(e)]) }} />
        </div>
      </main>
    </div>
  )
}

export default App
