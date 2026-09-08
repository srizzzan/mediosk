import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const { id } = req.query as any
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })

  const c = await prisma.consultation.findUnique({ where: { id }, include: { doctor: { include: { user: true } }, patient: { include: { user: true } } } })
  if (!c) return res.status(404).json({ error: 'not_found' })

  const uid = (session as any).user.id
  const role = (session as any).user.role
  // only assigned doctor or patient may view; hospital allowed only if explicit audit exists
  if (role === 'DOCTOR' && c.doctor.userId !== uid) {
    // doctor may still view if they have active consent for this patient
    const doctor = await prisma.doctor.findUnique({ where: { userId: uid } })
    if (!doctor) return res.status(403).json({ error: 'forbidden' })
    const consent = await prisma.consent.findFirst({ where: { patientId: c.patientId, granteeDoctorId: doctor.id }, orderBy: { createdAt: 'desc' } })
    if (!consent || consent.granted !== true) return res.status(403).json({ error: 'forbidden' })
  }
  if (role === 'PATIENT' && c.patient.userId !== uid) return res.status(403).json({ error: 'forbidden' })
  if (role === 'HOSPITAL'){
    const audit = await prisma.accessAudit.findFirst({ where: { actorId: uid, consultationId: id, action: { in: ['CONSULTATION_JOIN_ALLOWED','CONSULTATION_JOIN_AUTHORIZED'] } } })
    if (!audit) return res.status(403).json({ error: 'forbidden' })
  }

  return res.json({ consultation: c })
}
