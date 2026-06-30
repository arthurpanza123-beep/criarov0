import { FarmConsole } from "@/components/farm-console"

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1">
        <FarmConsole />
      </main>
    </div>
  )
}
