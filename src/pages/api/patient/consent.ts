import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'

const GrantSchema = z.object({ doctorId: z.string().uuid() })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const patient = await prisma.patient.findUnique({ where: { userId } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  if (req.method === 'GET') {
    const consents = await prisma.consent.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, take: 50 })
    return res.json({ consents })
  }

  if (req.method === 'POST') {
    // grant
    const parsed = GrantSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors })
    const { doctorId } = parsed.data
    const created = await prisma.consent.create({ data: { patientId: patient.id, granted: true, granteeDoctorId: doctorId, grantedAt: new Date() } })
    await prisma.accessAudit.create({ data: { actorId: userId, actorRole: 'PATIENT', patientId: patient.id, doctorId, action: 'GRANT_CONSENT', note: 'Patient granted access' } })
    return res.json({ consent: created })
  }

  if (req.method === 'DELETE') {
    // revoke
    const parsed = GrantSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors })
    const { doctorId } = parsed.data
    // create a revocation record
    const revoked = await prisma.consent.create({ data: { patientId: patient.id, granted: false, granteeDoctorId: doctorId, revokedAt: new Date() } })
    await prisma.accessAudit.create({ data: { actorId: userId, actorRole: 'PATIENT', patientId: patient.id, doctorId, action: 'REVOKE_CONSENT', note: 'Patient revoked access' } })
    return res.json({ consent: revoked })
  }

  res.setHeader('Allow', 'GET,POST,DELETE')
  res.status(405).end('Method Not Allowed')
}
