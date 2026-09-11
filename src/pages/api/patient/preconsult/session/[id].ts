import { getToken } from 'next-auth/jwt'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { z } from 'zod'
import { BANK } from '../../../../../lib/questionBank'

const AnswerSchema = z.object({ questionId: z.string().uuid(), value: z.any() })

function asOptionalText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({
  req,
  secret: process.env.NEXTAUTH_SECRET
})

if (!token) {
  return res.status(401).json({ error: 'Unauthorized' })
}

if (token.role !== 'PATIENT') {
  return res.status(403).json({ error: 'Forbidden' })
}

const userId = token.id as string

if (!userId) {
  return res.status(401).json({ error: 'Unauthorized: missing user id' })
}
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  const sess = await prisma.preConsultationSession.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' }, include: { answer: true } }, report: true, consultation: true } })
  if (!sess || sess.patientId !== (await prisma.patient.findUnique({ where: { userId } }))?.id) return res.status(404).json({ error: 'Not found' })

  if (req.method === 'GET') {
    // return questions with answers and progress
    const total = sess.questions.length
    const answered = sess.questions.filter(q=>q.answered).length
    return res.json({ session: sess, progress: { total, answered } })
  }

  if (req.method === 'POST') {
    if (sess.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'Session is already completed' })
    // submit answer for a question
    const parsed = AnswerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid answer', details: parsed.error.errors })
    const { questionId, value } = parsed.data
    const q = await prisma.sessionQuestion.findUnique({ where: { id: questionId } })
    if (!q || q.sessionId !== id) return res.status(400).json({ error: 'Invalid question' })
    const ans = await prisma.$transaction(async (tx) => {
      const answer = await tx.sessionAnswer.upsert({
        where: { questionId },
        create: { questionId, value },
        update: { value },
      })
      await tx.sessionQuestion.update({ where: { id: questionId }, data: { answered: true } })
      return answer
    })
    return res.json({ ok: true, answer: ans })
  }

  if (req.method === 'PUT') {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.preConsultationSession.findUnique({
        where: { id },
        include: { questions: { orderBy: { order: 'asc' }, include: { answer: true } }, report: true },
      })
      if (!current || current.patientId !== sess.patientId) return { error: 'Not found' as const }
      if (current.report) return { report: current.report, alreadyCompleted: true }
      if (current.questions.some((question) => !question.answered || !question.answer)) {
        return { error: 'All questions must be answered' as const }
      }

      const bank = BANK[current.domain || 'general'] || BANK.general
      const answersByKey = new Map<string, unknown>()
      for (const question of current.questions) {
        const key = bank[question.order]?.key
        if (key) answersByKey.set(key, question.answer?.value)
      }

      const report = await tx.preConsultationReport.create({
        data: {
          sessionId: current.id,
          chiefComplaint: current.complaint,
          onsetDuration: asOptionalText(answersByKey.get('onset')),
          location: asOptionalText(answersByKey.get('location')),
          severity: asOptionalText(answersByKey.get('severity')),
          associated: answersByKey.get('associated_symptoms') as any,
        },
      })
      await tx.preConsultationSession.update({ where: { id: current.id }, data: { status: 'COMPLETED' } })
      return { report, alreadyCompleted: false }
    })

    if ('error' in result) return res.status(result.error === 'Not found' ? 404 : 409).json({ error: result.error })
    return res.json({ ok: true, report: result.report, alreadyCompleted: result.alreadyCompleted })
  }

  res.setHeader('Allow', 'GET,POST,PUT')
  res.status(405).end('Method Not Allowed')
}
