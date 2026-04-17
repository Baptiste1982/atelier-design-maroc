import { useState, useEffect } from 'react'
import { fetchProjects, restoreProject } from '../lib/service'
import { Card, Badge, EmptyState, Spinner, PageHeader, ConfirmDialog } from './ui'

export default function Archives({ onSelectProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [restoreConfirm, setRestoreConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchProjects('archived')
      setProjects(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleRestore = async (id) => {
    await restoreProject(id)
    setRestoreConfirm(null)
    await load()
  }

  const filtered = projects.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.name.toLowerCase().includes(s) || p.client_name.toLowerCase().includes(s)
  })

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Archives" subtitle={`${projects.length} projets archives`} />

      {projects.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-dark outline-none focus:border-primary transition-colors"
          />
        </div>
      )}

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📦" title="Aucun projet archive" subtitle={search ? 'Aucun resultat' : 'Les projets termines et archives apparaitront ici'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectProject(p.id)}>
                  <h3 className="font-bold text-dark text-base truncate">{p.name}</h3>
                  <p className="text-sm text-muted truncate">{p.client_name}</p>
                </div>
                <Badge variant="archived">Archive</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  Archive le {p.archived_at ? new Date(p.archived_at).toLocaleDateString('fr-FR') : '—'}
                </span>
                <button
                  onClick={() => setRestoreConfirm(p)}
                  className="text-sm text-primary font-medium px-3 py-1 rounded-lg hover:bg-primary/5 active:scale-95 transition-all"
                >
                  Restaurer
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!restoreConfirm}
        title="Restaurer ce projet ?"
        message={`"${restoreConfirm?.name}" sera remis en statut actif.`}
        confirmLabel="Restaurer"
        onConfirm={() => handleRestore(restoreConfirm.id)}
        onCancel={() => setRestoreConfirm(null)}
      />
    </div>
  )
}
