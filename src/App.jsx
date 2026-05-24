import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'achantes-room-v1'

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
    strokes: [],
  },
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function App() {
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [draggingId, setDraggingId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [drawMode, setDrawMode] = useState(false)
  const [pastingUrl, setPastingUrl] = useState('')
  const [form, setForm] = useState({ name: '', description: '', wallColor: '#32214d', style: 'grunge-neon' })
  const [currentStroke, setCurrentStroke] = useState([])
  const canvasRef = useRef(null)
  const mainRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      setRoom({ ...defaultRoom, ...parsed, collage: { layers: [], strokes: [], ...(parsed.collage || {}) } })
      setStage('room')
    }
  }, [])

  useEffect(() => {
    if (stage === 'room') localStorage.setItem(STORAGE_KEY, JSON.stringify(room))
  }, [room, stage])

  const roomGradient = useMemo(() => {
    if (room.style === 'punk-zine') return `linear-gradient(135deg, ${room.wallColor}, #111)`
    if (room.style === 'retro-pop') return `radial-gradient(circle at 20% 20%, #ff4d9d, ${room.wallColor})`
    return `linear-gradient(160deg, ${room.wallColor}, #180f28)`
  }, [room.style, room.wallColor])

  useEffect(() => {
    if (stage !== 'room') return
    const canvas = canvasRef.current
    const host = mainRef.current
    if (!canvas || !host) return

    canvas.width = host.clientWidth
    canvas.height = host.clientHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    room.collage.strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    })

    room.collage.layers.forEach((layer) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => ctx.drawImage(img, layer.x, layer.y, layer.w, layer.h)
      img.src = layer.src
    })
  }, [room.collage, room.style, room.wallColor, stage])

  const addItem = (type) => {
    const base = { id: randomId(), type, x: 80, y: 80, w: 180, h: 120, content: '' }
    const byType = {
      poster: { content: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600' },
      gif: { content: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTh5c3N0aWJ6YW9nYWpnMjM4bm5ydmVvNnB1YmtudDB4YXM2eGNlYiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/TilmLMmWrRYYHjLfub/giphy.gif' },
      text: { content: 'ACHANTE VIBES ✦' },
      postit: { content: 'No olvides invitar al combo 🔥', w: 160, h: 160 },
      player: { content: 'https://open.spotify.com/' },
      dice: { content: '🎲 1' },
      signwall: { content: 'Firma aquí:\n- @pana1: brutal\n- @pana2: qué nivel', w: 240, h: 170 },
    }
    setRoom((prev) => ({ ...prev, items: [...prev.items, { ...base, ...byType[type] }] }))
  }

  const addBackgroundImage = (src, x = 40, y = 40) => {
    setRoom((prev) => ({
      ...prev,
      collage: {
        ...prev.collage,
        layers: [...prev.collage.layers, { id: randomId(), src, x, y, w: 220, h: 160 }],
      },
    }))
  }

  const updateItem = (id, patch) => setRoom((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))

  const onDrag = (event) => {
    if (!draggingId || drawMode) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp(event.clientX - rect.left - 60, 0, rect.width - 120)
    const y = clamp(event.clientY - rect.top - 24, 0, rect.height - 60)
    updateItem(draggingId, { x, y })
  }

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

  const getCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startStroke = (e) => {
    if (!drawMode) return
    setCurrentStroke([getCanvasPoint(e)])
  }

  const moveStroke = (e) => {
    if (!drawMode || currentStroke.length === 0) return
    setCurrentStroke((prev) => [...prev, getCanvasPoint(e)])
  }

  const endStroke = () => {
    if (!drawMode || currentStroke.length < 2) {
      setCurrentStroke([])
      return
    }
    const stroke = { id: randomId(), color: brushColor, size: brushSize, points: currentStroke }
    setRoom((prev) => ({ ...prev, collage: { ...prev.collage, strokes: [...prev.collage.strokes, stroke] } }))
    setCurrentStroke([])
  }

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
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage])

  if (stage === 'landing') {
    return (
      <div className="min-h-screen landing">
        <header>
          <h1>Achantes</h1>
          <p>Arma tu achante</p>
        </header>
        <form className="card" onSubmit={createRoom}>
          <h2>Crea tu sala</h2>
          <input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Color de pared <input type="color" value={form.wallColor} onChange={(e) => setForm({ ...form, wallColor: e.target.value })} /></label>
          <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
            <option value="grunge-neon">Grunge neón</option>
            <option value="punk-zine">Punk zine</option>
            <option value="retro-pop">Retro pop</option>
          </select>
          <button type="submit">Entrar a la sala</button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside>
        <h3>{room.name}</h3>
        <p>{room.description}</p>
        <button onClick={copyInvite}>{copied ? '¡Copiado!' : 'Copiar invitación'}</button>
        <hr />
        <h4>Collage de fondo</h4>
        <button onClick={() => setDrawMode((v) => !v)}>{drawMode ? 'Salir modo dibujo' : 'Dibujar fondo'}</button>
        <label>Color <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} /></label>
        <label>Tamaño <input type="range" min="1" max="24" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} /></label>
        <input placeholder="Pega URL de imagen" value={pastingUrl} onChange={(e) => setPastingUrl(e.target.value)} />
        <button onClick={() => pastingUrl && addBackgroundImage(pastingUrl, 60, 60)}>Agregar imagen al fondo</button>
        <button onClick={() => setRoom((prev) => ({ ...prev, collage: { layers: [], strokes: [] } }))}>Limpiar fondo</button>
        <small>Tip: también puedes copiar y pegar imágenes (Ctrl/Cmd + V).</small>
        <hr />
        <h4>Módulos flotantes</h4>
        {moduleOptions.map((m) => <button key={m.type} onClick={() => addItem(m.type)}>{m.label}</button>)}
      </aside>
      <main ref={mainRef} style={{ background: roomGradient }} onMouseMove={onDrag} onMouseUp={() => { setDraggingId(null); endStroke() }}>
        <canvas
          ref={canvasRef}
          className={`bg-canvas ${drawMode ? 'drawing' : ''}`}
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
