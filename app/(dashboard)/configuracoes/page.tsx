import { Save } from "lucide-react"

import { updateSettingFormAction } from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { PageHeader, Panel } from "@/components/admin/primitives"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { settingsService, type EditableSettingKey } from "@/lib/services/settings-service"

export const dynamic = "force-dynamic"

const editableFields: Array<{ key: EditableSettingKey; label: string; placeholder: string; hint: string }> = [
  { key: "app.currency", label: "Moeda padrão", placeholder: "USD", hint: "Código da moeda (3 a 8 caracteres)." },
  { key: "app.locale", label: "Idioma", placeholder: "pt-BR", hint: "Locale, ex.: pt-BR, en-US." },
  { key: "app.timezone", label: "Fuso horário", placeholder: "America/Sao_Paulo", hint: "Nome IANA do fuso." },
  { key: "app.defaultMonthlyLimit", label: "Limite mensal padrão", placeholder: "0.00", hint: "Valor padrão aplicado a novas contas." },
]

function displayValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

export default async function SettingsPage() {
  const actor = await requirePermission("settings", "read")
  const canUpdate = can(actor.role, "settings", "update")
  const stored = await settingsService.list({ pageSize: "100" })
  const values = new Map(stored.data.map((row) => [row.key, row.value] as const))

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Apenas chaves de aplicação são editáveis. Segredos, senhas e variáveis de ambiente nunca são expostos ou alteráveis aqui."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {editableFields.map((field) => (
          <Panel key={field.key}>
            {canUpdate ? (
              <ActionForm
                action={updateSettingFormAction}
                successMessage="Configuração salva."
                className="flex flex-col gap-2"
                submitLabel="Salvar"
                submitIcon={<Save className="size-3.5" />}
              >
                <label htmlFor={field.key} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {field.label}
                </label>
                <input type="hidden" name="key" value={field.key} />
                <input
                  id={field.key}
                  name="value"
                  defaultValue={displayValue(values.get(field.key))}
                  placeholder={field.placeholder}
                  required
                  className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{field.hint}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">{field.key}</span>
                </div>
              </ActionForm>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{field.label}</label>
                <input
                  defaultValue={displayValue(values.get(field.key))}
                  placeholder={field.placeholder}
                  disabled
                  className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="text-xs text-muted-foreground">{field.hint}</span>
              </div>
            )}
          </Panel>
        ))}
      </div>

      {!canUpdate ? (
        <p className="mt-4 text-xs text-muted-foreground">Seu papel permite apenas visualizar as configurações.</p>
      ) : null}
    </div>
  )
}
