export const MODULE_TYPES = {
  text: 'text',
  postit: 'postit',
  player: 'player',
  dice: 'dice',
  signwall: 'signwall',
  gif: 'gif',
}

export const MODULE_ITEM_MIN_SIZE = 80
export const MODULE_ITEM_DEFAULT_SIZE = { width: 180, height: 120 }
const MODULE_ITEM_DEFAULT_POSITION = { x: 80, y: 80 }

export const moduleOptions = [
  { type: MODULE_TYPES.text, label: 'Texto decorativo' },
  { type: MODULE_TYPES.postit, label: 'Post-it' },
  { type: MODULE_TYPES.player, label: 'Reproductor link' },
  { type: MODULE_TYPES.dice, label: 'Dado simple' },
  { type: MODULE_TYPES.signwall, label: 'Muro firmas' },
  { type: MODULE_TYPES.gif, label: 'GIF URL' },
]

export const defaultItemsByType = {
  [MODULE_TYPES.text]: { content: 'ACHANTE VIBES ✦' },
  [MODULE_TYPES.postit]: { content: 'No olvides invitar al combo 🔥', w: 160, h: 160 },
  [MODULE_TYPES.player]: { content: 'https://open.spotify.com/' },
  [MODULE_TYPES.dice]: { content: '🎲 1' },
  [MODULE_TYPES.signwall]: { content: 'Firma aquí:\n- @pana1: brutal\n- @pana2: qué nivel', w: 240, h: 170 },
  [MODULE_TYPES.gif]: { content: '', editUrl: '', w: 240, h: 180, loadError: '' },
}

export const isKnownModuleType = (value) => Object.values(MODULE_TYPES).includes(value)

const toNumberOr = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const normalizeModuleItem = ({ item, clamp, worldWidth, worldHeight, baseZ, maxZ, randomId }) => {
  if (!item || typeof item !== 'object') return null
  const type = isKnownModuleType(item.type) ? item.type : MODULE_TYPES.text
  const typeDefaults = defaultItemsByType[type] || {}

  const width = clamp(toNumberOr(item.w, typeDefaults.w ?? MODULE_ITEM_DEFAULT_SIZE.width), MODULE_ITEM_MIN_SIZE, worldWidth)
  const height = clamp(toNumberOr(item.h, typeDefaults.h ?? MODULE_ITEM_DEFAULT_SIZE.height), MODULE_ITEM_MIN_SIZE, worldHeight)

  return {
    id: item.id || randomId(),
    type,
    x: clamp(toNumberOr(item.x, MODULE_ITEM_DEFAULT_POSITION.x), 0, Math.max(0, worldWidth - width)),
    y: clamp(toNumberOr(item.y, MODULE_ITEM_DEFAULT_POSITION.y), 0, Math.max(0, worldHeight - height)),
    w: width,
    h: height,
    content: typeof item.content === 'string' ? item.content : (typeDefaults.content || ''),
    editUrl: typeof item.editUrl === 'string' ? item.editUrl : (typeDefaults.editUrl || ''),
    loadError: typeof item.loadError === 'string' ? item.loadError : (typeDefaults.loadError || ''),
    z: clamp(toNumberOr(item.z, baseZ), baseZ, maxZ),
    visible: item.visible !== false,
    locked: item.locked === true,
    moduleType: type,
    version: 1,
  }
}

export const createModuleItem = ({ id, type, z }) => ({
  id,
  type,
  x: MODULE_ITEM_DEFAULT_POSITION.x,
  y: MODULE_ITEM_DEFAULT_POSITION.y,
  w: MODULE_ITEM_DEFAULT_SIZE.width,
  h: MODULE_ITEM_DEFAULT_SIZE.height,
  content: '',
  editUrl: '',
  z,
  visible: true,
  locked: false,
  moduleType: type,
  version: 1,
  ...defaultItemsByType[type],
})
