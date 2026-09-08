import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const { id } = req.query as any
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'unauthenticated' })

  const c = await prisma.consultation.findUnique({ where: { id }, include: { doctor: { include: { user: true } }, patient: { include: { user: true } } } })
  if (!c) return res.status(404).json({ error: 'not_found' })

  const uid = (session as any).user.id
  const role = (session as any).user.role
  // only doctor assigned, patient assigned, or hospital roles allowed
  if (role === 'DOCTOR' && c.doctor.userId !== uid) return res.status(403).json({ error: 'forbidden' })
  if (role === 'PATIENT' && c.patient.userId !== uid) return res.status(403).json({ error: 'forbidden' })

  return res.json({ consultation: c })
}
