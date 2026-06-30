"use client"

import { motion } from "motion/react"
import { KeyRound, ListChecks, Gauge, Sparkles, Mail, Cpu } from "lucide-react"

const features = [
  {
    icon: KeyRound,
    title: "API NotLetters integrada",
    desc: "Cole sua chave da API NotLetters e o worker autentica automaticamente cada requisição do farm.",
  },
  {
    icon: ListChecks,
    title: "Fila de contas",
    desc: "Carregue centenas de contas no formato email > senha e gerencie tudo em uma fila inteligente.",
  },
  {
    icon: Gauge,
    title: "Progresso em tempo real",
    desc: "Cada conta mostra seu progresso individual com animações fluidas e estados de cor.",
  },
  {
    icon: Mail,
    title: "Contador de e-mails",
    desc: "Veja exatamente quantos e-mails ainda estão disponíveis e quantos já foram usados no farm.",
  },
  {
    icon: Cpu,
    title: "Controle total",
    desc: "Inicie, pause e retome o farm a qualquer momento sem perder o progresso acumulado.",
  },
  {
    icon: Sparkles,
    title: "Feedback visual",
    desc: "Animação verde de sucesso ao concluir cada lote, com partículas e pulsos tecnológicos.",
  },
]

export function Features() {
  return (
    <section id="recursos" className="relative mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Tudo que você precisa para{" "}
          <span className="text-primary">escalar o farm</span>
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          Uma plataforma pensada para automação contínua, com motion e
          monitoramento de ponta a ponta.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            whileHover={{ y: -6 }}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
              <f.icon className="size-5" />
            </span>
            <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
