# Achantes — Codex Rules

## Objetivo

Definir reglas obligatorias para cualquier modificación hecha por Codex o IA asistente.

Estas reglas existen para evitar:
- duplicación de código
- refactors destructivos
- regresiones
- corrupción de App.jsx
- arquitectura inconsistente
- cambios masivos no controlados

---

# Regla principal

Codex debe hacer cambios pequeños, controlados y verificables.

Nunca debe intentar reconstruir toda la aplicación en una sola respuesta.

---

# Reglas obligatorias

## 1. No duplicar código existente

Antes de crear:
- funciones
- refs
- hooks
- listeners
- estados
- componentes

Codex debe verificar si ya existen.

Si existen:
- reutilizar
- modificar
- extender

NO duplicar.

---

## 2. No agregar bloques al final del archivo sin revisar estructura

Los cambios deben integrarse en el lugar correcto.

No pegar nuevas implementaciones completas al final de App.jsx.

---

## 3. No refactorizar archivos completos sin autorización explícita

Especialmente:

- App.jsx
- canvas logic
- zoom/pan system
- history system
- realtime system

---

## 4. Un cambio por fase

Cada prompt debe atacar UNA sola responsabilidad.

Ejemplos correctos:

- arreglar zoom
- agregar ctrl+y
- mejorar toolbar
- corregir listeners
- agregar módulo musical

Ejemplos incorrectos:

- rehacer canvas completo
- reestructurar toda la app
- migrar todo a nueva arquitectura

---

## 5. Siempre ejecutar build

Después de cada cambio:

```bash
npm run build