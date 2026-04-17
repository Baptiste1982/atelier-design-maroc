import { useState, useEffect } from 'react'
import { fetchDefaultSteps, createDefaultStep, updateDefaultStep, deleteDefaultStep, reorderDefaultSteps, updateWorker } from '../lib/service'
import { Card, Input, Spinner, PageHeader, ConfirmDialog } from './ui'

export default function Settings({ currentWorker }) {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [newStep, setNewStep] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [pinForm, setPinForm] = useState({ current: '', newPin: '', confirm: '' })
  const [pinMsg, setPinMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchDefaultSteps()
      setSteps(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newStep.trim()) return
    await createDefaultStep(newStep.trim())
    setNewStep('')
    await load()
  }

  const handleRename = async (id) => {
    if (!editName.trim()) return
    await updateDefaultStep(id, editName.trim())
    setEditingId(null)
    await load()
  }

  const handleDelete = (step) => {
    setConfirm({
      title: `Supprimer "${step.name}" ?`,
      message: 'Cette etape ne sera plus proposee pour les nouveaux projets. Les projets existants ne seront pas affectes.',
      danger: true,
      onConfirm: async () => {
        await deleteDefaultStep(step.id)
        setConfirm(null)
        await load()
      }
    })
  }

  const handleMove = async (idx, dir) => {
    const newSteps = [...steps]
    const [moved] = newSteps.splice(idx, 1)
    newSteps.splice(idx + dir, 0, moved)
    setSteps(newSteps)
    await reorderDefaultSteps(newSteps.map(s => s.id))
  }

  const handleChangePin = async () => {
    if (pinForm.newPin.length !== 4) {
      setPinMsg('Le PIN doit faire 4 chiffres')
      return
    }
    if (pinForm.newPin !== pinForm.confirm) {
      setPinMsg('Les PINs ne correspondent pas')
      return
    }
    try {
      await updateWorker(currentWorker.id, { pin_code: pinForm.newPin })
      setPinMsg('PIN modifie avec succes !')
      setPinForm({ current: '', newPin: '', confirm: '' })
    } catch {
      setPinMsg('Erreur lors du changement')
    }
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Reglages" subtitle="Configuration de l'atelier" />

      {/* Default Steps */}
      <Card className="mb-4">
        <h3 className="text-sm font-bold text-dark mb-3">Etapes par defaut</h3>
        <p className="text-xs text-muted mb-4">Ces etapes seront automatiquement ajoutees aux nouveaux projets.</p>

        {loading ? <Spinner size="sm" /> : (
          <div className="space-y-2 mb-4">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 bg-bg rounded-xl p-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(s.id)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(s.id)}
                    className="flex-1 text-sm bg-surface border border-primary rounded-lg px-2 py-1 outline-none"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm text-dark cursor-pointer"
                    onClick={() => { setEditingId(s.id); setEditName(s.name) }}
                  >
                    {s.name}
                  </span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  {i > 0 && (
                    <button onClick={() => handleMove(i, -1)} className="w-7 h-7 rounded-lg bg-surface border border-border text-muted text-xs flex items-center justify-center">
                      ↑
                    </button>
                  )}
                  {i < steps.length - 1 && (
                    <button onClick={() => handleMove(i, 1)} className="w-7 h-7 rounded-lg bg-surface border border-border text-muted text-xs flex items-center justify-center">
                      ↓
                    </button>
                  )}
                  <button onClick={() => handleDelete(s)} className="w-7 h-7 rounded-lg bg-danger/10 text-danger text-xs flex items-center justify-center">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newStep}
            onChange={e => setNewStep(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nouvelle etape..."
            className="flex-1 px-3 py-2 rounded-xl border border-border text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleAdd}
            disabled={!newStep.trim()}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 active:scale-95 transition-transform"
          >
            Ajouter
          </button>
        </div>
      </Card>

      {/* Change PIN */}
      <Card className="mb-4">
        <h3 className="text-sm font-bold text-dark mb-3">Changer mon PIN</h3>
        <Input
          label="Nouveau PIN (4 chiffres)"
          placeholder="****"
          maxLength={4}
          value={pinForm.newPin}
          onChange={e => setPinForm(f => ({ ...f, newPin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
        />
        <Input
          label="Confirmer le PIN"
          placeholder="****"
          maxLength={4}
          value={pinForm.confirm}
          onChange={e => setPinForm(f => ({ ...f, confirm: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
        />
        {pinMsg && <p className={`text-sm mb-3 ${pinMsg.includes('succes') ? 'text-success' : 'text-danger'}`}>{pinMsg}</p>}
        <button
          onClick={handleChangePin}
          disabled={pinForm.newPin.length !== 4}
          className="w-full py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          Modifier
        </button>
      </Card>

      {/* About */}
      <Card>
        <h3 className="text-sm font-bold text-dark mb-2">A propos</h3>
        <p className="text-xs text-muted">Atelier - Suivi Production v1.0.0</p>
        <p className="text-xs text-muted mt-1">Application de suivi de production pour ateliers de menuiserie.</p>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
