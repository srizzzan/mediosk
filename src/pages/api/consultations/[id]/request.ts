import { getSession } from 'next-auth/react'
import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

const Body = z.object({ reason: z.string().optional() })

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })
  const role = (session as any).user.role
  if (role !== 'PATIENT') return res.status(403).json({ error: 'forbidden' })

  const { id } = req.query as any
  const parsed = Body.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid' })

  const consultation = await prisma.consultation.findUnique({ where: { id } })
  if (!consultation) return res.status(404).json({ error: 'not_found' })

  // ensure patient owns it
  const patient = await prisma.patient.findUnique({ where: { userId: (session as any).user.id } })
  if (!patient || patient.id !== consultation.patientId) return res.status(403).json({ error: 'forbidden' })

  const updated = await prisma.consultation.update({ where: { id }, data: { status: 'REQUESTED' } })
  await prisma.accessAudit.create({ data: { actorId: (session as any).user.id, actorRole: role, patientId: patient.id, consultationId: id, action: 'CONSULTATION_REQUESTED', note: parsed.data.reason || null } })
  return res.json({ consultation: updated })
}
