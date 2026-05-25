import { useEffect, useMemo, useRef, useState } from 'react'

// =========================
// Configuración base canvas
// =========================
const STORAGE_KEY = 'achantes-room-v3'
const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

const TOOL = {
  MOVE: 'move',
  HAND: 'hand',
  BRUSH: 'brush',
  PENCIL: 'pencil',
  ERASER: 'eraser',
}

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const isFormField = (element) => {
  if (!element) return false
  const tagName = element.tagName?.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable
}

const defaultRoom = {
  name: 'Mi Achante',
  description: 'Un cuarto nostálgico para panas',
  wallColor: '#2f2648',
  items: [],
  strokes: [],
  layers: [
    { id: 'media', name: 'Media', z: 10 },
    { id: 'draw', name: 'Dibujo', z: 20 },
  ],
  activeLayerId: 'draw',
}

function App() {
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [tool, setTool] = useState(TOOL.MOVE)
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([])
  const [currentStroke, setCurrentStroke] = useState([])
  const [spacePressed, setSpacePressed] = useState(false)
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [viewport, setViewport] = useState({ width: 1, height: 1 })

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

  const handMode = tool === TOOL.HAND || spacePressed
  const drawMode = tool === TOOL.BRUSH || tool === TOOL.PENCIL || tool === TOOL.ERASER

  // =========================
  // Conversión coordenadas pantalla -> mundo
  // =========================
  const getCanvasPoint = (event) => {
    const rect = mainRef.current.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left - view.panX) / view.zoom,
      y: (event.clientY - rect.top - view.panY) / view.zoom,
    }
  }

  // =========================
  // Carga/persistencia
  // =========================
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      const hydrated = { ...defaultRoom, ...parsed }
      setRoom(hydrated)
      undoStackRef.current = [snapshotRoom(hydrated)]
      redoStackRef.current = []
      setStage('room')
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'room') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(room))
    pushHistorySnapshot(room)
  }, [room, stage])

  // =========================
  // Render de trazos
  // =========================
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    canvas.width = WORLD_WIDTH
    canvas.height = WORLD_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    const allStrokes = [...room.strokes]
    if (currentStroke.length > 1) allStrokes.push({ id: 'preview', color: brushColor, size: brushSize, points: currentStroke })

    allStrokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.points.forEach((point, idx) => (idx === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
      ctx.stroke()
    })
  }, [room.strokes, currentStroke, brushColor, brushSize])

  useEffect(() => {
    if (!mainRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(mainRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = mainRef.current
    if (!host) return

    const onNativeWheel = (event) => {
      if (event.shiftKey && !event.ctrlKey) {
        event.preventDefault()
        setView((prev) => ({ ...prev, panX: prev.panX - event.deltaY }))
        return
      }
      if (!event.ctrlKey) return
      event.preventDefault()
      const rect = host.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      setView((prev) => {
        const nextZoom = clamp(prev.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM)
        const worldX = (cursorX - prev.panX) / prev.zoom
        const worldY = (cursorY - prev.panY) / prev.zoom
        return { zoom: nextZoom, panX: cursorX - worldX * nextZoom, panY: cursorY - worldY * nextZoom }
      })
    }

    host.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => host.removeEventListener('wheel', onNativeWheel)
  }, [])

  // =========================
  // Interacción de dibujo
  // =========================
  const startStroke = (event) => {
    // Dibujo solo con click izquierdo.
    if (event.button !== 0) return
    if (!drawMode || handMode) return
    setCurrentStroke([getCanvasPoint(event)])
  }

  const moveStroke = (event) => {
    if (!drawMode || currentStroke.length === 0) return
    setCurrentStroke((prev) => [...prev, getCanvasPoint(event)])
  }

  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) {
      setCurrentStroke([])
      return
    }
    setRoom((prev) => ({
      ...prev,
      strokes: [...prev.strokes, { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }],
    }))
    setCurrentStroke([])
  }

  const fitToBase = () => {
    const fitZoom = clamp(Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT), MIN_ZOOM, MAX_ZOOM)
    setView({ zoom: fitZoom, panX: (viewport.width - WORLD_WIDTH * fitZoom) / 2, panY: (viewport.height - WORLD_HEIGHT * fitZoom) / 2 })
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (isFormField(event.target)) return

      if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); undoGlobal(); return }
      if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redoGlobal(); return }
      if ((event.ctrlKey || event.metaKey) && key === '0') { event.preventDefault(); fitToBase(); return }
      if ((event.ctrlKey || event.metaKey) && key === '1') { event.preventDefault(); setView((prev) => ({ ...prev, zoom: 1 })); return }
      if ((event.ctrlKey || event.metaKey) && key === 'a') { event.preventDefault(); setSelectedItemIds(room.items.map((i) => i.id)); setSelectedStrokeIds(room.strokes.map((s) => s.id)); return }
      if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault()
        setRoom((prev) => ({ ...prev, items: [...prev.items, ...prev.items.filter((i) => selectedItemIds.includes(i.id)).map((i) => ({ ...i, id: randomId(), x: i.x + 20, y: i.y + 20 }))] }))
        return
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        setRoom((prev) => ({ ...prev, items: prev.items.filter((i) => !selectedItemIds.includes(i.id)), strokes: prev.strokes.filter((s) => !selectedStrokeIds.includes(s.id)) }))
        return
      }
      if (key === 'escape') { setSelectedItemIds([]); setSelectedStrokeIds([]); return }
      if (key === ' ') { event.preventDefault(); setSpacePressed(true); return }
      if (key === 'v') setTool(TOOL.MOVE)
      if (key === 'h') setTool(TOOL.HAND)
      if (key === 'b') setTool(TOOL.BRUSH)
      if (key === 'p') setTool(TOOL.PENCIL)
      if (key === 'e') setTool(TOOL.ERASER)
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
  }, [room.items, room.strokes, selectedItemIds, selectedStrokeIds])

  const roomGradient = useMemo(() => `linear-gradient(160deg, ${room.wallColor}, #180f28)`, [room.wallColor])

  if (stage === 'landing') {
    return <div className="landing"><button onClick={() => setStage('room')}>Entrar a la sala</button></div>
  }

  return (
    <div className="app-shell">
      <aside>
        <h3>Herramientas</h3>
        <button onClick={() => setTool(TOOL.MOVE)}>V Mover</button>
        <button onClick={() => setTool(TOOL.HAND)}>H Mano</button>
        <button onClick={() => setTool(TOOL.BRUSH)}>B Pincel</button>
        <button onClick={() => setTool(TOOL.PENCIL)}>P Lápiz</button>
        <button onClick={() => setTool(TOOL.ERASER)}>E Borrador</button>
        <label>Color<input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} /></label>
        <label>Tamaño<input type="range" min="1" max="30" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
        <button onClick={undoGlobal}>Undo</button>
        <button onClick={redoGlobal}>Redo</button>
      </aside>

      <main
        ref={mainRef}
        style={{ background: roomGradient }}
        onMouseMove={(event) => {
          if (!panDragRef.current) return
          setView((prev) => ({ ...prev, panX: panDragRef.current.panX + (event.clientX - panDragRef.current.x), panY: panDragRef.current.panY + (event.clientY - panDragRef.current.y) }))
        }}
        onMouseUp={() => { panDragRef.current = null; endStroke() }}
        onMouseDown={(event) => {
          const shouldPan = event.button === 1 || (event.button === 0 && handMode)
          if (!shouldPan) return
          event.preventDefault()
          panDragRef.current = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY }
        }}
      >
        <div className="viewport-tools"><button onClick={fitToBase}>Ajustar pantalla</button></div>
        <div className="design-surface" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
          {room.items.map((item) => (
            <div key={item.id} className={`item ${selectedItemIds.includes(item.id) ? 'selected' : ''}`} style={{ left: item.x, top: item.y, width: item.w || 180, height: item.h || 120 }}>
              {item.content || 'item'}
            </div>
          ))}

          <canvas
            ref={drawCanvasRef}
            className="bg-canvas front drawing"
            onMouseDown={startStroke}
            onMouseMove={moveStroke}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
          />
        </div>
      </main>
    </div>
  )
}

export default App
