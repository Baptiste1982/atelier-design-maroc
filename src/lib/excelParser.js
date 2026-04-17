import * as XLSX from 'xlsx'

const QTY_PATTERNS = /^(qte|qty|quantit[eé]|nb|nombre|pcs|pieces)$/i
const DESC_PATTERNS = /^(d[eé]signation|description|article|libell[eé]|intitul[eé]|produit|item|ref|r[eé]f[eé]rence)$/i
const UNIT_PATTERNS = /^(unit[eé]|unite|u\.|um|mesure)$/i

function synthesizeTitle(text) {
  if (!text) return 'Article'
  const words = String(text).trim().split(/\s+/)
  return words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '')
}

function detectColumns(headers) {
  let qtyCol = -1, descCol = -1, unitCol = -1
  headers.forEach((h, i) => {
    const clean = String(h || '').trim()
    if (QTY_PATTERNS.test(clean)) qtyCol = i
    else if (DESC_PATTERNS.test(clean)) descCol = i
    else if (UNIT_PATTERNS.test(clean)) unitCol = i
  })
  return { qtyCol, descCol, unitCol }
}

export function parseQuoteFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length < 2) {
          resolve({ articles: [], sheetName, rawHeaders: [] })
          return
        }

        // Try to detect header row (first row with recognizable column names)
        let headerIdx = 0
        let detected = { qtyCol: -1, descCol: -1, unitCol: -1 }
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const d = detectColumns(rows[i])
          if (d.descCol !== -1) {
            headerIdx = i
            detected = d
            break
          }
        }

        const rawHeaders = rows[headerIdx].map(String)

        // If no description column found, use the widest text column
        if (detected.descCol === -1) {
          let maxLen = 0
          rows.slice(headerIdx + 1, headerIdx + 6).forEach(row => {
            row.forEach((cell, i) => {
              const len = String(cell || '').length
              if (len > maxLen) { maxLen = len; detected.descCol = i }
            })
          })
        }

        const articles = []
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i]
          const desc = String(row[detected.descCol] || '').trim()
          if (!desc) continue

          const qty = detected.qtyCol >= 0 ? parseFloat(row[detected.qtyCol]) : 1
          if (isNaN(qty) || qty <= 0) continue

          const unit = detected.unitCol >= 0 ? String(row[detected.unitCol] || '').trim() : ''

          articles.push({
            title: synthesizeTitle(desc),
            description: desc,
            quantity: qty,
            unit,
          })
        }

        resolve({ articles, sheetName, rawHeaders })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erreur lecture fichier'))
    reader.readAsArrayBuffer(file)
  })
}
