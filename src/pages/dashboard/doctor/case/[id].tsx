import { useRouter } from 'next/router'
import { getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function CaseSheet(){
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState<any>(null)
  const [ayush, setAyush] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  useEffect(()=>{ if (id) fetch(`/api/doctor/case/${id}`).then(r=>r.json()).then(d=>setData(d)) },[id])
  useEffect(()=>{ if (id) fetch(`/api/doctor/ayush/${id}`).then(r=>r.json()).then(d=>{ setAyush(d.ayush); setForm(d.ayush||{}) }) },[id])
  const caseData = data?.consultation

  async function verify(targetType:string, targetId:string, status:string){
    await fetch(`/api/doctor/case/${id}/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ targetType, targetId, status })})
    alert('Verified')
  }

  if (!caseData) return <div className="container py-8">Loading...</div>

  const patient = caseData.patient
  const session = caseData.session


  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Case: {patient.user.name || patient.user.email}</h1>
      <div className="mb-4">
        {(caseData.status === 'SCHEDULED' || caseData.status === 'IN_PROGRESS' || caseData.status === 'READY') && (
          <a href={`/dashboard/consultation/${caseData.id}`} className="px-3 py-2 bg-sky-600 text-white rounded">Join Consultation</a>
        )}
      </div>
      <section className="mb-4">
        <h2 className="font-semibold">Patient Information</h2>
        <div>DOB: {patient.dob}</div>
        <div>Gender: {patient.gender}</div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Pre-Consultation / Symptom Report</h2>
        <div>{session?.complaint}</div>
        <div className="mt-2">
          {session?.report ? (
            <div className="p-3 border rounded">
              <div>Chief Complaint: {session.report.chiefComplaint}</div>
              <div>Onset: {session.report.onsetDuration}</div>
              <div>Location: {session.report.location}</div>
              <div>Severity: {session.report.severity}</div>
              <button onClick={()=>verify('PRECONSULTATION_REPORT', session.report.id, 'REVIEWED')} className="mt-2 px-3 py-2 bg-yellow-500 text-white rounded">Mark Reviewed</button>
              <button onClick={()=>verify('PRECONSULTATION_REPORT', session.report.id, 'VERIFIED')} className="mt-2 ml-2 px-3 py-2 bg-green-600 text-white rounded">Mark Verified</button>
            </div>
          ) : (
            <div>No final report yet.</div>
          )}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">AI Medical Summaries</h2>
        <div className="space-y-2">
          {data.summaries?.map((s:any)=> (
            <div key={s.id} className="p-3 border rounded">
              <div>Version: {s.version} — {s.status}</div>
              <div>Patient Summary: {s.patientSummary}</div>
              <button onClick={()=>verify('MEDICAL_SUMMARY', s.id, 'REVIEWED')} className="mt-2 px-3 py-2 bg-yellow-500 text-white rounded">Mark Reviewed</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Medical Timeline</h2>
        <div className="space-y-2">
          {data.timelines?.map((t:any)=> (
            <div key={t.id} className="p-2 border rounded">
              <div className="font-semibold">{t.title} — {t.entryType}</div>
              <div className="text-sm">{t.details}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">Documents & Extractions</h2>
        <div className="space-y-2">
          {data.documents?.map((d:any)=> (
            <div key={d.id} className="p-3 border rounded">
              <div className="font-semibold">{d.title} — {d.documentDate}</div>
              <div>URL: <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-600">Open</a></div>
              <div className="mt-2">Extractions:</div>
              <pre className="bg-gray-50 p-2 rounded mt-1">{JSON.stringify(d.extractions || [], null, 2)}</pre>
              <button onClick={()=>verify('DOCUMENT', d.id, 'REVIEWED')} className="mt-2 px-3 py-2 bg-yellow-500 text-white rounded">Mark Document Reviewed</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="font-semibold">AYUSH Assessment</h2>
        <div className="p-3 border rounded">
          {ayush && !editing && (
            <div>
              <div>Prakriti: {ayush.prakriti}</div>
              <div>Vikriti: {ayush.vikriti}</div>
              <div>Sara: {ayush.sara}</div>
              <div>Samhanana: {ayush.samhanna}</div>
              <div>Pramana: {ayush.pramana}</div>
              <div>Satmya: {ayush.satmya}</div>
              <div>Sattva: {ayush.sattva}</div>
              <div>Ahara Shakti: {ayush.aharaShakti}</div>
              <div>Vyayama Shakti: {ayush.vyayamaShakti}</div>
              <div>Vaya: {ayush.vaya}</div>
              <div>Ahara-Vihara: {ayush.aharaVihara}</div>
              <div>Agni: {ayush.agni}</div>
              <div>Nadi: {ayush.nadi}</div>
              <div>Note: {ayush.note}</div>
              <div className="mt-2">Status: {ayush.status} {ayush.verifiedAt ? ` — verified at ${new Date(ayush.verifiedAt).toLocaleString()}` : ''}</div>
              <div className="mt-2">
                <button onClick={()=>setEditing(true)} className="px-3 py-2 bg-sky-600 text-white rounded">Edit</button>
                <button onClick={async()=>{ await fetch(`/api/doctor/ayush/verify/${ayush.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ status: 'VERIFIED' })}); alert('Verified'); }} className="ml-2 px-3 py-2 bg-green-600 text-white rounded">Mark Verified</button>
              </div>
            </div>
          )}

          {(!ayush || editing) && (
            <div className="space-y-2">
              <label>Prakriti <input className="w-full border p-1" value={form.prakriti||''} onChange={e=>setForm({...form, prakriti: e.target.value})} /></label>
              <label>Vikriti <input className="w-full border p-1" value={form.vikriti||''} onChange={e=>setForm({...form, vikriti: e.target.value})} /></label>
              <label>Sara <input className="w-full border p-1" value={form.sara||''} onChange={e=>setForm({...form, sara: e.target.value})} /></label>
              <label>Samhanana <input className="w-full border p-1" value={form.samhanna||''} onChange={e=>setForm({...form, samhanna: e.target.value})} /></label>
              <label>Pramana <input className="w-full border p-1" value={form.pramana||''} onChange={e=>setForm({...form, pramana: e.target.value})} /></label>
              <label>Satmya <input className="w-full border p-1" value={form.satmya||''} onChange={e=>setForm({...form, satmya: e.target.value})} /></label>
              <label>Sattva <input className="w-full border p-1" value={form.sattva||''} onChange={e=>setForm({...form, sattva: e.target.value})} /></label>
              <label>Ahara Shakti <input className="w-full border p-1" value={form.aharaShakti||''} onChange={e=>setForm({...form, aharaShakti: e.target.value})} /></label>
              <label>Vyayama Shakti <input className="w-full border p-1" value={form.vyayamaShakti||''} onChange={e=>setForm({...form, vyayamaShakti: e.target.value})} /></label>
              <label>Vaya <input className="w-full border p-1" value={form.vaya||''} onChange={e=>setForm({...form, vaya: e.target.value})} /></label>
              <label>Ahara-Vihara <input className="w-full border p-1" value={form.aharaVihara||''} onChange={e=>setForm({...form, aharaVihara: e.target.value})} /></label>
              <label>Agni <input className="w-full border p-1" value={form.agni||''} onChange={e=>setForm({...form, agni: e.target.value})} /></label>
              <label>Nadi <input className="w-full border p-1" value={form.nadi||''} onChange={e=>setForm({...form, nadi: e.target.value})} /></label>
              <label>Note <textarea className="w-full border p-1" value={form.note||''} onChange={e=>setForm({...form, note: e.target.value})} /></label>
              <div>
                <button onClick={async()=>{ await fetch(`/api/doctor/ayush/${id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)}).then(r=>r.json()).then(d=>{ setAyush(d.ayush); setEditing(false) }); }} className="px-3 py-2 bg-sky-600 text-white rounded">Save AYUSH</button>
                <button onClick={()=>{ setEditing(false); setForm(ayush||{}) }} className="ml-2 px-3 py-2 border rounded">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

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
