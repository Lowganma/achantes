import { useEffect, useMemo, useRef, useState } from 'react'

// =========================
// Configuración base canvas
// =========================
// NOTE(modularización): mover este bloque a `src/constants/canvasConfig.js`.
const STORAGE_KEY = 'achantes-room-v2'
const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const MENU_WIDTH_KEY = 'achantes-menu-width-v1'
const MIN_MENU_WIDTH = 240
const MAX_MENU_WIDTH = 460
const MAX_HISTORY_ENTRIES = 40
const MAX_PASTE_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_PASTE_IMAGE_DIMENSION = 400

// Z-index lógico por familias
const Z_BASE_BACKGROUND = 1
const Z_BASE_ITEM = 2
const MAX_LAYER_Z = 50

const moduleOptions = [
  { type: 'text', label: 'Texto decorativo' },
  { type: 'postit', label: 'Post-it' },
  { type: 'player', label: 'Reproductor link' },
  { type: 'dice', label: 'Dado simple' },
  { type: 'signwall', label: 'Muro firmas' },
  { type: 'gif', label: 'GIF URL' },
]

// ======================
// Helpers generales
// ======================
// NOTE(modularización): helpers de utilería a `src/utils/canvasMath.js` y `src/utils/roomValidation.js`.
const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const isFormField = (element) => {
  if (!element) return false
  const tagName = element.tagName?.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable
}

// =========================
// Estado inicial de sala
// =========================
const defaultRoom = {
  name: 'Mi Achante',
  description: 'Un cuarto nostálgico para panas',
  wallColor: '#2f2648',
  backgroundImageUrl: '',
  style: 'grunge-neon',
  items: [],
  collage: { layers: [], strokesBack: [], strokesFront: [] },
}

// =================================
// Normalización y validación
// =================================
// NOTE(modularización): mover normalize/sanitize a `src/utils/roomValidation.js`.
const normalizeRoomState = (value) => ({
  ...defaultRoom,
  ...(value || {}),
  collage: {
    layers: [],
    strokesBack: [],
    strokesFront: [],
    ...((value && value.collage) || {}),
  },
  drawLayers: (value && value.drawLayers) || { back: 'Dibujo fondo', front: 'Dibujo frontal' },
})

const normalizeLayer = (layer) => {
  if (!layer || typeof layer !== 'object' || !layer.src) return null
  return {
    id: layer.id || randomId(),
    src: String(layer.src),
    x: clamp(Number(layer.x) || 0, 0, WORLD_WIDTH),
    y: clamp(Number(layer.y) || 0, 0, WORLD_HEIGHT),
    w: clamp(Number(layer.w) || 240, 40, WORLD_WIDTH),
    h: clamp(Number(layer.h) || 180, 40, WORLD_HEIGHT),
    z: clamp(Number(layer.z) || Z_BASE_BACKGROUND, Z_BASE_BACKGROUND, MAX_LAYER_Z),
  }
}

const isValidUrl = (value = '') => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

const sanitizeRoomState = (value) => {
  const normalized = normalizeRoomState(value)
  return {
    ...normalized,
    items: Array.isArray(normalized.items) ? normalized.items.filter(Boolean) : [],
    collage: {
      ...normalized.collage,
      layers: (Array.isArray(normalized.collage.layers) ? normalized.collage.layers : []).map(normalizeLayer).filter(Boolean),
      strokesBack: Array.isArray(normalized.collage.strokesBack) ? normalized.collage.strokesBack : [],
      strokesFront: Array.isArray(normalized.collage.strokesFront) ? normalized.collage.strokesFront : [],
    },
  }
}

const normalizeGifUrl = (rawUrl = '') => {
  const value = rawUrl.trim()
  if (!value) return ''
  if (/\.(gif|webp)(\?|$)/i.test(value) || value.startsWith('data:image/')) return value
  const tenorMatch = value.match(/tenor\.com\/(?:view|es\/view)\/[^/]*-(\d+)/i)
  if (tenorMatch) return `https://media.tenor.com/${tenorMatch[1]}/tenor.gif`
  const giphyMatch = value.match(/giphy\.com\/(?:gifs|media)\/[^/]*-([a-zA-Z0-9]+)$/i)
  if (giphyMatch) return `https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif`
  return value
}

const defaultItemsByType = {
  text: { content: 'ACHANTE VIBES ✦' },
  postit: { content: 'No olvides invitar al combo 🔥', w: 160, h: 160 },
  player: { content: 'https://open.spotify.com/' },
  dice: { content: '🎲 1' },
  signwall: { content: 'Firma aquí:\n- @pana1: brutal\n- @pana2: qué nivel', w: 240, h: 170 },
  gif: { content: '', editUrl: '', w: 240, h: 180, loadError: '' },
}

