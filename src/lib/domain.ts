export function detectDomainFromComplaint(complaint: string): string {
  const text = complaint.toLowerCase()
  if (/(chest|breath|cough|wheez)/.test(text)) return 'respiratory'
  if (/(abdominal|stomach|nausea|vomit|diarr)/.test(text)) return 'gastrointestinal'
  if (/(headache|dizzy|seizure|neurol)/.test(text)) return 'neurology'
  if (/(pain|joint|knee|back|muscle)/.test(text)) return 'musculoskeletal'
  if (/(fever|infection)/.test(text)) return 'general'
  return 'general'
}
