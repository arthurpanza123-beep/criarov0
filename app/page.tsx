import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { FarmConsole } from "@/components/farm-console"
import { Footer } from "@/components/footer"

export default function Page() {
  return (
    <main className="min-h-dvh bg-background">
      <Navbar />
      <Hero />
      <Features />
      <FarmConsole />
      <Footer />
    </main>
  )
}
