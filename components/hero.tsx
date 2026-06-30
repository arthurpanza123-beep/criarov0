"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { ArrowRight, DollarSign, ShieldCheck, Gauge } from "lucide-react"
import { Button } from "@/components/ui/button"

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}
const item = {
  hidden: { y: 24, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.2, 0.6, 0.2, 1] } },
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* fundo grid animado */}
      <div className="pointer-events-none absolute inset-0 bg-grid animate-grid-drift opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center md:py-32"
      >
        <motion.div variants={item} className="mb-8">
          <Image
            src="/credit-farm-logo.png"
            alt="Credit Farm"
            width={420}
            height={420}
            className="h-28 w-auto object-contain invert drop-shadow-[0_0_30px_oklch(0.78_0.19_155/0.35)] md:h-36"
            priority
          />
        </motion.div>

        <motion.span
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          $5 por conta farmada · pagamento automático
        </motion.span>

        <motion.h1
          variants={item}
          className="max-w-3xl text-balance text-5xl font-bold leading-tight tracking-tight md:text-7xl"
        >
          Transforme contas em{" "}
          <span className="text-primary text-glow">dólares no automático</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          Conecte sua API NotLetters, carregue suas contas e defina uma meta em
          dólares. O Credit Farm calcula quantas contas precisa, roda no piloto
          automático e mostra seus ganhos crescendo em tempo real.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="group ring-glow">
            <a href="#console">
              Iniciar agora
              <ArrowRight className="transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#recursos">Ver recursos</a>
          </Button>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            { icon: DollarSign, label: "Por conta farmada", value: "$5" },
            { icon: ShieldCheck, label: "Uptime do worker", value: "99.9%" },
            { icon: Gauge, label: "Meta automática", value: "∞" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm"
            >
              <s.icon className="mx-auto mb-2 size-5 text-primary" />
              <div className="font-mono text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
