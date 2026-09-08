import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'

const ENTRY_TYPES = [
  { value: 'DIAGNOSIS', label: 'Diagnosis' },
  { value: 'MEDICINE', label: 'Medicine' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'FINDING', label: 'Important finding' }
]

export default function TimelinePage(){
  const [entries, setEntries] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ title: '', details: '', entryType: 'DIAGNOSIS', date: '', sourceDocumentId: '' })

  useEffect(()=>{
    Promise.all([fetch('/api/patient/timeline').then(r=>r.json()), fetch('/api/patient/documents').then(r=>r.json())])
    .then(([te, dd])=>{ setEntries(te.entries); setDocs(dd.documents); setLoading(false) })
  },[])

  async function submit(){
    const res = await fetch('/api/patient/timeline',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ ...form })})
    const data = await res.json()
    setEntries(prev=>[data.entry,...prev])
  }

  async function remove(id:string){
    if (!confirm('Delete timeline entry?')) return
    await fetch(`/api/patient/timeline/${id}`,{method:'DELETE'})
    setEntries(prev=>prev.filter(e=>e.id!==id))
  }

  if (loading) return <div className="container py-20">Loading...</div>

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Medical Timeline</h1>

      <div className="max-w-xl border rounded p-4 mb-6">
        <div className="mb-2"><input placeholder="Title" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full border p-2 rounded" /></div>
        <div className="mb-2"><textarea placeholder="Details" value={form.details} onChange={e=>setForm({...form, details: e.target.value})} className="w-full border p-2 rounded" /></div>
        <div className="mb-2 flex gap-2">
          <select value={form.entryType} onChange={e=>setForm({...form, entryType: e.target.value})} className="border p-2 rounded">
            {ENTRY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="border p-2 rounded" />
        </div>
        <div className="mb-2">
          <select value={form.sourceDocumentId} onChange={e=>setForm({...form, sourceDocumentId: e.target.value})} className="w-full border p-2 rounded">
            <option value=''>No source document</option>
            {docs.map(d=><option key={d.id} value={d.id}>{d.title} — {d.documentDate ? new Date(d.documentDate).toLocaleDateString() : new Date(d.uploadedAt).toLocaleDateString()}</option>)}
          </select>
        </div>
        <div><button onClick={submit} className="px-3 py-2 bg-sky-600 text-white rounded">Add Entry</button></div>
      </div>

      <div className="space-y-4">
        {entries.map(e=> (
          <div key={e.id} className="border rounded p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-slate-600">{e.entryType} • {new Date(e.date).toLocaleDateString()}</div>
              </div>
              <div className="space-x-2">
                {e.sourceDocument && <a href={e.sourceDocument.url} target="_blank" rel="noreferrer" className="text-sky-600">Open Source</a>}
                <button onClick={()=>remove(e.id)} className="text-red-600">Delete</button>
              </div>
            </div>
            {e.details && <div className="mt-2 text-slate-700">{e.details}</div>}
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
