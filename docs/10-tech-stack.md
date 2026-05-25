# Achantes — Tech Stack

## Objetivo

Definir la base técnica de Achantes para que el desarrollo sea ordenado, modular y seguro.

---

# Stack actual

## Frontend

- React
- Vite
- JavaScript / JSX

## Backend / Base de datos

- Supabase

## Tiempo real

- Supabase Realtime

## Control de versiones

- Git
- GitHub
- ramas pequeñas por feature/fix

---

# Principios técnicos

## 1. Separación de responsabilidades

La app no debe concentrar toda la lógica en App.jsx.

Cuando un sistema crezca, debe separarse progresivamente en:

- componentes
- hooks
- helpers
- services
- managers

---

# Estructura sugerida futura

```txt
src/
  components/
    canvas/
    modules/
    music/
    chat/
    ui/

  hooks/
    useCanvasViewport.js
    useCanvasDrawing.js
    useHistoryManager.js
    useRealtimeRoom.js
    useMusicSync.js

  services/
    supabaseClient.js
    roomService.js
    musicService.js
    realtimeService.js

  managers/
    historyManager.js
    permissionsManager.js
    layerManager.js

  utils/
    geometry.js
    youtube.js
    ids.js

  App.jsx
  main.jsx