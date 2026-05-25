export const MODULE_TYPES = {
  text: 'text',
  postit: 'postit',
  player: 'player',
  dice: 'dice',
  signwall: 'signwall',
  gif: 'gif',
}

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

export const createModuleItem = ({ id, type, z }) => ({
  id,
  type,
  x: 80,
  y: 80,
  w: 180,
  h: 120,
  content: '',
  editUrl: '',
  z,
  ...defaultItemsByType[type],
})
