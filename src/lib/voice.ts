// Lightweight voice abstraction using browser Web Speech APIs.
// Exports simple speak() and createRecognizer() for STT.

type RecognizerHandle = {
  start: () => void
  stop: () => void
  isSupported: boolean
}

export function canUseSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function canUseSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  // @ts-ignore
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export async function speak(text: string, lang = 'en-US'): Promise<void> {
  if (!canUseSpeechSynthesis()) return Promise.resolve()
  return new Promise((resolve) => {
    try {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.onend = () => resolve()
      utter.onerror = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } catch (e) {
      resolve()
    }
  })
}

export function createRecognizer(onResult: (transcript: string, isFinal: boolean) => void, onEnd?: () => void): RecognizerHandle {
  const win: any = window as any
  const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
  if (!SpeechRecognition) {
    return {
      start: () => {},
      stop: () => {},
      isSupported: false,
    }
  }

  const recog = new SpeechRecognition()
  recog.lang = 'en-IN'
  recog.interimResults = true
  recog.maxAlternatives = 1

  recog.onresult = (ev: any) => {
    let interim = ''
    let final = ''
    for (let i = ev.resultIndex; i < ev.results.length; ++i) {
      const res = ev.results[i]
      if (res.isFinal) final += res[0].transcript
      else interim += res[0].transcript
    }
    if (final) onResult(final.trim(), true)
    else onResult(interim.trim(), false)
  }

  recog.onend = () => { if (onEnd) onEnd() }

  return {
    start: () => { try { recog.start() } catch(e){} },
    stop: () => { try { recog.stop() } catch(e){} },
    isSupported: true,
  }
}
