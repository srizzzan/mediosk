import { getSession } from 'next-auth/react'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import formidable from 'formidable'
import fs from 'fs'
import { uploadFile } from '../../../../lib/storage'
import { randomUUID } from 'crypto'

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req })
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any).user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const patient = await prisma.patient.findUnique({ where: { userId } })
  if (!patient) return res.status(404).json({ error: 'Patient not found' })

  if (req.method === 'GET') {
    const docs = await prisma.medicalDocument.findMany({ where: { patientId: patient.id }, orderBy: { uploadedAt: 'desc' } })
    return res.json({ documents: docs })
  }

  if (req.method === 'POST') {
    const form = new formidable.IncomingForm()
    form.parse(req, async (err: any, fields: formidable.Fields, files: formidable.Files) => {
      if (err) return res.status(500).json({ error: 'Upload error' })
      const file = (files as any).file as formidable.File
      if (!file) return res.status(400).json({ error: 'No file' })
      // file validation
      const maxSize = parseInt(process.env.MAX_UPLOAD_MB || '10', 10) * 1024 * 1024
      if (file.size && file.size > maxSize) return res.status(400).json({ error: 'File too large' })
      const allowed = ['application/pdf','image/png','image/jpeg','image/jpg']
      if (file.mimetype && !allowed.includes(file.mimetype)) return res.status(400).json({ error: 'Invalid file type' })

      const buffer = fs.readFileSync(file.filepath)
      const ext = file.originalFilename?.split('.').pop() || 'bin'
      const key = `${patient.id}/${randomUUID()}.${ext}`
      const contentType = file.mimetype || 'application/octet-stream'
      const url = await uploadFile(buffer, key, contentType)

      const f = fields as any
      const title = Array.isArray(f.title) ? f.title[0] : f.title || file.originalFilename || 'Document'
      const category = Array.isArray(f.category) ? f.category[0] : f.category || null
      const documentDate = f.documentDate ? new Date(Array.isArray(f.documentDate) ? f.documentDate[0] : f.documentDate) : null

      const created = await prisma.medicalDocument.create({ data: { patientId: patient.id, title, url, category, documentDate } })

      // create processing job
      await prisma.documentProcessing.create({ data: { documentId: created.id, status: 'PENDING' } })

      return res.json({ document: created })
    })
    return
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
