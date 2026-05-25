# Achantes — Save and Versions System

## Objetivo

Definir cómo Achantes guarda cambios, maneja persistencia y controla versiones de la sala.

El sistema debe priorizar:

- estabilidad
- control del dueño
- rendimiento
- seguridad
- reversibilidad de cambios

---

# Filosofía

Achantes NO debe guardar cada microacción automáticamente si eso afecta rendimiento o estabilidad.

La sala debe sentirse manipulable y experimental, pero con capacidad de volver atrás.

---

# Tipos de cambios

## 1. Cambios permanentes

Son cambios aprobados oficialmente por el dueño.

Ejemplos:

- mover imágenes
- cambiar fondo
- agregar módulos
- reorganizar elementos
- aprobar dibujos
- guardar una versión

Estos cambios forman parte oficial de la sala.

---

## 2. Cambios temporales

Son cambios hechos por invitados o cambios no confirmados.

Ejemplos:

- dibujos temporales
- notas temporales
- sugerencias visuales
- stickers temporales
- propuestas de reorganización

Estos cambios NO deben persistir automáticamente.

---

# Sistema de guardado

## Guardado manual

El dueño decide cuándo guardar oficialmente el estado de la sala.

Esto evita:
- spam de escritura
- sobrecarga realtime
- corrupción constante del estado
- demasiadas versiones inútiles

---

# Versiones de sala

El dueño debe poder crear versiones/snapshots de la sala.

Cada versión representa un estado completo del canvas y módulos.

---

# Información mínima de una versión

## RoomVersion

- id
- roomId
- createdBy
- createdAt
- snapshotData
- optionalDescription

---

# Restauración

El dueño debe poder:

- restaurar versiones anteriores
- duplicar versiones
- crear variantes de diseño
- experimentar sin perder el estado previo

---

# Undo / Redo

El sistema debe permitir undo/redo global.

Debe incluir:

- dibujos
- movimientos
- capas
- redimensionado
- eliminación
- agregados
- cambios de fondo
- módulos

---

# Reglas importantes de undo/redo

## No crear múltiples sistemas paralelos

Debe existir un único history manager.

---

## Undo debe funcionar con una sola acción

No debe requerir múltiples Ctrl+Z para revertir un cambio.

---

## Redo debe usar Ctrl+Y

No usar Ctrl+Shift+Z.

---

# Persistencia realtime

Realtime NO debe significar guardar permanentemente cada cambio.

Realtime sirve para:
- sincronización visual
- presencia
- interacción viva

Persistencia permanente es otra responsabilidad separada.

---

# Estrategia recomendada

## Estado temporal local

Usar estado local/reactivo mientras el usuario interactúa.

## Confirmación explícita

Guardar oficialmente solo cuando el dueño confirme.

---

# Posibles estrategias futuras

- autosave opcional
- historial visual
- timeline de versiones
- snapshots automáticos cada cierto tiempo
- recuperación ante crash

No son prioridad MVP.

---

# Reglas para Codex

1. No crear múltiples undo stacks.
2. No duplicar refs de historial.
3. No mezclar realtime con persistencia oficial.
4. No guardar cada frame del canvas.
5. No crear autosave agresivo sin autorización.
6. No reescribir App.jsx completo.
7. Hacer cambios pequeños y verificables.
8. Ejecutar build después de cada fase.

---

# Criterios de aceptación

El sistema cumple si:

- el dueño puede guardar versiones
- los invitados no generan cambios permanentes automáticamente
- undo/redo funciona globalmente
- se puede volver a estados anteriores
- realtime no destruye rendimiento
- los cambios oficiales son estables