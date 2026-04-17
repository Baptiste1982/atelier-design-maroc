import { useState, useEffect, useCallback } from 'react'
import {
  fetchProjectById, fetchProjectSteps, fetchArticlesByProject,
  fetchStepStatuses, toggleStepStatus, createArticle, deleteArticle,
  archiveProject, completeProject, addProjectStep, getProjectProgress
} from '../lib/service'
import { Card, Badge, ProgressBar, TouchCheckbox, Modal, Input, Textarea, Spinner, ConfirmDialog, EmptyState, Tabs, PageHeader, WorkerAvatar } from './ui'

export default function ProjectDetail({ projectId, currentWorker, onBack, onSelectArticle }) {
  const [project, setProject] = useState(null)
  const [steps, setSteps] = useState([])
  const [articles, setArticles] = useState([])
  const [statuses, setStatuses] = useState([])
  const [progress, setProgress] = useState({ percent: 0 })
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState(null)
  const [showAddArticle, setShowAddArticle] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [newArticle, setNewArticle] = useState({ title: '', description: '', quantity: 1, unit: '' })
  const [newStepName, setNewStepName] = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const [p, st, art, sts] = await Promise.all([
        fetchProjectById(projectId),
        fetchProjectSteps(projectId),
        fetchArticlesByProject(projectId),
        fetchStepStatuses(projectId),
      ])
      setProject(p)
      setSteps(st)
      setArticles(art)
      setStatuses(sts)
      if (!activeStep && st.length > 0) setActiveStep(st[0].id)
      const prog = await getProjectProgress(projectId)
      setProgress(prog)
    } catch {}
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (articleId, stepId) => {
    // Optimistic update
    setStatuses(prev => prev.map(s =>
      s.article_id === articleId && s.step_id === stepId
        ? { ...s, completed: !s.completed, completed_by: currentWorker?.id, completed_at: new Date().toISOString() }
        : s
    ))
    try {
      await toggleStepStatus(articleId, stepId, currentWorker?.id)
      const prog = await getProjectProgress(projectId)
      setProgress(prog)
    } catch {
      await load()
    }
  }

  const handleAddArticle = async () => {
    if (!newArticle.title.trim()) return
    try {
      await createArticle(projectId, newArticle.title.trim(), newArticle.description.trim(), Number(newArticle.quantity) || 1, newArticle.unit.trim())
      setShowAddArticle(false)
      setNewArticle({ title: '', description: '', quantity: 1, unit: '' })
      await load()
    } catch {}
  }

  const handleAddStep = async () => {
    if (!newStepName.trim()) return
    try {
      await addProjectStep(projectId, newStepName.trim())
      setShowAddStep(false)
      setNewStepName('')
      await load()
    } catch {}
  }

  const handleArchive = () => {
    setConfirm({
      title: 'Archiver le projet ?',
      message: 'Le projet sera deplace dans les archives. Vous pourrez le restaurer plus tard.',
      onConfirm: async () => {
        await archiveProject(projectId)
        setConfirm(null)
        onBack()
      }
    })
  }

  const handleComplete = () => {
    setConfirm({
      title: 'Marquer comme termine ?',
      message: 'Le projet sera marque comme termine.',
      onConfirm: async () => {
        await completeProject(projectId)
        setConfirm(null)
        await load()
      }
    })
  }

  const handleDeleteArticle = (articleId, title) => {
    setConfirm({
      title: 'Supprimer cet article ?',
      message: `"${title}" sera definitivement supprime.`,
      danger: true,
      onConfirm: async () => {
        await deleteArticle(articleId)
        setConfirm(null)
        await load()
      }
    })
  }

  if (loading) return <div className="py-16"><Spinner /></div>
  if (!project) return <EmptyState icon="❌" title="Projet introuvable" />

  const isReadOnly = project.status === 'archived'
  const stepTabs = [
    ...steps.map(s => {
      const stepStatuses = statuses.filter(st => st.step_id === s.id)
      const done = stepStatuses.filter(st => st.completed).length
      return { key: s.id, label: s.name, count: `${done}/${stepStatuses.length}` }
    }),
    ...(isReadOnly ? [] : [{ key: '__add', label: '+ Etape' }])
  ]

  const filteredArticles = articles
  const currentStatuses = statuses.filter(s => s.step_id === activeStep)

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted active:scale-90 transition-transform">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dark truncate">{project.name}</h1>
          <p className="text-sm text-muted truncate">{project.client_name}</p>
        </div>
        <Badge variant={project.status}>
          {project.status === 'active' ? 'Actif' : project.status === 'completed' ? 'Termine' : 'Archive'}
        </Badge>
      </div>

      {/* Progress */}
      <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-dark">Progression globale</span>
          <span className="text-sm font-bold text-primary">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} height="h-3" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted">{progress.completed}/{progress.total} validations</span>
          <span className="text-xs text-muted">{articles.length} articles</span>
        </div>
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={handleComplete} className="flex-shrink-0 px-4 py-2 rounded-xl bg-success/10 text-success text-sm font-medium active:scale-95 transition-transform">
            Terminer
          </button>
          <button onClick={handleArchive} className="flex-shrink-0 px-4 py-2 rounded-xl bg-muted/10 text-muted text-sm font-medium active:scale-95 transition-transform">
            Archiver
          </button>
        </div>
      )}

      {/* Step Tabs */}
      <Tabs
        tabs={stepTabs}
        active={activeStep}
        onChange={key => key === '__add' ? setShowAddStep(true) : setActiveStep(key)}
      />

      {/* Article List */}
      {filteredArticles.length === 0 ? (
        <EmptyState icon="📋" title="Aucun article" subtitle="Importez un devis ou ajoutez des articles manuellement" />
      ) : (
        <div className="space-y-2">
          {filteredArticles.map(article => {
            const stepStatus = currentStatuses.find(s => s.article_id === article.id)
            const allDone = statuses.filter(s => s.article_id === article.id).every(s => s.completed)
            return (
              <div
                key={article.id}
                className={`flex items-center gap-3 bg-surface rounded-xl border p-3 transition-colors
                  ${allDone ? 'border-success/30 bg-success/5' : 'border-border'}`}
              >
                {!isReadOnly && (
                  <TouchCheckbox
                    checked={stepStatus?.completed}
                    onChange={() => handleToggle(article.id, activeStep)}
                  />
                )}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectArticle(article.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${allDone ? 'line-through text-muted' : 'text-dark'}`}>
                      {article.title}
                    </span>
                    <span className="text-xs text-muted bg-border/50 px-1.5 py-0.5 rounded">
                      x{article.quantity}
                    </span>
                  </div>
                  {article.description && article.description !== article.title && (
                    <p className="text-xs text-muted mt-0.5 truncate">{article.description}</p>
                  )}
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeleteArticle(article.id, article.title)}
                    className="text-muted/40 hover:text-danger text-sm p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Article Button */}
      {!isReadOnly && (
        <button
          onClick={() => setShowAddArticle(true)}
          className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-border text-muted text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors active:scale-[0.98]"
        >
          + Ajouter un article
        </button>
      )}

      {/* Add Article Modal */}
      <Modal open={showAddArticle} onClose={() => setShowAddArticle(false)} title="Nouvel article">
        <Input label="Titre" placeholder="Ex: Table basse chene" value={newArticle.title} onChange={e => setNewArticle(f => ({ ...f, title: e.target.value }))} />
        <Textarea label="Description" placeholder="Detail complet de l'article..." value={newArticle.description} onChange={e => setNewArticle(f => ({ ...f, description: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantite" type="number" min="1" value={newArticle.quantity} onChange={e => setNewArticle(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Unite" placeholder="pcs, ml, m2..." value={newArticle.unit} onChange={e => setNewArticle(f => ({ ...f, unit: e.target.value }))} />
        </div>
        <button
          onClick={handleAddArticle}
          disabled={!newArticle.title.trim()}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          Ajouter
        </button>
      </Modal>

      {/* Add Step Modal */}
      <Modal open={showAddStep} onClose={() => setShowAddStep(false)} title="Nouvelle etape">
        <Input label="Nom de l'etape" placeholder="Ex: Laquage" value={newStepName} onChange={e => setNewStepName(e.target.value)} />
        <button
          onClick={handleAddStep}
          disabled={!newStepName.trim()}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          Ajouter l'etape
        </button>
      </Modal>

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
