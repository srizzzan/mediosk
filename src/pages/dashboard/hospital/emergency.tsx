import { useEffect, useState } from 'react'
import { getSession } from 'next-auth/react'

export default function HospitalEmergencyDashboard(){
  const [alerts, setAlerts] = useState<any[]>([])

  async function load(){
    const res = await fetch('/api/hospital/emergency')
    const j = await res.json()
    setAlerts(j.alerts||[])
  }

  useEffect(()=>{ load() },[])

  async function acknowledge(id:string){
    await fetch(`/api/hospital/emergency/${id}/acknowledge`,{method:'POST'})
    await load()
  }

  async function resolveAlert(id:string, action='RESOLVE'){
    await fetch(`/api/hospital/emergency/${id}/resolve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ action: action==='CANCEL' ? 'CANCEL' : 'RESOLVE' })})
    await load()
  }

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Hospital Emergency Dashboard</h1>
      <div className="space-y-3">
        {alerts.map(a=> (
          <div key={a.id} className="p-3 border rounded">
            <div className="font-semibold">{a.severity} — {a.status}</div>
            <div className="text-sm">Patient: {a.patient?.user?.name || a.patient?.user?.email}</div>
            <div className="text-sm">Reason: {a.reason}</div>
            <div className="text-sm">Created: {new Date(a.createdAt).toLocaleString()}</div>
            <div className="mt-2">
              {a.status === 'OPEN' && <button onClick={()=>acknowledge(a.id)} className="px-3 py-2 bg-yellow-500 text-white rounded mr-2">Acknowledge</button>}
              {a.status !== 'RESOLVED' && <button onClick={()=>resolveAlert(a.id,'RESOLVE')} className="px-3 py-2 bg-green-600 text-white rounded mr-2">Resolve</button>}
              {a.status !== 'CANCELLED' && <button onClick={()=>resolveAlert(a.id,'CANCEL')} className="px-3 py-2 border rounded">Cancel</button>}
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
  if (role !== 'HOSPITAL') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
