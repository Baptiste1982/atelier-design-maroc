import { useState, useEffect, useCallback } from 'react'
import { fetchWorkers, authenticateByPin } from '../lib/service'

const STORAGE_KEY = 'atelier_session'

export function useAuth() {
  const [currentWorker, setCurrentWorker] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const w = JSON.parse(stored)
        if (w?.id) setCurrentWorker(w)
      }
    } catch {}
    setLoading(false)
  }, [])

  const login = useCallback(async (workerId, pin) => {
    const worker = await authenticateByPin(workerId, pin)
    if (!worker) return false
    setCurrentWorker(worker)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(worker))
    return true
  }, [])

  const logout = useCallback(() => {
    setCurrentWorker(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const isAdmin = currentWorker?.role === 'admin'

  return { currentWorker, isAdmin, loading, login, logout }
}
