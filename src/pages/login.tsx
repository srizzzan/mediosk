import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', { redirect: false, email, password })
    setLoading(false)
    if (res?.error) setError(res.error)
    if (res?.ok) window.location.href = '/dashboard'
  }

  return (
    <main className="container py-20 max-w-md">
      <h2 className="text-2xl font-semibold mb-4">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={loading} className="px-4 py-2 bg-sky-600 text-white rounded">{loading? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  )
}
