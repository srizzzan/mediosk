import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

const provider = process.env.STORAGE_PROVIDER || 's3'

let s3: S3Client | null = null
if (provider === 's3') {
  s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
  })
}

export async function uploadFile(buffer: Buffer, key: string, contentType: string) {
  if (provider === 's3' && s3) {
    const bucket = process.env.S3_BUCKET!
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType })
    await s3.send(cmd)
    const endpoint = process.env.S3_ENDPOINT
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
    }
    return `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`
  }

  // Local storage fallback
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const filePath = path.join(uploadsDir, key)
  fs.writeFileSync(filePath, buffer)
  return `/uploads/${key}`
}

export async function deleteFile(key: string) {
  if (provider === 's3' && s3) {
    const bucket = process.env.S3_BUCKET!
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key })
    await s3.send(cmd)
    return
  }
  const filePath = path.join(process.cwd(), 'uploads', key)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}
