# Achantes — Modules System

## Objetivo

Los módulos son elementos interactivos colocados sobre el canvas.

Deben funcionar como objetos dentro de la habitación, no como ventanas rígidas desconectadas.

---

# Filosofía

Un módulo debe sentirse como parte del collage del dueño.

Puede verse como:

- objeto decorativo
- botón integrado
- póster clickeable
- reproductor
- ventana flotante
- elemento oculto dentro del diseño

---

# Módulos prioritarios del MVP

## 1. Módulo de música

Prioridad máxima.

Debe permitir:

- cargar música desde YouTube
- reproducir/pausar
- sincronizar con invitados
- mostrar canción actual
- gestionar sugerencias

---

## 2. Módulo de chat

Debe permitir comunicación textual ligera.

Debe soportar:

- mensajes cortos
- emotes/reacciones
- presencia básica
- historial simple de la sesión

No debe competir con la música.

---

## 3. Módulo lector PDF

Debe permitir compartir y visualizar PDFs dentro de la sala.

Uso esperado:

- mangas
- recuerdos
- documentos
- imágenes compiladas
- lecturas compartidas

---

# Módulos futuros

Posibles módulos futuros:

- juegos de mesa simples
- juegos tipo flash
- galería de recuerdos
- lector de manga
- notas colaborativas
- playlist visual
- mini blog personal
- tablero de links
- módulo de stickers

---

# Comportamiento visual

Los módulos deben poder:

- moverse sobre el canvas
- abrirse
- cerrarse
- minimizarse
- expandirse
- integrarse visualmente
- tener versión compacta y expandida

---

# Posicionamiento

Cada módulo debe tener:

- id
- type
- x
- y
- width
- height
- zIndex
- visible
- locked
- ownerId
- roomId
- config

---

# Permisos

El dueño decide quién puede interactuar con cada módulo.

Ejemplos:

- todos pueden ver música
- solo dueño controla música
- invitados pueden sugerir canciones
- espectadores solo escuchan
- invitados pueden escribir en chat
- espectadores pueden leer o no leer chat
- invitados pueden abrir PDFs si tienen permiso

---

# Persistencia

La posición y configuración de los módulos del dueño deben guardarse.

Los cambios hechos por invitados deben ser temporales salvo aprobación del dueño.

---

# Integración con canvas

Los módulos deben convivir con:

- imágenes
- GIFs
- dibujos
- links
- botones
- fondo
- capas

No deben romper zoom, pan ni selección.

---

# Reglas para Codex

1. No implementar todos los módulos al mismo tiempo.
2. Crear un módulo a la vez.
3. Mantener cada módulo desacoplado.
4. No meter toda la lógica de módulos dentro de App.jsx si puede separarse.
5. No duplicar estados globales.
6. No mezclar lógica del canvas con lógica interna del módulo.
7. No romper zoom/pan.
8. Ejecutar build después de cada fase.

---

# Criterios de aceptación

El sistema de módulos cumple si:

- los módulos pueden colocarse sobre el canvas
- pueden moverse libremente
- pueden abrirse/cerrarse
- respetan permisos
- no rompen la navegación del canvas
- pueden guardar configuración
- el módulo de música funciona como prioridad del MVP