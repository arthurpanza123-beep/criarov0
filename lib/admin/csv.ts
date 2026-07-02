/**
 * Minimal, dependency-free CSV parser/serializer (RFC 4180 style): handles
 * quoted fields, escaped quotes (""), embedded commas/newlines, CRLF and a BOM.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const n = input.length
  if (n > 0 && input.charCodeAt(0) === 0xfeff) i = 1 // strip BOM

  while (i < n) {
    const c = input[i]
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ",") {
      row.push(field)
      field = ""
      i += 1
      continue
    }
    if (c === "\r") {
      i += 1
      continue
    }
    if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i += 1
      continue
    }
    field += c
    i += 1
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export type CsvRecord = Record<string, string>

export function parseCsvRecords(input: string): { headers: string[]; records: CsvRecord[] } {
  const rows = parseCsv(input).filter((cells) => cells.some((cell) => cell.trim() !== ""))
  if (rows.length === 0) return { headers: [], records: [] }
  const headers = rows[0].map((header) => header.trim())
  const records = rows.slice(1).map((cells) => {
    const record: CsvRecord = {}
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim()
    })
    return record
  })
  return { headers, records }
}

/**
 * Neutralizes CSV/formula injection: spreadsheet apps (Excel, Google Sheets,
 * LibreOffice) execute a cell as a formula when it starts with =, +, -, @,
 * tab or CR. Prefixing with a single quote forces it to be read as text.
 * Applied before structural CSV quoting so exported data can never trigger
 * formula execution when opened in a spreadsheet.
 */
function neutralizeFormula(text: string): string {
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`
  return text
}

function escapeCsvField(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value)
  const text = neutralizeFormula(raw)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(escapeCsvField).join(",")]
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvField(row[header])).join(","))
  }
  return lines.join("\r\n")
}
