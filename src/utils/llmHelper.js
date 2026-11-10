import Groq from 'groq-sdk'
import { DEFAULT_MODEL } from './triageAI.js'
import { triageMessage as triage } from './triage.js'

/**
 * Browser entry point: reads the Vite environment and delegates to triage.js,
 * which holds the AI call, the safety rules and the visible fallback.
 */

const apiKey = import.meta.env.VITE_GROQ_API_KEY
const model = import.meta.env.VITE_GROQ_MODEL || DEFAULT_MODEL
let client = null

// Created on first use: a missing key must not crash the whole app at import time.
function getClient() {
  if (!apiKey || apiKey === 'your_groq_api_key_here') return null
  client ??= new Groq({
    apiKey,
    dangerouslyAllowBrowser: true, // Local development only; production calls belong on a server.
  })
  return client
}

/** @param {string} message */
export function triageMessage(message) {
  return triage(message, {
    client: getClient(),
    model,
    onError: error => console.warn('AI triage failed, using rules:', error.message),
  })
}
