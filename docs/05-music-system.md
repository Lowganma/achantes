# Achantes — Music System

## Objetivo

El sistema de música es uno de los pilares principales de Achantes.

Debe permitir que el dueño de la sala reproduzca música desde YouTube y que los invitados la escuchen sincronizadamente dentro de la app.

---

# Filosofía

La música no es un accesorio.

La música es parte central de la sensación de “estar juntos en una habitación”.

Debe sentirse como cuando alguien pone música en su cuarto mientras los demás visitan, dibujan, conversan o exploran.

---

# Fuente principal

Para el MVP, la fuente principal de música será YouTube.

La música debe reproducirse dentro de Achantes, no redirigir al usuario a YouTube.

---

# Control principal

El dueño controla:

- reproducir
- pausar
- cambiar canción
- modificar la cola principal
- aprobar canciones sugeridas
- decidir si los invitados pueden sugerir canciones

---

# Invitados

Los invitados pueden, si tienen permiso:

- escuchar música sincronizada
- sugerir canciones
- enviar links de YouTube
- votar canciones futuras en una fase posterior

Los invitados no controlan directamente la reproducción principal salvo que el dueño les otorgue permiso.

---

# Espectadores

Los espectadores pueden escuchar música si el dueño lo permite.

No pueden:

- cambiar canción
- pausar
- reproducir
- modificar cola
- sugerir canciones salvo permiso explícito

---

# Sincronización

La sincronización mínima aceptable debe mantener:

- misma canción
- mismo estado: play/pausa
- tiempo aproximado de reproducción
- cambios emitidos por el dueño reflejados en invitados

No se requiere precisión profesional milimétrica.

---

# Eventos principales

Eventos esperados:

- MUSIC_PLAY
- MUSIC_PAUSE
- MUSIC_SEEK
- MUSIC_CHANGE_TRACK
- MUSIC_QUEUE_ADD
- MUSIC_QUEUE_REMOVE
- MUSIC_SUGGESTION_CREATED
- MUSIC_SUGGESTION_APPROVED
- MUSIC_SUGGESTION_REJECTED

---

# Cola de reproducción

Debe existir una cola principal controlada por el dueño.

Estados posibles de una canción:

- queued
- playing
- played
- skipped
- removed

---

# Sugerencias

Los invitados pueden sugerir canciones.

Una sugerencia debe incluir:

- usuario que sugiere
- link o id de YouTube
- título si está disponible
- estado pendiente/aprobado/rechazado
- fecha de sugerencia

El dueño puede:

- aprobar
- rechazar
- agregar a la cola
- eliminar

---

# Comportamiento si el dueño se desconecta

Como la sala representa el achante del dueño:

- la música puede pausarse
- la sala puede pasar a modo solo lectura
- los invitados no deben tomar control automáticamente
- se puede mostrar un mensaje indicando que el dueño salió

---

# Interfaz esperada

El módulo musical debe poder vivir sobre el canvas.

Debe poder verse como:

- reproductor integrado
- objeto decorativo interactivo
- módulo movible
- parte del collage

No debe sentirse como un reproductor genérico desconectado del resto de la sala.

---

# Integración con canvas

El módulo de música debe poder:

- moverse
- colocarse libremente
- integrarse visualmente
- abrirse/cerrarse
- tener una versión compacta y una expandida

---

# Datos mínimos necesarios

Para el MVP, guardar:

## Sala

- roomId
- ownerId
- currentTrackId
- playbackState
- playbackStartedAt
- playbackPosition
- updatedAt

## Track

- id
- roomId
- youtubeUrl
- youtubeVideoId
- title
- addedByUserId
- status
- createdAt

---

# Reglas técnicas

1. No reproducir música fuera de la app.
2. No permitir que invitados sin permiso controlen la música.
3. No duplicar listeners realtime.
4. No enviar eventos innecesarios constantemente.
5. Sincronizar por eventos, no por snapshots gigantes.
6. Validar permisos en frontend y backend.
7. Mantener el módulo desacoplado del canvas.
8. Ejecutar build después de cada fase.

---

# MVP musical mínimo

El MVP musical cumple si:

1. El dueño pega un link de YouTube.
2. El video se carga en el reproductor dentro de Achantes.
3. El dueño presiona play.
4. El invitado escucha la misma canción.
5. Si el dueño pausa, el invitado pausa.
6. Si el dueño cambia la canción, el invitado cambia.
7. Los invitados pueden sugerir canciones si tienen permiso.
8. El dueño puede aprobar o rechazar sugerencias.

---

# Fuera del MVP

No incluir todavía:

- integración Spotify
- integración SoundCloud
- votaciones complejas
- perfiles musicales
- historial musical avanzado
- playlists públicas
- recomendaciones automáticas