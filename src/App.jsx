import { useEffect, useMemo, useRef, useState } from 'react'

// =========================
// Configuración base
// =========================
const STORAGE_KEY = 'achantes-room-v2'

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
  // =========================
  // Estado principal
  // =========================
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [form, setForm] = useState({ name: '', description: '', wallColor: '#32214d', style: 'grunge-neon' })

  // UI / selección
  const [copied, setCopied] = useState(false)
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [pastingUrl, setPastingUrl] = useState('')

  // Dibujo por capas
  const [drawMode, setDrawMode] = useState(false)
  const [drawTarget, setDrawTarget] = useState('front')
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [currentStroke, setCurrentStroke] = useState([])

  // Movimiento / resize
  const [draggingId, setDraggingId] = useState(null)
  const [dragLayerId, setDragLayerId] = useState(null)
  const [resizeLayerId, setResizeLayerId] = useState(null)
  const [resizeItemId, setResizeItemId] = useState(null)

  // Refs
  const mainRef = useRef(null)
  const backCanvasRef = useRef(null)
  const frontCanvasRef = useRef(null)
  const drawTargetRef = useRef(drawTarget)

  useEffect(() => {
    drawTargetRef.current = drawTarget
  }, [drawTarget])

  // =========================
  // Persistencia y tema
  // =========================
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

  useEffect(() => {
    if (stage === 'room') localStorage.setItem(STORAGE_KEY, JSON.stringify(room))
  }, [room, stage])

  // =========================
  // Helpers de actualización
  // =========================
  const updateItem = (id, patch) => {
    setRoom((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  }

  const updateLayer = (id, patch) => {
    setRoom((prev) => ({
      ...prev,
      collage: { ...prev.collage, layers: prev.collage.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) },
    }))
  }

  const removeSelectedEntity = () => {
    if (selectedItemId) {
      setRoom((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== selectedItemId) }))
      setSelectedItemId(null)
      return
    }
    if (selectedLayerId) {
      setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: prev.collage.layers.filter((layer) => layer.id !== selectedLayerId) } }))
      setSelectedLayerId(null)
    }
  }

  // =========================
  // Módulos y capas de fondo
  // =========================
  const addItem = (type) => {
    const base = { id: randomId(), type, x: 80, y: 80, w: 180, h: 120, content: '', editUrl: '' }
    const nextItem = { ...base, ...defaultItemsByType[type] }
    if (type === 'gif') nextItem.editUrl = nextItem.content

    setRoom((prev) => ({ ...prev, items: [...prev.items, nextItem] }))
    setSelectedItemId(nextItem.id)
    setSelectedLayerId(null)
  }

  const addBackgroundImage = (src, x = 50, y = 60) => {
    setRoom((prev) => ({
      ...prev,
      collage: {
        ...prev.collage,
        layers: [...prev.collage.layers, { id: randomId(), src, x, y, w: 240, h: 180, z: prev.collage.layers.length + 1 }],
      },
    }))
  }

  // =========================
  // Dibujo
  // =========================
  const drawStrokes = (canvas, strokes, previewStroke) => {
    const host = mainRef.current
    if (!canvas || !host) return

    canvas.width = host.clientWidth
    canvas.height = host.clientHeight

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ;[...strokes, ...(previewStroke ? [previewStroke] : [])].forEach((stroke) => {
      if (stroke.points.length < 2) return
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
      ctx.stroke()
    })
  }

  const getPoint = (event) => {
    const rect = mainRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const startStroke = (event) => {
    if (!drawMode) return
    setCurrentStroke([getPoint(event)])
  }

  const moveStroke = (event) => {
    if (!drawMode || currentStroke.length === 0) return
    setCurrentStroke((prev) => [...prev, getPoint(event)])
  }

  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) {
      setCurrentStroke([])
      return
    }

    const key = drawTargetRef.current === 'back' ? 'strokesBack' : 'strokesFront'
    const stroke = { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }
    setRoom((prev) => ({ ...prev, collage: { ...prev.collage, [key]: [...prev.collage[key], stroke] } }))
    setCurrentStroke([])
  }

  const undoStroke = (target = drawTargetRef.current) => {
    const key = target === 'back' ? 'strokesBack' : 'strokesFront'
    setRoom((prev) => ({ ...prev, collage: { ...prev.collage, [key]: prev.collage[key].slice(0, -1) } }))
  }

  useEffect(() => {
    if (stage !== 'room') return

    const preview = currentStroke.length > 1 ? { points: currentStroke, color: brushColor, size: brushSize } : null
    drawStrokes(backCanvasRef.current, room.collage.strokesBack, drawTarget === 'back' ? preview : null)
    drawStrokes(frontCanvasRef.current, room.collage.strokesFront, drawTarget === 'front' ? preview : null)
  }, [stage, room.collage.strokesBack, room.collage.strokesFront, currentStroke, drawTarget, brushColor, brushSize])

  // =========================
  // Eventos globales (teclado / pegado)
  // =========================
  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const activeField = isFormField(document.activeElement)

      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        undoStroke()
        return
      }

      if (!activeField && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        removeSelectedEntity()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItemId, selectedLayerId])

  useEffect(() => {
    const onPaste = (event) => {
      if (stage !== 'room') return
      if (isFormField(event.target)) return

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
          item.getAsString((txt) => {
            const url = txt.trim()
            if (/https?:\/\//.test(url)) addBackgroundImage(url)
          })
        }
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage])

  // =========================
  // Mouse interaction (drag / resize)
  // =========================
  const onMainMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()

    if (draggingId && !drawMode) {
      updateItem(draggingId, {
        x: clamp(event.clientX - rect.left - 60, 0, rect.width - 120),
        y: clamp(event.clientY - rect.top - 24, 0, rect.height - 60),
      })
    }

    if (dragLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === dragLayerId)
      if (!layer) return
      updateLayer(dragLayerId, {
        x: clamp(event.clientX - rect.left - layer.w / 2, 0, rect.width - layer.w),
        y: clamp(event.clientY - rect.top - layer.h / 2, 0, rect.height - layer.h),
      })
    }

    if (resizeItemId) {
      const item = room.items.find((entry) => entry.id === resizeItemId)
      if (!item) return
      updateItem(resizeItemId, {
        w: clamp(event.clientX - rect.left - item.x, 80, rect.width - item.x),
        h: clamp(event.clientY - rect.top - item.y, 80, rect.height - item.y),
      })
    }

    if (resizeLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === resizeLayerId)
      if (!layer) return
      updateLayer(resizeLayerId, {
        w: clamp(event.clientX - rect.left - layer.x, 60, rect.width - layer.x),
        h: clamp(event.clientY - rect.top - layer.y, 60, rect.height - layer.y),
      })
    }
  }

  const clearDraggingState = () => {
    setDraggingId(null)
    setDragLayerId(null)
    setResizeLayerId(null)
    setResizeItemId(null)
    endStroke()
  }

  const createRoom = (event) => {
    event.preventDefault()
    setRoom((prev) => ({ ...prev, ...form }))
    setStage('room')
  }

  const copyInvite = async () => {
    const invite = `${window.location.origin}/room/${room.name.toLowerCase().replaceAll(' ', '-')}`
    await navigator.clipboard.writeText(invite)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const applyGifUrl = (itemId) => {
    const item = room.items.find((entry) => entry.id === itemId)
    if (!item) return
    const nextUrl = item.editUrl?.trim()
    if (!nextUrl) return
    updateItem(itemId, { content: nextUrl })
  }

  if (stage === 'landing') {
    return <div className="min-h-screen landing"><header><h1>Achantes</h1><p>Arma tu achante</p></header><form className="card" onSubmit={createRoom}><h2>Crea tu sala</h2><input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><label>Color de pared <input type="color" value={form.wallColor} onChange={(e) => setForm({ ...form, wallColor: e.target.value })} /></label><select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option value="grunge-neon">Grunge neón</option><option value="punk-zine">Punk zine</option><option value="retro-pop">Retro pop</option></select><button type="submit">Entrar a la sala</button></form></div>
  }

  return (
    <div className="app-shell">
      <aside>
        <h3>{room.name}</h3><p>{room.description}</p>
        <button onClick={copyInvite}>{copied ? '¡Copiado!' : 'Copiar invitación'}</button>
        <hr />

        <h4>Collage fondo</h4>
        <button onClick={() => setDrawMode((value) => !value)}>{drawMode ? 'Salir dibujo' : 'Dibujar'}</button>
        <label>Capa dibujo
          <select value={drawTarget} onChange={(e) => setDrawTarget(e.target.value)}>
            <option value="back">Detrás de imágenes</option>
            <option value="front">Encima de imágenes</option>
          </select>
        </label>
        <label>Color <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} /></label>
        <label>Tamaño <input type="range" min="1" max="30" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
        <button onClick={() => undoStroke()}>Deshacer trazo (Ctrl/Cmd+Z)</button>
        <input placeholder="URL imagen o GIF" value={pastingUrl} onChange={(e) => setPastingUrl(e.target.value)} />
        <button onClick={() => pastingUrl.trim() && addBackgroundImage(pastingUrl.trim(), 60, 60)}>Agregar al fondo</button>
        {selectedLayerId && <button onClick={removeSelectedEntity}>Eliminar capa seleccionada</button>}
        <button onClick={() => setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: [], strokesBack: [], strokesFront: [] } }))}>Limpiar todo el fondo</button>
        <small>Puedes pegar imágenes o links (Ctrl/Cmd + V). Si estás escribiendo en un input, no se agrega al fondo.</small>

        <hr />
        <h4>Módulos flotantes</h4>
        {moduleOptions.map((module) => <button key={module.type} onClick={() => addItem(module.type)}>{module.label}</button>)}
      </aside>

      <main ref={mainRef} style={{ background: roomGradient }} onMouseMove={onMainMove} onMouseUp={clearDraggingState}>
        <canvas ref={backCanvasRef} className="bg-canvas" />

        {room.collage.layers.sort((a, b) => a.z - b.z).map((layer) => (
          <div
            key={layer.id}
            className={`bg-layer ${selectedLayerId === layer.id ? 'selected' : ''}`}
            style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.z }}
            onMouseDown={() => { setSelectedLayerId(layer.id); setSelectedItemId(null); if (!drawMode) setDragLayerId(layer.id) }}
          >
            <img src={layer.src} alt="layer" draggable={false} />
            <button className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); setResizeLayerId(layer.id) }} aria-label="resize" />
          </div>
        ))}

        <canvas ref={frontCanvasRef} className={`bg-canvas front ${drawMode ? 'drawing' : ''}`} onMouseDown={startStroke} onMouseMove={moveStroke} onMouseUp={endStroke} onMouseLeave={endStroke} />

        {room.items.map((item) => (
          <div
            key={item.id}
            className={`item item-${item.type} ${selectedItemId === item.id ? 'selected' : ''}`}
            style={{ left: item.x, top: item.y, width: item.w, minHeight: item.h }}
            onMouseDown={() => { setSelectedItemId(item.id); setSelectedLayerId(null); if (!drawMode) setDraggingId(item.id) }}
          >
            {(item.type === 'poster' || item.type === 'gif') && <img src={item.content} alt={item.type} draggable={false} />}

            {item.type === 'gif' && (
              <div className="gif-controls" onMouseDown={(e) => e.stopPropagation()}>
                <input
                  value={item.editUrl || ''}
                  onChange={(e) => updateItem(item.id, { editUrl: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyGifUrl(item.id)}
                  placeholder="URL GIF"
                />
                <button type="button" onClick={() => applyGifUrl(item.id)}>Aplicar</button>
              </div>
            )}

            {item.type === 'text' && <h5 contentEditable suppressContentEditableWarning onBlur={(e) => updateItem(item.id, { content: e.target.textContent })}>{item.content}</h5>}
            {item.type === 'postit' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}
            {item.type === 'player' && <a href={item.content} target="_blank" rel="noreferrer">Abrir reproductor</a>}
            {item.type === 'dice' && <button onClick={() => updateItem(item.id, { content: `🎲 ${Math.floor(Math.random() * 6) + 1}` })}>{item.content}</button>}
            {item.type === 'signwall' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}

            <button className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); setResizeItemId(item.id) }} aria-label="resize" />
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
