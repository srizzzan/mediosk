import Link from 'next/link'

export default function Home() {
  return (
    <main className="container py-20">
      <h1 className="text-3xl font-semibold mb-4">SIH 2026 — Patient Case-Taking Platform</h1>
      <p className="text-slate-600 mb-6">Foundation scaffold with auth, roles, Prisma schema and Tailwind UI.</p>

      <div className="space-x-3">
        <Link href="/login" className="px-4 py-2 bg-sky-600 text-white rounded">Login</Link>
      </div>
    </main>
  )
}
