"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="#" className="flex items-center gap-2.5">
          <Image
            src="/credit-farm-logo.png"
            alt="Credit Farm"
            width={200}
            height={200}
            className="h-11 w-auto object-contain object-left invert"
            priority
          />
        </a>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-foreground">
            Recursos
          </a>
          <a href="#console" className="transition-colors hover:text-foreground">
            Console
          </a>
          <a href="#contas" className="transition-colors hover:text-foreground">
            Contas
          </a>
        </nav>

        <Button asChild size="sm" className="ring-glow">
          <a href="#console">Abrir Console</a>
        </Button>
      </div>
    </motion.header>
  )
}
