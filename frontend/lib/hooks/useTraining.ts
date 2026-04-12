import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface TrainingModule {
  id: string
  title: string
  type: 'quiz' | 'guide' | 'scenario' | 'video'
  content: Record<string, unknown>
  order: number
  completed: boolean
  score: number | null
}

export interface MyTrack {
  track_id: string
  title: string
  role_name: string
  total_modules: number
  completed_modules: number
  progress_pct: number
  modules: TrainingModule[]
}

export function useMyTrack() {
  return useQuery<MyTrack>({
    queryKey: ['training', 'my-track'],
    queryFn: () => api.get('/training/my-track').then((r) => r.data),
    staleTime: 10_000,
    retry: false,
  })
}

export function useCompleteModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ moduleId, score }: { moduleId: string; score?: number }) =>
      api.post(`/training/modules/${moduleId}/complete`, { score: score ?? null }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  })
}

export function useFlagModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (moduleId: string) =>
      api.post(`/training/modules/${moduleId}/flag`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training'] }),
  })
}
