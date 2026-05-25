# Achantes — Canvas System

## Objetivo

El canvas es el espacio principal de Achantes.

Debe funcionar como una habitación/muro digital altamente personalizable donde el dueño puede construir un collage libre con imágenes, GIFs, dibujos, links, botones y módulos.

---

# Concepto visual

El canvas debe sentirse como:

- muro tipo MySpace/Tumblr
- habitación adolescente de los 2000
- collage caótico pero personal
- pizarra enorme explorable
- espacio visual íntimo del dueño

Debe partir de una base casi vacía para que el usuario construya su identidad visual.

---

# Elementos permitidos

Para el MVP o evolución cercana, el canvas debe soportar:

- imágenes
- GIFs
- dibujos
- links clickeables
- botones personalizados
- notas
- accesos visuales a módulos
- PDFs mediante módulo
- elementos agrupados
- fondos personalizados

---

# Fondo del canvas

El fondo debe poder ser:

- color sólido
- imagen
- GIF
- patrón
- textura
- composición personalizada

El dueño debe poder cambiarlo y bloquearlo.

---

# Navegación

La navegación debe ser simple:

- rueda del mouse: zoom
- rueda presionada + arrastrar: desplazamiento/pan
- botón de restablecer vista
- botón de ajustar a pantalla/contenido

No se prioriza navegación compleja tipo software profesional completo en el MVP.

---

# Edición de elementos

El dueño debe poder:

- agregar elementos
- mover elementos
- eliminar elementos
- redimensionar elementos
- superponer elementos
- ordenar elementos por capas
- bloquear elementos
- agrupar elementos
- crear elementos clickeables

---

# Capas

El canvas debe permitir control de capas para manejar superposición.

Necesidades mínimas:

- traer adelante
- enviar atrás
- traer al frente
- enviar al fondo
- seleccionar elementos superpuestos
- evitar conflictos entre imágenes, GIFs, dibujos y módulos

Necesidades futuras:

- panel visual de capas
- renombrar capas
- bloquear capas
- ocultar capas
- agrupar capas
- reordenar con drag and drop

---

# Dibujos

Los dibujos deben poder estar sobre el canvas.

Reglas:

- el dibujo debe activarse solo con click izquierdo
- click derecho no debe dibujar
- rueda del mouse no debe dibujar
- los trazos del dueño son permanentes cuando se guardan
- los trazos de invitados son temporales hasta aprobación del dueño

Deseable:

- trazos seleccionables
- borrar trazos individuales
- mover trazos
- undo/redo global

---

# Links y botones

Los links deben integrarse visualmente al collage.

No deben sentirse como tarjetas rígidas o componentes corporativos.

Deben poder funcionar como:

- enlaces externos
- accesos a módulos
- botones decorativos
- elementos ocultos tipo juego de exploración

---

# Módulos sobre canvas

Los módulos deben poder colocarse libremente encima del canvas.

Ejemplos:

- música
- chat
- lector PDF
- juegos futuros
- galerías futuras

Deben sentirse como parte de la habitación, no como ventanas genéricas desconectadas.

---

# Persistencia

El canvas no debe guardar cada microcambio si eso afecta rendimiento.

El dueño debe poder crear puntos de guardado o versiones.

Los aportes de invitados deben ser temporales hasta que el dueño los apruebe.

---

# Reglas para Codex

Al modificar el canvas:

1. No reescribir todo App.jsx sin autorización.
2. No duplicar handlers de mouse o wheel.
3. No duplicar refs como mainRef o drawCanvasRef.
4. No mezclar estructuras viejas y nuevas.
5. No cambiar navegación si la tarea no lo pide.
6. No tocar música ni permisos desde cambios de canvas.
7. Hacer cambios pequeños y verificables.
8. Ejecutar build después de cada cambio.

---

# Criterios de aceptación

El canvas cumple si:

- permite decorar libremente la sala
- soporta imágenes y GIFs
- permite dibujar sin romper navegación
- permite zoom y pan cómodos
- permite superponer elementos
- permite organizar visualmente la sala
- no genera errores de consola al navegar
- conserva los cambios del dueño según el sistema de guardado