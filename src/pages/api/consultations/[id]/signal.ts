import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

// In-memory message store: consultationId -> [{from, type, payload, id, createdAt}]
const store = new Map<string, any[]>()

const PostBody = z.object({ type: z.enum(['offer','answer','ice','control']), payload: z.any() })

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const { id } = req.query as any
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })

  // verify user is participant
  const consultation = await prisma.consultation.findUnique({ where: { id } })
  if (!consultation) return res.status(404).json({ error: 'not_found' })
  const role = (session as any).user.role
  const uid = (session as any).user.id
  const patient = await prisma.patient.findUnique({ where: { id: consultation.patientId } })
  const doctor = consultation.doctorId ? await prisma.doctor.findUnique({ where: { id: consultation.doctorId } }) : null
  const userAllowed = (role === 'PATIENT' && patient?.userId === uid) || (role === 'DOCTOR' && doctor?.userId === uid) || role === 'HOSPITAL'
  if (!userAllowed) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'POST'){
    const parsed = PostBody.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid' })
    const list = store.get(id) || []
    const entry = { id: `${Date.now()}-${Math.random()}`, from: uid, type: parsed.data.type, payload: parsed.data.payload, createdAt: new Date().toISOString() }
    list.push(entry)
    store.set(id, list)
    return res.json({ ok: true })
  }

  if (req.method === 'GET'){
    const list = store.get(id) || []
    // return and clear for this caller
    const copy = list.slice()
    store.set(id, [])
    return res.json({ messages: copy })
  }

  res.setHeader('Allow','GET,POST')
  res.status(405).end()
}
