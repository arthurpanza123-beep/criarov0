"use client"

import { useEffect, useRef } from "react"
import { animate, useInView } from "motion/react"

export function AnimatedNumber({
  value,
  className,
  duration = 0.9,
}: {
  value: number
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const prev = useRef(0)

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.2, 0.6, 0.2, 1],
      onUpdate(latest) {
        node.textContent = Math.round(latest).toLocaleString("pt-BR")
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, inView, duration])

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("pt-BR")}
    </span>
  )
}
