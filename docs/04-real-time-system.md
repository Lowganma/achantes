# Achantes — Real Time System

## Objetivo

Achantes debe permitir que múltiples personas compartan la sensación de estar dentro del mismo espacio digital en tiempo real.

La experiencia en vivo es uno de los pilares principales de la aplicación.

---

# Filosofía del tiempo real

El tiempo real no existe para productividad.

Existe para:
- presencia
- compañía
- ambiente
- interacción emocional
- compartir música y espacio visual

Achantes debe sentirse más como “estar juntos en una habitación” que como una herramienta colaborativa empresarial.

---

# Elementos sincronizados en tiempo real

## Música

La música debe sincronizarse entre todos los usuarios conectados.

El dueño controla:
- play
- pausa
- cambio de canción
- volumen global opcional
- cola principal

Los invitados pueden:
- sugerir canciones
- votar canciones futuras (futuro)
- escuchar sincronizadamente

---

## Canvas

Debe sincronizarse:

- dibujos temporales
- movimientos visibles
- aparición de nuevos elementos temporales
- cursores o presencia básica (futuro)
- cambios aprobados por el dueño

No todo necesita persistencia inmediata.

---

## Chat

El chat debe ser en tiempo real.

Debe soportar:
- mensajes rápidos
- respuestas emocionales
- reacciones/emotes
- mensajes cortos
- ambiente casual

No se busca un sistema tipo Discord complejo.

---

## Presencia de usuarios

La sala debe mostrar qué usuarios están conectados.

No se priorizan avatares complejos en el MVP.

Puede mostrarse mediante:
- iconos
- indicadores mínimos
- nombres conectados

---

# Arquitectura general esperada

Frontend:
- React + Vite

Backend:
- Supabase

Tiempo real:
- Supabase Realtime
- WebSockets administrados por Supabase

---

# Regla importante

El dueño es el host principal de la experiencia.

La sala idealmente depende del dueño conectado.

Si el dueño se desconecta:
- la música puede detenerse
- la sesión puede pausarse
- la sala puede pasar a modo solo lectura temporal

---

# Música sincronizada

## Fuente principal

YouTube.

La reproducción debe ocurrir integrada dentro de Achantes.

No debe sentirse como abrir YouTube aparte.

---

## Comportamiento esperado

Cuando el dueño:
- pausa
- reproduce
- cambia canción
- adelanta tiempo

todos los invitados sincronizados deben reflejar el cambio.

---

## Sincronización mínima aceptable

Debe mantenerse:
- misma canción
- tiempo aproximado compartido
- play/pause sincronizado

No se necesita precisión milimétrica tipo DAW profesional.

---

# Estado del canvas en tiempo real

## Persistente

Cambios del dueño guardados oficialmente.

## Temporal

Cambios de invitados pendientes de aprobación.

---

# Eventos importantes

Ejemplos de eventos realtime:

- USER_JOINED_ROOM
- USER_LEFT_ROOM
- MUSIC_PLAY
- MUSIC_PAUSE
- MUSIC_CHANGE
- CHAT_MESSAGE
- USER_DRAW
- USER_REACTION
- TEMP_NOTE_CREATED
- OWNER_APPROVED_CHANGE

---

# Restricciones técnicas

## No saturar realtime innecesariamente

No enviar:
- estado completo del canvas constantemente
- snapshots gigantes
- render completo por frame

Preferir:
- eventos pequeños
- diffs
- acciones concretas

---

# Estrategia MVP

Para el MVP:

Prioridad máxima:
1. Música sincronizada
2. Chat en tiempo real
3. Presencia básica
4. Dibujos simples sincronizados

---

# Reglas para Codex

1. No implementar realtime global masivo de golpe.
2. Implementar un sistema a la vez.
3. Validar primero música sincronizada mínima.
4. No mezclar realtime con refactors grandes del canvas.
5. No duplicar listeners websocket.
6. Limpiar listeners correctamente en useEffect.
7. Evitar memory leaks.
8. Ejecutar build después de cada cambio.

---

# Criterios de aceptación

El sistema realtime cumple si:

- dos usuarios pueden escuchar música juntos
- el chat funciona en vivo
- la presencia de usuarios funciona
- los eventos no rompen el canvas
- no existen listeners duplicados
- la conexión se recupera correctamente
- el dueño mantiene control principal de la sala