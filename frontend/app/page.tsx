import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function RootPage() {
  const token = cookies().get('foresight_token')?.value
  redirect(token ? '/dashboard' : '/login')
}
