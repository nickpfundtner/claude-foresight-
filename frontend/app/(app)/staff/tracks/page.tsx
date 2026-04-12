'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useTracks,
  useTrackModules,
  useTemplates,
  useCreateTrack,
  useLoadTemplate,
  useGenerateTrack,
  useAddModule,
  useUpdateModule,
  useDeleteModule,
  useReorderModule,
  type TrackSummary,
  type ModuleSummary,
} from '@/lib/hooks/useStaff'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
}

function ModuleTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = { quiz: '?', guide: '📄', scenario: '🎭', video: '▶' }
  return <span className="text-base w-6 text-center shrink-0">{icons[type] ?? '□'}</span>
}

function ModuleRow({
  module, index, total, trackId, onEdit,
}: {
  module: ModuleSummary; index: number; total: number; trackId: string; onEdit: (m: ModuleSummary) => void
}) {
  const deleteModule = useDeleteModule()
  const reorder = useReorderModule()

  return (
    <div className="bg-bg rounded-xl p-3 border border-white/5 flex items-center gap-3 group">
      <ModuleTypeIcon type={module.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ftext truncate">{module.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted capitalize">{module.type}</span>
          {module.flag_count > 0 && <span className="text-xs text-pd1">⚑ {module.flag_count} flagged</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {index > 0 && (
          <button className="p-1.5 text-muted hover:text-ftext transition-colors"
            onClick={() => reorder.mutate({ moduleId: module.id, trackId, order: module.order - 1 })}>↑</button>
        )}
        {index < total - 1 && (
          <button className="p-1.5 text-muted hover:text-ftext transition-colors"
            onClick={() => reorder.mutate({ moduleId: module.id, trackId, order: module.order + 1 })}>↓</button>
        )}
        <button className="p-1.5 text-muted hover:text-p1 transition-colors text-xs" onClick={() => onEdit(module)}>Edit</button>
        <button className="p-1.5 text-muted hover:text-pd1 transition-colors text-xs"
          onClick={() => { if (confirm(`Delete "${module.title}"?`)) deleteModule.mutate({ moduleId: module.id, trackId }) }}>✕</button>
      </div>
    </div>
  )
}

function AddModuleForm({ trackId, onDone, editing }: { trackId: string; onDone: () => void; editing: ModuleSummary | null }) {
  const addModule = useAddModule()
  const updateModule = useUpdateModule()
  const [type, setType] = useState(editing?.type ?? 'guide')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [contentText, setContentText] = useState(editing ? JSON.stringify(editing.content, null, 2) : '')
  const [error, setError] = useState('')

  const TYPES = ['quiz', 'guide', 'scenario', 'video']
  const defaultContent: Record<string, object> = {
    guide: { text: '' },
    quiz: { questions: [{ question: '', options: ['', '', ''], correct_index: 0 }] },
    scenario: { situation: '', options: ['', '', ''], best_index: 0, explanation: '' },
    video: { url: '', caption: '' },
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let content: Record<string, unknown>
    try {
      content = contentText ? JSON.parse(contentText) : defaultContent[type]
    } catch {
      setError('Content must be valid JSON')
      return
    }
    try {
      if (editing) {
        await updateModule.mutateAsync({ moduleId: editing.id, trackId, data: { type, title, content, order: editing.order } })
      } else {
        await addModule.mutateAsync({ trackId, data: { type, title, content, order: 0 } })
      }
      sounds.success()
      onDone()
    } catch {
      setError('Failed to save module')
      sounds.error()
    }
  }

  const inputClass = 'w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 transition-all'

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-5 border border-p0/20 space-y-3">
      <p className="text-sm font-semibold text-p1">{editing ? 'Edit Module' : 'New Module'}</p>
      <div className="flex gap-2">
        {TYPES.map((t) => (
          <button key={t} type="button"
            onClick={() => { setType(t); if (!editing) setContentText(JSON.stringify(defaultContent[t], null, 2)) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${type === t ? 'bg-p0/20 text-p1 border border-p0/30' : 'text-muted border border-white/10 hover:text-ftext'}`}>
            {t}
          </button>
        ))}
      </div>
      <input className={inputClass} placeholder="Module title" value={title}
        onChange={(e) => setTitle(e.target.value)} required />
      <textarea className={inputClass + ' h-36 font-mono text-xs resize-none'}
        placeholder={`Content JSON — e.g. ${JSON.stringify(defaultContent[type])}`}
        value={contentText} onChange={(e) => setContentText(e.target.value)} />
      {error && <p className="text-pd1 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1 py-2 text-sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" className="flex-1 py-2 text-sm" disabled={addModule.isPending || updateModule.isPending}>
          {editing ? 'Save' : 'Add Module'}
        </Button>
      </div>
    </form>
  )
}

function TemplatePickerModal({ trackId, onClose, onLoaded }: { trackId: string; onClose: () => void; onLoaded: () => void }) {
  const { data: templates = [] } = useTemplates()
  const loadTemplate = useLoadTemplate()
  const [selected, setSelected] = useState('')

  const byIndustry = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    if (!acc[t.industry]) acc[t.industry] = []
    acc[t.industry].push(t)
    return acc
  }, {})

  async function handleLoad() {
    const tpl = templates.find((t) => `${t.industry}:${t.role_key}` === selected)
    if (!tpl) return
    await loadTemplate.mutateAsync({ trackId, industry: tpl.industry, role_key: tpl.role_key })
    sounds.success()
    onLoaded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div className="relative bg-surface rounded-2xl p-6 w-full max-w-sm border border-white/5 shadow-2xl space-y-4"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <h2 className="font-bold text-ftext">Use a Template</h2>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Object.entries(byIndustry).map(([industry, tpls]) => (
            <div key={industry}>
              <p className="text-xs text-muted uppercase tracking-wider mb-1.5 capitalize">{industry}</p>
              {tpls.map((t) => {
                const key = `${t.industry}:${t.role_key}`
                return (
                  <button key={key} onClick={() => setSelected(key)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all mb-1 ${selected === key ? 'bg-p0/20 text-p1 border border-p0/30' : 'text-ftext hover:bg-white/5 border border-transparent'}`}>
                    {t.display_name}
                    <span className="text-xs text-muted ml-2">({t.module_count} modules)</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 py-2 text-sm" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 py-2 text-sm" disabled={!selected || loadTemplate.isPending} onClick={handleLoad}>
            {loadTemplate.isPending ? 'Loading…' : 'Load Template'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

function TrackEditor({ track, onBack }: { track: TrackSummary; onBack: () => void }) {
  const { data: modules = [], isLoading } = useTrackModules(track.id)
  const generateTrack = useGenerateTrack()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingModule, setEditingModule] = useState<ModuleSummary | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function handleGenerate() {
    try {
      await generateTrack.mutateAsync(track.id)
      sounds.success()
      setToast({ msg: 'Starter kit generated!', type: 'success' })
    } catch {
      setToast({ msg: 'Generation failed — try again', type: 'error' })
      sounds.error()
    }
  }

  const isEmpty = !isLoading && modules.length === 0

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ftext text-sm transition-colors">← Tracks</button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-ftext">{track.title}</h2>
          <p className="text-xs text-muted">{track.role_name}</p>
        </div>
        {!isEmpty && (
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setShowAddForm(true)}>+ Add Module</Button>
        )}
      </div>

      {isEmpty && !generateTrack.isPending && (
        <motion.div className="bg-surface rounded-2xl p-8 border border-white/5 text-center space-y-6"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted text-sm">This track has no modules yet.</p>
          <div className="flex gap-3 justify-center">
            <Button className="px-4 py-2.5 text-sm" onClick={handleGenerate}>⚡ Generate with AI</Button>
            <Button variant="ghost" className="px-4 py-2.5 text-sm" onClick={() => setShowTemplatePicker(true)}>Use a Template</Button>
          </div>
          <p className="text-xs text-muted">Or</p>
          <button className="text-xs text-p1 hover:underline" onClick={() => setShowAddForm(true)}>Add a module manually</button>
        </motion.div>
      )}

      {generateTrack.isPending && (
        <div className="space-y-3">
          <p className="text-xs text-muted animate-pulse">Generating starter kit…</p>
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface rounded-xl animate-pulse border border-white/5" />)}
        </div>
      )}

      {!isEmpty && (
        <div className="space-y-2">
          {modules.map((m, i) => (
            <ModuleRow key={m.id} module={m} index={i} total={modules.length} trackId={track.id}
              onEdit={(mod) => { setEditingModule(mod); setShowAddForm(true) }} />
          ))}
        </div>
      )}

      {showAddForm && (
        <AddModuleForm trackId={track.id} onDone={() => { setShowAddForm(false); setEditingModule(null) }} editing={editingModule} />
      )}

      <AnimatePresence>
        {showTemplatePicker && (
          <TemplatePickerModal trackId={track.id} onClose={() => setShowTemplatePicker(false)} onLoaded={() => setShowTemplatePicker(false)} />
        )}
      </AnimatePresence>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function NewTrackModal({ onClose, onCreated }: { onClose: () => void; onCreated: (track: TrackSummary) => void }) {
  const createTrack = useCreateTrack()
  const [form, setForm] = useState({ title: '', role_name: '', description: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const track = await createTrack.mutateAsync({ title: form.title, role_name: form.role_name, description: form.description || undefined })
      sounds.success()
      onCreated(track)
    } catch {
      setError('Failed to create track')
      sounds.error()
    }
  }

  const inputClass = 'w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 transition-all'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div className="relative bg-surface rounded-2xl p-6 w-full max-w-sm border border-white/5 shadow-2xl"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <h2 className="font-bold text-ftext mb-5">New Training Track</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className={inputClass} placeholder="Track title (e.g. Server Training)" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className={inputClass} placeholder="Role name (e.g. Server)" value={form.role_name}
            onChange={(e) => setForm({ ...form, role_name: e.target.value })} required />
          <input className={inputClass} placeholder="Description (optional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <p className="text-pd1 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1 py-2.5 text-sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 py-2.5 text-sm" disabled={createTrack.isPending}>
              {createTrack.isPending ? 'Creating…' : 'Create Track'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function TracksPage() {
  const { data: tracks = [], isLoading } = useTracks()
  const [openTrack, setOpenTrack] = useState<TrackSummary | null>(null)
  const [showNew, setShowNew] = useState(false)

  if (openTrack) {
    return <TrackEditor track={openTrack} onBack={() => setOpenTrack(null)} />
  }

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        <motion.div className="flex items-center justify-between"
          variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <div>
            <h1 className="text-2xl font-black text-ftext">Training Tracks</h1>
            <p className="text-sm text-muted mt-0.5">Build and manage role-specific training content</p>
          </div>
          <Button className="px-4 py-2 text-sm" onClick={() => setShowNew(true)}>+ New Track</Button>
        </motion.div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-surface rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && tracks.length === 0 && (
          <motion.div className="bg-surface rounded-2xl p-8 border border-white/5 text-center"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <p className="text-muted text-sm">No training tracks yet.</p>
            <p className="text-muted text-xs mt-1">Create a track to start building your team&apos;s training.</p>
          </motion.div>
        )}

        <div className="space-y-3">
          {tracks.map((track, i) => (
            <motion.div key={track.id} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}
              onClick={() => setOpenTrack(track)}
              className="bg-surface rounded-2xl p-5 border border-white/5 hover:border-p0/20 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ftext">{track.title}</p>
                  <p className="text-xs text-muted mt-0.5">{track.role_name}</p>
                  {track.description && <p className="text-xs text-muted mt-1 line-clamp-1">{track.description}</p>}
                </div>
                <span className="text-muted text-sm group-hover:text-p1 transition-colors">→</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showNew && (
          <NewTrackModal onClose={() => setShowNew(false)}
            onCreated={(track) => { setShowNew(false); setOpenTrack(track) }} />
        )}
      </AnimatePresence>
    </>
  )
}
