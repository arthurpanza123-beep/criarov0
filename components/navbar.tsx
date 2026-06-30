"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { Circle } from "lucide-react"

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 ring-glow">
            <Image
              src="/credit-farm-icon.png"
              alt="Credit Farm"
              width={64}
              height={64}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          <div className="leading-none">
            <span className="block text-base font-bold tracking-tight">
              Credit <span className="text-primary">Farm</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Automação de farm
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Circle className="size-2.5 fill-primary text-primary" />
          Worker online
        </div>
      </div>
    </motion.header>
  )
}
