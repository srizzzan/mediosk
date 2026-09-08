import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query as any
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })
  const role = (session as any).user.role
  const uid = (session as any).user.id

  const consultation = await prisma.consultation.findUnique({ where: { id } })
  if (!consultation) return res.status(404).json({ error: 'not_found' })

  // only allow join when SCHEDULED or IN_PROGRESS
  if (!(consultation.status === 'SCHEDULED' || consultation.status === 'IN_PROGRESS')) return res.status(403).json({ error: 'invalid_status' })

  if (role === 'PATIENT'){
    const patient = await prisma.patient.findUnique({ where: { userId: uid } })
    if (!patient || patient.id !== consultation.patientId) return res.status(403).json({ error: 'forbidden' })
    // patient consent check: if consent required exist? We'll enforce that if a Consent record exists and is not granted, deny
    const consent = await prisma.consent.findFirst({ where: { patientId: patient.id, granteeDoctorId: consultation.doctorId }, orderBy: { createdAt: 'desc' } })
    if (consent && !consent.granted) return res.status(403).json({ error: 'consent_required' })
  } else if (role === 'DOCTOR'){
    const doctor = await prisma.doctor.findUnique({ where: { userId: uid } })
    if (!doctor) return res.status(403).json({ error: 'doctor_profile_not_found' })
    // allow if assigned
    if (doctor.id !== consultation.doctorId){
      // or if there is explicit consent granting this doctor
      const consent = await prisma.consent.findFirst({ where: { patientId: consultation.patientId, granteeDoctorId: doctor.id }, orderBy: { createdAt: 'desc' } })
      if (!consent || consent.granted !== true) return res.status(403).json({ error: 'forbidden' })
    }
  } else if (role === 'HOSPITAL'){
    // hospital users must be explicitly authorized via AccessAudit entry
    const audit = await prisma.accessAudit.findFirst({ where: { actorId: uid, consultationId: id, action: { in: ['CONSULTATION_JOIN_ALLOWED','CONSULTATION_JOIN_AUTHORIZED'] } } })
    if (!audit) return res.status(403).json({ error: 'forbidden' })
  } else {
    return res.status(403).json({ error: 'forbidden' })
  }

  // record audit
  await prisma.accessAudit.create({ data: { actorId: uid, actorRole: role, patientId: consultation.patientId, doctorId: consultation.doctorId, consultationId: id, action: 'CONSULTATION_JOINED' } })

  return res.json({ ok: true })
}
