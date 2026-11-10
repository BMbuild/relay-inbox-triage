/**
 * Triage a customer message with the AI, protected by deterministic rules.
 * Falls back to the rules (and says so) when the AI is unavailable.
 *
 * Environment-free: the caller passes the AI client and model, so this logic
 * (including the fallback) is unit-tested without Vite or a real API key.
 */
import { triageWithAI } from './triageAI.js'
import { classifyByRules, combineUrgency, scoreUrgency } from './triageRules.js'

/**
 * @param {string} message
 * @param {{client: object|null, model: string, onError?: (error: Error) => void}} options
 * @returns {Promise<{category: string, urgency: string, reasoning: string, source: 'ai'|'rules',
 *   model: string|null, notice: string|null, urgencyReasons: string[]}>}
 */
export async function triageMessage(message, { client, model, onError = () => {} }) {
  const rules = scoreUrgency(message)

  if (!client) {
    return rulesResult(message, rules, 'No Groq API key configured. Showing rule-based triage; review manually.')
  }

  try {
    const ai = await triageWithAI(client, model, message)
    const urgency = combineUrgency(ai.urgency, rules.level)
    return {
      category: ai.category,
      urgency,
      reasoning: ai.reasoning,
      source: 'ai',
      model,
      notice: urgency !== ai.urgency ? `Urgency raised from ${ai.urgency} by safety rules: ${rules.reasons.join(', ')}.` : null,
      urgencyReasons: rules.reasons,
    }
  } catch (error) {
    onError(error)
    return rulesResult(message, rules, `AI unavailable (${describeError(error)}). Showing rule-based triage; review manually.`)
  }
}

// Groq API errors carry a JSON body; show its message rather than the raw payload.
export function describeError(error) {
  const detail = error?.error?.error?.message || error?.error?.message || error?.message || 'unknown error'
  return String(detail).slice(0, 160)
}

function rulesResult(message, rules, notice) {
  return {
    category: classifyByRules(message),
    urgency: rules.level,
    reasoning: `Rule-based triage: ${rules.reasons.join(', ')}.`,
    source: 'rules',
    model: null,
    notice,
    urgencyReasons: rules.reasons,
  }
}
