import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'GET') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  const userRole = (session as any).user?.role
  if (userRole !== 'DOCTOR') return res.status(403).json({ error: 'Forbidden' })

  const doctor = await prisma.doctor.findUnique({ where: { userId } })
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found' })

  const start = new Date()
  start.setHours(0,0,0,0)
  const end = new Date()
  end.setHours(23,59,59,999)

  const consultations = await prisma.consultation.findMany({ where: { doctorId: doctor.id, scheduledAt: { gte: start, lte: end } }, include: { patient: { include: { user: true } }, session: true } })

  return res.json({ consultations })
}
