"use client"

import { useEffect, useRef } from "react"
import { animate, useInView } from "motion/react"

export function AnimatedNumber({
  value,
  className,
  duration = 0.9,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number
  className?: string
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const prev = useRef(0)

  const fmt = (n: number) =>
    `${prefix}${n.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.2, 0.6, 0.2, 1],
      onUpdate(latest) {
        node.textContent = fmt(latest)
      },
    })
    prev.current = value
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, duration])

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  )
}
