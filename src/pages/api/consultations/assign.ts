import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'

const BodySchema = z.object({ consultationId: z.string().uuid(), doctorId: z.string().uuid(), scheduledAt: z.string().optional() })

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  const role = (session as any).user?.role
  if (role !== 'DOCTOR' && role !== 'HOSPITAL') return res.status(403).json({ error: 'Forbidden' })

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors })
  const { consultationId, doctorId, scheduledAt } = parsed.data

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } })
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' })

  if (role === 'HOSPITAL') {
    const hospital = await prisma.hospital.findUnique({ where: { userId } })
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' })
    const link = await prisma.hospitalDoctor.findFirst({ where: { hospitalId: hospital.id, doctorId: doctor.id } })
    if (!link) return res.status(403).json({ error: 'Doctor is not linked to this hospital' })
  } else if (doctor.userId !== userId) {
    return res.status(403).json({ error: 'Doctors may only assign themselves' })
  }

  const consultation = await prisma.$transaction(async (tx) => {
    const request = await tx.consultation.findUnique({ where: { id: consultationId } })
    if (!request) return { error: 'CONSULTATION_NOT_FOUND' as const }
    if (request.status !== 'REQUESTED' || request.doctorId !== null) return { error: 'CONSULTATION_NOT_ASSIGNABLE' as const }

    const assigned = await tx.consultation.update({
      where: { id: request.id },
      data: { doctorId: doctor.id, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, status: 'READY' },
    })
    await tx.accessAudit.create({
      data: { actorId: userId, actorRole: role, patientId: request.patientId, doctorId: doctor.id, consultationId: assigned.id, action: 'ASSIGNED', note: `Assigned by ${role}` },
    })
    return { assigned }
  }).catch((error) => {
    throw error
  })

  if ('error' in consultation) {
    return res.status(consultation.error === 'CONSULTATION_NOT_FOUND' ? 404 : 409).json({ error: consultation.error })
  }
  return res.json({ consultation: consultation.assigned })
}
