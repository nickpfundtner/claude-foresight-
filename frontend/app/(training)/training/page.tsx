'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/store'
import {
  useMyTrack,
  useCompleteModule,
  useFlagModule,
  type TrainingModule,
} from '@/lib/hooks/useTraining'
import { sounds } from '@/lib/sound'
import { useRouter } from 'next/navigation'

function FlagButton({ moduleId, onFlagged }: { moduleId: string; onFlagged: () => void }) {
  const flagModule = useFlagModule()
  const [done, setDone] = useState(false)

  async function handleFlag() {
    if (done) return
    await flagModule.mutateAsync(moduleId)
    setDone(true)
    onFlagged()
    sounds.error()
  }

  return (
    <button onClick={handleFlag} disabled={done || flagModule.isPending}
      className={`mt-4 text-xs transition-colors ${done ? 'text-muted cursor-default' : 'text-muted hover:text-pd1'}`}>
      {done ? '✓ Got it — your manager will take a look' : "I didn't get this"}
    </button>
  )
}

function GuideViewer({ module, onComplete }: { module: TrainingModule; onComplete: () => void }) {
  const completeModule = useCompleteModule()
  const content = module.content as { text: string }

  async function handleComplete() {
    await completeModule.mutateAsync({ moduleId: module.id })
    sounds.success()
    onComplete()
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl p-6 border border-white/5 leading-relaxed text-ftext text-sm"
        style={{ whiteSpace: 'pre-wrap' }}>
        {content.text}
      </div>
      <div className="flex flex-col items-center gap-2">
        <button onClick={handleComplete} disabled={completeModule.isPending || module.completed}
          className="px-8 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 text-white"
          style={{ background: module.completed ? 'rgba(255,96,64,0.15)' : 'linear-gradient(135deg, #FF6040, #FF5090)' }}>
          {module.completed ? '✓ Marked as Read' : 'Mark as Read'}
        </button>
        <FlagButton moduleId={module.id} onFlagged={() => {}} />
      </div>
    </div>
  )
}

function ScenarioViewer({ module, onComplete }: { module: TrainingModule; onComplete: () => void }) {
  const completeModule = useCompleteModule()
  const content = module.content as { situation: string; options: string[]; best_index: number; explanation: string }
  const [picked, setPicked] = useState<number | null>(null)
  const revealed = picked !== null

  async function handlePick(i: number) {
    if (revealed) return
    setPicked(i)
    await completeModule.mutateAsync({ moduleId: module.id })
    if (i === content.best_index) sounds.success()
    else sounds.error()
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-2xl p-5 border border-white/5">
        <p className="text-sm text-ftext leading-relaxed">{content.situation}</p>
      </div>
      <div className="space-y-2">
        {content.options.map((opt, i) => {
          const isBest = i === content.best_index
          const isPicked = i === picked
          const getStyle = () => {
            if (!revealed) return 'border-white/10 hover:border-p0/40 hover:bg-p0/5 cursor-pointer'
            if (isBest) return 'border-[#40FF80]/40 bg-[#40FF80]/10 text-[#40FF80]'
            if (isPicked && !isBest) return 'border-pd1/40 bg-pd1/10 text-pd1'
            return 'border-white/5 opacity-40'
          }
          return (
            <button key={i} onClick={() => handlePick(i)} disabled={revealed}
              className={`w-full text-left p-4 rounded-xl border transition-all text-sm ${getStyle()}`}>
              {opt}
              {revealed && isBest && <span className="ml-2 text-xs">← best response</span>}
            </button>
          )
        })}
      </div>
      {revealed && (
        <motion.div className="bg-surface rounded-xl p-4 border border-p0/20 text-sm text-ftext"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs text-p2 font-semibold mb-1">Why this works</p>
          {content.explanation}
        </motion.div>
      )}
      {revealed && (
        <div className="flex flex-col items-center">
          <button onClick={onComplete} className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6040, #FF5090)' }}>
            Continue →
          </button>
          <FlagButton moduleId={module.id} onFlagged={() => {}} />
        </div>
      )}
    </div>
  )
}

