import { useState, useEffect } from 'react'
import { fetchProjects, createProject, getProjectProgress } from '../lib/service'
import { Card, Badge, ProgressBar, FAB, Modal, Input, Textarea, EmptyState, Spinner, PageHeader, Tabs } from './ui'

export default function ProjectList({ onSelect }) {
  const [projects, setProjects] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', clientName: '', description: '' })
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
      // Load progress for each project
      const prog = {}
      await Promise.all(data.map(async p => {
        prog[p.id] = await getProjectProgress(p.id)
      }))
      setProgress(prog)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = projects.filter(p => {
    if (filter === 'active' && p.status !== 'active') return false
    if (filter === 'completed' && p.status !== 'completed') return false
    if (search) {
      const s = search.toLowerCase()
      return p.name.toLowerCase().includes(s) || p.client_name.toLowerCase().includes(s)
    }
    return p.status !== 'archived'
  })

  const handleCreate = async () => {
    if (!form.name.trim() || !form.clientName.trim()) return
    setCreating(true)
    try {
      const projectId = await createProject(form.name.trim(), form.clientName.trim(), form.description.trim())
      setShowCreate(false)
      setForm({ name: '', clientName: '', description: '' })
      await load()
      if (projectId) onSelect(projectId)
    } catch {}
    setCreating(false)
  }

  const tabs = [
    { key: 'all', label: 'Tous', count: projects.filter(p => p.status !== 'archived').length },
    { key: 'active', label: 'Actifs', count: projects.filter(p => p.status === 'active').length },
    { key: 'completed', label: 'Termines', count: projects.filter(p => p.status === 'completed').length },
  ]

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Projets" subtitle="Suivi de production" />

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher un projet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-dark outline-none focus:border-primary transition-colors"
        />
      </div>

      <Tabs tabs={tabs} active={filter} onChange={setFilter} />

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📐"
          title="Aucun projet"
          subtitle={search ? 'Aucun resultat pour cette recherche' : 'Creez votre premier projet avec le bouton +'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const prog = progress[p.id] || { percent: 0, completed: 0, total: 0 }
            return (
              <Card key={p.id} onClick={() => onSelect(p.id)} className="active:bg-bg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-dark text-base truncate">{p.name}</h3>
                    <p className="text-sm text-muted truncate">{p.client_name}</p>
                  </div>
                  <Badge variant={p.status}>{p.status === 'active' ? 'Actif' : p.status === 'completed' ? 'Termine' : 'Archive'}</Badge>
                </div>
                <ProgressBar percent={prog.percent} className="mb-2" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {prog.completed}/{prog.total} etapes validees
                  </span>
                  <span className="text-xs font-semibold text-primary">{prog.percent}%</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <FAB onClick={() => setShowCreate(true)} label="Nouveau projet" />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau projet">
        <Input label="Nom du projet" placeholder="Ex: Cuisine Villa Rabat" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Client" placeholder="Nom du client" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
        <Textarea label="Description (optionnel)" placeholder="Notes sur le projet..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <button
          onClick={handleCreate}
          disabled={creating || !form.name.trim() || !form.clientName.trim()}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform mt-2"
        >
          {creating ? 'Creation...' : 'Creer le projet'}
        </button>
      </Modal>
    </div>
  )
}
