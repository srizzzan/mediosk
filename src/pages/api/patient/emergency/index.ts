import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const role = (session as any).user?.role
  if (role !== 'PATIENT') return res.status(403).json({ error: 'Forbidden' })

  const patient = await prisma.patient.findUnique({ where: { userId: (session as any).user.id } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  if (req.method === 'GET'){
    const alerts = await prisma.emergencyAlert.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: 'desc' }, include: { consultation: true } })
    return res.json({ alerts })
  }

  res.setHeader('Allow','GET')
  res.status(405).end('Method Not Allowed')
}
