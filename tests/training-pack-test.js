'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  TRAINING_RESULT,
  validatePack,
  evaluateAnswer,
  stablePackUrl,
  summarizeResults
} = require('../src/core/training-pack');

const root = path.join(__dirname, '..');
const loadJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sample = loadJson('data/training-packs/sample.json');
const demo = loadJson('data/training-packs/coach-demo.json');
const ledger = loadJson('data/coach-training-kpis.json');
const knownScenarioTypes = new Set([
  'efficiency_test',
  'defensive_play',
  'riichi_decision',
  'complex_wait_patterns',
  'opponent_reading'
]);

assert.strictEqual(validatePack(sample), true);
assert.strictEqual(validatePack(demo), true);
assert.strictEqual(sample.scenarios.length, 5, 'sample must contain exactly 5 scenarios');
assert.ok(demo.scenarios.length >= 10, 'coach demo must contain at least 10 scenarios');
for (const pack of [sample, demo]) {
  for (const scenario of pack.scenarios) {
    assert.ok(knownScenarioTypes.has(scenario.sourceScenarioType), `unknown source scenario: ${scenario.sourceScenarioType}`);
    assert.ok(scenario.context.length > 10, `${scenario.id}: concrete context is required`);
    assert.ok(!scenario.choices.some(choice => /^候補[Ａ-ＺA-Z]$/.test(choice)), `${scenario.id}: placeholder choices are forbidden`);
    assert.strictEqual(
      evaluateAnswer(scenario, scenario.choices[0]),
      TRAINING_RESULT.REVIEW_REQUIRED,
      'unverified distributed scenarios must fail closed to REVIEW_REQUIRED'
    );
  }
}

const scorableFixture = {
  id: 'scorable-fixture',
  sourceScenarioType: 'efficiency_test',
  prompt: 'validated fixture',
  context: 'fixture context with concrete tiles 1m 2m 3m',
  choices: ['1m', '2m', '3m'],
  answerPolicy: { mode: 'SCORABLE', recommended: ['1m'], acceptable: ['2m'] }
};
assert.strictEqual(evaluateAnswer(scorableFixture, '1m'), TRAINING_RESULT.MATCH);
assert.strictEqual(evaluateAnswer(scorableFixture, '2m'), TRAINING_RESULT.ACCEPTABLE);
assert.strictEqual(evaluateAnswer(scorableFixture, '3m'), TRAINING_RESULT.INVALID);

const stableUrl = stablePackUrl('https://kafka2306.github.io/mj/', sample);
assert.ok(stableUrl.includes('pack=coach-sample-v1'));
assert.ok(stableUrl.includes('version=1.1.0'));

const summary = summarizeResults(sample, [
  { scenarioId: sample.scenarios[0].id, status: TRAINING_RESULT.REVIEW_REQUIRED },
  { scenarioId: sample.scenarios[1].id, status: TRAINING_RESULT.REVIEW_REQUIRED }
]);
assert.deepStrictEqual(
  { completed: summary.completed, reviewRequired: summary.reviewRequired, scorable: summary.scorable, matchRate: summary.matchRate },
  { completed: 2, reviewRequired: 2, scorable: 0, matchRate: null }
);
assert.strictEqual(Object.hasOwn(summary, 'learnerName'), false, 'summary must not require learner PII');

assert.deepStrictEqual(
  Object.keys(ledger.events).sort(),
  ['coach_demo_opened', 'coach_inquiry_started', 'paid_pilot', 'qualified_inquiry', 'sample_pack_completed', 'sample_pack_started'].sort()
);
assert.strictEqual(ledger.events.paid_pilot, 0, 'commercial KPI ledger must start from observed zero, not fabricated success');

assert.throws(
  () => validatePack({ ...sample, scenarios: [{ ...sample.scenarios[0], answerPolicy: { mode: 'REVIEW_REQUIRED', recommended: ['1m'], acceptable: [] } }] }),
  /cannot assert recommended\/acceptable/
);

assert.throws(
  () => validatePack({ ...sample, scenarios: [{ ...sample.scenarios[0], choices: ['候補A', '1m'] }] }),
  /placeholder choice is not distributable/
);

assert.throws(
  () => validatePack({ ...sample, scenarios: [{ ...sample.scenarios[0], context: '' }] }),
  /scenario.context must be a non-empty string/
);

console.log('✅ training-pack contract tests passed');
