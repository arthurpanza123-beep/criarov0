"use client"

import { motion } from "motion/react"

/**
 * Fundo neutro premium estilo "terminal": base quase preta, uma única
 * aura verde discreta no topo, grade fina com fade e vinheta nas bordas.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base quase preta com leve elevação no topo */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-20%,oklch(0.2_0.012_158)_0%,oklch(0.155_0.005_160)_50%,oklch(0.125_0.004_160)_100%)]" />

      {/* Grade fina com fade radial */}
      <div
        className="absolute inset-0 bg-grid opacity-60"
        style={{
          maskImage:
            "radial-gradient(ellipse 90% 75% at 50% 30%, black 20%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 75% at 50% 30%, black 20%, transparent 80%)",
        }}
      />

      {/* Aura verde única e discreta no topo */}
      <motion.div
        className="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full blur-[140px]"
        style={{ background: "oklch(0.8 0.2 152 / 0.1)" }}
        animate={{ opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Vinheta nas bordas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,oklch(0.1_0.004_160_/_0.85)_100%)]" />
    </div>
  )
}
