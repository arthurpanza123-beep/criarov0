import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins"

import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { accessControl, rbacRoles } from "@/lib/auth/permissions"

const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? appUrl

function isLocalDevOrigin(origin: string | null) {
  if (process.env.NODE_ENV === "production" || !origin) return false
  try {
    const url = new URL(origin)
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  } catch {
    return false
  }
}

export const auth = betterAuth({
  appName: "Credit Console",
  baseURL: betterAuthUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 14,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    autoSignIn: false,
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      role: "viewer",
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },
  user: {
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        required: true,
        input: false,
        defaultValue: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    freshAge: 60 * 10,
  },
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin") ?? null
    return [appUrl, betterAuthUrl, isLocalDevOrigin(origin) ? origin : null]
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      "/change-password": {
        window: 60,
        max: 5,
      },
      "/admin/create-user": {
        window: 60,
        max: 10,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    admin({
      defaultRole: "viewer",
      adminRoles: ["owner"],
      ac: accessControl,
      roles: rbacRoles,
      bannedUserMessage: "Usuário bloqueado.",
      defaultBanReason: "blocked_by_owner",
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth
