import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasViewport, clamp } from './hooks/useCanvasViewport'
import { createModuleItem, moduleOptions, normalizeModuleItem } from './models/modules'
import { getSupabaseClient } from './lib/supabaseClient'

// =========================
// Configuración base canvas
// =========================
const STORAGE_KEY = 'achantes-room-v2'
const WORLD_WIDTH = 6000
const WORLD_HEIGHT = 4000
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const MENU_WIDTH_KEY = 'achantes-menu-width-v1'
const MIN_MENU_WIDTH = 150
const MAX_MENU_WIDTH = 360
const MAX_HISTORY_ENTRIES = 40
const MAX_PASTE_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_PASTE_IMAGE_DIMENSION = 400
const MAX_BACKGROUND_IMAGE_BYTES = 4 * 1024 * 1024
const MUSIC_EVENT_TYPES = {
  PLAY: 'MUSIC_PLAY',
  PAUSE: 'MUSIC_PAUSE',
  SEEK: 'MUSIC_SEEK',
  CHANGE_TRACK: 'MUSIC_CHANGE_TRACK',
}

// Z-index lógico por familias
const Z_BASE_BACKGROUND = 1
const Z_BASE_ITEM = 2
const MAX_LAYER_Z = 50

const randomId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const isFormField = (element) => {
  if (!element) return false
  const tagName = element.tagName?.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable
}

const defaultRoom = {
  name: 'Mi Achante',
  description: 'Un cuarto nostálgico para panas',
  wallColor: '#2f2648',
  backgroundImageUrl: '',
  style: 'grunge-neon',
  items: [],
  collage: { layers: [], strokesBack: [], strokesFront: [] },
}

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
    items: (Array.isArray(normalized.items) ? normalized.items : [])
      .map((item) => normalizeModuleItem({
        item,
        clamp,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        baseZ: Z_BASE_ITEM,
        maxZ: MAX_LAYER_Z,
        randomId,
      }))
      .filter(Boolean),
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


const getYouTubeVideoId = (rawUrl = '') => {
  const value = rawUrl.trim()
  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1)
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/embed/')[1]?.split('/')[0] || ''
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || ''
    }
  } catch {
    return ''
  }

  return ''
}

const getYouTubeEmbedUrl = (videoId = '') => {
  if (!videoId) return ''
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
}

