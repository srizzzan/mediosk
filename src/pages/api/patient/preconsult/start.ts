import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { detectDomainFromComplaint } from '../../../../lib/domain'
import { BANK } from '../../../../lib/questionBank'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { complaint } = req.body
  if (!complaint || typeof complaint !== 'string') return res.status(400).json({ error: 'Complaint required' })

  const patient = await prisma.patient.findUnique({ where: { userId } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  const domain = detectDomainFromComplaint(complaint)

  const sessionRec = await prisma.preConsultationSession.create({ data: { patientId: patient.id, complaint, domain } })

  // create session questions from bank
  const qlist = BANK[domain] || BANK['general']
  for (let i=0;i<qlist.length;i++){
    const q = qlist[i]
    await prisma.sessionQuestion.create({ data: { sessionId: sessionRec.id, text: q.text, type: q.type, order: i } })
  }

  return res.json({ sessionId: sessionRec.id, domain })
}
