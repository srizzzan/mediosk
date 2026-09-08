import { z } from 'zod'

export const MedicineSchema = z.object({ name: z.string(), dosage: z.string().optional(), frequency: z.string().optional() })
export const InvestigationSchema = z.object({ name: z.string(), value: z.string().optional(), unit: z.string().optional(), referenceRange: z.string().optional() })
export const ProcedureSchema = z.object({ name: z.string(), date: z.string().optional() })

export const ExtractionSchema = z.object({
  diagnoses: z.array(z.string()).optional(),
  medicines: z.array(MedicineSchema).optional(),
  investigations: z.array(InvestigationSchema).optional(),
  procedures: z.array(ProcedureSchema).optional(),
  findings: z.array(z.string()).optional(),
  dates: z.array(z.string()).optional()
})

export type Extraction = z.infer<typeof ExtractionSchema>

export function extractFromText(text: string): Extraction {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const diagnoses: string[] = []
  const medicines: any[] = []
  const investigations: any[] = []
  const procedures: any[] = []
  const findings: string[] = []
  const dates: string[] = []

  // Very conservative regexes: only capture obvious patterns
  const medRx = /(\b[A-Z][a-zA-Z0-9\- ]+)(?:,?\s*(\d+mg|\d+ g|\d+ mcg|\d+ml|\d+ units))?(?:\s*(once a day|twice a day|bd|tds|daily|weekly))?/i
  const invRx = /(\b[A-Z][a-zA-Z0-9 ]+):?\s*(\d+[.,]?\d*)\s*(mg|g|ml|mmol|mIU|%)?/i
  const dateRx = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})|(\d{4}-\d{2}-\d{2})/g

  for (const line of lines) {
    // dates
    const dmatch = line.match(dateRx)
    if (dmatch) dates.push(...dmatch)

    // investigations
    const im = line.match(invRx)
    if (im) {
      investigations.push({ name: im[1], value: im[2], unit: im[3] || undefined })
      continue
    }

    // medicines
    const mm = line.match(medRx)
    if (mm) {
      medicines.push({ name: mm[1].trim(), dosage: mm[2] || undefined, frequency: mm[3] || undefined })
      continue
    }

    // procedures (surgery keywords)
    if (/surgery|appendectomy|cholecystectomy|bypass|procedure|operation/i.test(line)) {
      procedures.push({ name: line })
      continue
    }

    // findings / diagnoses heuristics
    if (/diagnosis:|dx:|impression:|diagnosed with/i.test(line)) {
      const v = line.replace(/.*?(diagnosis:|dx:|impression:|diagnosed with)\s*/i,'')
      diagnoses.push(v)
      continue
    }

    if (/findings:|noted:|observed:|remark:/i.test(line)) {
      findings.push(line)
      continue
    }
  }

  const result = { diagnoses: diagnoses.length?diagnoses:undefined, medicines: medicines.length?medicines:undefined, investigations: investigations.length?investigations:undefined, procedures: procedures.length?procedures:undefined, findings: findings.length?findings:undefined, dates: dates.length?dates:undefined }
  return ExtractionSchema.parse(result)
}
