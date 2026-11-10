/**
 * Offline evaluation of the rule-based fallback (what users get when the AI is unavailable).
 * Usage: npm run eval:rules  (no API key needed)
 */
import { classifyByRules, scoreUrgency } from '../src/utils/triageRules.js'
import { EVALUATION, DEVELOPMENT } from './eval-sets.mjs'

for (const [title, examples] of [['Development set', DEVELOPMENT], ['Evaluation set', EVALUATION]]) {
  let categoryHits = 0, urgencyHits = 0
  console.log(`\n${title}`)
  for (const [message, expectedCategory, expectedUrgency] of examples) {
    const category = classifyByRules(message)
    const urgency = scoreUrgency(message).level
    categoryHits += category === expectedCategory
    urgencyHits += urgency === expectedUrgency
    const mark = ok => (ok ? '✓' : '✗')
    console.log(`${mark(category === expectedCategory)} ${category.padEnd(18)} ${mark(urgency === expectedUrgency)} ${urgency.padEnd(6)} | ${message.slice(0, 60)}`)
  }
  console.log(`${title}, rules only: category ${categoryHits}/${examples.length} | urgency ${urgencyHits}/${examples.length}`)
}
