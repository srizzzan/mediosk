import { getSession } from 'next-auth/react'
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'

function safeDate(d?: Date | string | null){
  if (!d) return undefined
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return undefined
  return dt.toISOString()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    const session = await getSession({ req })
    if (!session) return res.status(401).json({ error: 'unauthenticated' })
    const user = (session as any).user
    if (user.role !== 'DOCTOR') return res.status(403).json({ error: 'forbidden' })

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } })
    if (!doctor) return res.status(404).json({ error: 'doctor_profile_not_found' })

    const patientId = req.query.id as string
    const patient = await prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) return res.status(404).json({ error: 'patient_not_found' })

    // check if doctor has an active or past consultation with this patient OR explicit consent granted
    const consultation = await prisma.consultation.findFirst({ where: { patientId: patientId, doctorId: doctor.id } })
    const consent = await prisma.consent.findFirst({ where: { patientId: patientId, granteeDoctorId: doctor.id }, orderBy: { createdAt: 'desc' } })
    if (!consultation && !(consent && consent.granted === true)) return res.status(403).json({ error: 'forbidden' })

    const full = await prisma.patient.findUnique({ where: { id: patientId }, include: { user: true, documents: { include: { processing: true, extractions: true } }, timelines: true, summaries: true, consultations: true, ayushAssessments: true } })
    if (!full) return res.status(404).json({ error: 'patient_not_found' })

  const resources:any[] = []
  const patientRes:any = { resourceType: 'Patient', id: full.id, identifier: [], name: full.user?.name ? [{ text: full.user.name }] : undefined, gender: full.gender || undefined, birthDate: full.dob ? (new Date(full.dob)).toISOString().slice(0,10) : undefined }
  if (full.abhaId) patientRes.identifier.push({ system: 'https://abdm.gov.in/abha', value: full.abhaId })
  resources.push(patientRes)

  for (const doc of full.documents || []){
    const dr:any = { resourceType: 'DocumentReference', id: doc.id, status: 'current', type: { text: doc.category || doc.title }, date: doc.documentDate ? safeDate(doc.documentDate) : safeDate(doc.uploadedAt), content: [{ attachment: { url: doc.url, title: doc.title } }], subject: { reference: `Patient/${full.id}` }, extension: [ { url: 'http://example.org/fhir/StructureDefinition/source-record-id', valueString: doc.id } ] }
    if (doc.extractions && doc.extractions.length) dr.extension.push({ url: 'http://example.org/fhir/StructureDefinition/extractions', valueString: JSON.stringify(doc.extractions) })
    if (doc.processing && doc.processing.length) dr.extension.push({ url: 'http://example.org/fhir/StructureDefinition/processing', valueString: JSON.stringify(doc.processing) })
    resources.push(dr)
  }

  for (const t of full.timelines || []){
    const common:any = { resourceType: 'Observation', id: t.id, status: 'final', code: { text: t.title }, subject: { reference: `Patient/${full.id}` }, effectiveDateTime: safeDate(t.date), note: [{ text: t.details || '' }], extension: [] }
    if (t.sourceDocumentId) common.extension.push({ url: 'http://example.org/fhir/StructureDefinition/source-document-id', valueString: t.sourceDocumentId })
    if (t.entryType === 'DIAGNOSIS'){
      const cond:any = { resourceType: 'Condition', id: t.id, code: { text: t.title }, subject: { reference: `Patient/${full.id}` }, recordedDate: safeDate(t.date), note: [{ text: t.details || '' }], extension: common.extension }
      resources.push(cond)
    } else if (t.entryType === 'MEDICINE'){
      const med:any = { resourceType: 'MedicationStatement', id: t.id, subject: { reference: `Patient/${full.id}` }, effectiveDateTime: safeDate(t.date), note: [{ text: t.details || '' }], extension: common.extension }
      resources.push(med)
    } else {
      resources.push(common)
    }
  }

  for (const s of full.summaries || []){
    const comp:any = { resourceType: 'Composition', id: s.id, status: 'final', type: { text: 'Medical summary' }, subject: { reference: `Patient/${full.id}` }, date: safeDate(s.createdAt), title: s.provider || 'AI/Service generated summary', section: [{ title: 'Patient summary', text: { status: 'generated', div: s.patientSummary || '' } }], extension: [{ url: 'http://example.org/fhir/StructureDefinition/summary-status', valueString: s.status || '' }] }
    resources.push(comp)
  }

  for (const a of full.ayushAssessments || []){
    const obs:any = { resourceType: 'Observation', id: a.id, status: 'final', code: { text: 'AYUSH assessment' }, subject: { reference: `Patient/${full.id}` }, effectiveDateTime: safeDate(a.createdAt), note: [{ text: a.note || '' }], extension: [{ url: 'http://example.org/fhir/StructureDefinition/ayush', valueString: JSON.stringify({ prakriti: a.prakriti, vikriti: a.vikriti }) }] }
    resources.push(obs)
  }

  for (const c of full.consultations || []){
    const enc:any = { resourceType: 'Encounter', id: c.id, status: c.status === 'IN_PROGRESS' ? 'in-progress' : 'finished', subject: { reference: `Patient/${full.id}` }, period: c.scheduledAt ? { start: safeDate(c.scheduledAt) } : undefined }
    resources.push(enc)
  }

  const bundle = { resourceType: 'Bundle', type: 'document', entry: resources.map(r=>({ resource: r })) }
    await prisma.accessAudit.create({ data: { actorId: user.id, actorRole: 'DOCTOR', patientId: full.id, doctorId: doctor.id, action: 'FHIR_EXPORT', note: `Doctor export for patient ${full.id}` } })
    res.setHeader('Content-Type','application/fhir+json')
    return res.status(200).json(bundle)
  } catch (err) {
    console.error('doctor fhir export error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
