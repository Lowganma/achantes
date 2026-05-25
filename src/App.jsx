import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'achantes-room-v2'
const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

const moduleOptions = [
  { type: 'poster', label: 'Poster URL' },
  { type: 'gif', label: 'GIF URL' },
  { type: 'text', label: 'Texto decorativo' },
  { type: 'postit', label: 'Post-it' },
  { type: 'player', label: 'Reproductor link' },
  { type: 'dice', label: 'Dado simple' },
  { type: 'signwall', label: 'Muro firmas' },
]

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
  style: 'grunge-neon',
  items: [],
  collage: { layers: [], strokesBack: [], strokesFront: [] },
}

const normalizeGifUrl = (rawUrl) => {
  const value = rawUrl.trim()
  if (!value) return ''
  if (/\.(gif|webp)(\?|$)/i.test(value) || value.startsWith('data:image/')) return value
  const tenorMatch = value.match(/tenor\.com\/(?:view|es\/view)\/[^/]*-(\d+)/i)
  if (tenorMatch) return `https://media.tenor.com/${tenorMatch[1]}/tenor.gif`
  const giphyMatch = value.match(/giphy\.com\/(?:gifs|media)\/[^/]*-([a-zA-Z0-9]+)$/i)
  if (giphyMatch) return `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`
  return value
}

