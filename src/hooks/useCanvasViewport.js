import { useCallback, useMemo, useState } from 'react'

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function useCanvasViewport({ minZoom, maxZoom, worldWidth, worldHeight }) {
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })

  const clampPan = useCallback((panX, panY, zoom, viewportWidth, viewportHeight) => {
    const minPanX = Math.min(0, viewportWidth - worldWidth * zoom)
    const minPanY = Math.min(0, viewportHeight - worldHeight * zoom)
    return { panX: clamp(panX, minPanX, 0), panY: clamp(panY, minPanY, 0) }
  }, [worldHeight, worldWidth])

  const zoomAtPoint = useCallback(({ deltaY, cursorX, cursorY, viewportWidth, viewportHeight }) => {
    setView((prev) => {
      const nextZoom = clamp(prev.zoom * (deltaY > 0 ? 0.9 : 1.1), minZoom, maxZoom)
      const worldX = (cursorX - prev.panX) / prev.zoom
      const worldY = (cursorY - prev.panY) / prev.zoom
      const rawPanX = cursorX - worldX * nextZoom
      const rawPanY = cursorY - worldY * nextZoom
      const clamped = clampPan(rawPanX, rawPanY, nextZoom, viewportWidth, viewportHeight)
      return { zoom: nextZoom, ...clamped }
    })
  }, [clampPan, maxZoom, minZoom])

  const panByPointerDrag = useCallback(({ pointerStartX, pointerStartY, panStartX, panStartY, clientX, clientY, viewportWidth, viewportHeight }) => {
    setView((prev) => {
      const nextPanX = panStartX + (clientX - pointerStartX)
      const nextPanY = panStartY + (clientY - pointerStartY)
      const clamped = clampPan(nextPanX, nextPanY, prev.zoom, viewportWidth, viewportHeight)
      return { ...prev, ...clamped }
    })
  }, [clampPan])

  const zoomIn = useCallback(() => setView((prev) => ({ ...prev, zoom: clamp(prev.zoom * 1.1, minZoom, maxZoom) })), [maxZoom, minZoom])
  const zoomOut = useCallback(() => setView((prev) => ({ ...prev, zoom: clamp(prev.zoom * 0.9, minZoom, maxZoom) })), [maxZoom, minZoom])
  const resetView = useCallback(() => setView({ zoom: 1, panX: 0, panY: 0 }), [])

  const fitToScreen = useCallback((viewportWidth, viewportHeight) => {
    const fitZoom = clamp(Math.min(viewportWidth / worldWidth, viewportHeight / worldHeight), minZoom, maxZoom)
    setView({
      zoom: fitZoom,
      panX: (viewportWidth - worldWidth * fitZoom) / 2,
      panY: (viewportHeight - worldHeight * fitZoom) / 2,
    })
  }, [maxZoom, minZoom, worldHeight, worldWidth])

  const api = useMemo(() => ({ view, setView, zoomAtPoint, panByPointerDrag, zoomIn, zoomOut, resetView, fitToScreen }), [fitToScreen, panByPointerDrag, resetView, view, zoomAtPoint, zoomIn, zoomOut])

  return api
}
