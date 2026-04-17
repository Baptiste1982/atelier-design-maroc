import { useState, useEffect } from 'react'
import { fetchWorkers } from '../lib/service'
import { WorkerAvatar, Spinner } from './ui'

export default function Login({ onLogin }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    fetchWorkers(true).then(setWorkers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDigit = async (d) => {
    if (checking) return
    const next = pin + d
    setError(false)
    if (next.length < 4) {
      setPin(next)
      return
    }
    // 4 digits reached, attempt login
    setPin(next)
    setChecking(true)
    const ok = await onLogin(selected.id, next)
    if (!ok) {
      setError(true)
      if (navigator.vibrate) navigator.vibrate([100, 50, 100])
      setTimeout(() => { setPin(''); setError(false) }, 800)
    }
    setChecking(false)
  }

  const handleDelete = () => {
    setPin(p => p.slice(0, -1))
    setError(false)
  }

  const handleBack = () => {
    setSelected(null)
    setPin('')
    setError(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 py-10">
      {/* Logo */}
      <div className="text-5xl mb-3">🪵</div>
      <h1 className="text-white text-2xl font-bold mb-1">Atelier</h1>
      <p className="text-white/50 text-sm mb-10">Suivi Production</p>

      {!selected ? (
        /* Step 1: Worker selection */
        <div className="w-full max-w-sm animate-fadeIn">
          <p className="text-white/60 text-sm text-center mb-4">Qui etes-vous ?</p>
          <div className="grid grid-cols-2 gap-3">
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelected(w)}
                className="bg-white/10 hover:bg-white/15 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all active:scale-95"
              >
                <WorkerAvatar name={w.name} size="lg" />
                <span className="text-white font-medium text-sm">{w.name}</span>
                <span className="text-white/40 text-xs capitalize">{w.role}</span>
              </button>
            ))}
          </div>
          {workers.length === 0 && (
            <p className="text-white/40 text-center text-sm mt-8">Aucun ouvrier enregistre</p>
          )}
        </div>
      ) : (
        /* Step 2: PIN entry */
        <div className="w-full max-w-xs animate-fadeIn">
          <button onClick={handleBack} className="text-white/40 text-sm mb-6 flex items-center gap-1 hover:text-white/60">
            ← Retour
          </button>
          <div className="flex flex-col items-center mb-8">
            <WorkerAvatar name={selected.name} size="lg" />
            <span className="text-white font-semibold mt-2">{selected.name}</span>
          </div>

          {/* PIN dots */}
          <div className={`flex justify-center gap-4 mb-8 ${error ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200
                  ${i < pin.length
                    ? error ? 'bg-danger scale-110' : 'bg-accent scale-110'
                    : 'bg-white/20'
                  }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((d, i) => {
              if (d === null) return <div key={i} />
              if (d === 'del') {
                return (
                  <button
                    key="del"
                    onClick={handleDelete}
                    className="h-16 rounded-2xl bg-white/5 text-white/60 text-xl flex items-center justify-center active:bg-white/10 transition-colors"
                  >
                    ←
                  </button>
                )
              }
              return (
                <button
                  key={d}
                  onClick={() => handleDigit(String(d))}
                  className="h-16 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-2xl font-medium flex items-center justify-center active:scale-90 transition-all"
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
