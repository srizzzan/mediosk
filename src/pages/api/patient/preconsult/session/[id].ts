import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { z } from 'zod'

const AnswerSchema = z.object({ questionId: z.string().uuid(), value: z.any() })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  const sess = await prisma.preConsultationSession.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' }, include: { answer: true } } } })
  if (!sess || sess.patientId !== (await prisma.patient.findUnique({ where: { userId } }))?.id) return res.status(404).json({ error: 'Not found' })

  if (req.method === 'GET') {
    // return questions with answers and progress
    const total = sess.questions.length
    const answered = sess.questions.filter(q=>q.answered).length
    return res.json({ session: sess, progress: { total, answered } })
  }

  if (req.method === 'POST') {
    // submit answer for a question
    const parsed = AnswerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid answer', details: parsed.error.errors })
    const { questionId, value } = parsed.data
    const q = await prisma.sessionQuestion.findUnique({ where: { id: questionId } })
    if (!q || q.sessionId !== id) return res.status(400).json({ error: 'Invalid question' })
    // store answer
    const ans = await prisma.sessionAnswer.create({ data: { questionId: questionId, value } })
    await prisma.sessionQuestion.update({ where: { id: questionId }, data: { answered: true } })
    return res.json({ ok: true, answer: ans })
  }

  if (req.method === 'PUT') {
    // finish session and create SymptomReport
    const qmap = {} as any
    for (const q of sess.questions) {
      qmap[q.text] = q.answer?.value
    }
    const reportData: any = {
      sessionId: sess.id,
      chiefComplaint: sess.complaint
    }
    const onset = qmap['When did this start? (date or duration)'] || qmap['When did it start?'] || qmap['When did this begin?']
    if (onset) reportData.onsetDuration = onset
    const location = qmap['Where is the pain located?']
    if (location) reportData.location = location
    const severity = qmap['How severe is the problem on a scale of 1-10?'] || qmap['Severity 1-10']
    if (severity) reportData.severity = severity
    const associated = qmap['Any associated symptoms? (fever, nausea, etc.)']
    if (associated) reportData.associated = associated

    const report = await prisma.preConsultationReport.create({ data: reportData })
    await prisma.preConsultationSession.update({ where: { id: sess.id }, data: { status: 'COMPLETED', report: { connect: { id: report.id } } } })
    return res.json({ ok: true, report })
  }

  res.setHeader('Allow', 'GET,POST,PUT')
  res.status(405).end('Method Not Allowed')
}
