import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const patient = await prisma.patient.findUnique({ where: { userId } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  if (req.method === 'GET') {
    return res.json({ patient })
  }

  if (req.method === 'PUT') {
    const { name, dob, gender, preferredLanguage } = req.body
    // update user name and patient fields
    await prisma.user.update({ where: { id: userId }, data: { name } })
    const updated = await prisma.patient.update({ where: { id: patient.id }, data: { dob: dob ? new Date(dob) : null, gender, preferredLanguage } })
    return res.json({ patient: updated })
  }

  res.setHeader('Allow', 'GET,PUT')
  res.status(405).end('Method Not Allowed')
}
