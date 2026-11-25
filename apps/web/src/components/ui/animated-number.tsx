'use client'

import { useLayoutEffect, useRef } from 'react'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * Number that counts towards its value (from 0 on first show). The text belongs to this component only:
 * React renders an empty span and frames write `textContent` inside requestAnimationFrame, so there is
 * no React render per frame. A new value mid-animation continues from the number on screen; with
 * reduced motion the value is written at once.
 */
export function AnimatedNumber({ value, format, duration = 650, className }: {
  value: number
  format: (value: number) => string
  duration?: number
  className?: string
}) {
  const node = useRef<HTMLSpanElement>(null)
  const display = useRef<number | null>(null)
  const formatRef = useRef(format)

  // Declared first so the animation below always sees the latest formatter (e.g. another currency).
  useLayoutEffect(() => {
    formatRef.current = format
    if (node.current && display.current !== null) node.current.textContent = format(display.current)
  }, [format])

  useLayoutEffect(() => {
    const element = node.current
    if (!element) return
    const write = (current: number) => {
      display.current = current
      element.textContent = formatRef.current(current)
    }
    const from = display.current ?? 0
    if (from === value || prefersReducedMotion()) return write(value)
    write(from)
    let begin = -1
    let frame = 0
    const tick = (now: number) => {
      if (begin < 0) begin = now
      const progress = Math.min(1, (now - begin) / duration)
      write(from + (value - from) * easeOutCubic(progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span ref={node} className={className} />
}
