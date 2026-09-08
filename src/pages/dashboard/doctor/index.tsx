import Link from 'next/link'
import { getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function DoctorDashboard(){
  const [consultations, setConsultations] = useState<any[]>([])
  useEffect(()=>{ fetch('/api/doctor/queue').then(r=>r.json()).then(d=>setConsultations(d.consultations||[])) },[])

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Todays Consultations</h1>
      <div className="space-y-2">
        {consultations.map((c:any)=> (
          <div key={c.id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <div className="font-semibold">{c.patient.user.name || c.patient.user.email}</div>
              <div className="text-sm text-gray-600">{c.session?.complaint || 'No pre-consult complaint'}</div>
            </div>
            <div className="space-x-2">
              <Link href={`/dashboard/doctor/case/${c.id}`} className="px-3 py-2 bg-sky-600 text-white rounded">Open Case</Link>
              {(c.status === 'SCHEDULED' || c.status === 'IN_PROGRESS' || c.status === 'READY') && (
                <Link href={`/dashboard/consultation/${c.id}`} className="px-3 py-2 border rounded">Join Consultation</Link>
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
  if (role !== 'DOCTOR') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
