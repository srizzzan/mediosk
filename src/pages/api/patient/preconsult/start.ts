import { getToken } from 'next-auth/jwt'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { detectDomainFromComplaint } from '../../../../lib/domain'
import { BANK } from '../../../../lib/questionBank'
import { z } from 'zod'

const BodySchema = z.object({ complaint: z.string().min(3) })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const token = await getToken({
  req,
  secret: process.env.NEXTAUTH_SECRET
})

if (!token) {
  return res.status(401).json({ error: 'Unauthorized' })
}

const userId = token.id as string

if (!userId) {
  return res.status(401).json({ error: 'Unauthorized: missing user id' })
}

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors })
  const { complaint } = parsed.data

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
