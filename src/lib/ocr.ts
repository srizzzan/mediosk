import fs from 'fs'
import path from 'path'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

type OCRResult = { text: string }

async function bufferFromUrl(url: string): Promise<Buffer> {
  // local uploads
  if (url.startsWith('/uploads/')) {
    const key = url.replace(/^\/uploads\//, '')
    const filePath = path.join(process.cwd(), 'uploads', key)
    return fs.readFileSync(filePath)
  }

  // If STORAGE_PROVIDER is s3, try to fetch via S3 using env config
  if (process.env.STORAGE_PROVIDER === 's3') {
    try {
      const endpoint = process.env.S3_ENDPOINT || ''
      const bucket = process.env.S3_BUCKET || ''
      // try to extract key from common URL forms
      let key = url
      if (endpoint && url.startsWith(endpoint)) {
        key = url.replace(new RegExp('^' + endpoint.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '/'), '')
      } else {
        // try AWS S3 hostname form
        const m = url.match(/https?:\/\/(?:[\w.-]+)\/(.+)$/)
        if (m) key = m[1]
      }
      // If key includes bucket prefix like bucket/key, remove bucket/
      if (key.startsWith(bucket + '/')) key = key.replace(bucket + '/', '')

      const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT || undefined, region: process.env.S3_REGION || 'us-east-1', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' }, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' })
      const get = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      const stream = (get.Body as any)
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      return Buffer.concat(chunks)
    } catch (e) {
      // fallthrough to HTTP fetch
    }
  }

  // fallback: fetch over HTTP
  const res = await fetch(url)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

export async function runOCR(url: string): Promise<OCRResult> {
  const provider = process.env.OCR_PROVIDER || 'ocr_space'
  if (provider === 'mock') {
    // For local testing: if url is /uploads/..., try to find a .txt sidecar file
    if (url.startsWith('/uploads/')) {
      const key = url.replace(/^\/uploads\//, '')
      const txtPath = path.join(process.cwd(), 'uploads', key + '.txt')
      if (fs.existsSync(txtPath)) {
        return { text: fs.readFileSync(txtPath, 'utf8') }
      }
    }
    // No text available; return empty
    return { text: '' }
  }

  if (provider === 'ocr_space') {
    const apiKey = process.env.OCR_API_KEY || process.env.OCR_SPACE_API_KEY
    if (!apiKey) throw new Error('OCR_SPACE API key not configured (OCR_API_KEY or OCR_SPACE_API_KEY)')
    // retrieve buffer for file
    const buf = await bufferFromUrl(url)
    const b64 = buf.toString('base64')
    const ext = path.extname(url).replace('.', '').toLowerCase() || 'png'

    const form = new FormData()
    // OCR.Space expects data URI prefix
    form.append('base64Image', `data:application/${ext};base64,${b64}`)
    form.append('apikey', apiKey)
    form.append('language', 'eng')
    form.append('isOverlayRequired', 'false')

    const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form })
    if (!res.ok) throw new Error('OCR provider request failed: ' + res.statusText)
    const j = await res.json()
    if (j && j.ParsedResults && j.ParsedResults.length>0) {
      const texts = j.ParsedResults.map((p:any)=>p.ParsedText || '').join('\n')
      return { text: texts }
    }
    // no parsed results
    return { text: '' }
  }

  throw new Error('OCR provider not implemented: ' + provider)
}
