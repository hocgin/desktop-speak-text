import type { TextRequest } from './type.js'
export function validateBaseURL(value: string) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Use HTTPS, or HTTP for localhost only')
  return url.toString().replace(/\/$/, '')
}
export function endpoint(base: string, route: string) {
  return `${validateBaseURL(base)}/${route}`
}
export function headers(key?: string): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }
}
export function promptFor(request: TextRequest) {
  switch (request.action) {
    case 'polish':
      return 'Polish the supplied text for natural spoken narration. Preserve meaning and language. Return only the revised text.'
    case 'summarize':
      return 'Summarize the supplied text for spoken narration in its original language. Return only the summary.'
    case 'translate':
      if (!request.targetLanguage?.trim()) throw new Error('Target language is required')
      return `Translate the supplied text into ${request.targetLanguage.slice(0, 100)}. Return only the translation.`
    case 'custom':
      if (!request.instruction?.trim()) throw new Error('Instruction is required')
      return request.instruction.slice(0, 2000)
    default:
      throw new Error('Unsupported text action')
  }
}
export async function streamCompletion(
  response: Response,
  signal: AbortSignal,
  onText: (text: string) => void
) {
  if (!response.ok || !response.body) throw new Error(`AI HTTP ${response.status}`)
  const reader = response.body.getReader()
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => {})
  }
  signal.addEventListener('abort', abort, { once: true })
  const decoder = new TextDecoder()
  let buffer = '',
    text = '',
    finished = false
  function event(block: string) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data) return
    if (data.trim() === '[DONE]') {
      finished = true
      return
    }
    const value = JSON.parse(data)
    if (value.error) throw new Error('AI service returned an error')
    const delta = value.choices?.[0]?.delta?.content
    if (typeof delta === 'string') {
      text += delta
      if (text.length > 100_000) throw new Error('AI response too large')
      onText(text)
    }
  }
  try {
    while (!finished) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
      if (buffer.length > 1_000_000) throw new Error('AI stream frame too large')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        event(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        if (finished) break
      }
      if (done) {
        if (buffer.trim()) event(buffer)
        break
      }
    }
    signal.throwIfAborted()
    if (!text.trim()) throw new Error('AI returned an empty response')
    return text
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
