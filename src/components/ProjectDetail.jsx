import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchProjectById, fetchProjectSteps, fetchArticlesByProject,
  fetchStepStatuses, toggleStepStatus, createArticle, deleteArticle,
  archiveProject, completeProject, addProjectStep, getProjectProgress,
  uploadPhoto, fetchPhotosByArticle, uploadArticleImage
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
  const [activeStep, setActiveStep] = useState('all')
  const [showAddArticle, setShowAddArticle] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [newArticle, setNewArticle] = useState({ title: '', description: '', quantity: 1, unit: '' })
  const [newStepName, setNewStepName] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [showPipeline, setShowPipeline] = useState(true)
  const [articlePhotos, setArticlePhotos] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(null)
  const photoInputRefs = useRef({})
  const imageInputRefs = useRef({})

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
      const prog = await getProjectProgress(projectId)
      setProgress(prog)

      // Load photos per article (latest first for thumbnail)
      const photosMap = {}
      await Promise.all(art.map(async a => {
        const photos = await fetchPhotosByArticle(a.id)
        photosMap[a.id] = photos
      }))
      setArticlePhotos(photosMap)
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
      // Reload photos for this article
      const photos = await fetchPhotosByArticle(articleId)
      setArticlePhotos(prev => ({ ...prev, [articleId]: photos }))
    } catch (err) {
      console.error('Upload error:', err)
    }
    setUploadingPhoto(null)
    if (photoInputRefs.current[articleId]) photoInputRefs.current[articleId].value = ''
  }

  const handleImageUpload = async (articleId, files) => {
    if (!files?.length) return
    setUploadingImage(articleId)
    try {
      const compressed = await compressImage(files[0])
      const imageUrl = await uploadArticleImage(articleId, compressed)
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, image_url: imageUrl } : a))
    } catch (err) {
      console.error('Image upload error:', err)
    }
    setUploadingImage(null)
    if (imageInputRefs.current[articleId]) imageInputRefs.current[articleId].value = ''
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

  // Compute current step per article
  const articleCurrentStep = {}
  articles.forEach(a => {
    articleCurrentStep[a.id] = getArticleCurrentStep(a.id, steps, statuses)
  })

  // Count articles completed (all steps done)
  const doneCount = articles.filter(a => articleCurrentStep[a.id] === '__done').length

  // Filter: 'all' shows everything, or filter by step
  const displayedArticles = activeStep === 'all'
    ? articles
    : articles.filter(a => articleCurrentStep[a.id] === activeStep)

  // For each displayed article, find its current step info
  const getStepName = (articleId) => {
    const stepId = articleCurrentStep[articleId]
    if (stepId === '__done') return 'Termine'
    const step = steps.find(s => s.id === stepId)
    return step?.name || ''
  }

  const getStepIndex = (articleId) => {
    const stepId = articleCurrentStep[articleId]
    if (stepId === '__done') return steps.length
    return steps.findIndex(s => s.id === stepId)
  }

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

      {/* Filter tabs: Tous + each step */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
        <button
          onClick={() => setActiveStep('all')}
          className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0
            ${activeStep === 'all' ? 'bg-primary text-white' : 'bg-dark/5 text-muted'}`}
        >
          Tous <span className="ml-1 text-xs opacity-70">{articles.length}</span>
        </button>
        {steps.map(s => {
          const count = articles.filter(a => articleCurrentStep[a.id] === s.id).length
          return (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0
                ${activeStep === s.id ? 'bg-primary text-white' : 'bg-dark/5 text-muted'}`}
            >
              {s.name} <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Article List */}
      {displayedArticles.length === 0 ? (
        <EmptyState
          icon={articles.length === 0 ? '📋' : '✓'}
          title={articles.length === 0 ? 'Aucun article' : 'Aucun article a cette etape'}
          subtitle={articles.length === 0 ? 'Importez un devis ou ajoutez des articles manuellement' : null}
        />
      ) : (
        <div className="space-y-2">
          {displayedArticles.map(article => {
            const photos = articlePhotos[article.id] || []
            const photoCount = photos.length
            const isUploadingProd = uploadingPhoto === article.id
            const isUploadingImg = uploadingImage === article.id
            const currentStepId = articleCurrentStep[article.id]
            const isDone = currentStepId === '__done'
            const stepName = getStepName(article.id)
            const stepIdx = getStepIndex(article.id)
            const stepPercent = steps.length > 0 ? Math.round((stepIdx / steps.length) * 100) : 0
            return (
              <div
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className={`bg-surface rounded-xl border p-3 transition-all cursor-pointer active:bg-dark/2
                  ${isDone ? 'border-primary/20' : 'border-border'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Article image or placeholder to add one */}
                  {article.image_url ? (
                    <div className="w-16 h-16 min-w-16 rounded-lg overflow-hidden bg-dark/5 flex-shrink-0">
                      <img src={article.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <label
                      onClick={e => e.stopPropagation()}
                      className={`w-16 h-16 min-w-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-colors
                        ${isUploadingImg ? 'border-primary/30 bg-primary/5' : 'border-dark/10 bg-dark/2 hover:border-primary/30'}`}
                    >
                      <span className="text-lg leading-none">{isUploadingImg ? '...' : '📷'}</span>
                      <span className="text-[9px] text-muted mt-0.5">Image</span>
                      <input
                        ref={el => { imageInputRefs.current[article.id] = el }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingImg}
                        onChange={e => handleImageUpload(article.id, e.target.files)}
                      />
                    </label>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${isDone ? 'text-muted' : 'text-dark'}`}>
                        {article.title}
                      </span>
                      <span className="text-xs text-muted bg-dark/5 px-1.5 py-0.5 rounded">
                        x{article.quantity}
                      </span>
                    </div>
                    {/* Current step indicator */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md
                        ${isDone ? 'bg-primary/8 text-primary' : 'bg-accent/15 text-accent'}`}>
                        {stepName}
                      </span>
                      {!isDone && (
                        <div className="flex-1 h-1 bg-dark/6 rounded-full overflow-hidden max-w-20">
                          <div className="h-1 bg-primary/40 rounded-full transition-all" style={{ width: `${stepPercent}%` }} />
                        </div>
                      )}
                    </div>
                    {/* Action bar: validate + prod photos */}
                    <div className="flex items-center gap-2 mt-1.5" onClick={e => e.stopPropagation()}>
                      {!isReadOnly && !isDone && (
                        <button
                          onClick={() => handleToggle(article.id, currentStepId)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-dark/4 text-muted hover:bg-primary/8 hover:text-primary transition-colors"
                        >
                          ✓ Valider
                        </button>
                      )}
                      <label className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors
                        ${isUploadingProd ? 'bg-dark/5 text-muted' : 'bg-dark/4 text-muted hover:bg-primary/8 hover:text-primary'}`}>
                        <span>🔨</span>
                        <span>{isUploadingProd ? 'Envoi...' : photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''} prod` : 'Photo prod'}</span>
                        <input
                          ref={el => { photoInputRefs.current[article.id] = el }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={isUploadingProd}
                          onChange={e => handlePhotoUpload(article.id, e.target.files)}
                        />
                      </label>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteArticle(article.id, article.title) }}
                      className="text-dark/20 hover:text-danger text-sm p-1 mt-1"
                    >
                      ✕
                    </button>
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
