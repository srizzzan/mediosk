import { getSession } from 'next-auth/react'
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })
  const role = (session as any).user.role
  if (role !== 'DOCTOR' && role !== 'HOSPITAL') return res.status(403).json({ error: 'forbidden' })

  const { id } = req.query as any
  const consultation = await prisma.consultation.findUnique({ where: { id } })
  if (!consultation) return res.status(404).json({ error: 'not_found' })
  const doctor = await prisma.doctor.findUnique({ where: { id: consultation.doctorId } })
  if (!doctor) return res.status(404).json({ error: 'doctor_not_found' })
  if (role === 'DOCTOR' && (session as any).user.id !== doctor.userId) return res.status(403).json({ error: 'forbidden' })

  const updated = await prisma.consultation.update({ where: { id }, data: { status: 'COMPLETED' } })
  await prisma.accessAudit.create({ data: { actorId: (session as any).user.id, actorRole: role, patientId: consultation.patientId, doctorId: consultation.doctorId, consultationId: id, action: 'CONSULTATION_ENDED' } })
  return res.json({ consultation: updated })
}
