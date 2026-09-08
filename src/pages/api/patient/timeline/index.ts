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
    const entries = await prisma.medicalTimeline.findMany({ where: { patientId: patient.id }, orderBy: { date: 'desc' }, include: { sourceDocument: true } })
    return res.json({ entries })
  }

  if (req.method === 'POST') {
    const { title, details, entryType, date, sourceDocumentId } = req.body
    // validate sourceDocument ownership if provided
    if (sourceDocumentId) {
      const doc = await prisma.medicalDocument.findUnique({ where: { id: sourceDocumentId } })
      if (!doc || doc.patientId !== patient.id) return res.status(400).json({ error: 'Invalid source document' })
    }
    const created = await prisma.medicalTimeline.create({ data: { patientId: patient.id, title, details, entryType, date: date ? new Date(date) : undefined, sourceDocumentId } })
    return res.json({ entry: created })
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
