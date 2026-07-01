// Test-only stub. The real `server-only` package throws when imported outside a
// React Server Component. Under Vitest we execute server modules directly, so we
// alias `server-only` to this no-op via vitest.config.ts. Production builds still
// use the real package and its bundler guard.
export {}
