'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@vcrm/ui'

type ImportType = 'companies' | 'contacts' | 'investments'

const IMPORT_TYPES: { value: ImportType; label: string; description: string; columns: string }[] = [
  {
    value: 'companies',
    label: 'Companies',
    description: 'Import companies into your database',
    columns: 'name, short_description, website, industry, city, country, founded_year, stage, tags',
  },
  {
    value: 'contacts',
    label: 'Contacts',
    description: 'Import people, founders, and advisors',
    columns: 'first_name, last_name, email, title, role, linkedin_url, mobile_phone, location, tags',
  },
  {
    value: 'investments',
    label: 'Investments',
    description: 'Import investment records (import companies first)',
    columns: 'company_name, amount, round, type, date, lead_partner_email, notes',
  },
]

export default function ImportClient() {
  const [importType, setImportType] = useState<ImportType>('companies')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { showToast } = useToast()

  const detectImportType = (headers: string[]): ImportType | null => {
    const h = headers.map((s) => s.toLowerCase())
    if (h.includes('company_name') && h.includes('amount')) return 'investments'
    if (h.includes('first_name') && h.includes('last_name')) return 'contacts'
    if (h.includes('name')) return 'companies'
    return null
  }

  const processFile = (selected: File) => {
    setFile(selected)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const lines = content.split('\n').filter((l) => l.trim())
      if (lines.length < 2) {
        setPreview(null)
        return
      }
      const headers = parseLine(lines[0])
      const rows = lines.slice(1, 6).map((line) => {
        const values = parseLine(line)
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = values[i] || '' })
        return obj
      })
      setPreview({ headers, rows })

      // Auto-detect type from headers
      const detected = detectImportType(headers)
      if (detected) setImportType(detected)
    }
    reader.readAsText(selected)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    processFile(selected)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.name.endsWith('.csv')) {
      processFile(dropped)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', importType)

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Import failed', 'error')
        setLoading(false)
        return
      }

      setResult(data)
      if (data.success > 0 && data.failed === 0) {
        showToast(`Successfully imported ${data.success} ${importType}`, 'success')
      } else if (data.success > 0) {
        showToast(`Imported ${data.success}, ${data.failed} failed`, 'warning')
      } else {
        showToast(`Import failed: ${data.failed} errors`, 'error')
      }
    } catch {
      showToast('An unexpected error occurred', 'error')
    }
    setLoading(false)
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectedType = IMPORT_TYPES.find((t) => t.value === importType)!

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-gray-500 mt-1">Upload a CSV file to import companies, contacts, or investments</p>
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-3 gap-3">
        {IMPORT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => { setImportType(type.value); reset() }}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              importType === type.value
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-gray-900">{type.label}</div>
            <div className="text-xs text-gray-500 mt-1">{type.description}</div>
          </button>
        ))}
      </div>

      {/* Expected Columns */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-1">Expected CSV columns for {selectedType.label}:</div>
        <code className="text-xs text-gray-600">{selectedType.columns}</code>
      </div>

      {/* File Upload */}
      <div>
        <label className="block" onDrop={handleDrop} onDragOver={handleDragOver}>
          <div className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            file ? 'border-emerald-300 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'
          }`}>
            {file ? (
              <div>
                <div className="text-emerald-700 font-medium">{file.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {preview ? `${preview.rows.length}${preview.rows.length >= 5 ? '+' : ''} rows found` : 'Parsing...'}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); reset() }}
                  className="text-sm text-red-500 hover:text-red-600 mt-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="text-gray-500">Drop a CSV file here or click to browse</div>
                <div className="text-xs text-gray-400 mt-1">CSV files only</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Preview */}
      {preview && preview.rows.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Preview (first {preview.rows.length} rows)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {preview.headers.map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {preview.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && !result && (
        <button
          onClick={handleImport}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Importing...
            </span>
          ) : (
            `Import ${preview?.rows.length || 0}+ ${selectedType.label}`
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className={`rounded-lg p-4 border ${result.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="font-medium text-gray-900">
            {result.success} imported{result.failed > 0 ? `, ${result.failed} failed` : ''}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-sm text-red-600 space-y-1">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 mt-3">
            <button onClick={reset} className="text-sm text-gray-600 hover:text-gray-800">
              Import more
            </button>
            <button
              onClick={() => router.push(importType === 'companies' ? '/companies' : importType === 'contacts' ? '/people' : '/portfolio')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View {selectedType.label}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
