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

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  const summary = await prisma.medicalSummary.findUnique({ where: { id } })
  if (!summary || summary.patientId !== patient.id) return res.status(404).json({ error: 'Not found' })

  if (req.method === 'GET') {
    return res.json({ summary })
  }

  if (req.method === 'DELETE') {
    await prisma.medicalSummary.delete({ where: { id } })
    return res.json({ ok: true })
  }

  res.setHeader('Allow', 'GET,DELETE')
  res.status(405).end('Method Not Allowed')
}
