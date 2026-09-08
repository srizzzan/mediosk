import { QuestionType } from '@prisma/client'

export const BANK: Record<string, Array<any>> = {
  general: [
    { key: 'chief_complaint', text: 'Please describe your main complaint in a sentence.', type: 'TEXT' },
    { key: 'onset', text: 'When did this start? (date or duration)', type: 'TEXT' },
    { key: 'severity', text: 'How severe is the problem on a scale of 1-10?', type: 'NUMBER' },
    { key: 'associated_symptoms', text: 'Any associated symptoms? (fever, nausea, etc.)', type: 'TEXT' }
  ],
  respiratory: [
    { key: 'chief_complaint', text: 'What symptom brought you here? (cough, breathlessness, chest pain)', type: 'TEXT' },
    { key: 'onset', text: 'When did it start?', type: 'TEXT' },
    { key: 'severity', text: 'Rate breathlessness 1-10', type: 'NUMBER' },
    { key: 'fever', text: 'Do you have fever?', type: 'YESNO' },
    { key: 'sputum', text: 'Do you produce sputum?', type: 'YESNO' }
  ],
  gastrointestinal: [
    { key: 'chief_complaint', text: 'Describe abdominal symptoms (pain, vomiting, diarrhea)', type: 'TEXT' },
    { key: 'onset', text: 'When did this begin?', type: 'TEXT' },
    { key: 'location', text: 'Where is the pain located?', type: 'TEXT' },
    { key: 'severity', text: 'Severity 1-10', type: 'NUMBER' }
  ],
  neurology: [
    { key: 'chief_complaint', text: 'What neurological symptom are you experiencing?', type: 'TEXT' },
    { key: 'onset', text: 'When did it start?', type: 'TEXT' },
    { key: 'seizure', text: 'Have you had any seizures?', type: 'YESNO' },
    { key: 'weakness', text: 'Any weakness or numbness?', type: 'YESNO' }
  ]
}
