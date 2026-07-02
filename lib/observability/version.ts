import packageJson from "@/package.json"

export const APP_VERSION = packageJson.version
export const APP_NAME = packageJson.name
export const APP_COMMIT = process.env.APP_COMMIT ?? process.env.GIT_COMMIT ?? "unknown"

export function versionInfo() {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    commit: APP_COMMIT,
    node: process.version,
    env: process.env.NODE_ENV ?? "development",
  }
}
