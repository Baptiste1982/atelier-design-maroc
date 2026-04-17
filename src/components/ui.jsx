import { useState } from 'react'

// ─── Spinner ──────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7'
  return (
    <div className={`${s} border-3 border-border border-t-primary rounded-full animate-spin mx-auto`} />
  )
}

// ─── Card ─────────────────────────────────────────────────
export function Card({ children, className = '', onClick, ...props }) {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border p-4 ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────
const BADGE_COLORS = {
  active: 'bg-primary/8 text-primary',
  completed: 'bg-dark/6 text-dark',
  archived: 'bg-dark/6 text-muted',
  admin: 'bg-accent/15 text-accent',
  worker: 'bg-dark/5 text-muted',
}
export function Badge({ variant = 'active', children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE_COLORS[variant] || BADGE_COLORS.active}`}>
      {children}
    </span>
  )
}

// ─── StepPipeline ─────────────────────────────────────────
export function StepPipeline({ steps, statuses, articles, activeStep, onStepClick }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
      {/* Title is in parent toggle button */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const stepStatuses = statuses.filter(s => s.step_id === step.id)
          const done = stepStatuses.filter(s => s.completed).length
          const total = stepStatuses.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const isActive = activeStep === step.id
          const isDone = total > 0 && done === total
          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left
                ${isActive ? 'bg-primary/6 ring-1 ring-primary/20' : 'hover:bg-dark/3'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${isDone ? 'bg-primary text-white' : isActive ? 'bg-primary/15 text-primary' : 'bg-dark/6 text-muted'}`}>
                {isDone ? '✓' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isActive ? 'text-dark' : 'text-muted'}`}>{step.name}</span>
                  <span className={`text-xs tabular-nums ${isDone ? 'text-primary font-semibold' : 'text-muted'}`}>
                    {done}/{total}
                  </span>
                </div>
                <div className="h-1 bg-dark/6 rounded-full overflow-hidden mt-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${isDone ? 'bg-primary' : 'bg-primary/40'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── ProgressBar ──────────────────────────────────────────
export function ProgressBar({ percent = 0, height = 'h-2', className = '' }) {
  return (
    <div className={`${height} bg-dark/8 rounded-full overflow-hidden ${className}`}>
      <div className={`${height} bg-primary rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
    </div>
  )
}

// ─── TouchCheckbox ────────────────────────────────────────
export function TouchCheckbox({ checked, onChange, disabled }) {
  const handleClick = () => {
    if (disabled) return
    if (navigator.vibrate) navigator.vibrate(30)
    onChange?.(!checked)
  }
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`w-12 h-12 min-w-12 rounded-xl border-2 flex items-center justify-center transition-all
        ${checked
          ? 'bg-primary border-primary text-white animate-checkPop'
          : 'bg-surface border-dark/15 text-transparent hover:border-primary/40'
        } ${disabled ? 'opacity-50' : 'active:scale-90'}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4,10 8,14 16,6" />
      </svg>
    </button>
  )
}

// ─── FAB (Floating Action Button) ─────────────────────────
export function FAB({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-16 right-5 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl font-light active:scale-90 transition-transform hover:bg-primary-light"
      title={label}
    >
      +
    </button>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', onConfirm, onCancel, danger }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm shadow-xl animate-fadeIn" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-dark mb-2">{title}</h3>
        <p className="text-muted text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-border text-muted font-medium active:scale-95 transition-transform">
            Annuler
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl text-white font-medium active:scale-95 transition-transform ${danger ? 'bg-danger' : 'bg-primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────
export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-5xl mb-4 opacity-30">{icon || '📦'}</div>
      <h3 className="text-lg font-semibold text-dark mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl animate-fadeIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-dark">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-border/50 flex items-center justify-center text-muted">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────
export function Input({ label, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-muted mb-1.5">{label}</label>}
      <input
        className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-dark text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        {...props}
      />
    </div>
  )
}

export function Textarea({ label, ...props }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-muted mb-1.5">{label}</label>}
      <textarea
        className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-dark text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
        rows={3}
        {...props}
      />
    </div>
  )
}

// ─── PageHeader ───────────────────────────────────────────
export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-bold text-dark">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1 scrollbar-none">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0
            ${active === t.key
              ? 'bg-primary text-white'
              : 'bg-surface text-muted border border-border hover:bg-border/30'
            }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`ml-1.5 text-xs ${active === t.key ? 'text-white/70' : 'text-muted/60'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── WorkerAvatar ─────────────────────────────────────────
export function WorkerAvatar({ name, size = 'sm' }) {
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-lg'
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`${s} rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}
