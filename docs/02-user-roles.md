# Achantes — User Roles

## Objetivo

Definir los tipos de usuario dentro de Achantes y qué puede hacer cada uno.

Achantes no es una red social pública. Cada sala pertenece a un dueño y solo se accede mediante invitación.

---

# Roles principales

## 1. Dueño

El dueño es el usuario propietario de la sala.

Tiene control total sobre:

- diseño del canvas
- fondo
- imágenes
- GIFs
- dibujos permanentes
- módulos
- música
- permisos
- invitaciones
- guardado de versiones
- aprobación de cambios temporales

---

## 2. Invitado

El invitado es un usuario autorizado por el dueño.

Sus permisos pueden personalizarse.

Puede tener acceso a acciones como:

- ver la sala
- escuchar música sincronizada
- escribir en chat
- enviar reacciones/emotes
- sugerir canciones
- dibujar temporalmente
- dejar notas temporales
- mover ciertos elementos permitidos
- interactuar con módulos permitidos

Los cambios del invitado no deben ser permanentes automáticamente.

---

## 3. Espectador

El espectador entra mediante link temporal o sin permisos especiales.

Puede:

- ver la sala
- escuchar música si está permitido
- leer chat si está permitido

No puede:

- editar canvas
- mover elementos
- borrar elementos
- cambiar música
- modificar módulos
- guardar cambios

---

# Sistema de permisos

Los permisos deben ser configurables por el dueño.

## Permisos sugeridos

### Canvas

- canViewRoom
- canDrawTemporary
- canAddTemporaryNotes
- canSuggestVisualItems
- canMoveAllowedItems
- canInteractWithLinks

### Música

- canListenMusic
- canSuggestSongs
- canVoteSongs
- canControlMusic

### Chat

- canReadChat
- canWriteChat
- canSendEmotes

### Módulos

- canOpenModules
- canInteractWithModules
- canUploadPdfTemporary
- canViewPdf

### Administración

- canInviteUsers
- canManagePermissions
- canApproveChanges
- canSaveVersions

---

# Regla central de permisos

Solo el dueño puede hacer cambios permanentes sin aprobación.

Los invitados pueden crear aportes temporales si tienen permiso.

Los espectadores solo observan.

---

# Cambios temporales de invitados

Los aportes de invitados deben marcarse como temporales.

Ejemplos:

- dibujos temporales
- notas temporales
- sugerencias de imágenes
- canciones sugeridas

El dueño puede:

- aprobar
- rechazar
- borrar
- convertir en permanente

---

# Link temporal

Un usuario que entra mediante link temporal debe iniciar como espectador.

El dueño puede promoverlo a invitado.

---

# Validaciones obligatorias

La aplicación debe validar permisos tanto en frontend como en backend.

No basta con ocultar botones.

Supabase debe proteger acciones críticas mediante reglas o validaciones.

---

# Criterios de aceptación

El sistema de roles cumple si:

- el dueño puede controlar su sala
- el invitado no puede modificar nada sin permiso
- el espectador no puede editar
- los cambios temporales no se guardan como permanentes automáticamente
- los permisos son claros y extensibles