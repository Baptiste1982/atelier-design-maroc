import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchProjectById, fetchProjectSteps, fetchArticlesByProject,
  fetchStepStatuses, toggleStepStatus, createArticle, deleteArticle,
  archiveProject, completeProject, addProjectStep, getProjectProgress,
  uploadPhoto, fetchPhotosByArticle
} from '../lib/service'
import { Card, Badge, ProgressBar, TouchCheckbox, StepPipeline, Modal, Input, Textarea, Spinner, ConfirmDialog, EmptyState, PageHeader, WorkerAvatar } from './ui'

// Compress image before upload
function compressImage(file, maxSize = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' })),
        'image/jpeg', quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Get the current step for an article = first unchecked step in order
function getArticleCurrentStep(articleId, steps, statuses) {
  for (const step of steps) {
    const s = statuses.find(st => st.article_id === articleId && st.step_id === step.id)
    if (!s || !s.completed) return step.id
  }
  return '__done' // all steps completed
}

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
  const [showPipeline, setShowPipeline] = useState(true)
  const [photoCounts, setPhotoCounts] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const photoInputRefs = useRef({})

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

      // Load photo counts per article
      const counts = {}
      await Promise.all(art.map(async a => {
        const photos = await fetchPhotosByArticle(a.id)
        counts[a.id] = photos.length
      }))
      setPhotoCounts(counts)
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

  const handlePhotoUpload = async (articleId, files) => {
    if (!files?.length) return
    setUploadingPhoto(articleId)
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file)
        await uploadPhoto(articleId, compressed, 'production', currentWorker?.id)
      }
      setPhotoCounts(prev => ({ ...prev, [articleId]: (prev[articleId] || 0) + files.length }))
    } catch (err) {
      console.error('Upload error:', err)
    }
    setUploadingPhoto(null)
    if (photoInputRefs.current[articleId]) photoInputRefs.current[articleId].value = ''
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

  // Filter articles: only show those whose CURRENT step matches the active tab
  const articlesAtStep = articles.filter(article => {
    const currentStep = getArticleCurrentStep(article.id, steps, statuses)
    return currentStep === activeStep
  })

  // Count articles completed (all steps done)
  const doneCount = articles.filter(article =>
    getArticleCurrentStep(article.id, steps, statuses) === '__done'
  ).length

  // Step tabs with count of articles AT that step
  const stepTabs = steps.map(s => {
    const count = articles.filter(a => getArticleCurrentStep(a.id, steps, statuses) === s.id).length
    return { key: s.id, label: s.name, count }
  })

  const activeStepObj = steps.find(s => s.id === activeStep)
  const activeStepIdx = steps.findIndex(s => s.id === activeStep)

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

      {/* Global Progress */}
      <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-dark">Progression globale</span>
          <span className="text-sm font-bold text-dark">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} height="h-2.5" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted">{progress.completed}/{progress.total} validations</span>
          <span className="text-xs text-muted">{doneCount}/{articles.length} articles termines</span>
        </div>
      </div>

      {/* Step Pipeline (collapsible) */}
      <button
        onClick={() => setShowPipeline(!showPipeline)}
        className="w-full flex items-center justify-between px-1 mb-2 text-xs font-semibold text-muted uppercase tracking-wider"
      >
        <span>Avancement par etape</span>
        <span className="text-[10px]">{showPipeline ? '▲' : '▼'}</span>
      </button>
      {showPipeline && (
        <StepPipeline
          steps={steps}
          statuses={statuses}
          articles={articles}
          activeStep={activeStep}
          onStepClick={setActiveStep}
        />
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-2 mb-4">
          <button onClick={handleComplete} className="flex-shrink-0 px-4 py-2 rounded-xl bg-dark/5 text-dark text-sm font-medium active:scale-95 transition-transform">
            Terminer
          </button>
          <button onClick={handleArchive} className="flex-shrink-0 px-4 py-2 rounded-xl bg-dark/5 text-muted text-sm font-medium active:scale-95 transition-transform">
            Archiver
          </button>
          <button onClick={() => setShowAddStep(true)} className="flex-shrink-0 px-4 py-2 rounded-xl bg-dark/5 text-muted text-sm font-medium active:scale-95 transition-transform ml-auto">
            + Etape
          </button>
        </div>
      )}

      {/* Active Step Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {activeStepIdx > 0 && (
          <button onClick={() => setActiveStep(steps[activeStepIdx - 1].id)} className="w-8 h-8 rounded-lg bg-dark/5 flex items-center justify-center text-muted text-sm active:scale-90">
            ‹
          </button>
        )}
        <div className="flex-1 text-center">
          <span className="text-base font-bold text-dark">{activeStepObj?.name}</span>
          <span className="text-xs text-muted ml-2">
            {articlesAtStep.length} article{articlesAtStep.length !== 1 ? 's' : ''}
          </span>
        </div>
        {activeStepIdx < steps.length - 1 && (
          <button onClick={() => setActiveStep(steps[activeStepIdx + 1].id)} className="w-8 h-8 rounded-lg bg-dark/5 flex items-center justify-center text-muted text-sm active:scale-90">
            ›
          </button>
        )}
      </div>

      {/* Step indicator dots */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveStep(s.id)}
            className={`h-1.5 rounded-full transition-all ${activeStep === s.id ? 'w-6 bg-primary' : 'w-1.5 bg-dark/15 hover:bg-dark/25'}`}
          />
        ))}
      </div>

      {/* Article List for current step */}
      {articlesAtStep.length === 0 ? (
        <EmptyState
          icon={doneCount === articles.length && articles.length > 0 ? '✓' : '📋'}
          title={articles.length === 0
            ? 'Aucun article'
            : doneCount === articles.length
              ? 'Tous les articles sont termines'
              : 'Aucun article a cette etape'
          }
          subtitle={articles.length === 0
            ? 'Importez un devis ou ajoutez des articles manuellement'
            : doneCount < articles.length
              ? 'Les articles avancent automatiquement apres validation'
              : null
          }
        />
      ) : (
        <div className="space-y-2">
          {articlesAtStep.map(article => {
            const photoCount = photoCounts[article.id] || 0
            const isUploading = uploadingPhoto === article.id
            return (
              <div
                key={article.id}
                className="bg-surface rounded-xl border border-border p-3 transition-all"
              >
                <div className="flex items-center gap-3">
                  {!isReadOnly && (
                    <TouchCheckbox
                      checked={false}
                      onChange={() => handleToggle(article.id, activeStep)}
                    />
                  )}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSelectArticle(article.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-dark">
                        {article.title}
                      </span>
                      <span className="text-xs text-muted bg-dark/5 px-1.5 py-0.5 rounded">
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
                      className="text-dark/20 hover:text-danger text-sm p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* Photo bar */}
                <div className="flex items-center gap-2 mt-2 ml-15">
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
                    ${isUploading ? 'bg-dark/5 text-muted' : 'bg-dark/4 text-muted hover:bg-primary/8 hover:text-primary'}`}>
                    <span>📷</span>
                    <span>{isUploading ? 'Envoi...' : 'Photo'}</span>
                    <input
                      ref={el => { photoInputRefs.current[article.id] = el }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={isUploading}
                      onChange={e => handlePhotoUpload(article.id, e.target.files)}
                    />
                  </label>
                  {photoCount > 0 && (
                    <span className="text-xs text-muted">{photoCount} photo{photoCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Article Button */}
      {!isReadOnly && (
        <button
          onClick={() => setShowAddArticle(true)}
          className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-dark/10 text-muted text-sm font-medium hover:border-primary/30 hover:text-primary transition-colors active:scale-[0.98]"
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
