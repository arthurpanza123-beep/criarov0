import { redirect } from "next/navigation"

import { FarmConsole } from "@/components/farm-console"
import { AmbientBackground } from "@/components/ambient-background"
import { logoutAction } from "@/app/actions/auth"
import { getCurrentUser } from "@/lib/auth/session"

export default async function Page() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect("/login")
  }
  if (currentUser.banned) {
    redirect("/login")
  }
  if (currentUser.mustChangePassword) {
    redirect("/alterar-senha")
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <AmbientBackground />
      <FarmConsole
        user={{
          name: currentUser.name,
          role: currentUser.role,
        }}
        logoutAction={logoutAction}
      />
    </div>
  )
}
