import { supabase } from './supabase'

// ─── Workers ──────────────────────────────────────────────
export async function fetchWorkers(activeOnly = true) {
  let q = supabase.from('workers').select('*').order('name')
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function authenticateByPin(workerId, pin) {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .eq('pin_code', pin)
    .eq('active', true)
    .single()
  if (error || !data) return null
  return data
}

export async function createWorker(name, pinCode, role = 'worker') {
  const { data, error } = await supabase
    .from('workers')
    .insert({ name, pin_code: pinCode, role })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWorker(id, updates) {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleWorkerActive(id, active) {
  return updateWorker(id, { active })
}

// ─── Projects ─────────────────────────────────────────────
export async function fetchProjects(status = null) {
  let q = supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function fetchProjectById(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProject(name, clientName, description = '') {
  const { data, error } = await supabase.rpc('create_project_with_steps', {
    p_name: name,
    p_client_name: clientName,
    p_description: description,
  })
  if (error) throw error
  return data
}

export async function updateProject(id, updates) {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function archiveProject(id) {
  return updateProject(id, { status: 'archived', archived_at: new Date().toISOString() })
}

export async function restoreProject(id) {
  return updateProject(id, { status: 'active', archived_at: null })
}

export async function completeProject(id) {
  return updateProject(id, { status: 'completed', completed_at: new Date().toISOString() })
}

// ─── Project Steps ────────────────────────────────────────
export async function fetchProjectSteps(projectId) {
  const { data, error } = await supabase
    .from('project_steps')
    .select('*')
    .eq('project_id', projectId)
    .order('position')
  if (error) throw error
  return data || []
}

export async function addProjectStep(projectId, name) {
  // Get max position
  const steps = await fetchProjectSteps(projectId)
  const maxPos = steps.length > 0 ? Math.max(...steps.map(s => s.position)) : 0
  const { data, error } = await supabase
    .from('project_steps')
    .insert({ project_id: projectId, name, position: maxPos + 1 })
    .select()
    .single()
  if (error) throw error

  // Create article_step_status rows for all existing articles
  const articles = await fetchArticlesByProject(projectId)
  if (articles.length > 0) {
    const rows = articles.map(a => ({ article_id: a.id, step_id: data.id }))
    await supabase.from('article_step_status').insert(rows)
  }

  return data
}

// ─── Articles ─────────────────────────────────────────────
export async function fetchArticlesByProject(projectId) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('project_id', projectId)
    .order('position')
  if (error) throw error
  return data || []
}

export async function createArticle(projectId, title, description, quantity = 1, unit = '') {
  const articles = await fetchArticlesByProject(projectId)
  const maxPos = articles.length > 0 ? Math.max(...articles.map(a => a.position)) : 0

  const { data, error } = await supabase
    .from('articles')
    .insert({ project_id: projectId, title, description, quantity, unit, position: maxPos + 1 })
    .select()
    .single()
  if (error) throw error

  // Create step status rows for all project steps
  const steps = await fetchProjectSteps(projectId)
  if (steps.length > 0) {
    const rows = steps.map(s => ({ article_id: data.id, step_id: s.id }))
    await supabase.from('article_step_status').insert(rows)
  }

  return data
}

export async function updateArticle(id, updates) {
  const { data, error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteArticle(id) {
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) throw error
}

export async function bulkCreateArticles(projectId, articlesList) {
  const steps = await fetchProjectSteps(projectId)
  const existing = await fetchArticlesByProject(projectId)
  let maxPos = existing.length > 0 ? Math.max(...existing.map(a => a.position)) : 0

  const rows = articlesList.map((a, i) => ({
    project_id: projectId,
    title: a.title,
    description: a.description,
    quantity: a.quantity || 1,
    unit: a.unit || '',
    position: maxPos + 1 + i,
  }))

  const { data, error } = await supabase.from('articles').insert(rows).select()
  if (error) throw error

  // Create step status rows for all new articles
  if (data.length > 0 && steps.length > 0) {
    const statusRows = data.flatMap(article =>
      steps.map(step => ({ article_id: article.id, step_id: step.id }))
    )
    await supabase.from('article_step_status').insert(statusRows)
  }

  return data
}

// ─── Step Status (Checkboxes) ─────────────────────────────
export async function fetchStepStatuses(projectId) {
  const articles = await fetchArticlesByProject(projectId)
  if (articles.length === 0) return []
  const ids = articles.map(a => a.id)
  const { data, error } = await supabase
    .from('article_step_status')
    .select('*')
    .in('article_id', ids)
  if (error) throw error
  return data || []
}

export async function toggleStepStatus(articleId, stepId, workerId) {
  // Get current status
  const { data: current } = await supabase
    .from('article_step_status')
    .select('*')
    .eq('article_id', articleId)
    .eq('step_id', stepId)
    .single()

  const completed = !current?.completed
  const { data, error } = await supabase
    .from('article_step_status')
    .update({
      completed,
      completed_by: completed ? workerId : null,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('article_id', articleId)
    .eq('step_id', stepId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Photos ───────────────────────────────────────────────
export async function fetchPhotosByArticle(articleId) {
  const { data, error } = await supabase
    .from('article_photos')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadPhoto(articleId, file, phase = 'production', workerId = null) {
  const ext = file.name?.split('.').pop() || 'jpg'
  const path = `${articleId}/${Date.now()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (uploadErr) throw uploadErr

  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
  const photoUrl = urlData?.publicUrl

  const { data, error } = await supabase
    .from('article_photos')
    .insert({ article_id: articleId, photo_url: photoUrl, phase, uploaded_by: workerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePhoto(id, photoUrl) {
  // Extract storage path from URL
  const match = photoUrl?.match(/\/photos\/(.+)$/)
  if (match) {
    await supabase.storage.from('photos').remove([match[1]])
  }
  const { error } = await supabase.from('article_photos').delete().eq('id', id)
  if (error) throw error
}

// ─── Assignments ──────────────────────────────────────────
export async function fetchAssignmentsByArticle(articleId) {
  const { data, error } = await supabase
    .from('article_assignments')
    .select('*, worker:workers(*)')
    .eq('article_id', articleId)
  if (error) throw error
  return data || []
}

export async function assignWorker(articleId, workerId) {
  const { data, error } = await supabase
    .from('article_assignments')
    .insert({ article_id: articleId, worker_id: workerId })
    .select('*, worker:workers(*)')
    .single()
  if (error) throw error
  return data
}

export async function unassignWorker(articleId, workerId) {
  const { error } = await supabase
    .from('article_assignments')
    .delete()
    .eq('article_id', articleId)
    .eq('worker_id', workerId)
  if (error) throw error
}

// ─── Default Steps ────────────────────────────────────────
export async function fetchDefaultSteps() {
  const { data, error } = await supabase
    .from('default_steps')
    .select('*')
    .order('position')
  if (error) throw error
  return data || []
}

export async function createDefaultStep(name) {
  const steps = await fetchDefaultSteps()
  const maxPos = steps.length > 0 ? Math.max(...steps.map(s => s.position)) : 0
  const { data, error } = await supabase
    .from('default_steps')
    .insert({ name, position: maxPos + 1 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDefaultStep(id, name) {
  const { data, error } = await supabase
    .from('default_steps')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDefaultStep(id) {
  const { error } = await supabase.from('default_steps').delete().eq('id', id)
  if (error) throw error
}

export async function reorderDefaultSteps(orderedIds) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('default_steps').update({ position: i + 1 }).eq('id', id)
  )
  await Promise.all(updates)
}

// ─── Project Progress ─────────────────────────────────────
export async function getProjectProgress(projectId) {
  const statuses = await fetchStepStatuses(projectId)
  if (statuses.length === 0) return { total: 0, completed: 0, percent: 0 }
  const completed = statuses.filter(s => s.completed).length
  return {
    total: statuses.length,
    completed,
    percent: Math.round((completed / statuses.length) * 100),
  }
}

// ─── Upload Quote File ────────────────────────────────────
export async function uploadQuoteFile(file, projectId) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${projectId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage
    .from('quotes')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('quotes').getPublicUrl(path)
  await updateProject(projectId, { quote_file_url: data?.publicUrl })
  return data?.publicUrl
}
