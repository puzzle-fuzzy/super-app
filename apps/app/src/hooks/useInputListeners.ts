import { useEffect, useRef } from 'react'
import { useInputStore } from '../stores/inputStore'

export function useInputListeners() {
  const setSpaceHeld = useInputStore((s) => s.setSpaceHeld)
  const setMousePosition = useInputStore((s) => s.setMousePosition)

  const rafRef = useRef<number | null>(null)
  const lastMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
          return
        e.preventDefault()
        setSpaceHeld(true)
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setSpaceHeld(false)
      }
    }

    function onBlur() {
      // 处理 Alt+Tab 等边缘情况
      setSpaceHeld(false)
    }

    // rAF 节流的鼠标移动
    function onMouseMove(e: MouseEvent) {
      lastMouse.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          setMousePosition(lastMouse.current)
          rafRef.current = null
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('mousemove', onMouseMove)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('mousemove', onMouseMove)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [setSpaceHeld, setMousePosition])
}
