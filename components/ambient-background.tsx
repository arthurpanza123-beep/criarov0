"use client"

import { motion } from "motion/react"

/**
 * Camada de fundo premium: gradiente base, brilhos verdes animados,
 * grade fina com máscara de fade e vinheta. Fica atrás de todo o conteúdo.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Gradiente base */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_-10%,oklch(0.24_0.05_155)_0%,oklch(0.17_0.022_158)_45%,oklch(0.13_0.018_160)_100%)]" />

      {/* Grade fina com fade radial */}
      <div
        className="absolute inset-0 bg-grid opacity-[0.18]"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 35%, black 30%, transparent 75%)",
        }}
      />

      {/* Brilho superior central */}
      <motion.div
        className="absolute -top-1/4 left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "oklch(0.82 0.23 150 / 0.16)" }}
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Brilho inferior esquerdo */}
      <motion.div
        className="absolute -bottom-1/4 -left-20 size-[34rem] rounded-full blur-[130px]"
        style={{ background: "oklch(0.7 0.16 165 / 0.12)" }}
        animate={{ opacity: [0.35, 0.6, 0.35], y: [0, -24, 0] }}
        transition={{ duration: 11, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Brilho inferior direito */}
      <motion.div
        className="absolute -bottom-1/3 right-0 size-[30rem] rounded-full blur-[130px]"
        style={{ background: "oklch(0.8 0.2 145 / 0.1)" }}
        animate={{ opacity: [0.3, 0.55, 0.3], y: [0, 20, 0] }}
        transition={{ duration: 13, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Vinheta */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,oklch(0.1_0.015_160_/_0.7)_100%)]" />
    </div>
  )
}
