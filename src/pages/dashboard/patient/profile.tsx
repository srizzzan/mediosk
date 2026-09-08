import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

export default function ProfilePage() {
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ fetch('/api/patient/profile').then(r=>r.json()).then(d=>{ setPatient(d.patient); setLoading(false) }) },[])

  async function save() {
    setSaving(true)
    await fetch('/api/patient/profile',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({ name: patient.name, dob: patient.dob, gender: patient.gender, preferredLanguage: patient.preferredLanguage })})
    setSaving(false)
  }

  if (loading) return <div className="container py-20">Loading...</div>

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>
      <div className="max-w-md space-y-4">
        <label className="block">
          <div className="text-sm mb-1">Name</div>
          <input className="w-full border p-2 rounded" value={patient?.user?.name || ''} onChange={e=>setPatient({...patient, user: {...patient.user, name: e.target.value}})} />
        </label>
        <label className="block">
          <div className="text-sm mb-1">Date of birth</div>
          <input type="date" className="w-full border p-2 rounded" value={patient?.dob ? new Date(patient.dob).toISOString().slice(0,10) : ''} onChange={e=>setPatient({...patient, dob: e.target.value})} />
        </label>
        <label className="block">
          <div className="text-sm mb-1">Gender</div>
          <select className="w-full border p-2 rounded" value={patient?.gender || ''} onChange={e=>setPatient({...patient, gender: e.target.value})}>
            <option value="">Select</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <div className="text-sm mb-1">Preferred language</div>
          <input className="w-full border p-2 rounded" value={patient?.preferredLanguage || ''} onChange={e=>setPatient({...patient, preferredLanguage: e.target.value})} />
        </label>

        <div>
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-sky-600 text-white rounded">{saving? 'Saving...':'Save'}</button>
        </div>
      </div>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  const role = (session as any).user?.role
  if (role !== 'PATIENT') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
