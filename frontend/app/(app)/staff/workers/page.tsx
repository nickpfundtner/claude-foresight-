'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useWorkers,
  useTracks,
  useCreateWorker,
  useAssignTrack,
  useWorkerProgress,
  type WorkerSummary,
} from '@/lib/hooks/useStaff'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: pct === 100 ? '#40FF80' : 'linear-gradient(90deg, #FF6040, #FF5090)',
        }}
      />
    </div>
  )
}

function ProgressDrawer({
  worker,
  onClose,
}: {
  worker: WorkerSummary | null
  onClose: () => void
}) {
  const { data: progress, isLoading } = useWorkerProgress(worker?.id ?? null)

  if (!worker) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="flex-1 bg-black/40" />
        <motion.aside
          className="w-80 bg-surface border-l border-white/5 h-full overflow-y-auto flex flex-col"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #FF6040, #FF5090)' }}
              >
                {worker.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-ftext text-sm">{worker.name}</p>
                <p className="text-xs text-muted">{worker.role_name}</p>
              </div>
            </div>
            {progress && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{progress.completed_modules} of {progress.total_modules} modules</span>
                  <span>{progress.progress_pct}%</span>
                </div>
                <ProgressBar pct={progress.progress_pct} />
              </div>
            )}
          </div>
          <div className="flex-1 p-4 space-y-2">
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            )}
            {progress?.modules.map((m) => (
              <div key={m.module_id} className="bg-bg rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${m.completed ? 'text-[#40FF80]' : 'text-muted'}`}>
                      {m.completed ? '✓' : '○'}
                    </span>
                    <span className="text-xs font-medium text-ftext truncate max-w-[160px]">
                      {m.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.flag_count > 0 && (
                      <span className="text-xs text-pd1">⚑ {m.flag_count}</span>
                    )}
                    {m.score !== null && (
                      <span className="text-xs text-muted font-mono">{m.score}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {progress?.total_modules === 0 && (
              <p className="text-xs text-muted text-center py-8">No track assigned yet</p>
            )}
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  )
}

function AddWorkerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const { data: tracks = [] } = useTracks()
  const createWorker = useCreateWorker()
  const assignTrack = useAssignTrack()
  const [form, setForm] = useState({ name: '', email: '', role_name: '', password: '', track_id: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const worker = await createWorker.mutateAsync({
        name: form.name,
        email: form.email,
        role_name: form.role_name,
        password: form.password,
      })
      if (form.track_id) {
        await assignTrack.mutateAsync({ workerId: worker.id, trackId: form.track_id })
      }
      sounds.success()
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to create worker')
      sounds.error()
    }
  }

  const inputClass =
    'w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative bg-surface rounded-2xl p-6 w-full max-w-sm border border-white/5 shadow-2xl"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <h2 className="font-bold text-ftext mb-5">Add Worker</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className={inputClass} placeholder="Full name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" className={inputClass} placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputClass} placeholder="Role (e.g. Server, Stylist)" value={form.role_name}
            onChange={(e) => setForm({ ...form, role_name: e.target.value })} required />
          <input type="password" className={inputClass} placeholder="Temporary password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <select className={inputClass + ' appearance-none'} value={form.track_id}
            onChange={(e) => setForm({ ...form, track_id: e.target.value })}>
            <option value="">Assign to track (optional)</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {error && <p className="text-pd1 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1 py-2.5 text-sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 py-2.5 text-sm" disabled={createWorker.isPending}>
              {createWorker.isPending ? 'Creating…' : 'Add Worker'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function ProgressBarWithPct({ workerId }: { workerId: string }) {
  const { data: progress } = useWorkerProgress(workerId)
  if (!progress) return <div className="w-24 h-1.5 bg-white/5 rounded-full" />
  return (
    <div className="flex items-center gap-2">
      {progress.modules.some((m) => m.flag_count > 0) && (
        <span className="text-pd1 text-xs">⚑</span>
      )}
      <ProgressBar pct={progress.progress_pct} />
      <span className="text-xs text-muted w-8 text-right font-mono">{progress.progress_pct}%</span>
    </div>
  )
}

export default function WorkersPage() {
  const { data: workers = [], isLoading } = useWorkers()
  const [drawerWorker, setDrawerWorker] = useState<WorkerSummary | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        <motion.div className="flex items-center justify-between"
          variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <div>
            <h1 className="text-2xl font-black text-ftext">Workers</h1>
            <p className="text-sm text-muted mt-0.5">Manage your team and track their progress</p>
          </div>
          <Button className="px-4 py-2 text-sm" onClick={() => setShowAdd(true)}>
            + Add Worker
          </Button>
        </motion.div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && workers.length === 0 && (
          <motion.div className="bg-surface rounded-2xl p-8 border border-white/5 text-center"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <p className="text-muted text-sm">No workers yet.</p>
            <p className="text-muted text-xs mt-1">Add your first team member to get started.</p>
          </motion.div>
        )}

        <div className="space-y-3">
          {workers.map((worker, i) => (
            <motion.div key={worker.id} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}
              onClick={() => setDrawerWorker(worker)}
              className="bg-surface rounded-2xl p-4 border border-white/5 hover:border-p0/20 transition-all cursor-pointer flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF6040, #FF5090)' }}>
                  {worker.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ftext">{worker.name}</p>
                  <p className="text-xs text-muted">{worker.role_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ProgressBarWithPct workerId={worker.id} />
                <span className="text-muted text-xs group-hover:text-p1 transition-colors">→</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <ProgressDrawer worker={drawerWorker} onClose={() => setDrawerWorker(null)} />

      <AnimatePresence>
        {showAdd && (
          <AddWorkerModal
            onClose={() => setShowAdd(false)}
            onSuccess={() => {
              setShowAdd(false)
              setToast({ msg: 'Worker added!', type: 'success' })
            }}
          />
        )}
      </AnimatePresence>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
