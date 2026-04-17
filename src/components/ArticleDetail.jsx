import { useState, useEffect, useCallback } from 'react'
import {
  fetchArticlesByProject, fetchProjectSteps, fetchStepStatuses,
  fetchPhotosByArticle, fetchAssignmentsByArticle, fetchWorkers,
  toggleStepStatus, assignWorker, unassignWorker, updateArticle, deletePhoto
} from '../lib/service'
import { supabase } from '../lib/supabase'
import { TouchCheckbox, Badge, Spinner, Modal, Input, Textarea, WorkerAvatar, ConfirmDialog } from './ui'
import PhotoCapture from './PhotoCapture'

export default function ArticleDetail({ articleId, projectId, currentWorker, onBack }) {
  const [article, setArticle] = useState(null)
  const [steps, setSteps] = useState([])
  const [statuses, setStatuses] = useState([])
  const [photos, setPhotos] = useState([])
  const [assignments, setAssignments] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', quantity: 1, unit: '' })
  const [lightbox, setLightbox] = useState(null)
  const [expandDesc, setExpandDesc] = useState(false)

  const load = useCallback(async () => {
    try {
      const articles = await fetchArticlesByProject(projectId)
      const art = articles.find(a => a.id === articleId)
      if (!art) return
      setArticle(art)
      setEditForm({ title: art.title, description: art.description || '', quantity: art.quantity, unit: art.unit || '' })

      const [st, sts, ph, asg, wk] = await Promise.all([
        fetchProjectSteps(projectId),
        fetchStepStatuses(projectId),
        fetchPhotosByArticle(articleId),
        fetchAssignmentsByArticle(articleId),
        fetchWorkers(true),
      ])
      setSteps(st)
      setStatuses(sts.filter(s => s.article_id === articleId))
      setPhotos(ph)
      setAssignments(asg)
      setWorkers(wk)
    } catch {}
    setLoading(false)
  }, [articleId, projectId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (stepId) => {
    setStatuses(prev => prev.map(s =>
      s.step_id === stepId ? { ...s, completed: !s.completed } : s
    ))
    await toggleStepStatus(articleId, stepId, currentWorker?.id)
    await load()
  }

  const handleAssign = async (workerId) => {
    await assignWorker(articleId, workerId)
    setShowAssign(false)
    await load()
  }

  const handleUnassign = async (workerId) => {
    await unassignWorker(articleId, workerId)
    await load()
  }

  const handleSaveEdit = async () => {
    await updateArticle(articleId, {
      title: editForm.title,
      description: editForm.description,
      quantity: Number(editForm.quantity) || 1,
      unit: editForm.unit,
    })
    setShowEdit(false)
    await load()
  }

  const handleDeletePhoto = async (photo) => {
    await deletePhoto(photo.id, photo.photo_url)
    await load()
  }

  const handlePhotoUploaded = () => load()

  if (loading) return <div className="py-16"><Spinner /></div>
  if (!article) return <div className="py-16 text-center text-muted">Article introuvable</div>

  const assignedIds = assignments.map(a => a.worker_id)
  const availableWorkers = workers.filter(w => !assignedIds.includes(w.id))
  const allDone = statuses.length > 0 && statuses.every(s => s.completed)

  return (
    <div className="animate-fadeIn pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted active:scale-90 transition-transform">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dark truncate">{article.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-muted">Qte: {article.quantity} {article.unit}</span>
            {allDone && <Badge variant="completed">Termine</Badge>}
          </div>
        </div>
        <button onClick={() => setShowEdit(true)} className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted">
          ✎
        </button>
      </div>

      {/* Description */}
      {article.description && (
        <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Description</h3>
          <p className={`text-sm text-dark leading-relaxed ${!expandDesc && article.description.length > 150 ? 'line-clamp-3' : ''}`}>
            {article.description}
          </p>
          {article.description.length > 150 && (
            <button onClick={() => setExpandDesc(!expandDesc)} className="text-xs text-primary font-medium mt-1">
              {expandDesc ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}

      {/* Step Progress */}
      <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Progression par etape</h3>
        <div className="space-y-2">
          {steps.map(step => {
            const status = statuses.find(s => s.step_id === step.id)
            return (
              <div key={step.id} className="flex items-center gap-3">
                <TouchCheckbox
                  checked={status?.completed}
                  onChange={() => handleToggle(step.id)}
                />
                <div className="flex-1">
                  <span className={`text-sm font-medium ${status?.completed ? 'text-primary' : 'text-dark'}`}>
                    {step.name}
                  </span>
                  {status?.completed && status?.completed_at && (
                    <p className="text-xs text-muted">
                      {new Date(status.completed_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Photos */}
      <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Photos ({photos.length})
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-border/30">
              <img
                src={photo.photo_url}
                alt=""
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(photo)}
              />
              <span className={`absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium
                ${photo.phase === 'devis' ? 'bg-accent text-white' : 'bg-primary text-white'}`}>
                {photo.phase === 'devis' ? 'Devis' : 'Prod'}
              </span>
            </div>
          ))}
        </div>
        <PhotoCapture articleId={articleId} currentWorker={currentWorker} onUploaded={handlePhotoUploaded} />
      </div>

      {/* Assignments */}
      <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Assignation</h3>
        <div className="flex flex-wrap gap-2">
          {assignments.map(a => (
            <button
              key={a.id}
              onClick={() => handleUnassign(a.worker_id)}
              className="flex items-center gap-2 bg-primary/5 rounded-full pl-1 pr-3 py-1 group"
            >
              <WorkerAvatar name={a.worker?.name} size="sm" />
              <span className="text-sm text-dark">{a.worker?.name}</span>
              <span className="text-muted/40 group-hover:text-danger text-xs ml-1">✕</span>
            </button>
          ))}
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary transition-colors"
          >
            + Assigner
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.photo_url} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(lightbox); setLightbox(null) }}
            className="absolute top-4 right-4 bg-danger text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            Supprimer
          </button>
        </div>
      )}

      {/* Assign Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assigner un ouvrier">
        {availableWorkers.length === 0 ? (
          <p className="text-sm text-muted py-4">Tous les ouvriers sont deja assignes.</p>
        ) : (
          <div className="space-y-2">
            {availableWorkers.map(w => (
              <button
                key={w.id}
                onClick={() => handleAssign(w.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-primary/5 transition-colors active:scale-[0.98]"
              >
                <WorkerAvatar name={w.name} size="md" />
                <span className="font-medium text-dark">{w.name}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Modifier l'article">
        <Input label="Titre" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea label="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantite" type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
          <Input label="Unite" value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} />
        </div>
        <button onClick={handleSaveEdit} className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold active:scale-[0.98] transition-transform">
          Enregistrer
        </button>
      </Modal>
    </div>
  )
}
