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
  const dragEntityRef = useRef(null)
  const sidebarResizeRef = useRef(null)

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

  const undo = () => {
    setHistory((h) => {
      if (h.undoStack.length < 2) return h
      const nextUndo = h.undoStack.slice(0, -1)
      const current = h.undoStack[h.undoStack.length - 1]
      const previous = nextUndo[nextUndo.length - 1]
      setRoom(previous)
      return { undoStack: nextUndo, redoStack: [current, ...h.redoStack] }
    })
  }

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
    if (!mainRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(mainRef.current)
    return () => observer.disconnect()
  }, [])

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
  }, [room.strokes, currentStroke, brushColor, brushSize, brushOpacity])

  const fitToContent = () => {
    const boxes = [
      ...room.items.map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h })),
      ...room.strokes.filter((s) => s.points?.length).map((s) => {
        const xs = s.points.map((p) => p.x)
        const ys = s.points.map((p) => p.y)
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
      }),
    ]
    if (boxes.length === 0) {
      const zoom = clamp(Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT), MIN_ZOOM, MAX_ZOOM)
      setView({ zoom, panX: (viewport.width - WORLD_WIDTH * zoom) / 2, panY: (viewport.height - WORLD_HEIGHT * zoom) / 2 })
      return
    }
    const minX = Math.min(...boxes.map((b) => b.x)); const minY = Math.min(...boxes.map((b) => b.y))
    const maxX = Math.max(...boxes.map((b) => b.x + b.w)); const maxY = Math.max(...boxes.map((b) => b.y + b.h))
    const contentW = Math.max(1, maxX - minX); const contentH = Math.max(1, maxY - minY)
    const margin = 120
    const zoom = clamp(Math.min((viewport.width - margin) / contentW, (viewport.height - margin) / contentH), MIN_ZOOM, MAX_ZOOM)
    setView({ zoom, panX: viewport.width / 2 - ((minX + maxX) / 2) * zoom, panY: viewport.height / 2 - ((minY + maxY) / 2) * zoom })
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const cmd = event.ctrlKey || event.metaKey
      if (isFormField(event.target)) return
      if (cmd && key === 'z') { event.preventDefault(); undo(); return }
      if (cmd && key === 'y') { event.preventDefault(); redo(); return }
      if (cmd && key === '0') { event.preventDefault(); fitToContent(); return }
      if (cmd && key === '1') { event.preventDefault(); setView((v) => ({ ...v, zoom: 1 })); return }
      if (cmd && key === 'a') { event.preventDefault(); setSelectedItemIds(room.items.map((i) => i.id)); setSelectedStrokeIds(room.strokes.map((s) => s.id)); return }
      if (cmd && key === 'd') { event.preventDefault(); commitRoom((r) => ({ ...r, items: [...r.items, ...r.items.filter((i) => selectedItemIds.includes(i.id)).map((i) => ({ ...i, id: randomId(), x: i.x + 30, y: i.y + 30 }))] })); return }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); commitRoom((r) => ({ ...r, items: r.items.filter((i) => !selectedItemIds.includes(i.id)), strokes: r.strokes.filter((s) => !selectedStrokeIds.includes(s.id)) })); return }
      if (key === 'escape') { setSelectedItemIds([]); setSelectedStrokeIds([]); return }
      if (key === ' ') { event.preventDefault(); setSpacePressed(true); return }
      if (key === 'b') setTool('brush')
      if (key === 'p') setTool('pencil')
      if (key === 'e') setTool('eraser')
      if (key === 'v') setTool('move')
      if (key === 'h') setTool('hand')
    }
    const onKeyUp = (event) => { if (event.key === ' ') setSpacePressed(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [room, selectedItemIds, selectedStrokeIds])

  const createRoom = (e) => { e.preventDefault(); setStage('room') }

  return stage === 'landing' ? <div className="landing"><form className="card" onSubmit={createRoom}><button type="submit">Entrar a la sala</button></form></div> : (
    <div className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}>
      <aside>
        <h3>Herramientas</h3>
        <div className="toolbar-grid">
          {['move','hand','pencil','brush','marker','eraser'].map((name) => <button key={name} className={tool===name?'active':''} title={name} onClick={() => setTool(name)}>{name}</button>)}
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