// ==============
// Componente App
// ==============
function App() {
  // ==================
  // Estados de interfaz
  // ==================
  const [stage, setStage] = useState('landing')
  const [room, setRoom] = useState(defaultRoom)
  const [form, setForm] = useState({ name: '', description: '', wallColor: '#32214d', style: 'grunge-neon' })

  const [copied, setCopied] = useState(false)
  const [selectedLayerId, setSelectedLayerId] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [pastingUrl, setPastingUrl] = useState('')
  const [menuCollapsed, setMenuCollapsed] = useState(false)
  const [menuWidth, setMenuWidth] = useState(() => {
    const raw = Number(localStorage.getItem(MENU_WIDTH_KEY))
    return Number.isFinite(raw) && raw > 0 ? clamp(raw, MIN_MENU_WIDTH, MAX_MENU_WIDTH) : 300
  })
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showLayerLabels, setShowLayerLabels] = useState(false)
  const [activeTool, setActiveTool] = useState('select')
  const [drawTarget, setDrawTarget] = useState('front')
  const [brushColor, setBrushColor] = useState('#f5e663')
  const [brushSize, setBrushSize] = useState(5)
  const [brushOpacity, setBrushOpacity] = useState(0.7)
  const [brushFlow, setBrushFlow] = useState(0.6)
  const [brushTaper, setBrushTaper] = useState(0.35)
  const [currentStroke, setCurrentStroke] = useState([])

  // =================
  // Estados del canvas
  // =================
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
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const skipHistoryRef = useRef(false)
  const lastPointerRef = useRef({ x: 60, y: 60 })
  const interactionStartRef = useRef(null)
  const interactionDirtyRef = useRef(false)
  const strokeSessionRef = useRef(0)
  const menuResizeRef = useRef(null)
  const cropStartRef = useRef(null)
  const [cropRect, setCropRect] = useState(null)
  const [toast, setToast] = useState('')

  // Referencias internas para interacciones imperativas (drag, historial y dibujo activo).
  useEffect(() => { drawTargetRef.current = drawTarget }, [drawTarget])
  useEffect(() => { localStorage.setItem(MENU_WIDTH_KEY, String(menuWidth)) }, [menuWidth])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(notify.timer)
    notify.timer = window.setTimeout(() => setToast(''), 2800)
  }

  useEffect(() => {
    // Observa tamaño visible del canvas para recalcular límites de pan/zoom responsivos.
    if (!mainRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(mainRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // ====================
    // Zoom con rueda + Ctrl
    // ====================
    // NOTE(modularización): extraer lógica de viewport a `src/hooks/useCanvasViewport.js`.
    const host = mainRef.current
    if (!host) return

    const onNativeWheel = (event) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const rect = host.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top

      setView((prev) => {
        const nextZoom = clamp(prev.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM)
        const worldX = (cursorX - prev.panX) / prev.zoom
        const worldY = (cursorY - prev.panY) / prev.zoom
        const rawPanX = cursorX - worldX * nextZoom
        const rawPanY = cursorY - worldY * nextZoom
        const minPanX = Math.min(0, viewport.width - WORLD_WIDTH * nextZoom)
        const minPanY = Math.min(0, viewport.height - WORLD_HEIGHT * nextZoom)
        return { zoom: nextZoom, panX: clamp(rawPanX, minPanX, 0), panY: clamp(rawPanY, minPanY, 0) }
      })
    }

    host.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => host.removeEventListener('wheel', onNativeWheel)
  }, [viewport.width, viewport.height])

  useEffect(() => {
    // Drag para redimensionar el menú lateral.
    // NOTE(modularización): mover UI de sidebar a `src/components/Sidebar.jsx`.
    const onMove = (event) => {
      if (!menuResizeRef.current) return
      const nextWidth = clamp(menuResizeRef.current.startW + (event.clientX - menuResizeRef.current.startX), MIN_MENU_WIDTH, MAX_MENU_WIDTH)
      setMenuWidth(nextWidth)
    }
    const onUp = () => { menuResizeRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const roomGradient = useMemo(() => {
    // Fondo estilizado base de sala (si no hay imagen de fondo).
    if (room.style === 'punk-zine') return `linear-gradient(135deg, ${room.wallColor}, #111)`
    if (room.style === 'retro-pop') return `radial-gradient(circle at 20% 20%, #ff4d9d, ${room.wallColor})`
    return `linear-gradient(160deg, ${room.wallColor}, #180f28)`
  }, [room.style, room.wallColor])

  // ============================
  // Persistencia (localStorage)
  // ============================
  // NOTE(modularización): mover carga/guardado a `src/utils/roomStorage.js`.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      setRoom(sanitizeRoomState(parsed))
      setStage('room')
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (stage !== 'room') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(room))
    } catch {
      notify('No se pudo guardar la sala en tu navegador (espacio insuficiente).')
    }
  }, [room, stage])

  const setRoomWithHistory = (updater, { recordHistory = true } = {}) => {
    // ===================================
    // Historial / undo-redo a nivel sala
    // ===================================
    // NOTE(modularización): migrar a `src/hooks/useRoomHistory.js`.
    setRoom((prevRoom) => {
      const nextRoom = sanitizeRoomState(typeof updater === 'function' ? updater(prevRoom) : updater)
      if (!recordHistory || skipHistoryRef.current || nextRoom === prevRoom) return nextRoom
      undoStackRef.current.push(sanitizeRoomState(prevRoom))
      if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) undoStackRef.current.shift()
      redoStackRef.current = []
      return nextRoom
    })
  }

  const getCanvasPoint = (event) => {
    // Convierte coordenadas de pantalla a coordenadas del mundo (considerando pan/zoom).
    const rect = mainRef.current.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left - view.panX) / view.zoom,
      y: (event.clientY - rect.top - view.panY) / view.zoom,
    }
  }

  const getMaxZ = () => {
    // Cálculo del z-index máximo combinado entre capas de fondo e items.
    const layerMax = room.collage.layers.reduce((max, layer) => Math.max(max, layer.z || Z_BASE_BACKGROUND), Z_BASE_BACKGROUND)
    const itemMax = room.items.reduce((max, item) => Math.max(max, item.z || Z_BASE_ITEM), Z_BASE_ITEM)
    return clamp(Math.max(layerMax, itemMax), Z_BASE_BACKGROUND, MAX_LAYER_Z)
  }

  const updateItem = (id, patch, options) => {
    setRoomWithHistory((prevRoom) => ({
      ...prevRoom,
      items: prevRoom.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }), options)
  }

  const updateLayer = (id, patch, options) => {
    setRoomWithHistory((prevRoom) => ({
      ...prevRoom,
      collage: {
        ...prevRoom.collage,
        layers: prevRoom.collage.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
      },
    }), options)
  }

  const removeSelectedEntity = () => {
    if (selectedItemId) {
      setRoomWithHistory((prevRoom) => ({ ...prevRoom, items: prevRoom.items.filter((item) => item.id !== selectedItemId) }))
      setSelectedItemId(null)
      return
    }

    if (selectedLayerId) {
      setRoomWithHistory((prevRoom) => ({
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
    // =======================
    // Módulos / items flotantes
    // =======================
    // NOTE(modularización): render y comportamiento por item a `src/components/RoomItem.jsx`.
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

    setRoomWithHistory((prevRoom) => ({ ...prevRoom, items: [...prevRoom.items, nextItem] }))
    setSelectedItemId(nextItem.id)
    setSelectedLayerId(null)
  }

  const addBackgroundImage = (src, x = 50, y = 60) => {
    // =======================
    // Capas e imágenes de fondo
    // =======================
    // NOTE(modularización): capa visual a `src/components/BackgroundLayer.jsx`.
    setRoomWithHistory((prevRoom) => ({
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

  const drawStrokes = (canvas, strokes, previewStroke) => {
    // ==================
    // Sistema de dibujo
    // ==================
    // Renderiza trazos consolidados y preview temporal en canvas interno.
    // NOTE(modularización): lógica de dibujo a `src/hooks/useDrawingTools.js`.
    if (!canvas) return
    canvas.width = WORLD_WIDTH
    canvas.height = WORLD_HEIGHT
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ;[...strokes, ...(previewStroke ? [previewStroke] : [])].forEach((stroke) => {
      if (stroke.points.length < 2) return
      if (stroke.tool === 'eraser') {
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = '#000'
        ctx.lineWidth = stroke.size
        ctx.lineCap = 'round'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.size
        ctx.lineCap = stroke.tool === 'pencil' ? 'butt' : 'round'
        ctx.globalAlpha = stroke.tool === 'brush' ? (stroke.opacity ?? 0.7) : 1
      }
      if (stroke.tool === 'brush') {
        const total = stroke.points.length - 1
        for (let i = 1; i < stroke.points.length; i += 1) {
          const p0 = stroke.points[i - 1]
          const p1 = stroke.points[i]
          const t = total <= 0 ? 1 : i / total
          const edge = Math.min(t, 1 - t) * 2
          const taperFactor = 1 - (stroke.taper ?? 0.35) * (1 - edge)
          ctx.lineWidth = Math.max(1, stroke.size * taperFactor)
          ctx.globalAlpha = (stroke.opacity ?? 0.7) * (stroke.flow ?? 0.6)
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }
      } else {
        ctx.lineJoin = 'round'
        ctx.beginPath()
        const points = stroke.points
        ctx.moveTo(points[0].x, points[0].y)
        if (points.length === 2) {
          ctx.lineTo(points[1].x, points[1].y)
        } else {
          for (let i = 1; i < points.length - 1; i += 1) {
            const midX = (points[i].x + points[i + 1].x) / 2
            const midY = (points[i].y + points[i + 1].y) / 2
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
        }
        ctx.stroke()
      }
      if (stroke.tool === 'eraser') ctx.restore()
      ctx.globalAlpha = 1
    })
  }

  const startStroke = (event) => {
    if (event.button !== 0) return
    if (activeTool === 'crop') {
      const point = getCanvasPoint(event)
      cropStartRef.current = point
      setCropRect({ x: point.x, y: point.y, w: 0, h: 0 })
      return
    }
    if (activeTool !== 'hand' && activeTool !== 'select') {
      strokeSessionRef.current += 1
      const point = getCanvasPoint(event)
      setCurrentStroke([point])
    }
  }

  const moveStroke = (event) => {
    if (activeTool === 'crop' && cropStartRef.current) {
      const p = getCanvasPoint(event)
      const s = cropStartRef.current
      setCropRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
      return
    }
    if (activeTool !== 'hand' && activeTool !== 'select' && currentStroke.length > 0) {
      const nextPoint = getCanvasPoint(event)
      setCurrentStroke((prev) => {
        const last = prev[prev.length - 1]
        if (!last) return [nextPoint]
        const minStep = activeTool === 'brush' ? 1.8 : 1.2
        const dist = distance(last, nextPoint)
        if (dist < minStep) return prev
        const steps = Math.max(1, Math.floor(dist / minStep))
        const interpolated = []
        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps
          interpolated.push({
            x: last.x + (nextPoint.x - last.x) * t,
            y: last.y + (nextPoint.y - last.y) * t,
          })
        }
        return [...prev, ...interpolated]
      })
    }
  }

  const endStroke = (sessionId = strokeSessionRef.current) => {
    if (sessionId !== strokeSessionRef.current) return
    if (activeTool === 'crop') {
      cropStartRef.current = null
      return
    }
    if (activeTool === 'hand' || activeTool === 'select' || currentStroke.length < 2) {
      setCurrentStroke([])
      return
    }

    const key = drawTargetRef.current === 'back' ? 'strokesBack' : 'strokesFront'
    const toolSize = activeTool === 'pencil' ? Math.max(1, Math.min(brushSize, 8)) : activeTool === 'eraser' ? Math.max(8, brushSize * 1.6) : Math.max(brushSize, 6)
    const stroke = { id: randomId(), color: brushColor, size: toolSize, points: currentStroke, tool: activeTool, opacity: brushOpacity, flow: brushFlow, taper: brushTaper }
    setRoomWithHistory((prevRoom) => ({
      ...prevRoom,
      collage: {
        ...prevRoom.collage,
        [key]: [...prevRoom.collage[key], stroke],
      },
    }))
    setCurrentStroke([])
    strokeSessionRef.current += 1
  }

  const undoStroke = () => {
    const previousRoom = undoStackRef.current.pop()
    if (!previousRoom) return
    skipHistoryRef.current = true
    setRoom((currentRoom) => {
      redoStackRef.current.push(sanitizeRoomState(currentRoom))
      return sanitizeRoomState(previousRoom)
    })
    skipHistoryRef.current = false
    setCurrentStroke([])
  }

  const redoStroke = () => {
    const nextRoom = redoStackRef.current.pop()
    if (!nextRoom) return
    skipHistoryRef.current = true
    setRoom((currentRoom) => {
      undoStackRef.current.push(sanitizeRoomState(currentRoom))
      return sanitizeRoomState(nextRoom)
    })
    skipHistoryRef.current = false
    setCurrentStroke([])
  }

  useEffect(() => {
    // Re-render de canvas de dibujo (capa back/front + preview actual).
    if (stage !== 'room') return
    const preview = currentStroke.length > 1 ? { points: currentStroke, color: brushColor, size: activeTool === 'pencil' ? Math.max(1, Math.min(brushSize, 8)) : activeTool === 'eraser' ? Math.max(8, brushSize * 1.6) : Math.max(brushSize, 6), tool: activeTool, opacity: brushOpacity } : null
    drawStrokes(backCanvasRef.current, room.collage.strokesBack, drawTarget === 'back' ? preview : null)
    drawStrokes(frontCanvasRef.current, room.collage.strokesFront, drawTarget === 'front' ? preview : null)
  }, [stage, room.collage.strokesBack, room.collage.strokesFront, currentStroke, drawTarget, brushColor, brushSize, activeTool, brushOpacity])

  useEffect(() => {
    // =================
    // Shortcuts globales
    // =================
    // Delete/backspace, undo/redo, hand tool y escape.
    // NOTE(modularización): centralizar en `src/components/ShortcutModal.jsx` + hook de teclado.
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const activeField = isFormField(document.activeElement)
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        if (event.repeat) return
        event.preventDefault()
        if (event.shiftKey) redoStroke()
        else undoStroke()
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        if (event.repeat) return
        event.preventDefault()
        redoStroke()
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
        setActiveTool((value) => (value === 'hand' ? 'select' : 'hand'))
        return
      }
      if (key === 'escape') {
        setSelectedItemId(null)
        setSelectedLayerId(null)
        setCropRect(null)
        setActiveTool('select')
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
  }, [selectedItemId, selectedLayerId, currentStroke, activeTool])

  useEffect(() => {
    // ====================================
    // Pegado de URLs e imágenes del portapapeles
    // ====================================
    // Incluye controles de seguridad básicos (tipo de archivo, peso y normalización de tamaño).
    const onPaste = (event) => {
      if (stage !== 'room' || isFormField(event.target)) return
      const clipboardItems = event.clipboardData?.items
      if (!clipboardItems) return

      for (const item of clipboardItems) {
        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            const cleanText = text.trim()
            if (!isValidUrl(cleanText)) return
            addBackgroundImage(cleanText, Math.max(0, lastPointerRef.current.x - 120), Math.max(0, lastPointerRef.current.y - 90))
          })
          continue
        }

        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          if (file.size > MAX_PASTE_IMAGE_BYTES) {
            notify('La imagen pegada pesa demasiado. Usa una imagen más liviana.')
            continue
          }
          event.preventDefault()
          const reader = new FileReader()
          reader.onerror = () => notify('No se pudo leer la imagen pegada.')
          reader.onload = () => {
            const src = typeof reader.result === 'string' ? reader.result : ''
            if (!src) return
            const img = new Image()
            img.onload = () => {
              const ratio = Math.min(1, MAX_PASTE_IMAGE_DIMENSION / Math.max(img.width || 1, img.height || 1))
              const w = Math.max(40, Math.round((img.width || 240) * ratio))
              const h = Math.max(40, Math.round((img.height || 180) * ratio))
              const x = clamp(((viewport.width / view.zoom) - w) / 2 - (view.panX / view.zoom), 0, WORLD_WIDTH - w)
              const y = clamp(((viewport.height / view.zoom) - h) / 2 - (view.panY / view.zoom), 0, WORLD_HEIGHT - h)
              setRoomWithHistory((prevRoom) => ({
                ...prevRoom,
                collage: {
                  ...prevRoom.collage,
                  layers: [...prevRoom.collage.layers, { id: randomId(), src, x, y, w, h, z: clamp(getMaxZ() + 1, Z_BASE_BACKGROUND, MAX_LAYER_Z) }],
                },
              }))
            }
            img.onerror = () => notify('La imagen pegada no pudo cargarse.')
            img.src = src
          }
          reader.readAsDataURL(file)
        }
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [stage, room, view])

  const onMainMove = (event) => {
    // =================
    // Pan, drag y resize
    // =================
    const point = getCanvasPoint(event)
    lastPointerRef.current = { x: point.x, y: point.y }

    if (panDragRef.current) {
      const { pointerStartX, pointerStartY, panStartX, panStartY } = panDragRef.current
      setView((prevView) => {
        const nextPanX = panStartX + (event.clientX - pointerStartX)
        const nextPanY = panStartY + (event.clientY - pointerStartY)
        const minPanX = Math.min(0, viewport.width - WORLD_WIDTH * prevView.zoom)
        const minPanY = Math.min(0, viewport.height - WORLD_HEIGHT * prevView.zoom)
        return { ...prevView, panX: clamp(nextPanX, minPanX, 0), panY: clamp(nextPanY, minPanY, 0) }
      })
      return
    }

    if (draggingId) {
      interactionDirtyRef.current = true
      updateItem(draggingId, {
        x: clamp(point.x - 60, 0, WORLD_WIDTH - 120),
        y: clamp(point.y - 24, 0, WORLD_HEIGHT - 60),
      }, { recordHistory: false })
    }

    if (dragLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === dragLayerId)
      if (layer) {
        interactionDirtyRef.current = true
        updateLayer(dragLayerId, {
          x: clamp(point.x - layer.w / 2, 0, WORLD_WIDTH - layer.w),
          y: clamp(point.y - layer.h / 2, 0, WORLD_HEIGHT - layer.h),
        }, { recordHistory: false })
      }
    }

    if (resizeItemId) {
      const item = room.items.find((entry) => entry.id === resizeItemId)
      if (item) {
        interactionDirtyRef.current = true
        updateItem(resizeItemId, {
          w: clamp(point.x - item.x, 80, WORLD_WIDTH - item.x),
          h: clamp(point.y - item.y, 80, WORLD_HEIGHT - item.y),
        }, { recordHistory: false })
      }
    }

    if (resizeLayerId) {
      const layer = room.collage.layers.find((entry) => entry.id === resizeLayerId)
      if (layer) {
        interactionDirtyRef.current = true
        updateLayer(resizeLayerId, {
          w: clamp(point.x - layer.x, 60, WORLD_WIDTH - layer.x),
          h: clamp(point.y - layer.y, 60, WORLD_HEIGHT - layer.y),
        }, { recordHistory: false })
      }
    }
  }

  const clearDraggingState = () => {
    if (interactionStartRef.current && interactionDirtyRef.current) {
      undoStackRef.current.push(interactionStartRef.current)
      redoStackRef.current = []
    }
    interactionStartRef.current = null
    interactionDirtyRef.current = false
    setDraggingId(null)
    setDragLayerId(null)
    setResizeLayerId(null)
    setResizeItemId(null)
    setIsPanning(false)
    panDragRef.current = null
  }

  const createRoom = (event) => {
    event.preventDefault()
    setRoom((prevRoom) => ({ ...prevRoom, ...form }))
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
    const nextUrl = normalizeGifUrl(item.editUrl || '')
    if (!nextUrl) return
    updateItem(itemId, { content: nextUrl, editUrl: nextUrl, loadError: '' })
  }

  if (stage === 'landing') {
    // ===============
    // Render landing
    // ===============
    return (
      <div className="min-h-screen landing">
        <header>
          <h1>Achantes</h1>
          <p>Arma tu achante</p>
        </header>
        <form className="card" onSubmit={createRoom}>
          <h2>Crea tu sala</h2>
          <input required placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <textarea placeholder="Descripción" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <label>
            Color de pared
            <input type="color" value={form.wallColor} onChange={(event) => setForm({ ...form, wallColor: event.target.value })} />
          </label>
          <select value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })}>
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
    // ============
    // Render sala
    // ============
    // NOTE(modularización): separar esta estructura en `Sidebar`, `CanvasStage` y modales auxiliares.
    <div className={`app-shell ${menuCollapsed ? 'menu-collapsed' : ''}`} style={{ '--menu-width': `${menuWidth}px` }}>
      <aside>
        {/* Menú lateral: herramientas, capas, dibujo y módulos. */}
        <button className="menu-toggle" onClick={() => setMenuCollapsed((value) => !value)}>
          {menuCollapsed ? '▶ Abrir menú' : '◀ Ocultar menú'}
        </button>

        {!menuCollapsed && (
          <>
            <h3>{room.name}</h3>
            <p>{room.description}</p>
            <button onClick={copyInvite}>{copied ? '¡Copiado!' : 'Copiar invitación'}</button>
            <button onClick={() => setStage('landing')}>Salir de la sala</button>
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
            <button onClick={() => setShowShortcuts(true)}>Atajos</button>
            <div className="tool-grid">
              <button className={activeTool === 'pencil' ? 'tool-active' : ''} onClick={() => setActiveTool('pencil')}>Lápiz</button>
              <button className={activeTool === 'brush' ? 'tool-active' : ''} onClick={() => setActiveTool('brush')}>Pincel</button>
              <button className={activeTool === 'eraser' ? 'tool-active' : ''} onClick={() => setActiveTool('eraser')}>Borrador</button>
              <button className={activeTool === 'crop' ? 'tool-active' : ''} onClick={() => setActiveTool('crop')}>Recorte</button>
              <button className={activeTool === 'select' ? 'tool-active' : ''} onClick={() => setActiveTool('select')}>Seleccionar</button>
              <button className={activeTool === 'hand' ? 'tool-active' : ''} onClick={() => setActiveTool('hand')}>Mano (A)</button>
            </div>
            <label>
              Capa dibujo
              <select value={drawTarget} onChange={(event) => setDrawTarget(event.target.value)}>
                <option value="back">Dibujo fondo</option>
                <option value="front">Dibujo frontal</option>
              </select>
            </label>
            <label>
              Color
              <span className="color-chip" style={{ backgroundColor: brushColor }} />
              <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
            </label>
            <label>
              Tamaño
              <input type="range" min="1" max="30" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
            {activeTool === 'brush' && (
              <>
                <label>Opacidad <input type="range" min="0.1" max="1" step="0.05" value={brushOpacity} onChange={(event) => setBrushOpacity(Number(event.target.value))} /></label>
                <label>Intensidad <input type="range" min="0.1" max="1" step="0.05" value={brushFlow} onChange={(event) => setBrushFlow(Number(event.target.value))} /></label>
                <label>Suavidad punta <input type="range" min="0" max="1" step="0.05" value={brushTaper} onChange={(event) => setBrushTaper(Number(event.target.value))} /></label>
              </>
            )}
            <button onClick={() => undoStroke()}>Deshacer trazo (Ctrl/Cmd+Z)</button>
            <h4>Fondo de sala</h4>
            <input placeholder="URL de imagen de fondo" value={room.backgroundImageUrl || ''} onChange={(event) => setRoomWithHistory((prevRoom) => ({ ...prevRoom, backgroundImageUrl: event.target.value.trim() }), { recordHistory: false })} />
            <button onClick={() => setRoomWithHistory((prevRoom) => ({ ...prevRoom, backgroundImageUrl: (prevRoom.backgroundImageUrl || '').trim() }))}>Aplicar fondo</button>
            <button onClick={() => setRoomWithHistory((prevRoom) => ({ ...prevRoom, backgroundImageUrl: '' }))}>Quitar fondo de sala</button>
            <input placeholder="URL imagen o GIF" value={pastingUrl} onChange={(event) => setPastingUrl(event.target.value)} />
            <button onClick={() => pastingUrl.trim() && addBackgroundImage(pastingUrl.trim(), 60, 60)}>
              Agregar al fondo
            </button>
            {selectedLayerId && <button onClick={removeSelectedEntity}>Eliminar capa seleccionada</button>}
            <button onClick={() => setRoomWithHistory((prevRoom) => ({ ...prevRoom, collage: { ...prevRoom.collage, layers: [], strokesBack: [], strokesFront: [] } }))}>
              Limpiar todo el fondo
            </button>
            <small>Pega imágenes/GIFs con Ctrl/Cmd+V. Pan: rueda presionada o espacio+drag. Zoom: Ctrl+rueda sobre canvas.</small>
            <small>Recorte: selecciona "Recorte" y arrastra sobre el canvas para marcar el área.</small>
            <hr />

            <h4>Módulos flotantes</h4>
            {moduleOptions.map((module) => (
              <button key={module.type} onClick={() => addItem(module.type)}>{module.label}</button>
            ))}
          </>
        )}
      </aside>
      {!menuCollapsed && <div className="menu-resizer" onMouseDown={(event) => { menuResizeRef.current = { startX: event.clientX, startW: menuWidth }; event.preventDefault() }} />}
      {showShortcuts && (
        <div className="shortcuts-modal" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-card" onClick={(event) => event.stopPropagation()}>
            <h3>Atajos</h3>
            <ul>
              <li>Ctrl/Cmd + Z: deshacer trazo</li><li>Espacio + arrastrar: mover vista</li><li>A: activar/desactivar modo mano</li>
              <li>Escape: cancelar selección o salir herramienta</li><li>Ctrl + rueda: zoom</li><li>Suprimir/Backspace: eliminar seleccionado</li>
            </ul>
            <button onClick={() => setShowShortcuts(false)}>Cerrar</button>
          </div>
        </div>
      )}

      <main
        ref={mainRef}
        style={{ background: roomGradient }}
        className={isPanning ? 'is-panning' : ''}
        onMouseMove={onMainMove}
        onMouseUp={clearDraggingState}
        onMouseLeave={clearDraggingState}
        onMouseDown={(event) => {
          const shouldPan = event.button === 1 || (event.button === 0 && (spacePressed || activeTool === 'hand'))
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

        <div
          className={`design-surface ${isPanning ? 'panning' : ''}`}
          style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}
        >
          <canvas ref={backCanvasRef} className="bg-canvas" />
          {room.backgroundImageUrl && (
            // Fondo de sala principal configurable por URL.
            <div className="room-background-image">
              <img src={room.backgroundImageUrl} alt="Fondo de sala" onError={() => notify('No se pudo cargar la imagen de fondo.')} />
            </div>
          )}

          {room.collage.layers.map((layer) => (
            // Capas libres de collage (imágenes pegadas o por URL) con drag y resize.
            <div
              key={layer.id}
              className={`bg-layer ${selectedLayerId === layer.id ? 'selected' : ''}`}
              style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.z || Z_BASE_BACKGROUND }}
              onMouseDown={() => {
                setSelectedLayerId(layer.id)
                setSelectedItemId(null)
                if (activeTool !== 'select') return
                {
                  interactionStartRef.current = room
                  interactionDirtyRef.current = false
                  setDragLayerId(layer.id)
                }
              }}
            >
              <img src={layer.src} alt="layer" draggable={false} onError={() => updateLayer(layer.id, { loadError: 'No se pudo cargar imagen' }, { recordHistory: false })} onLoad={() => layer.loadError && updateLayer(layer.id, { loadError: '' }, { recordHistory: false })} />
              {layer.loadError && <small className="gif-error">{layer.loadError}</small>}
              {showLayerLabels && <span className="layer-badge">Z:{layer.z || Z_BASE_BACKGROUND}</span>}
              <button className="resize-handle" onMouseDown={(event) => { event.stopPropagation(); interactionStartRef.current = room; interactionDirtyRef.current = false; setResizeLayerId(layer.id) }} aria-label="resize" />
            </div>
          ))}

          <canvas
            ref={frontCanvasRef}
            className={`bg-canvas front ${(activeTool === 'pencil' || activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'crop') ? 'drawing' : ''}`}
            onMouseDown={startStroke}
            onMouseMove={moveStroke}
            onMouseUp={() => endStroke(strokeSessionRef.current)}
            onMouseLeave={() => endStroke(strokeSessionRef.current)}
          />
          {cropRect && activeTool === 'crop' && <div className="crop-rect" style={{ left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h }} />}

          {room.items.map((item) => (
            // Módulos interactivos flotantes (texto, post-it, player, dado, firmas, gif).
            <div
              key={item.id}
              className={`item item-${item.type} ${selectedItemId === item.id ? 'selected' : ''}`}
              style={{ left: item.x, top: item.y, width: item.w, minHeight: item.h, zIndex: item.z || Z_BASE_ITEM }}
              onMouseDown={() => {
                setSelectedItemId(item.id)
                setSelectedLayerId(null)
                if (activeTool !== 'select') return
                {
                  interactionStartRef.current = room
                  interactionDirtyRef.current = false
                  setDraggingId(item.id)
                }
              }}
            >
              {item.type === 'gif' && item.content && (
                <img
                  className="item-media"
                  src={item.content}
                  alt={item.type}
                  draggable={false}
                  onError={() => updateItem(item.id, { loadError: 'No se pudo cargar este GIF.' })}
                  onLoad={() => item.loadError && updateItem(item.id, { loadError: '' })}
                />
              )}

              {showLayerLabels && <span className="layer-badge">Z:{item.z || Z_BASE_ITEM}</span>}

              {item.type === 'gif' && (
                <div className="gif-controls" onMouseDown={(event) => event.stopPropagation()}>
                  <input
                    value={item.editUrl || ''}
                    onChange={(event) => updateItem(item.id, { editUrl: event.target.value })}
                    onKeyDown={(event) => event.key === 'Enter' && applyGifUrl(item.id)}
                    placeholder="URL GIF"
                  />
                  <button type="button" onClick={() => applyGifUrl(item.id)}>Aplicar</button>
                </div>
              )}

              {item.type === 'gif' && item.loadError && <small className="gif-error">{item.loadError}</small>}
              {item.type === 'text' && <h5 contentEditable suppressContentEditableWarning onBlur={(event) => updateItem(item.id, { content: event.target.textContent })}>{item.content}</h5>}
              {item.type === 'postit' && <textarea value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} />}
              {item.type === 'player' && <a href={item.content} target="_blank" rel="noreferrer">Abrir reproductor</a>}
              {item.type === 'dice' && <button onClick={() => updateItem(item.id, { content: `🎲 ${Math.floor(Math.random() * 6) + 1}` })}>{item.content}</button>}
              {item.type === 'signwall' && <textarea value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} />}

              <button className="resize-handle" onMouseDown={(event) => { event.stopPropagation(); interactionStartRef.current = room; interactionDirtyRef.current = false; setResizeItemId(item.id) }} aria-label="resize" />
            </div>
          ))}
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
