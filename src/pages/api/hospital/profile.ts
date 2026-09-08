import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'

const BodySchema = z.object({ address: z.string().optional(), name: z.string().optional() })

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const role = (session as any).user?.role
  if (role !== 'HOSPITAL') return res.status(403).json({ error: 'Forbidden' })

  const hospital = await prisma.hospital.findUnique({ where: { userId: (session as any).user.id }, include: { user: true } })
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' })

  if (req.method === 'GET'){
    return res.json({ hospital })
  }

  if (req.method === 'PUT'){
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.errors })
    const data:any = {}
    if (parsed.data.address !== undefined) data.address = parsed.data.address
    if (parsed.data.name !== undefined) await prisma.user.update({ where: { id: hospital.userId }, data: { name: parsed.data.name } })
    const updated = await prisma.hospital.update({ where: { id: hospital.id }, data })
    await prisma.accessAudit.create({ data: { actorId: (session as any).user.id, actorRole: role, patientId: '', action: 'HOSPITAL_PROFILE_UPDATED', note: 'Profile updated' } })
    return res.json({ hospital: updated })
  }

  res.setHeader('Allow','GET,PUT')
  res.status(405).end('Method Not Allowed')
}
