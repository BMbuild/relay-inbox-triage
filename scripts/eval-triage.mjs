/**
 * Live evaluation against Groq: runs labelled examples twice and reports accuracy and consistency.
 * Usage: npm run eval  (reads VITE_GROQ_API_KEY and optional VITE_GROQ_MODEL from .env.local)
 *
 * Scores the development and evaluation sets separately (see eval-sets.mjs). Pauses EVAL_DELAY_MS
 * (default 3000) before each call to stay under the free tier's per-minute limit.
 */
import Groq from 'groq-sdk'
import { DEFAULT_MODEL, triageWithAI } from '../src/utils/triageAI.js'
import { combineUrgency, scoreUrgency } from '../src/utils/triageRules.js'
import { getRecommendedAction, shouldEscalate } from '../src/utils/templates.js'
import { EVALUATION, DEVELOPMENT } from './eval-sets.mjs'

const apiKey = process.env.VITE_GROQ_API_KEY
if (!apiKey || apiKey === 'your_groq_api_key_here') {
  console.error('Set VITE_GROQ_API_KEY in .env.local first.')
  process.exit(1)
}
const model = process.env.VITE_GROQ_MODEL || DEFAULT_MODEL
const client = new Groq({ apiKey })
// Groq's free tier limits requests per minute; without a pause, calls fail and the scores mean nothing.
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 3000)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

console.log(`Model: ${model}`)
const results = [
  await runSet('Development set (used to find and fix the bugs)', DEVELOPMENT),
  await runSet('Evaluation set (new messages, held out)', EVALUATION),
]
console.log('')
for (const r of results) console.log(r)
if (results.some(r => !r.endsWith('API failures 0'))) {
  console.error('\nSome API calls failed: the scores above are not a measure of the AI. Check the key, the model and the network.')
  process.exitCode = 1
}

async function runSet(title, examples) {
  console.log(`\n${title}`)
  let categoryHits = 0, urgencyHits = 0, stable = 0, failures = 0
  for (const [message, expectedCategory, expectedUrgency] of examples) {
    const rules = scoreUrgency(message)
    const runs = []
    for (let i = 0; i < 2; i++) {
      await sleep(delayMs)
      try {
        const ai = await triageWithAI(client, model, message)
        runs.push({ ...ai, urgency: combineUrgency(ai.urgency, rules.level) })
      } catch (error) {
        failures++
        runs.push({ category: 'ERROR', urgency: 'ERROR', reasoning: error.message })
      }
    }
    const [first, second] = runs
    // Two failed calls are not a consistent answer.
    const same = first.category !== 'ERROR' && second.category !== 'ERROR' && first.category === second.category && first.urgency === second.urgency
    categoryHits += first.category === expectedCategory
    urgencyHits += first.urgency === expectedUrgency
    stable += same
    const mark = (ok) => (ok ? '✓' : '✗')
    console.log(`${mark(first.category === expectedCategory)} ${first.category.padEnd(18)} ${mark(first.urgency === expectedUrgency)} ${first.urgency.padEnd(6)} ${same ? 'stable  ' : 'UNSTABLE'} ${shouldEscalate(first.category, first.urgency) ? 'escalate' : '        '} | ${message.slice(0, 60)}`)
    if (first.category !== expectedCategory || first.urgency !== expectedUrgency) {
      console.log(`    expected ${expectedCategory} / ${expectedUrgency}; action: ${getRecommendedAction(first.category, first.urgency)}`)
    }
  }
  const n = examples.length
  return `${title.split(' (')[0]}: category ${categoryHits}/${n} | urgency ${urgencyHits}/${n} | consistent across 2 runs ${stable}/${n} | API failures ${failures}`
}
