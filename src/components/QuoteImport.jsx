import { useState, useEffect, useRef } from 'react'
import { parseQuoteFile } from '../lib/excelParser'
import { fetchProjects, createProject, bulkCreateArticles, uploadQuoteFile } from '../lib/service'
import { Card, Input, EmptyState, PageHeader, Spinner } from './ui'

export default function QuoteImport({ onNavigate }) {
  const [projects, setProjects] = useState([])
  const [file, setFile] = useState(null)
  const [articles, setArticles] = useState([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [targetProject, setTargetProject] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [done, setDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchProjects('active').then(setProjects).catch(() => {})
  }, [])

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setParsing(true)
    setDone(false)
    try {
      const result = await parseQuoteFile(f)
      setArticles(result.articles.map((a, i) => ({ ...a, _id: i, _include: true })))
    } catch (err) {
      console.error(err)
      setArticles([])
    }
    setParsing(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const toggleArticle = (idx) => {
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, _include: !a._include } : a))
  }

  const updateArticle = (idx, field, value) => {
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const removeArticle = (idx) => {
    setArticles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleImport = async () => {
    const toImport = articles.filter(a => a._include)
    if (toImport.length === 0) return

    setImporting(true)
    try {
      let pid = targetProject
      if (targetProject === '__new') {
        if (!newProjectName.trim() || !newClientName.trim()) return
        pid = await createProject(newProjectName.trim(), newClientName.trim())
      }
      if (!pid) return

      await bulkCreateArticles(pid, toImport)
      if (file) {
        await uploadQuoteFile(file, pid).catch(() => {})
      }
      setDone(true)
    } catch (err) {
      console.error(err)
    }
    setImporting(false)
  }

  if (done) {
    return (
      <div className="animate-fadeIn">
        <EmptyState
          icon="✅"
          title="Import termine !"
          subtitle={`${articles.filter(a => a._include).length} articles importes avec succes`}
        />
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => { setFile(null); setArticles([]); setDone(false); setTargetProject('') }}
            className="px-6 py-3 rounded-xl border border-border text-muted font-medium active:scale-95 transition-transform"
          >
            Nouvel import
          </button>
          <button
            onClick={() => onNavigate('projects')}
            className="px-6 py-3 rounded-xl bg-primary text-white font-medium active:scale-95 transition-transform"
          >
            Voir les projets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Import devis" subtitle="Importez un fichier Excel pour extraire les articles" />

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-6
            ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
        >
          <div className="text-4xl mb-3 opacity-50">📊</div>
          <p className="text-dark font-medium mb-1">Deposez votre fichier Excel ici</p>
          <p className="text-sm text-muted">ou cliquez pour parcourir (.xlsx, .xls)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {parsing && <div className="py-10"><Spinner /><p className="text-center text-sm text-muted mt-3">Analyse du fichier...</p></div>}

      {/* Preview */}
      {file && articles.length > 0 && !parsing && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-dark">{file.name}</p>
              <p className="text-xs text-muted">{articles.length} articles detectes</p>
            </div>
            <button
              onClick={() => { setFile(null); setArticles([]) }}
              className="text-sm text-danger font-medium px-3 py-1.5 rounded-lg hover:bg-danger/5"
            >
              Changer
            </button>
          </div>

          {/* Article list */}
          <div className="space-y-2 mb-6">
            {articles.map((a, i) => (
              <div key={a._id} className={`bg-surface rounded-xl border border-border p-3 ${!a._include ? 'opacity-40' : ''}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={a._include}
                    onChange={() => toggleArticle(i)}
                    className="mt-1 w-5 h-5 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    {a.zone && (i === 0 || a.zone !== articles[i - 1]?.zone) && (
                      <div className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 -mt-0.5">{a.zone}</div>
                    )}
                    <input
                      value={a.title}
                      onChange={e => updateArticle(i, 'title', e.target.value)}
                      className="w-full text-sm font-medium text-dark bg-transparent outline-none border-b border-transparent focus:border-primary pb-0.5"
                    />
                    <p className="text-xs text-muted mt-1 line-clamp-2">{a.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted">Qte:</span>
                      <input
                        type="number"
                        value={a.quantity}
                        onChange={e => updateArticle(i, 'quantity', Number(e.target.value) || 1)}
                        className="w-16 text-xs text-dark bg-border/30 rounded px-2 py-0.5 outline-none"
                      />
                      {a.unit && <span className="text-xs text-muted">{a.unit}</span>}
                    </div>
                  </div>
                  <button onClick={() => removeArticle(i)} className="text-muted/40 hover:text-danger text-sm p-1">✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* Target project */}
          <Card className="mb-4">
            <h3 className="text-sm font-semibold text-dark mb-3">Projet destination</h3>
            <select
              value={targetProject}
              onChange={e => setTargetProject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-sm text-dark outline-none focus:border-primary mb-3"
            >
              <option value="">Choisir un projet...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.client_name}</option>
              ))}
              <option value="__new">+ Nouveau projet</option>
            </select>
            {targetProject === '__new' && (
              <div className="space-y-3 animate-fadeIn">
                <Input label="Nom du projet" placeholder="Ex: Dressing Chambre" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} />
                <Input label="Client" placeholder="Nom du client" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
              </div>
            )}
          </Card>

          <button
            onClick={handleImport}
            disabled={importing || !targetProject || articles.filter(a => a._include).length === 0}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {importing ? 'Import en cours...' : `Importer ${articles.filter(a => a._include).length} articles`}
          </button>
        </>
      )}

      {file && articles.length === 0 && !parsing && (
        <EmptyState icon="⚠️" title="Aucun article detecte" subtitle="Le fichier ne contient pas de colonnes reconnues (designation, quantite...)" />
      )}
    </div>
  )
}
