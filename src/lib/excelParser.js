import * as XLSX from 'xlsx'

// Column detection patterns (accent-insensitive)
const HEADER_PATTERNS = {
  num: /^(n[°o]|num|numero|#|pos)$/i,
  zone: /^(zone|local|espace|lieu|pi[eè]ce)/i,
  desc: /^(d[eé]signation|description|article|libell[eé]|intitul[eé]|produit|item)/i,
  materials: /^(mat[eé]riau|finition|mati[eè]re)/i,
  dimensions: /^(dimension|taille|mesure|l\s*[×x])/i,
  qty: /^(qt[eé]|qty|quantit[eé]|nb|nombre|pcs|pi[eè]ces)/i,
  unit: /^(u\.|unit[eé]|unite|um|mesure)$/i,
  price: /^(pu|prix\s*u|p\.u)/i,
  total: /^(total|montant)/i,
  notes: /^(notes?|remarques?|observations?|commentaires?)/i,
}

// Detect if a row is a section header (e.g. "▶ RDC — COMPTOIR CHOCOLAT")
function isSectionHeader(row) {
  const first = String(row[0] || '').trim()
  // Section headers: start with ▶, or contain ▶ and have no numeric N°
  if (first.includes('▶') || first.includes('►')) return true
  // Check other cells for ▶
  for (const cell of row) {
    if (String(cell || '').trim().startsWith('▶') || String(cell || '').trim().startsWith('►')) return true
  }
  return false
}

// Extract current section name from a section header row
function extractSectionName(row) {
  for (const cell of row) {
    const s = String(cell || '').trim()
    if (s.includes('▶') || s.includes('►')) {
      return s.replace(/[▶►\s]+/g, ' ').trim()
    }
  }
  return ''
}

// Synthesize a short title from the designation
function synthesizeTitle(text) {
  if (!text) return 'Article'
  let s = String(text).trim()
  // Take text before first comma for a shorter title
  const commaIdx = s.indexOf(',')
  if (commaIdx > 10) s = s.substring(0, commaIdx)
  // Limit to ~8 words
  const words = s.split(/\s+/)
  const title = words.slice(0, 8).join(' ')
  return title + (words.length > 8 ? '...' : '')
}

// Build full description from multiple columns
function buildDescription(row, cols) {
  const parts = []
  if (cols.desc >= 0) parts.push(String(row[cols.desc] || '').trim())
  if (cols.materials >= 0) {
    const mat = String(row[cols.materials] || '').trim()
    if (mat) parts.push('Materiaux : ' + mat)
  }
  if (cols.dimensions >= 0) {
    const dim = String(row[cols.dimensions] || '').trim()
    if (dim) parts.push('Dimensions : ' + dim)
  }
  if (cols.notes >= 0) {
    const note = String(row[cols.notes] || '').trim()
    if (note) parts.push('Notes : ' + note)
  }
  return parts.filter(Boolean).join('\n')
}

// Detect columns from a header row
function detectColumns(headers) {
  const cols = { num: -1, zone: -1, desc: -1, materials: -1, dimensions: -1, qty: -1, unit: -1, price: -1, total: -1, notes: -1 }
  headers.forEach((h, i) => {
    const clean = String(h || '').trim().replace(/\r?\n/g, ' ')
    for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (pattern.test(clean) && cols[key] === -1) {
        cols[key] = i
        break
      }
    }
  })
  return cols
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

        // Find header row: scan first 20 rows for one containing "Désignation" or "Qté"
        let headerIdx = -1
        let cols = null
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const detected = detectColumns(rows[i])
          if (detected.desc >= 0 && detected.qty >= 0) {
            headerIdx = i
            cols = detected
            break
          }
          // Fallback: at least desc column
          if (detected.desc >= 0 && headerIdx === -1) {
            headerIdx = i
            cols = detected
          }
        }

        // If nothing found, try heuristic
        if (headerIdx === -1) {
          headerIdx = 0
          cols = { num: -1, zone: -1, desc: -1, materials: -1, dimensions: -1, qty: -1, unit: -1, price: -1, total: -1, notes: -1 }
          // Guess: widest text column is desc
          let maxLen = 0
          rows.slice(1, 6).forEach(row => {
            row.forEach((cell, i) => {
              const len = String(cell || '').length
              if (len > maxLen) { maxLen = len; cols.desc = i }
            })
          })
        }

        const rawHeaders = rows[headerIdx].map(h => String(h || '').replace(/\r?\n/g, ' '))

        const articles = []
        let currentSection = ''

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i]

          // Skip empty rows
          const hasContent = row.some(c => String(c || '').trim() !== '')
          if (!hasContent) continue

          // Detect section headers
          if (isSectionHeader(row)) {
            currentSection = extractSectionName(row)
            continue
          }

          // Get designation
          const designation = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : ''
          if (!designation) continue

          // Get quantity — skip if not a valid number
          let qty = 1
          if (cols.qty >= 0) {
            const rawQty = parseFloat(row[cols.qty])
            if (isNaN(rawQty) || rawQty <= 0) continue
            qty = rawQty
          }

          // Get unit
          const unit = cols.unit >= 0 ? String(row[cols.unit] || '').trim() : ''

          // Build full description from all detail columns
          const description = buildDescription(row, cols)

          // Get zone
          const zone = cols.zone >= 0 ? String(row[cols.zone] || '').trim() : currentSection

          articles.push({
            title: synthesizeTitle(designation),
            description,
            quantity: qty,
            unit,
            zone: zone || currentSection,
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
