import { useState, useEffect } from 'react'
import { fetchWorkers, createWorker, updateWorker, toggleWorkerActive } from '../lib/service'
import { Card, Badge, Modal, Input, WorkerAvatar, EmptyState, Spinner, PageHeader, ConfirmDialog } from './ui'

export default function TeamManager({ isAdmin }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [form, setForm] = useState({ name: '', pinCode: '', role: 'worker' })
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchWorkers(false)
      setWorkers(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const displayed = showAll ? workers : workers.filter(w => w.active)

  const handleCreate = async () => {
    if (!form.name.trim() || form.pinCode.length !== 4) return
    setSaving(true)
    try {
      await createWorker(form.name.trim(), form.pinCode, form.role)
      setShowCreate(false)
      setForm({ name: '', pinCode: '', role: 'worker' })
      await load()
    } catch {}
    setSaving(false)
  }

  const handleEdit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const updates = { name: form.name.trim(), role: form.role }
      if (form.pinCode.length === 4) updates.pin_code = form.pinCode
      await updateWorker(showEdit.id, updates)
      setShowEdit(null)
      await load()
    } catch {}
    setSaving(false)
  }

  const handleToggleActive = (worker) => {
    const action = worker.active ? 'Desactiver' : 'Reactiver'
    setConfirm({
      title: `${action} ${worker.name} ?`,
      message: worker.active
        ? 'Cet ouvrier ne pourra plus se connecter.'
        : 'Cet ouvrier pourra se reconnecter.',
      onConfirm: async () => {
        await toggleWorkerActive(worker.id, !worker.active)
        setConfirm(null)
        await load()
      }
    })
  }

  const openEdit = (worker) => {
    setForm({ name: worker.name, pinCode: '', role: worker.role })
    setShowEdit(worker)
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Equipe"
        subtitle={`${workers.filter(w => w.active).length} ouvriers actifs`}
        right={isAdmin && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs text-primary font-medium px-3 py-1.5 rounded-lg border border-primary/20">
            {showAll ? 'Actifs' : 'Tous'}
          </button>
        )}
      />

      {loading ? (
        <div className="py-16"><Spinner /></div>
      ) : displayed.length === 0 ? (
        <EmptyState icon="👷" title="Aucun ouvrier" subtitle="Ajoutez votre premier ouvrier" />
      ) : (
        <div className="space-y-3">
          {displayed.map(w => (
            <Card key={w.id} className={`${!w.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <WorkerAvatar name={w.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-dark">{w.name}</span>
                    <Badge variant={w.role}>{w.role === 'admin' ? 'Admin' : 'Ouvrier'}</Badge>
                  </div>
                  {!w.active && <span className="text-xs text-danger">Desactive</span>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(w)} className="w-9 h-9 rounded-lg bg-border/30 flex items-center justify-center text-muted text-sm">
                      ✎
                    </button>
                    <button onClick={() => handleToggleActive(w)} className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm
                      ${w.active ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                      {w.active ? '⏸' : '▶'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add button */}
      {isAdmin && (
        <button
          onClick={() => { setForm({ name: '', pinCode: '', role: 'worker' }); setShowCreate(true) }}
          className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-border text-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors active:scale-[0.98]"
        >
          + Ajouter un ouvrier
        </button>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel ouvrier">
        <Input label="Nom" placeholder="Prenom Nom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Code PIN (4 chiffres)" placeholder="1234" maxLength={4} value={form.pinCode} onChange={e => setForm(f => ({ ...f, pinCode: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-1.5">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-dark text-sm outline-none focus:border-primary">
            <option value="worker">Ouvrier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={saving || !form.name.trim() || form.pinCode.length !== 4}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Creation...' : 'Creer'}
        </button>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title={`Modifier ${showEdit?.name}`}>
        <Input label="Nom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Nouveau PIN (laisser vide pour garder)" placeholder="****" maxLength={4} value={form.pinCode} onChange={e => setForm(f => ({ ...f, pinCode: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-1.5">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-dark text-sm outline-none focus:border-primary">
            <option value="worker">Ouvrier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          onClick={handleEdit}
          disabled={saving || !form.name.trim()}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