const getRoomSlugFromUrl = () => {
  const path = window.location.pathname || ''
  const match = path.match(/^\/room\/([^/?#]+)/i)
  return (match?.[1] || '').trim().toLowerCase()
}

function App() {
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

  const [draggingId, setDraggingId] = useState(null)
  const [dragLayerId, setDragLayerId] = useState(null)
  const [resizeLayerId, setResizeLayerId] = useState(null)
  const [resizeItemId, setResizeItemId] = useState(null)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const { view, setView, zoomAtPoint, panByPointerDrag, zoomIn, zoomOut, resetView, fitToScreen } = useCanvasViewport({
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
  })

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
  const clientIdRef = useRef(randomId())
  console.log('current clientId:', clientIdRef.current)
  const musicEventDedupRef = useRef(new Set())
  const musicRealtimeRef = useRef(null)
  const [roomSlug, setRoomSlug] = useState(() => getRoomSlugFromUrl() || 'default')
  const [roomSyncStatus, setRoomSyncStatus] = useState({ mode: 'local', reason: 'Inicializando sync...' })
  const roomIdRef = useRef(null)

  useEffect(() => { drawTargetRef.current = drawTarget }, [drawTarget])
  useEffect(() => { localStorage.setItem(MENU_WIDTH_KEY, String(menuWidth)) }, [menuWidth])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(notify.timer)
    notify.timer = window.setTimeout(() => setToast(''), 2800)
  }

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
      if (!event.ctrlKey) return
      event.preventDefault()
      const rect = host.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top

      zoomAtPoint({
        deltaY: event.deltaY,
        cursorX,
        cursorY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      })
    }

    host.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => host.removeEventListener('wheel', onNativeWheel)
  }, [viewport.width, viewport.height])

  useEffect(() => {
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
    if (room.style === 'punk-zine') return `linear-gradient(135deg, ${room.wallColor}, #111)`
    if (room.style === 'retro-pop') return `radial-gradient(circle at 20% 20%, #ff4d9d, ${room.wallColor})`
    return `linear-gradient(160deg, ${room.wallColor}, #180f28)`
  }, [room.style, room.wallColor])

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

  const applyBackgroundImageFromFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('Selecciona un archivo de imagen válido para el fondo.')
      return
    }
    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      notify('La imagen pesa demasiado para guardarla en localStorage. Usa una imagen más ligera (máx. 4 MB).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextBackground = typeof reader.result === 'string' ? reader.result : ''
      if (!nextBackground) {
        notify('No se pudo leer la imagen seleccionada.')
        return
      }
      setRoomWithHistory((prevRoom) => ({ ...prevRoom, backgroundImageUrl: nextBackground }))
      notify('Fondo local aplicado ✅')
    }
    reader.onerror = () => notify('No se pudo leer la imagen seleccionada.')
    reader.readAsDataURL(file)
  }

  const setMusicFromUrl = (item) => {
    console.log('button clicked: load youtube', { itemId: item.id })
    const rawUrl = (item.editUrl || '').trim()
    const videoId = getYouTubeVideoId(rawUrl)
    if (!videoId) {
      updateItem(item.id, { status: 'paused' })
      notify('URL de YouTube inválida. Usa un link de youtube.com o youtu.be.')
      return
    }
    emitMusicEvent({
      type: MUSIC_EVENT_TYPES.CHANGE_TRACK,
      itemId: item.id,
      payload: {
        provider: 'youtube',
        url: rawUrl,
        videoId,
        content: getYouTubeEmbedUrl(videoId),
        title: item.title || 'Música de la sala',
        status: 'paused',
        positionMs: 0,
      },
    })
  }

  const applyMusicEvent = (event, { source = 'local' } = {}) => {
    if (!event?.itemId || !event?.type) return
    if (source === 'remote') console.log('applyMusicEvent from remote:', event)
    const dedupId = event.id || `${event.type}-${event.itemId}-${event.at || 0}`
    if (musicEventDedupRef.current.has(dedupId)) {
      console.log('music event dedup skipped:', { dedupId, source, by: event.by, currentClientId: clientIdRef.current })
      return
    }
    musicEventDedupRef.current.add(dedupId)
    if (musicEventDedupRef.current.size > 1000) musicEventDedupRef.current.clear()
    const patchBase = { lastMusicEventId: dedupId, lastMusicEventAt: event.at || Date.now() }
    if (event.type === MUSIC_EVENT_TYPES.PLAY) updateItem(event.itemId, { ...patchBase, status: 'playing' }, { recordHistory: false })
    if (event.type === MUSIC_EVENT_TYPES.PAUSE) updateItem(event.itemId, { ...patchBase, status: 'paused' }, { recordHistory: false })
    if (event.type === MUSIC_EVENT_TYPES.SEEK) updateItem(event.itemId, { ...patchBase, positionMs: Number(event.payload?.positionMs) || 0 }, { recordHistory: false })
    if (event.type === MUSIC_EVENT_TYPES.CHANGE_TRACK) updateItem(event.itemId, { ...patchBase, ...(event.payload || {}) }, { recordHistory: false })
  }

  const emitMusicEvent = (partialEvent) => {
    const event = { ...partialEvent, id: randomId(), at: Date.now(), by: clientIdRef.current }
    console.log('emitMusicEvent called:', { event, currentClientId: clientIdRef.current, roomId: roomIdRef.current })
    applyMusicEvent(event)
    if (musicRealtimeRef.current?.transport === 'supabase') {
      musicRealtimeRef.current.send(event)
      return
    }
    if (musicRealtimeRef.current?.transport === 'broadcast') musicRealtimeRef.current.send(event)
  }

  useEffect(() => {
    let stopped = false
    let cleanup = () => {}

    const setup = async () => {
      const supabase = await getSupabaseClient()
      if (stopped) return
      if (supabase) {
        console.log('resolved room slug:', roomSlug)
        const { data: existingRoom, error: roomError } = await supabase.from('rooms').select('id,slug').eq('slug', roomSlug).maybeSingle()
        if (roomError) throw new Error(`rooms query failed: ${roomError.message}`)
        let roomId = existingRoom?.id
        if (!roomId) {
          const { data: createdRoom, error: createRoomError } = await supabase.from('rooms').insert({ slug: roomSlug, owner_name: room.name || roomSlug }).select('id,slug').single()
          if (createRoomError) throw new Error(`rooms create failed: ${createRoomError.message}`)
          roomId = createdRoom?.id
        }
        if (!roomId) throw new Error('room_id missing after create/query')
        roomIdRef.current = roomId
        console.log('resolved room_id:', roomId)
        console.log('current clientId:', clientIdRef.current)

        const { data: stateRow, error: stateError } = await supabase.from('music_state').select('room_id').eq('room_id', roomId).maybeSingle()
        if (stateError) throw new Error(`music_state query failed: ${stateError.message}`)
        if (!stateRow?.room_id) {
          const firstMusicItem = room.items.find((item) => item.type === 'music')
          const defaultModuleItemId = firstMusicItem?.id || `music-${roomId}`
          const { error: stateInsertError } = await supabase.from('music_state').insert({
            room_id: roomId,
            module_item_id: defaultModuleItemId,
            current_track_url: firstMusicItem?.url || firstMusicItem?.editUrl || null,
            current_video_id: firstMusicItem?.videoId || null,
            embed_url: firstMusicItem?.content || null,
            status: firstMusicItem?.status || 'paused',
            position_ms: Number(firstMusicItem?.positionMs) || 0,
            event_id: `initial-${clientIdRef.current}`,
            updated_by: clientIdRef.current,
          })
          if (stateInsertError) throw new Error(`music_state create failed: ${stateInsertError.message}`)
          console.log('music_state loaded/created: created')
        } else {
          console.log('music_state loaded/created: loaded')
        }

        const channelName = `room:${roomId}:music-events`
        const realtimeFilter = `room_id=eq.${roomId}`
        console.log('realtime channel creating:', channelName)
        console.log('realtime filter:', realtimeFilter)
        const channel = supabase.channel(channelName)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'music_events', filter: realtimeFilter }, ({ new: payload }) => {
            console.log('realtime payload received:', payload)
            if (!payload) return
            if (payload.created_by === clientIdRef.current) {
              console.log('ignored own event:', { createdBy: payload.created_by, currentClientId: clientIdRef.current, clientEventId: payload.client_event_id })
              return
            }
            const musicEvent = {
              ...(payload.payload || {}),
              id: payload.payload?.id || payload.client_event_id || payload.id,
              type: payload.payload?.type || payload.event_type,
              itemId: payload.payload?.itemId || payload.module_item_id,
              by: payload.payload?.by || payload.created_by,
              at: payload.payload?.at || new Date(payload.created_at).getTime(),
            }
            applyMusicEvent(musicEvent, { source: 'remote' })
          })

        await new Promise((resolve, reject) => {
          channel.subscribe((status, err) => {
            console.log('realtime subscription error/status:', status, err || null)
            if (status === 'SUBSCRIBED') resolve()
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime status ${status}`))
          })
        })
        console.log('realtime channel subscribed')
        musicRealtimeRef.current = {
          transport: 'supabase',
          send: async (event) => {
            const currentMusicItem = room.items.find((item) => item.id === event.itemId)
            const eventPayload = {
              type: event.type,
              itemId: event.itemId,
              payload: event.payload || {},
              id: event.id,
              by: event.by,
              at: event.at,
            }
            const row = {
              room_id: roomIdRef.current,
              module_item_id: event.itemId || `music-${roomIdRef.current}`,
              event_type: event.type,
              payload: eventPayload,
              client_event_id: event.id,
              created_by: clientIdRef.current,
            }
            console.log('event insert start:', row)
            console.log('music event insert start:', row)
            const { data: insertedEvent, error: eventError } = await supabase.from('music_events').insert(row).select('id').single()
            if (eventError) {
              console.error('event insert error:', eventError)
              console.error('music event insert error:', eventError)
              setRoomSyncStatus({ mode: 'local', reason: `Fallback por error insert: ${eventError.message}` })
              return
            }
            console.log('event insert success:', insertedEvent)
            console.log('music event insert success:', insertedEvent)
            const eventId = insertedEvent?.id || event.id
            const payload = event.payload || {}
            const { data: existingMusicState, error: existingStateError } = await supabase
              .from('music_state')
              .select('current_track_url,current_video_id,embed_url,position_ms,status')
              .eq('room_id', roomIdRef.current)
              .maybeSingle()
            if (existingStateError) console.error('music_state current state query error:', existingStateError)
            const nextStatus = payload.status || (event.type === MUSIC_EVENT_TYPES.PLAY ? 'playing' : event.type === MUSIC_EVENT_TYPES.PAUSE ? 'paused' : existingMusicState?.status || currentMusicItem?.status || 'paused')
            const nextPositionMs = Number.isFinite(Number(payload.positionMs)) ? Number(payload.positionMs) : Number(existingMusicState?.position_ms ?? currentMusicItem?.positionMs) || 0
            const { error: updateStateError } = await supabase.from('music_state').upsert({
              room_id: roomIdRef.current,
              module_item_id: event.itemId || `music-${roomIdRef.current}`,
              current_track_url: payload.url || currentMusicItem?.url || currentMusicItem?.editUrl || existingMusicState?.current_track_url || null,
              current_video_id: payload.videoId || currentMusicItem?.videoId || existingMusicState?.current_video_id || null,
              embed_url: payload.content || currentMusicItem?.content || existingMusicState?.embed_url || null,
              status: nextStatus,
              position_ms: nextPositionMs,
              event_id: eventId,
              updated_by: clientIdRef.current,
            }, { onConflict: 'room_id' })
            if (updateStateError) console.error('music_state upsert error:', updateStateError)
            else console.log('music_state upsert success:', { roomId: roomIdRef.current, eventId, status: nextStatus })
          },
        }
        cleanup = () => {
          supabase.removeChannel(channel)
          if (musicRealtimeRef.current?.transport === 'supabase') musicRealtimeRef.current = null
        }
        setRoomSyncStatus({ mode: 'supabase', reason: 'Sync Supabase activo' })
        console.log('realtime subscribed')
        notify('Música conectada por Supabase Realtime ✅')
        return
      }

      const fallback = new BroadcastChannel(`achantes-music-${roomSlug}`)
      const onMessage = (message) => {
        const event = message?.data
        if (!event) return
        if (event.by === clientIdRef.current) {
          console.log('ignored own event:', { createdBy: event.by, currentClientId: clientIdRef.current, clientEventId: event.id })
          return
        }
        console.log('realtime payload received:', event)
        applyMusicEvent(event, { source: 'remote' })
      }
      fallback.addEventListener('message', onMessage)
      musicRealtimeRef.current = {
        transport: 'broadcast',
        send: (event) => fallback.postMessage(event),
      }
      setRoomSyncStatus({ mode: 'local', reason: 'fallback reason: Supabase no configurado o cliente no disponible' })
      cleanup = () => {
        fallback.removeEventListener('message', onMessage)
        fallback.close()
        if (musicRealtimeRef.current?.transport === 'broadcast') musicRealtimeRef.current = null
      }
      notify('Supabase no configurado: usando sync local (misma PC).')
    }

    setup()
    return () => {
      stopped = true
      cleanup()
    }
  }, [roomSlug])

  const addItem = (type) => {
    const nextItem = createModuleItem({
      id: randomId(),
      type,
      z: clamp(getMaxZ() + 1, Z_BASE_ITEM, MAX_LAYER_Z),
    })

    setRoomWithHistory((prevRoom) => ({ ...prevRoom, items: [...prevRoom.items, nextItem] }))
    setSelectedItemId(nextItem.id)
    setSelectedLayerId(null)
  }

  const addBackgroundImage = (src, x = 50, y = 60) => {
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
    if (stage !== 'room') return
    const preview = currentStroke.length > 1 ? { points: currentStroke, color: brushColor, size: activeTool === 'pencil' ? Math.max(1, Math.min(brushSize, 8)) : activeTool === 'eraser' ? Math.max(8, brushSize * 1.6) : Math.max(brushSize, 6), tool: activeTool, opacity: brushOpacity } : null
    drawStrokes(backCanvasRef.current, room.collage.strokesBack, drawTarget === 'back' ? preview : null)
    drawStrokes(frontCanvasRef.current, room.collage.strokesFront, drawTarget === 'front' ? preview : null)
  }, [stage, room.collage.strokesBack, room.collage.strokesFront, currentStroke, drawTarget, brushColor, brushSize, activeTool, brushOpacity])

  useEffect(() => {
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
    const point = getCanvasPoint(event)
    lastPointerRef.current = { x: point.x, y: point.y }

    if (panDragRef.current) {
      const { pointerStartX, pointerStartY, panStartX, panStartY } = panDragRef.current
      panByPointerDrag({
        pointerStartX,
        pointerStartY,
        panStartX,
        panStartY,
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
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
    const nextSlug = form.name.trim().toLowerCase().replaceAll(' ', '-')
    setRoomSlug(nextSlug)
    window.history.replaceState({}, '', `/room/${nextSlug}`)
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
    <div className={`app-shell ${menuCollapsed ? 'menu-collapsed' : ''}`} style={{ '--menu-width': `${menuWidth}px` }}>
      <aside>
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
            <button onClick={() => setRoomWithHistory((prevRoom) => ({ ...prevRoom, backgroundImageUrl: (prevRoom.backgroundImageUrl || '').trim() }))}>Aplicar fondo por URL</button>
            <label>
              Subir imagen de fondo desde mi PC
              <input type="file" accept="image/*" onChange={(event) => applyBackgroundImageFromFile(event.target.files?.[0])} />
            </label>
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
          <button onClick={zoomIn}>+</button>
          <button onClick={zoomOut}>-</button>
          <button onClick={resetView}>Restablecer vista</button>
          <button onClick={() => fitToScreen(viewport.width, viewport.height)}>
            Ajustar a pantalla
          </button>
        </div>

        <div
          className={`design-surface ${isPanning ? 'panning' : ''}`}
          style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}
        >
          <canvas ref={backCanvasRef} className="bg-canvas" />
          {room.backgroundImageUrl && (
            <div className="room-background-image">
              <img src={room.backgroundImageUrl} alt="Fondo de sala" onError={() => notify('No se pudo cargar la imagen de fondo.')} />
            </div>
          )}

          {room.collage.layers.map((layer) => (
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
            <div
              key={item.id}
              className={`item item-${item.type} ${selectedItemId === item.id ? 'selected' : ''}`}
              style={{ left: item.x, top: item.y, width: item.w, height: item.collapsed && item.type === 'music' ? 64 : item.h, zIndex: item.z || Z_BASE_ITEM }}
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
              {item.type === 'music' && (
                <div className={`music-module ${item.collapsed ? 'collapsed' : ''}`}>
                  <div className="music-module-header" title="Arrastra desde aquí para mover">
                    <strong>{item.title || 'Radio del Achante'}</strong>
                    <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={() => updateItem(item.id, { collapsed: !item.collapsed })}>
                      {item.collapsed ? 'Expandir' : 'Minimizar'}
                    </button>
                  </div>
                  <small>
                    {item.status === 'playing' ? 'Reproduciendo en sala' : 'En pausa en sala'} · {roomSyncStatus.mode === 'supabase' ? 'Conectado a sala (Supabase)' : `Local: ${roomSyncStatus.reason}`}
                  </small>
                  <input
                        onMouseDown={(event) => event.stopPropagation()}
                        className={item.collapsed ? 'is-hidden' : ''}
                        value={item.editUrl || item.url || ''}
                        onChange={(event) => updateItem(item.id, { editUrl: event.target.value })}
                        onKeyDown={(event) => event.key === 'Enter' && setMusicFromUrl(item)}
                        placeholder="Pega URL de YouTube"
                      />
                      <div className={`music-module-actions ${item.collapsed ? 'is-hidden' : ''}`}>
                        <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={() => setMusicFromUrl(item)}>Cargar YouTube</button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            console.log('button clicked: play/pause', { itemId: item.id, nextType: item.status === 'playing' ? MUSIC_EVENT_TYPES.PAUSE : MUSIC_EVENT_TYPES.PLAY })
                            emitMusicEvent({ type: item.status === 'playing' ? MUSIC_EVENT_TYPES.PAUSE : MUSIC_EVENT_TYPES.PLAY, itemId: item.id })
                          }}
                        >
                          {item.status === 'playing' ? 'Pausar sala' : 'Reproducir sala'}
                        </button>
                      </div>
                  {item.content ? (
                        <div className="music-player-shell" onMouseDown={(event) => event.stopPropagation()}>
                          <iframe
                            title={`music-${item.id}`}
                            src={item.content}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <p className={`music-placeholder ${item.collapsed ? 'is-hidden' : ''}`}>La Radio del Achante está lista. Pega un link de YouTube 🎧</p>
                      )}
                </div>
              )}
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
