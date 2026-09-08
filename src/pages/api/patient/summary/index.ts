import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const patient = await prisma.patient.findUnique({ where: { userId } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  if (req.method === 'GET') {
    const summaries = await prisma.medicalSummary.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' } })
    return res.json({ summaries })
  }

  if (req.method === 'POST') {
    const created = await prisma.medicalSummary.create({ data: { patientId: patient.id, authorId: userId, provider: process.env.LLM_PROVIDER || 'mock', status: 'PENDING' } })
    return res.json({ summary: created })
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
