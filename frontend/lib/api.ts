import axios from 'axios'
import { useAuthStore } from './store'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearToken()
      await fetch('/api/auth/token', { method: 'DELETE' })
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
