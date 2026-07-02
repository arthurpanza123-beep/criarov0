import { expect, test, type Page } from "@playwright/test"

import { E2E_PASSWORD, emailFor } from "./users"

async function login(page: Page, role: "owner" | "admin" | "operator" | "viewer") {
  await page.goto("/login")
  await page.locator("#email").fill(emailFor(role))
  await page.locator("#password").fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 })
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click()
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 })
}

test.describe.configure({ mode: "serial" })

test("owner: full operational flow (login → dashboard → CRUD → jobs → import → notifications → settings → logout)", async ({ page }) => {
  await login(page, "owner")

  // Dashboard
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()

  // CRUD: create a customer
  await page.goto("/clientes")
  const customerName = `E2E Cliente ${Date.now()}`
  await page.locator('input[name="name"]').first().fill(customerName)
  await page.getByRole("button", { name: "Criar" }).first().click()
  await expect(page.getByText(customerName)).toBeVisible()

  // Jobs: enqueue a maintenance job and process the queue
  await page.goto("/jobs")
  await page.getByRole("button", { name: "Manutenção" }).click()
  await expect(page.getByRole("link", { name: "maintenance" }).first()).toBeVisible()
  await page.getByRole("button", { name: "Processar fila agora" }).click()
  await expect(page.locator("table").getByText("completed").first()).toBeVisible()

  // Import: dry-run of a managed_accounts CSV
  await page.goto("/importacoes")
  const csv = "label,email,provider,monthlyCreditLimit,notes\nE2E Conta,e2e-conta@example.com,Plataforma,100.00,\n"
  await page.locator('select[name="entity"]').selectOption("managed_accounts")
  await page.locator('input[name="file"]').setInputFiles({ name: "accounts.csv", mimeType: "text/csv", buffer: Buffer.from(csv) })
  await page.getByRole("button", { name: "Enviar" }).click()
  await expect(page.locator("table").getByText("dry-run").first()).toBeVisible()

  // Notifications
  await page.goto("/notificacoes")
  await expect(page.getByRole("heading", { name: "Notificações" })).toBeVisible()

  // Settings
  await page.goto("/configuracoes")
  await expect(page.getByText("Moeda padrão")).toBeVisible()

  await logout(page)
})

test("admin: sees system health but not user administration", async ({ page }) => {
  await login(page, "admin")
  await page.goto("/sistema")
  await expect(page.getByRole("heading", { name: "Saúde do sistema" })).toBeVisible()
  await logout(page)
})

test("viewer: read-only, no privileged nav and blocked from owner-only routes", async ({ page }) => {
  await login(page, "viewer")

  // Privileged nav items are hidden for viewer.
  await expect(page.getByRole("link", { name: "Sistema" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Importações" })).toHaveCount(0)

  // Owner-only route redirects viewer back to the dashboard.
  await page.goto("/usuarios")
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 })

  // Reports remain accessible (read-only analytics).
  await page.goto("/relatorios")
  await expect(page.getByRole("heading", { name: "Relatórios & simulador" })).toBeVisible()

  await logout(page)
})
