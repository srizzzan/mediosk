import { GetServerSideProps } from 'next'
import { requireRole } from '../../lib/auth'
import { useEffect, useState } from 'react'

export default function PatientDashboard() {
  const [consultations, setConsultations] = useState<any[]>([])
  useEffect(()=>{ fetch('/api/patient/consultations').then(r=>r.json()).then(d=>setConsultations(d.consultations||[])) },[])

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Patient Dashboard</h1>
      <div className="space-y-2">
        {consultations.map((c:any)=> (
          <div key={c.id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <div className="font-semibold">Dr. {c.doctor.user.name || c.doctor.user.email}</div>
              <div className="text-sm text-gray-600">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : 'No schedule'}</div>
            </div>
            <div>
              {(c.status === 'SCHEDULED' || c.status === 'IN_PROGRESS' || c.status === 'READY') && (
                <a href={`/dashboard/consultation/${c.id}`} className="px-3 py-2 bg-sky-600 text-white rounded">Join Consultation</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return requireRole(ctx, 'PATIENT')
}
