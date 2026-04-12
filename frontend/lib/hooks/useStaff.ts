import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface WorkerSummary {
  id: string
  name: string
  email: string
  role_name: string
  business_id: string
  created_at: string
}

export interface TrackSummary {
  id: string
  title: string
  role_name: string
  description: string | null
  business_id: string
}

export interface ModuleSummary {
  id: string
  track_id: string
  type: string
  title: string
  content: Record<string, unknown>
  order: number
  flag_count: number
}

export interface WorkerProgressDetail {
  worker_id: string
  total_modules: number
  completed_modules: number
  progress_pct: number
  modules: Array<{
    module_id: string
    title: string
    type: string
    completed: boolean
    score: number | null
    flagged: boolean
    flag_count: number
  }>
}

export interface Template {
  industry: string
  role_key: string
  display_name: string
  module_count: number
}

export function useWorkers() {
  return useQuery<WorkerSummary[]>({
    queryKey: ['staff', 'workers'],
    queryFn: () => api.get('/staff/workers').then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useTracks() {
  return useQuery<TrackSummary[]>({
    queryKey: ['staff', 'tracks'],
    queryFn: () => api.get('/staff/tracks').then((r) => r.data),
    staleTime: 30_000,
  })
}

export function useTrackModules(trackId: string | null) {
  return useQuery<ModuleSummary[]>({
    queryKey: ['staff', 'modules', trackId],
    queryFn: () => api.get(`/staff/tracks/${trackId}/modules`).then((r) => r.data),
    enabled: !!trackId,
    staleTime: 15_000,
  })
}

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['staff', 'templates'],
    queryFn: () => api.get('/staff/templates').then((r) => r.data),
    staleTime: Infinity,
  })
}

export function useWorkerProgress(workerId: string | null) {
  return useQuery<WorkerProgressDetail>({
    queryKey: ['staff', 'progress', workerId],
    queryFn: () => api.get(`/staff/workers/${workerId}/progress`).then((r) => r.data),
    enabled: !!workerId,
    staleTime: 15_000,
  })
}

export function useCreateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; role_name: string; password: string }) =>
      api.post('/staff/workers', data).then((r) => r.data as WorkerSummary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', 'workers'] }),
  })
}

export function useCreateTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; role_name: string; description?: string }) =>
      api.post('/staff/tracks', data).then((r) => r.data as TrackSummary),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', 'tracks'] }),
  })
}

export function useLoadTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trackId, industry, role_key }: { trackId: string; industry: string; role_key: string }) =>
      api.post(`/staff/tracks/${trackId}/load-template`, { industry, role_key }).then((r) => r.data as ModuleSummary[]),
    onSuccess: (_data, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useGenerateTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trackId: string) =>
      api.post(`/staff/tracks/${trackId}/generate`).then((r) => r.data as ModuleSummary[]),
    onSuccess: (_data, trackId) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useAddModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      trackId,
      data,
    }: {
      trackId: string
      data: { type: string; title: string; content: Record<string, unknown>; order: number }
    }) => api.post(`/staff/tracks/${trackId}/modules`, data).then((r) => r.data as ModuleSummary),
    onSuccess: (_data, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useUpdateModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      moduleId,
      trackId,
      data,
    }: {
      moduleId: string
      trackId: string
      data: { type: string; title: string; content: Record<string, unknown>; order: number }
    }) => api.put(`/staff/modules/${moduleId}`, data).then((r) => r.data as ModuleSummary),
    onSuccess: (_data, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useDeleteModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ moduleId, trackId }: { moduleId: string; trackId: string }) =>
      api.delete(`/staff/modules/${moduleId}`),
    onSuccess: (_data, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useReorderModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ moduleId, trackId, order }: { moduleId: string; trackId: string; order: number }) =>
      api.patch(`/staff/modules/${moduleId}/reorder`, { order }).then((r) => r.data as ModuleSummary),
    onSuccess: (_data, { trackId }) =>
      qc.invalidateQueries({ queryKey: ['staff', 'modules', trackId] }),
  })
}

export function useAssignTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workerId, trackId }: { workerId: string; trackId: string }) =>
      api.post(`/staff/workers/${workerId}/assign`, { track_id: trackId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}
