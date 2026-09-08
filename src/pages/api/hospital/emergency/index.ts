import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const role = (session as any).user?.role
  if (role !== 'HOSPITAL') return res.status(403).json({ error: 'Forbidden' })

  // find hospital record for this user
  const hospital = await prisma.hospital.findUnique({ where: { userId: (session as any).user.id } })
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' })

  if (req.method === 'GET'){
    const alerts = await prisma.emergencyAlert.findMany({ where: { hospitalId: hospital.id }, orderBy: { createdAt: 'desc' }, include: { patient: { include: { user: true } }, consultation: true } })
    return res.json({ alerts })
  }

  res.setHeader('Allow','GET')
  res.status(405).end('Method Not Allowed')
}
