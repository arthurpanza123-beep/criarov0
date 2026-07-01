import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth/auth"
import { sanitizeCallbackUrl } from "@/lib/auth/redirects"

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/placeholder",
  "/credit-farm",
]

function isPublicPath(pathname: string) {
  return pathname === "/login" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function loginUrl(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  const callbackUrl = sanitizeCallbackUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`)
  if (callbackUrl !== "/") {
    url.searchParams.set("callbackUrl", callbackUrl)
  }
  return url
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    if (pathname !== "/login") return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: request.headers,
    query: {
      disableCookieCache: true,
    },
  }).catch(() => null)

  if (!session) {
    if (isPublicPath(pathname)) return NextResponse.next()
    return NextResponse.redirect(loginUrl(request))
  }

  const mustChangePassword = Boolean(session.user.mustChangePassword)

  if (pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = mustChangePassword ? "/alterar-senha" : "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (mustChangePassword && pathname !== "/alterar-senha" && !pathname.startsWith("/api/auth/sign-out")) {
    const url = request.nextUrl.clone()
    url.pathname = "/alterar-senha"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"],
}
