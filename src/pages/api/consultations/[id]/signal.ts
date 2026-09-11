import { getToken } from 'next-auth/jwt'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

type SignalMessage = {
  id: string
  from: string
  to?: string
  type: 'offer' | 'answer' | 'ice' | 'control'
  payload: any
  createdAt: string
}

// consultationId -> messages
const store = new Map<string, SignalMessage[]>()

const PostBody = z.object({
  type: z.enum(['offer', 'answer', 'ice', 'control']),
  payload: z.any(),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query as { id: string }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    return res.status(401).json({
      error: 'unauthenticated',
    })
  }

  const consultation = await prisma.consultation.findUnique({
    where: { id },
  })

  if (!consultation) {
    return res.status(404).json({
      error: 'not_found',
    })
  }

  const role = String(token.role)
  const uid = String(token.id)

  const patient = await prisma.patient.findUnique({
    where: {
      id: consultation.patientId,
    },
  })

  const doctor = consultation.doctorId
    ? await prisma.doctor.findUnique({
        where: {
          id: consultation.doctorId,
        },
      })
    : null

  const userAllowed =
    (role === 'PATIENT' && patient?.userId === uid) ||
    (role === 'DOCTOR' && doctor?.userId === uid)

  if (!userAllowed) {
    return res.status(403).json({
      error: 'forbidden',
    })
  }

  /*
   * POST
   *
   * Send a signaling message to the OTHER participant.
   */
  if (req.method === 'POST') {
    const parsed = PostBody.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid',
      })
    }

    const otherParticipant =
      role === 'PATIENT'
        ? doctor?.userId
        : patient?.userId

    if (!otherParticipant) {
      return res.status(409).json({
        error: 'other_participant_not_found',
      })
    }

    const list = store.get(id) || []

    const entry: SignalMessage = {
      id: `${Date.now()}-${Math.random()}`,
      from: uid,
      to: otherParticipant,
      type: parsed.data.type,
      payload: parsed.data.payload,
      createdAt: new Date().toISOString(),
    }

    list.push(entry)

    // Keep only recent signaling messages.
    if (list.length > 100) {
      list.splice(0, list.length - 100)
    }

    store.set(id, list)

    console.log(
      `[SIGNAL POST] ${role} ${uid} -> ${otherParticipant}: ${parsed.data.type}`
    )

    return res.json({
      ok: true,
    })
  }

  /*
   * GET
   *
   * Return ONLY messages addressed to this user.
   */
  if (req.method === 'GET') {
    const list = store.get(id) || []

    const messagesForUser = list.filter(
      (message) => message.to === uid
    )

    const remainingMessages = list.filter(
      (message) => message.to !== uid
    )

    store.set(id, remainingMessages)

    console.log(
      `[SIGNAL GET] ${role} ${uid}: ${messagesForUser
        .map((message) => message.type)
        .join(', ') || 'none'}`
    )

    return res.json({
      messages: messagesForUser,
    })
  }

  res.setHeader('Allow', 'GET,POST')

  return res.status(405).end()
}