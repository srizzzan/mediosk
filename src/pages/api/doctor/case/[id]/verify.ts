import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  const role = (session as any).user?.role
  if (role !== 'DOCTOR') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  const doctor = await prisma.doctor.findUnique({ where: { userId } })
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' })

  const { targetType, targetId, status, note } = req.body
  if (!targetType || !targetId || !status) return res.status(400).json({ error: 'Missing fields' })

  // verify that consultation exists and doctor assigned or consent
  const consultation = await prisma.consultation.findUnique({ where: { id } })
  if (!consultation) return res.status(404).json({ error: 'Consultation not found' })
  const assigned = consultation.doctorId === doctor.id
  const consent = await prisma.consent.findFirst({ where: { patientId: consultation.patientId, granteeDoctorId: doctor.id, granted: true } })
  if (!assigned && !consent) return res.status(403).json({ error: 'Access denied' })

  const v = await prisma.doctorVerification.create({ data: { doctorId: doctor.id, targetType, targetId, status, note } })
  return res.json({ ok: true, verification: v })
}
