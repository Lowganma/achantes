import { useEffect, useMemo, useRef, useState } from 'react'

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

const defaultRoom = {
  name: 'Mi Achante',
  description: 'Un cuarto nostálgico para panas',
  wallColor: '#2f2648',
  style: 'grunge-neon',
  items: [],
  collage: {
    layers: [],
    strokesBack: [],
    strokesFront: [],
  },
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function App() {
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [draggingId, setDraggingId] = useState(null)
  const [dragLayerId, setDragLayerId] = useState(null)
  const [resizeLayerId, setResizeLayerId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [drawMode, setDrawMode] = useState(false)
  const [drawTarget, setDrawTarget] = useState('front')
  const [pastingUrl, setPastingUrl] = useState('')
  const [form, setForm] = useState({ name: '', description: '', wallColor: '#32214d', style: 'grunge-neon' })
  const [currentStroke, setCurrentStroke] = useState([])
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const mainRef = useRef(null)
  const backCanvasRef = useRef(null)
  const frontCanvasRef = useRef(null)

  const roomGradient = useMemo(() => {
    if (room.style === 'punk-zine') return `linear-gradient(135deg, ${room.wallColor}, #111)`
    if (room.style === 'retro-pop') return `radial-gradient(circle at 20% 20%, #ff4d9d, ${room.wallColor})`
    return `linear-gradient(160deg, ${room.wallColor}, #180f28)`
  }, [room.style, room.wallColor])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      setRoom({ ...defaultRoom, ...parsed, collage: { layers: [], strokesBack: [], strokesFront: [], ...(parsed.collage || {}) } })
      setStage('room')
    }
  }, [])

  useEffect(() => {
    if (stage === 'room') localStorage.setItem(STORAGE_KEY, JSON.stringify(room))
  }, [room, stage])

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
      stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
    })
  }

  useEffect(() => {
    if (stage !== 'room') return
    const preview = currentStroke.length > 1 ? { points: currentStroke, color: brushColor, size: brushSize } : null
    drawStrokes(backCanvasRef.current, room.collage.strokesBack, drawTarget === 'back' ? preview : null)
    drawStrokes(frontCanvasRef.current, room.collage.strokesFront, drawTarget === 'front' ? preview : null)
  }, [stage, room.collage.strokesBack, room.collage.strokesFront, currentStroke, drawTarget, brushColor, brushSize])

  const updateItem = (id, patch) => setRoom((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))
  const updateLayer = (id, patch) => setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: prev.collage.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) } }))

  const addItem = (type) => {
    const base = { id: randomId(), type, x: 80, y: 80, w: 180, h: 120, content: '' }
    const byType = {
      poster: { content: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600' },
      gif: { content: 'https://media.giphy.com/media/TilmLMmWrRYYHjLfub/giphy.gif' },
      text: { content: 'ACHANTE VIBES ✦' },
      postit: { content: 'No olvides invitar al combo 🔥', w: 160, h: 160 },
      player: { content: 'https://open.spotify.com/' },
      dice: { content: '🎲 1' },
      signwall: { content: 'Firma aquí:\n- @pana1: brutal\n- @pana2: qué nivel', w: 240, h: 170 },
    }
    setRoom((prev) => ({ ...prev, items: [...prev.items, { ...base, ...byType[type] }] }))
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

  const getPoint = (e) => {
    const rect = mainRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startStroke = (e) => {
    if (!drawMode) return
    setCurrentStroke([getPoint(e)])
  }

  const moveStroke = (e) => {
    if (!drawMode || currentStroke.length === 0) return
    setCurrentStroke((prev) => [...prev, getPoint(e)])
  }

  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) return setCurrentStroke([])
    const key = drawTarget === 'back' ? 'strokesBack' : 'strokesFront'
    const stroke = { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }
    setRoom((prev) => ({ ...prev, collage: { ...prev.collage, [key]: [...prev.collage[key], stroke] } }))
    setCurrentStroke([])
  }

  const undoStroke = () => {
    const key = drawTarget === 'back' ? 'strokesBack' : 'strokesFront'
    setRoom((prev) => ({ ...prev, collage: { ...prev.collage, [key]: prev.collage[key].slice(0, -1) } }))
  }

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undoStroke()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const onPaste = (event) => {
      if (stage !== 'room') return
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = () => addBackgroundImage(reader.result)
          reader.readAsDataURL(file)
        } else if (item.type === 'text/plain') {
          item.getAsString((txt) => /https?:\/\//.test(txt) && addBackgroundImage(txt.trim()))
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage])

  const createRoom = (e) => {
    e.preventDefault()
    setRoom((prev) => ({ ...prev, ...form }))
    setStage('room')
  }

  const copyInvite = async () => {
    const invite = `${window.location.origin}/room/${room.name.toLowerCase().replaceAll(' ', '-')}`
    await navigator.clipboard.writeText(invite)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onMainMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (draggingId && !drawMode) updateItem(draggingId, { x: clamp(event.clientX - rect.left - 60, 0, rect.width - 120), y: clamp(event.clientY - rect.top - 24, 0, rect.height - 60) })
    if (dragLayerId) {
      const layer = room.collage.layers.find((l) => l.id === dragLayerId)
      if (!layer) return
      updateLayer(dragLayerId, { x: clamp(event.clientX - rect.left - layer.w / 2, 0, rect.width - layer.w), y: clamp(event.clientY - rect.top - layer.h / 2, 0, rect.height - layer.h) })
    }
    if (resizeLayerId) {
      const layer = room.collage.layers.find((l) => l.id === resizeLayerId)
      if (!layer) return
      updateLayer(resizeLayerId, { w: clamp(event.clientX - rect.left - layer.x, 60, rect.width - layer.x), h: clamp(event.clientY - rect.top - layer.y, 60, rect.height - layer.y) })
    }
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
        <button onClick={() => setDrawMode((v) => !v)}>{drawMode ? 'Salir dibujo' : 'Dibujar'}</button>
        <label>Capa dibujo
          <select value={drawTarget} onChange={(e) => setDrawTarget(e.target.value)}>
            <option value="back">Detrás de imágenes</option>
            <option value="front">Encima de imágenes</option>
          </select>
        </label>
        <label>Color <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} /></label>
        <label>Tamaño <input type="range" min="1" max="30" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
        <button onClick={undoStroke}>Deshacer trazo (Ctrl/Cmd+Z)</button>
        <input placeholder="URL imagen o GIF" value={pastingUrl} onChange={(e) => setPastingUrl(e.target.value)} />
        <button onClick={() => pastingUrl && addBackgroundImage(pastingUrl.trim(), 60, 60)}>Agregar al fondo</button>
        {selectedLayerId && <button onClick={() => setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: prev.collage.layers.filter((l) => l.id !== selectedLayerId) } }))}>Eliminar capa seleccionada</button>}
        <button onClick={() => setRoom((prev) => ({ ...prev, collage: { ...prev.collage, layers: [], strokesBack: [], strokesFront: [] } }))}>Limpiar todo el fondo</button>
        <small>Puedes pegar imágenes o links (Ctrl/Cmd + V). Los GIF en fondo se reproducen como capas HTML.</small>
        <hr />
        <h4>Módulos flotantes</h4>
        {moduleOptions.map((m) => <button key={m.type} onClick={() => addItem(m.type)}>{m.label}</button>)}
      </aside>

      <main ref={mainRef} style={{ background: roomGradient }} onMouseMove={onMainMove} onMouseUp={() => { setDraggingId(null); setDragLayerId(null); setResizeLayerId(null); endStroke() }}>
        <canvas ref={backCanvasRef} className="bg-canvas" />

        {room.collage.layers.sort((a, b) => a.z - b.z).map((layer) => (
          <div
            key={layer.id}
            className={`bg-layer ${selectedLayerId === layer.id ? 'selected' : ''}`}
            style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.z }}
            onMouseDown={() => { setSelectedLayerId(layer.id); if (!drawMode) setDragLayerId(layer.id) }}
          >
            <img src={layer.src} alt="layer" draggable={false} />
            <button className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); setResizeLayerId(layer.id) }} aria-label="resize" />
          </div>
        ))}

        <canvas
          ref={frontCanvasRef}
          className={`bg-canvas front ${drawMode ? 'drawing' : ''}`}
          onMouseDown={startStroke}
          onMouseMove={moveStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
        />

        {room.items.map((item) => (
          <div key={item.id} className={`item item-${item.type}`} style={{ left: item.x, top: item.y, width: item.w, minHeight: item.h }} onMouseDown={() => setDraggingId(item.id)}>
            {(item.type === 'poster' || item.type === 'gif') && <img src={item.content} alt={item.type} />}
            {item.type === 'text' && <h5 contentEditable suppressContentEditableWarning onBlur={(e) => updateItem(item.id, { content: e.target.textContent })}>{item.content}</h5>}
            {item.type === 'postit' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}
            {item.type === 'player' && <a href={item.content} target="_blank" rel="noreferrer">Abrir reproductor</a>}
            {item.type === 'dice' && <button onClick={() => updateItem(item.id, { content: `🎲 ${Math.floor(Math.random() * 6) + 1}` })}>{item.content}</button>}
            {item.type === 'signwall' && <textarea value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} />}
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
