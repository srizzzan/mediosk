import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'

export default function SummaryPage(){
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(()=>{ fetch('/api/patient/summary').then(r=>r.json()).then(d=>{ setItems(d.summaries); setLoading(false) }) },[])

  async function create(){
    setCreating(true)
    // by default summarize all documents
    const res = await fetch('/api/patient/summary',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ sourceRefs: { documents: [] } })})
    const data = await res.json()
    setItems(prev=>[data.summary,...prev])
    setCreating(false)
  }

  if (loading) return <div className="container py-20">Loading...</div>

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Medical History Summaries</h1>
      <div className="mb-4"><button onClick={create} disabled={creating} className="px-3 py-2 bg-sky-600 text-white rounded">{creating? 'Creating...':'Create Summary'}</button></div>
      <div className="space-y-4">
        {items.map(s=> (
          <div key={s.id} className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Summary — {s.status}</div>
                <div className="text-sm text-slate-600">Created: {new Date(s.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-3">
              {s.status === 'PENDING' && <div className="text-sm text-slate-500">Processing...</div>}
              {s.status === 'PROCESSING' && <div className="text-sm text-slate-500">Processing...</div>}
              {s.status === 'FAILED' && <div className="text-sm text-red-600">Failed: {s.note}</div>}
              {s.status === 'COMPLETED' && (
                <div>
                  <h3 className="font-semibold mt-2">Patient-friendly</h3>
                  <div className="p-3 bg-white border rounded text-slate-800">AI Generated — Patient View (Doctor verification required)<br/><pre className="whitespace-pre-wrap">{s.patientSummary}</pre></div>
                  <h3 className="font-semibold mt-3">Doctor-facing (structured)</h3>
                  <div className="p-3 bg-white border rounded text-slate-800">AI Generated — Doctor Verification Required<br/><pre className="whitespace-pre-wrap">{JSON.stringify(s.doctorSummary, null, 2)}</pre></div>
                </div>
              )}
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
