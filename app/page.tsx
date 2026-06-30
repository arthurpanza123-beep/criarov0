import { FarmConsole } from "@/components/farm-console"
import { AmbientBackground } from "@/components/ambient-background"

export default function Page() {
  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <AmbientBackground />
      <FarmConsole />
    </div>
  )
}
