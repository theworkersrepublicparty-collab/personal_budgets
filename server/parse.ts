// Parses an uploaded CSV or XLSX file buffer into a uniform shape:
// { headers: string[], rows: Record<string,string>[] }.
// Both formats end up identical so the rest of the pipeline doesn't care which
// one you uploaded.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

function isXlsx(filename: string): boolean {
  const f = filename.toLowerCase()
  return f.endsWith('.xlsx') || f.endsWith('.xls')
}

export function parseFile(filename: string, buffer: Buffer): ParsedFile {
  return isXlsx(filename) ? parseXlsx(buffer) : parseCsv(buffer)
}

function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString('utf8')
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const headers = (result.meta.fields ?? []).map((h) => h.trim()).filter(Boolean)
  const rows = (result.data ?? []).filter((r) => Object.keys(r).length > 0)
  return { headers, rows }
}

function parseXlsx(buffer: Buffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return { headers: [], rows: [] }
  const ws = wb.Sheets[firstSheet]
  // header:1 => array-of-arrays; we build our own objects so blank cells stay ''.
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
  if (matrix.length === 0) return { headers: [], rows: [] }
  const headers = matrix[0].map((h) => String(h ?? '').trim()).filter(Boolean)
  const rows: Record<string, string>[] = []
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i]
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = String(row[idx] ?? '').trim()
    })
    // Skip fully-empty rows.
    if (Object.values(obj).some((v) => v !== '')) rows.push(obj)
  }
  return { headers, rows }
}
