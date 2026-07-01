const MIN_PASSWORD_LENGTH = 14

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "senha123",
  "qwerty123",
  "admin123",
  "123456789",
  "1234567890",
  "changeme",
  "letmein123",
])

export function validateStrongPassword(password: string) {
  const failures: string[] = []
  const normalized = password.trim()

  if (normalized.length < MIN_PASSWORD_LENGTH) {
    failures.push("A senha precisa ter pelo menos 14 caracteres.")
  }
  if (normalized !== password) {
    failures.push("A senha não pode começar ou terminar com espaços.")
  }
  if (COMMON_PASSWORDS.has(normalized.toLowerCase())) {
    failures.push("A senha temporária não pode ser uma senha comum.")
  }
  if (!/[a-z]/.test(password)) failures.push("Inclua uma letra minúscula.")
  if (!/[A-Z]/.test(password)) failures.push("Inclua uma letra maiúscula.")
  if (!/[0-9]/.test(password)) failures.push("Inclua um número.")
  if (!/[^A-Za-z0-9]/.test(password)) failures.push("Inclua um símbolo.")

  return {
    ok: failures.length === 0,
    failures,
  }
}

export function assertStrongPassword(password: string) {
  const result = validateStrongPassword(password)
  if (!result.ok) {
    throw new Error(result.failures[0] ?? "Senha inválida.")
  }
}

export { MIN_PASSWORD_LENGTH }