function QuizViewer({ module, onComplete }: { module: TrainingModule; onComplete: () => void }) {
  const completeModule = useCompleteModule()
  const content = module.content as { questions: Array<{ question: string; options: string[]; correct_index: number }> }
  const questions = content.questions ?? []
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null))
  const [submitted, setSubmitted] = useState<boolean[]>(questions.map(() => false))

  const current = questions[qIndex]
  const isLast = qIndex === questions.length - 1

  async function handleAnswer(optIndex: number) {
    if (submitted[qIndex]) return
    const next = [...answers]; next[qIndex] = optIndex; setAnswers(next)
    const nextSub = [...submitted]; nextSub[qIndex] = true; setSubmitted(nextSub)
    if (optIndex === current.correct_index) sounds.success(); else sounds.error()
  }

  async function handleNext() {
    if (isLast) {
      const correct = answers.filter((a, i) => a === questions[i].correct_index).length
      const score = Math.round((correct / questions.length) * 100)
      await completeModule.mutateAsync({ moduleId: module.id, score })
      onComplete()
    } else {
      setQIndex(qIndex + 1)
    }
  }

  if (!current) return null

  return (
    <div className="space-y-5">
      <div className="flex justify-between text-xs text-muted">
        <span>Question {qIndex + 1} of {questions.length}</span>
        <span>{answers.filter(Boolean).length} answered</span>
      </div>
      <div className="bg-surface rounded-2xl p-5 border border-white/5">
        <p className="text-sm font-medium text-ftext">{current.question}</p>
      </div>
      <div className="space-y-2">
        {current.options.map((opt, i) => {
          const isAnswered = submitted[qIndex]
          const isCorrect = i === current.correct_index
          const isPicked = answers[qIndex] === i
          const getStyle = () => {
            if (!isAnswered) return 'border-white/10 hover:border-p0/40 hover:bg-p0/5 cursor-pointer'
            if (isCorrect) return 'border-[#40FF80]/40 bg-[#40FF80]/10 text-[#40FF80]'
            if (isPicked) return 'border-pd1/40 bg-pd1/10 text-pd1'
            return 'border-white/5 opacity-40'
          }
          return (
            <button key={i} onClick={() => handleAnswer(i)} disabled={isAnswered}
              className={`w-full text-left p-4 rounded-xl border transition-all text-sm ${getStyle()}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {submitted[qIndex] && (
        <motion.div className="flex flex-col items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button onClick={handleNext} className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6040, #FF5090)' }}>
            {isLast ? 'Finish Quiz →' : 'Next Question →'}
          </button>
          <FlagButton moduleId={module.id} onFlagged={() => {}} />
        </motion.div>
      )}
    </div>
  )
}

function VideoViewer({ module, onComplete }: { module: TrainingModule; onComplete: () => void }) {
  const completeModule = useCompleteModule()
  const content = module.content as { url: string; caption: string }

  async function handleComplete() {
    await completeModule.mutateAsync({ moduleId: module.id })
    sounds.success()
    onComplete()
  }

  return (
    <div className="space-y-5">
      <div className="bg-surface rounded-2xl overflow-hidden border border-white/5 aspect-video">
        <iframe src={content.url} className="w-full h-full" allowFullScreen title={module.title} />
      </div>
      {content.caption && <p className="text-xs text-muted text-center">{content.caption}</p>}
      <div className="flex flex-col items-center gap-2">
        <button onClick={handleComplete} disabled={completeModule.isPending || module.completed}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: module.completed ? 'rgba(255,96,64,0.15)' : 'linear-gradient(135deg, #FF6040, #FF5090)' }}>
          {module.completed ? '✓ Marked as Watched' : 'Mark as Watched'}
        </button>
        <FlagButton moduleId={module.id} onFlagged={() => {}} />
      </div>
    </div>
  )
}

function ModuleViewer({ module, onBack, onComplete }: { module: TrainingModule; onBack: () => void; onComplete: () => void }) {
  return (
    <motion.div className="max-w-lg mx-auto space-y-5 px-4 pb-16 pt-8"
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-muted hover:text-ftext text-sm transition-colors">←</button>
        <div>
          <h2 className="font-bold text-ftext text-sm">{module.title}</h2>
          <p className="text-xs text-muted capitalize">{module.type}</p>
        </div>
      </div>
      {module.type === 'guide' && <GuideViewer module={module} onComplete={onComplete} />}
      {module.type === 'quiz' && <QuizViewer module={module} onComplete={onComplete} />}
      {module.type === 'scenario' && <ScenarioViewer module={module} onComplete={onComplete} />}
      {module.type === 'video' && <VideoViewer module={module} onComplete={onComplete} />}
    </motion.div>
  )
}

function CompletionScreen({ name, roleName }: { name: string; roleName: string }) {
  const router = useRouter()
  const clearToken = useAuthStore((s) => s.clearToken)

  async function handleLogout() {
    clearToken()
    await fetch('/api/auth/token', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <motion.div className="min-h-screen flex flex-col items-center justify-center text-center px-6 space-y-6"
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
      <motion.div className="text-7xl" initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}>
        🎉
      </motion.div>
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-p0">You&apos;re ready!</h1>
        <p className="text-lg text-ftext font-medium">{name}</p>
        <p className="text-muted text-sm">{roleName} — training complete</p>
      </div>
      <p className="text-sm text-muted max-w-xs leading-relaxed">
        You&apos;ve completed all your training modules. You&apos;re set — go show them what you&apos;ve got.
      </p>
      <button onClick={handleLogout} className="text-xs text-muted hover:text-ftext transition-colors mt-8">Sign out</button>
    </motion.div>
  )
}

type View = 'list' | 'module' | 'complete'

export default function TrainingPage() {
  const router = useRouter()
  const { data: track, isLoading, error } = useMyTrack()
  const userName = useAuthStore((s) => s.userName)
  const userRoleName = useAuthStore((s) => s.userRoleName)
  const clearToken = useAuthStore((s) => s.clearToken)
  const [view, setView] = useState<View>('list')
  const [activeModule, setActiveModule] = useState<TrainingModule | null>(null)

  async function handleLogout() {
    clearToken()
    await fetch('/api/auth/token', { method: 'DELETE' })
    router.push('/login')
  }

  function handleModuleComplete() {
    if (!track) return
    const allCompleted = track.modules.every((m) => m.completed || m.id === activeModule?.id)
    if (allCompleted) {
      setView('complete')
      sounds.success()
    } else {
      setView('list')
    }
    setActiveModule(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-80">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-surface rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !track) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-ftext font-semibold">No training track assigned yet.</p>
        <p className="text-muted text-sm">Ask your manager to assign you to a training track.</p>
        <button onClick={handleLogout} className="text-xs text-muted hover:text-ftext transition-colors mt-4">Sign out</button>
      </div>
    )
  }

  if (view === 'complete') {
    return <CompletionScreen name={userName ?? 'You'} roleName={userRoleName ?? track.role_name} />
  }

  if (view === 'module' && activeModule) {
    return (
      <AnimatePresence mode="wait">
        <ModuleViewer key={activeModule.id} module={activeModule}
          onBack={() => { setView('list'); setActiveModule(null) }}
          onComplete={handleModuleComplete} />
      </AnimatePresence>
    )
  }

  const progress = track.progress_pct
  const progressMsg = progress === 0 ? "Let's get started" : progress === 100 ? 'All done!' : `${track.completed_modules} of ${track.total_modules} complete`

  return (
    <motion.div className="max-w-lg mx-auto px-4 pb-16 pt-10 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-1">
        <p className="text-xs text-muted">Welcome back,</p>
        <h1 className="text-2xl font-black text-ftext">{userName ?? 'there'}</h1>
        <p className="text-sm text-muted">{userRoleName ?? track.role_name}</p>
      </div>
      <div className="bg-surface rounded-2xl p-5 border border-white/5 space-y-3">
        <div className="flex justify-between text-xs text-muted">
          <span>{progressMsg}</span>
          <span className="font-mono">{progress}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #FF6040, #FF5090)' }}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
        </div>
        <p className="text-xs text-muted">{track.title}</p>
      </div>
      <div className="space-y-2">
        {track.modules.map((m, i) => {
          const isNext = !m.completed && track.modules.slice(0, i).every((prev) => prev.completed)
          return (
            <motion.button key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} onClick={() => { setActiveModule(m); setView('module') }}
              className={`w-full text-left bg-surface rounded-2xl p-4 border transition-all flex items-center gap-3 ${isNext ? 'border-p0/30 hover:border-p0/60' : 'border-white/5 hover:border-white/10'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${m.completed ? 'bg-[#40FF80]/20 text-[#40FF80]' : isNext ? 'bg-p0/20 text-p1' : 'bg-white/5 text-muted'}`}>
                {m.completed ? '✓' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${m.completed ? 'text-muted' : 'text-ftext'}`}>{m.title}</p>
                <p className="text-xs text-muted capitalize">{m.type}</p>
              </div>
              {isNext && <span className="text-xs text-p1 shrink-0">Start →</span>}
            </motion.button>
          )
        })}
      </div>
      <div className="text-center pt-4">
        <button onClick={handleLogout} className="text-xs text-muted hover:text-ftext transition-colors">Sign out</button>
      </div>
    </motion.div>
  )
}
