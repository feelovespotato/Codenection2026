// Provider credentials stay in this module's closure, never in API snapshots or logs.
const SPECS = {
  gemini: { key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL', defaultModel: 'gemini-2.5-flash', label: 'Google Gemini' },
  groq: { key: 'GROQ_API_KEY', model: 'GROQ_MODEL', defaultModel: 'llama-3.3-70b-versatile', label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions' },
  openrouter: { key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL', defaultModel: 'openrouter/free', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions' },
}
const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== undefined && value !== '' ? Math.min(max, Math.max(min, Number(value))) : fallback
export function parseAIJson(text) {
  let cleanText = text.trim()
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (match) {
    cleanText = match[1]
  } else {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    // Also try to find the first { and last } if it's still failing
    const start = cleanText.indexOf('{')
    const end = cleanText.lastIndexOf('}')
    if (start >= 0 && end >= start) {
      cleanText = cleanText.slice(start, end + 1)
    }
  }
  return JSON.parse(cleanText)
}

export function createAI({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const enabled = env.AI_ENABLED !== 'false'
  const allowPaid = env.AI_ALLOW_PAID_PROVIDERS === 'true'
  const timeoutMs = bounded(env.AI_TIMEOUT_MS, 8000, 100, 15000)
  const totalMs = bounded(env.AI_TOTAL_TIMEOUT_MS, 25000, 100, 45000)
  const cooldownMs = bounded(env.AI_COOLDOWN_MS, 60000, 1000, 3600000)
  const requestsPerMinute = bounded(env.AI_REQUESTS_PER_MINUTE, 10, 1, 60)
  const order = [...new Set((env.AI_PROVIDER_ORDER || 'groq,openrouter,gemini').split(',').map(s => s.trim().toLowerCase()))]
  const unknownProviders = order.filter(id => !Object.hasOwn(SPECS, id))
  const providers = order.filter(id => Object.hasOwn(SPECS, id)).map(id => {
    const spec = SPECS[id]
    const model = env[spec.model]?.trim() || spec.defaultModel
    const paid = id === 'openrouter' && model !== 'openrouter/free' && !model.endsWith(':free')
    return { id, ...spec, model, apiKey: env[spec.key]?.trim() || '', blockedByCost: paid && !allowPaid, until: 0, failure: null }
  })
  const quotas = new Map()
  let active = 0
  function status() {
    return { enabled, configured: enabled && providers.some(p => p.apiKey && !p.blockedByCost), unknownProviders,
      providers: providers.map(p => ({ id: p.id, label: p.label, model: p.model,
        state: !enabled ? 'disabled' : !p.apiKey ? 'missing_key' : p.blockedByCost ? 'paid_disabled' : p.until > now() ? 'cooldown' : 'ready',
        retryAt: p.until > now() ? new Date(p.until).toISOString() : null, lastError: p.failure })) }
  }
  function available(scope) {
    const time = now()
    for (const [key, item] of quotas) if (item.until <= time) quotas.delete(key)
    const entry = quotas.get(scope) || { count: 0, until: time + 60000 }
    if (entry.count >= requestsPerMinute || active >= 4 || (!quotas.has(scope) && quotas.size >= 1000)) return false
    entry.count++; quotas.set(scope, entry); return true
  }
  const fallback = reason => ({ value: null, method: 'local', provider: null, reason })
  async function generate({ system, prompt, validate, scope = 'default' }) {
    if (!status().configured) return fallback('not_configured')
    if (!available(scope)) return fallback('busy')
    active++
    // A real elapsed-time deadline also bounds injected clocks and stalled responses.
    const deadline = Date.now() + totalMs
    try {
      for (const provider of providers) {
        if (!provider.apiKey || provider.blockedByCost || provider.until > now()) continue
        const remaining = deadline - Date.now()
        if (remaining <= 0) break
        const controller = new AbortController()
        let timer
        try {
          const attempt = async () => {
            const gemini = provider.id === 'gemini'
            const url = gemini ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent` : provider.url
            const headers = { 'Content-Type': 'application/json', ...(gemini ? { 'x-goog-api-key': provider.apiKey } : { Authorization: `Bearer ${provider.apiKey}` }) }
            const body = gemini ? {
              systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: 'application/json', ...(/^gemini-2\.5-flash/.test(provider.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
            } : { model: provider.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.4, max_tokens: 1024, stream: false }
            const response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' })
            if (!response.ok) {
              const code = response.status
              const retry = response.headers.get('retry-after')
              const retryMs = retry && /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - now() : 0
              const error = new Error('provider_http_error')
              error.safeReason = code === 429 ? 'rate_limited' : [400, 401, 402, 403, 404].includes(code) ? 'key_model_or_billing' : 'provider_error'
              error.delay = Math.max(cooldownMs, Number.isFinite(retryMs) ? Math.min(retryMs, 2147483647) : 0, [400, 401, 402, 403, 404].includes(code) ? 300000 : 0)
              await response.body?.cancel()
              throw error
            }
            // Bound provider output size, including unexpectedly verbose reasoning.
            let raw = ''
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              raw += decoder.decode(value, { stream: true })
              if (raw.length > 100000) { await reader.cancel(); throw new Error('oversized_response') }
            }
            raw += decoder.decode()
            const data = JSON.parse(raw)
            const candidate = gemini ? data.candidates?.[0] : data.choices?.[0]
            const refused = gemini ? data.promptFeedback?.blockReason || ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(candidate?.finishReason)
              : candidate?.message?.refusal || candidate?.finish_reason === 'content_filter'
            if (refused) return { refused: true }
            if ((gemini ? candidate?.finishReason : candidate?.finish_reason) !== (gemini ? 'STOP' : 'stop')) throw new Error('incomplete_response')
            const text = gemini ? candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') : candidate?.message?.content
            if (typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('invalid_response')
            const value = validate(text)
            if (value === null || value === undefined) throw new Error('invalid_response')
            return { value }
          }
          const result = await Promise.race([attempt(), new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); const error = new Error('timeout'); error.safeReason = 'timeout'; reject(error) }, Math.min(timeoutMs, remaining))
          })])
          if (result.refused) return fallback('blocked') // Do not route moderation refusals around another provider.
          provider.until = 0; provider.failure = null
          return { value: result.value, method: 'ai', provider: provider.label, model: provider.model }
        } catch (error) {
          console.error(`Provider ${provider.label} failed:`, error.message, error.safeReason)
          provider.failure = error.safeReason || 'invalid_or_unavailable'
          provider.until = now() + (error.delay || cooldownMs)
          // Never log provider bodies, credentials, request headers or user prompts.
        } finally { clearTimeout(timer); controller.abort() }
      }
      const failures = providers.map(p => p.failure).filter(Boolean)
      if (failures.includes('rate_limited')) return fallback('rate_limited')
      if (failures.includes('key_model_or_billing')) return fallback('key_model_or_billing')
      return fallback('unavailable')
    } finally { active-- }
  }
  return { status, generate }
}
