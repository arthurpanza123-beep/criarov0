import Image from "next/image"

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Image
            src="/credit-farm-logo.png"
            alt="Credit Farm"
            width={160}
            height={160}
            className="h-8 w-auto object-contain object-left invert"
          />
        </div>
        <p>$5 por conta • API NotLetters</p>
        <p>© {new Date().getFullYear()} Credit Farm</p>
      </div>
    </footer>
  )
}
