import { prisma } from '../lib/prisma'
import { runOCR } from '../lib/ocr'
import { extractFromText } from '../lib/extract'
import { generateSummaryPatientFriendly, generateSummaryDoctor } from '../lib/llm'

async function processOnce() {
  const job = await prisma.medicalSummary.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } })
  if (!job) return false
  try {
    await prisma.medicalSummary.update({ where: { id: job.id }, data: { status: 'PROCESSING' } })
    // gather documents for this patient
    const documentsRec = await prisma.medicalDocument.findMany({ where: { patientId: job.patientId } })
    const documents = documentsRec.map(d=>d.id)
    const timelineIds: string[] = []

    // aggregate text from documents
    let aggregatedText = ''
    for (const docId of documents) {
      const doc = await prisma.medicalDocument.findUnique({ where: { id: docId } })
      if (!doc) continue
      const ocr = await runOCR(doc.url)
      aggregatedText += '\n' + (ocr.text || '')
    }

    // fallback: include extracted data linked to documents
    const extractedRecords = await prisma.extractedMedicalData.findMany({ where: { documentId: { in: documents } } })
    for (const rec of extractedRecords) {
      aggregatedText += '\n' + JSON.stringify(rec.extracted)
    }

    // include timeline entries
    const timeline = await prisma.medicalTimeline.findMany({ where: { patientId: job.patientId }, orderBy: { date: 'desc' } })

    const extracted = extractFromText(aggregatedText || '')

    const patientSummary = await generateSummaryPatientFriendly(extracted, timeline)
    const doctorSummary = await generateSummaryDoctor(extracted, timeline, { documents, timelineEntries: timelineIds })

    await prisma.medicalSummary.update({ where: { id: job.id }, data: { status: 'COMPLETED', patientSummary, doctorSummary, version: job.version + 1 } })
  } catch (err:any) {
    await prisma.medicalSummary.update({ where: { id: job.id }, data: { status: 'FAILED', note: String(err?.message || err) } })
  }
  return true
}

async function run() {
  while (true) {
    const did = await processOnce()
    if (!did) await new Promise(r=>setTimeout(r, 3000))
  }
}

run().catch(err=>{ console.error(err); process.exit(1) })