const defaultItemsByType = {
  poster: { content: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600' },
  gif: { content: 'https://media.giphy.com/media/TilmLMmWrRYYHjLfub/giphy.gif', w: 240, h: 160 },
  text: { content: 'ACHANTE VIBES ✦' },
  postit: { content: 'No olvides invitar al combo 🔥', w: 160, h: 160 },
  player: { content: 'https://open.spotify.com/' },
  dice: { content: '🎲 1' },
  signwall: { content: 'Firma aquí:\n- @pana1: brutal\n- @pana2: qué nivel', w: 240, h: 170 },
}

function App() {
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [form, setForm] = useState({ name: '', description: '', wallColor: '#32214d', style: 'grunge-neon' })
  const [copied, setCopied] = useState(false)
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [pastingUrl, setPastingUrl] = useState('')
  const [drawMode, setDrawMode] = useState(false)
  const [drawTarget, setDrawTarget] = useState('front')
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [currentStroke, setCurrentStroke] = useState([])
  const [draggingId, setDraggingId] = useState(null)
  const [dragLayerId, setDragLayerId] = useState(null)
  const [resizeLayerId, setResizeLayerId] = useState(null)
  const [resizeItemId, setResizeItemId] = useState(null)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })

  const mainRef = useRef(null)
  const backCanvasRef = useRef(null)
  const frontCanvasRef = useRef(null)
  const drawTargetRef = useRef(drawTarget)
  const panDragRef = useRef(null)

  useEffect(() => { drawTargetRef.current = drawTarget }, [drawTarget])
  useEffect(() => {
    if (!mainRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(mainRef.current)
    return () => observer.disconnect()
  }, [])

  const roomGradient = useMemo(() => {
    if (room.style === 'punk-zine') return `linear-gradient(135deg, ${room.wallColor}, #111)`
    if (room.style === 'retro-pop') return `radial-gradient(circle at 20% 20%, #ff4d9d, ${room.wallColor})`
    return `linear-gradient(160deg, ${room.wallColor}, #180f28)`
  }, [room.style, room.wallColor])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const parsed = JSON.parse(saved)
    setRoom({ ...defaultRoom, ...parsed, collage: { layers: [], strokesBack: [], strokesFront: [], ...(parsed.collage || {}) } })
    setStage('room')
  }, [])
  useEffect(() => { if (stage === 'room') localStorage.setItem(STORAGE_KEY, JSON.stringify(room)) }, [room, stage])

  const getCanvasPoint = (event) => {
    const rect = mainRef.current.getBoundingClientRect()
    return { x: (event.clientX - rect.left - view.panX) / view.zoom, y: (event.clientY - rect.top - view.panY) / view.zoom }
  }
  const updateItem = (id, patch) => setRoom((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const updateLayer = (id, patch) => setRoom((p) => ({ ...p, collage: { ...p.collage, layers: p.collage.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }))
  const removeSelectedEntity = () => {
    if (selectedItemId) return setRoom((p) => ({ ...p, items: p.items.filter((it) => it.id !== selectedItemId) })), setSelectedItemId(null)
    if (selectedLayerId) setRoom((p) => ({ ...p, collage: { ...p.collage, layers: p.collage.layers.filter((l) => l.id !== selectedLayerId) } })), setSelectedLayerId(null)
  }

  const addItem = (type) => {
    const nextItem = { ...{ id: randomId(), type, x: 80, y: 80, w: 180, h: 120, content: '', editUrl: '' }, ...defaultItemsByType[type] }
    if (type === 'gif') nextItem.editUrl = nextItem.content
    setRoom((p) => ({ ...p, items: [...p.items, nextItem] }))
    setSelectedItemId(nextItem.id)
    setSelectedLayerId(null)
  }
  const addBackgroundImage = (src, x = 50, y = 60) => setRoom((p) => ({ ...p, collage: { ...p.collage, layers: [...p.collage.layers, { id: randomId(), src, x, y, w: 240, h: 180, z: p.collage.layers.length + 1 }] } }))

  const drawStrokes = (canvas, strokes, previewStroke) => {
    if (!canvas) return
    canvas.width = WORLD_WIDTH
    canvas.height = WORLD_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;[...strokes, ...(previewStroke ? [previewStroke] : [])].forEach((stroke) => {
      if (stroke.points.length < 2) return
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.points.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
      ctx.stroke()
    })
  }
  const startStroke = (event) => drawMode && setCurrentStroke([getCanvasPoint(event)])
  const moveStroke = (event) => drawMode && currentStroke.length > 0 && setCurrentStroke((prev) => [...prev, getCanvasPoint(event)])
  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) return setCurrentStroke([])
    const key = drawTargetRef.current === 'back' ? 'strokesBack' : 'strokesFront'
    setRoom((p) => ({ ...p, collage: { ...p.collage, [key]: [...p.collage[key], { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }] } }))
    setCurrentStroke([])
  }
  const undoStroke = (target = drawTargetRef.current) => {
    const key = target === 'back' ? 'strokesBack' : 'strokesFront'
    setRoom((p) => ({ ...p, collage: { ...p.collage, [key]: p.collage[key].slice(0, -1) } }))
  }

  useEffect(() => {
    if (stage !== 'room') return
    const preview = currentStroke.length > 1 ? { points: currentStroke, color: brushColor, size: brushSize } : null
    drawStrokes(backCanvasRef.current, room.collage.strokesBack, drawTarget === 'back' ? preview : null)
    drawStrokes(frontCanvasRef.current, room.collage.strokesFront, drawTarget === 'front' ? preview : null)
  }, [stage, room.collage.strokesBack, room.collage.strokesFront, currentStroke, drawTarget, brushColor, brushSize])

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const activeField = isFormField(document.activeElement)
      if ((event.ctrlKey || event.metaKey) && key === 'z') return event.preventDefault(), undoStroke()
      if (!activeField && (key === 'delete' || key === 'backspace')) return event.preventDefault(), removeSelectedEntity()
      if (!activeField && key === ' ') return event.preventDefault(), setSpacePressed(true)
    }
    const onKeyUp = (event) => event.key === ' ' && setSpacePressed(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [selectedItemId, selectedLayerId])

  useEffect(() => {
    const onPaste = (event) => {
      if (stage !== 'room' || isFormField(event.target)) return
      const clipboardItems = event.clipboardData?.items
      if (!clipboardItems) return
      for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) { const file = item.getAsFile(); if (!file) continue; const reader = new FileReader(); reader.onload = () => addBackgroundImage(reader.result); reader.readAsDataURL(file); continue }
        if (item.type === 'text/plain') item.getAsString((txt) => /https?:\/\//.test(txt.trim()) && addBackgroundImage(txt.trim()))
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage])

  const onMainMove = (event) => {
    const point = getCanvasPoint(event)
    if (panDragRef.current) {
      const { pointerStartX, pointerStartY, panStartX, panStartY } = panDragRef.current
      setView((p) => ({ ...p, panX: panStartX + (event.clientX - pointerStartX), panY: panStartY + (event.clientY - pointerStartY) }))
      return
    }
    if (draggingId && !drawMode) updateItem(draggingId, { x: clamp(point.x - 60, 0, WORLD_WIDTH - 120), y: clamp(point.y - 24, 0, WORLD_HEIGHT - 60) })
    if (dragLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === dragLayerId)
      if (layer) updateLayer(dragLayerId, { x: clamp(point.x - layer.w / 2, 0, WORLD_WIDTH - layer.w), y: clamp(point.y - layer.h / 2, 0, WORLD_HEIGHT - layer.h) })
    }
    if (resizeItemId) {
      const item = room.items.find((entry) => entry.id === resizeItemId)
      if (item) updateItem(resizeItemId, { w: clamp(point.x - item.x, 80, WORLD_WIDTH - item.x), h: clamp(point.y - item.y, 80, WORLD_HEIGHT - item.y) })
    }
    if (resizeLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === resizeLayerId)
      if (layer) updateLayer(resizeLayerId, { w: clamp(point.x - layer.x, 60, WORLD_WIDTH - layer.x), h: clamp(point.y - layer.y, 60, WORLD_HEIGHT - layer.y) })
    }
  }

  const clearDraggingState = () => { setDraggingId(null); setDragLayerId(null); setResizeLayerId(null); setResizeItemId(null); setIsPanning(false); panDragRef.current = null; endStroke() }
  const createRoom = (event) => { event.preventDefault(); setRoom((prev) => ({ ...prev, ...form })); setStage('room') }
  const copyInvite = async () => { const invite = `${window.location.origin}/room/${room.name.toLowerCase().replaceAll(' ', '-')}`; await navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const applyGifUrl = (itemId) => {
    const item = room.items.find((entry) => entry.id === itemId)
    if (!item) return
    const nextUrl = normalizeGifUrl(item.editUrl || '')
    if (!nextUrl) return
    updateItem(itemId, { content: nextUrl, editUrl: nextUrl, loadError: '' })
  }

  if (stage === 'landing') return <div className="min-h-screen landing"><header><h1>Achantes</h1><p>Arma tu achante</p></header><form className="card" onSubmit={createRoom}><h2>Crea tu sala</h2><input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><label>Color de pared <input type="color" value={form.wallColor} onChange={(e) => setForm({ ...form, wallColor: e.target.value })} /></label><select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option value="grunge-neon">Grunge neón</option><option value="punk-zine">Punk zine</option><option value="retro-pop">Retro pop</option></select><button type="submit">Entrar a la sala</button></form></div>

  return (
    <div className="app-shell">
      <aside>
        <h3>{room.name}</h3><p>{room.description}</p><button onClick={copyInvite}>{copied ? '¡Copiado!' : 'Copiar invitación'}</button><hr />
        <h4>Collage fondo</h4><button onClick={() => setDrawMode((value) => !value)}>{drawMode ? 'Salir dibujo' : 'Dibujar'}</button>
        <label>Capa dibujo<select value={drawTarget} onChange={(e) => setDrawTarget(e.target.value)}><option value="back">Detrás de imágenes</option><option value="front">Encima de imágenes</option></select></label>
        <label>Color <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} /></label>
        <label>Tamaño <input type="range" min="1" max="30" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
        <button onClick={() => undoStroke()}>Deshacer trazo (Ctrl/Cmd+Z)</button><input placeholder="URL imagen o GIF" value={pastingUrl} onChange={(e) => setPastingUrl(e.target.value)} />
        <button onClick={() => pastingUrl.trim() && addBackgroundImage(pastingUrl.trim(), 60, 60)}>Agregar al fondo</button>{selectedLayerId && <button onClick={removeSelectedEntity}>Eliminar capa seleccionada</button>}
        <button onClick={() => setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: [], strokesBack: [], strokesFront: [] } }))}>Limpiar todo el fondo</button><small>Puedes pegar imágenes o links (Ctrl/Cmd + V). Mantén espacio y arrastra o usa rueda para panear.</small>
        <hr /><h4>Módulos flotantes</h4>{moduleOptions.map((module) => <button key={module.type} onClick={() => addItem(module.type)}>{module.label}</button>)}
      </aside>
      <main
        ref={mainRef}
        style={{ background: roomGradient }}
        className={isPanning ? 'is-panning' : ''}
        onMouseMove={onMainMove}
        onMouseUp={clearDraggingState}
        onMouseLeave={clearDraggingState}
        onMouseDown={(event) => {
          const shouldPan = event.button === 1 || (event.button === 0 && spacePressed)
          if (!shouldPan) return
          event.preventDefault()
          setIsPanning(true)
          panDragRef.current = { pointerStartX: event.clientX, pointerStartY: event.clientY, panStartX: view.panX, panStartY: view.panY }
        }}
        onWheel={(event) => {
          if (!event.ctrlKey) return
          event.preventDefault()
          const nextZoom = clamp(view.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM)
          const rect = mainRef.current.getBoundingClientRect()
          const cursorX = event.clientX - rect.left
          const cursorY = event.clientY - rect.top
          const worldX = (cursorX - view.panX) / view.zoom
          const worldY = (cursorY - view.panY) / view.zoom
          setView({ zoom: nextZoom, panX: cursorX - worldX * nextZoom, panY: cursorY - worldY * nextZoom })
        }}>
        <div className="viewport-tools"><button onClick={() => setView((p) => ({ ...p, zoom: clamp(p.zoom * 1.1, MIN_ZOOM, MAX_ZOOM) }))}>+</button><button onClick={() => setView((p) => ({ ...p, zoom: clamp(p.zoom * 0.9, MIN_ZOOM, MAX_ZOOM) }))}>-</button><button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })}>Restablecer vista</button><button onClick={() => { const fitZoom = clamp(Math.min(viewport.width / WORLD_WIDTH, viewport.height / WORLD_HEIGHT), MIN_ZOOM, MAX_ZOOM); setView({ zoom: fitZoom, panX: (viewport.width - WORLD_WIDTH * fitZoom) / 2, panY: (viewport.height - WORLD_HEIGHT * fitZoom) / 2 }) }}>Ajustar a pantalla</button></div>
        <div className={`design-surface ${isPanning ? 'panning' : ''}`} style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
          <canvas ref={backCanvasRef} className="bg-canvas" />
          {room.collage.layers.sort((a, b) => a.z - b.z).map((layer) => <div key={layer.id} className={`bg-layer ${selectedLayerId === layer.id ? 'selected' : ''}`} style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.z }} onMouseDown={() => { setSelectedLayerId(layer.id); setSelectedItemId(null); if (!drawMode) setDragLayerId(layer.id) }}><img src={layer.src} alt="layer" draggable={false} /><button className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); setResizeLayerId(layer.id) }} aria-label="resize" /></div>)}
          <canvas ref={frontCanvasRef} className={`bg-canvas front ${drawMode ? 'drawing' : ''}`} onMouseDown={startStroke} onMouseMove={moveStroke} onMouseUp={endStroke} onMouseLeave={endStroke} />
          {room.items.map((item) => <div key={item.id} className={`item item-${item.type} ${selectedItemId === item.id ? 'selected' : ''}`} style={{ left: item.x, top: item.y, width: item.w, minHeight: item.h }} onMouseDown={() => { setSelectedItemId(item.id); setSelectedLayerId(null); if (!drawMode) setDraggingId(item.id) }}>{(item.type === 'poster' || item.type === 'gif') && <img src={item.content} alt={item.type} draggable={false} onError={() => item.type === 'gif' && updateItem(item.id, { loadError: 'No se pudo cargar este GIF. Usa enlace directo .gif o de Giphy/Tenor.' })} onLoad={() => item.type === 'gif' && item.loadError && updateItem(item.id, { loadError: '' })} />}
            {item.type === 'gif' && <div className="gif-controls" onMouseDown={(e) => e.stopPropagation()}><input value={item.editUrl || ''} onChange={(e) => updateItem(item.id, { editUrl: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && applyGifUrl(item.id)} placeholder="URL GIF" /><button type="button" onClick={() => applyGifUrl(item.id)}>Aplicar</button></div>}
            {item.type === 'gif' && item.loadError && <small className="gif-error">{item.loadError}</small>}
            {item.type === 'text' && <h5 contentEditable suppressContentEditableWarning onBlur={(e) => updateItem(item.id, { content: e.target.textContent })}>{item.content}</h5>}
            {item.type === 'postit' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}
            {item.type === 'player' && <a href={item.content} target="_blank" rel="noreferrer">Abrir reproductor</a>}
            {item.type === 'dice' && <button onClick={() => updateItem(item.id, { content: `🎲 ${Math.floor(Math.random() * 6) + 1}` })}>{item.content}</button>}
            {item.type === 'signwall' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}
            <button className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); setResizeItemId(item.id) }} aria-label="resize" /></div>)}
        </div>
      </main>
    </div>
  )
}

export default App
