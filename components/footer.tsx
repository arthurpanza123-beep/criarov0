import { Sprout } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sprout className="size-4" />
          </span>
          <span className="font-semibold text-foreground">
            Farm<span className="text-primary">Flow</span>
          </span>
        </div>
        <p>Automação contínua • API NotLetters</p>
        <p>© {new Date().getFullYear()} FarmFlow</p>
      </div>
    </footer>
  )
}
