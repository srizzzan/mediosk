import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'

export default function DocumentsPage(){
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState('')

  useEffect(()=>{ fetch('/api/patient/documents').then(r=>r.json()).then(d=>{ setDocs(d.documents); setLoading(false) }) },[])

  async function upload(){
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('category', category)
    fd.append('documentDate', date)
    const res = await fetch('/api/patient/documents',{method:'POST',body:fd})
    const data = await res.json()
    setDocs(prev=>[data.document,...prev])
  }

  async function remove(id:string){
    if (!confirm('Delete document?')) return
    await fetch(`/api/patient/documents/${id}`,{method:'DELETE'})
    setDocs(prev=>prev.filter(d=>d.id!==id))
  }

  if (loading) return <div className="container py-20">Loading...</div>

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Your Documents</h1>

      <div className="max-w-md border rounded p-4 mb-6">
        <div className="mb-2">
          <input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} />
        </div>
        <div className="mb-2"><input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div className="mb-2"><input placeholder="Category" value={category} onChange={e=>setCategory(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div className="mb-2"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full border p-2 rounded" /></div>
        <div><button onClick={upload} className="px-3 py-2 bg-sky-600 text-white rounded">Upload</button></div>
      </div>

      <div className="space-y-3">
        {docs.map(d=> (
          <div key={d.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{d.title}</div>
              <div className="text-sm text-slate-600">{d.category} • {d.documentDate ? new Date(d.documentDate).toLocaleDateString() : new Date(d.uploadedAt).toLocaleDateString()}</div>
            </div>
            <div className="space-x-2">
              <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-600">View</a>
              <button onClick={()=>remove(d.id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

export async function getServerSideProps(ctx:any){
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  const role = (session as any).user?.role
  if (role !== 'PATIENT') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
