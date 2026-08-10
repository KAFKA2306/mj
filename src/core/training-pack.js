'use strict';

const TRAINING_RESULT = Object.freeze({
  MATCH: 'MATCH',
  ACCEPTABLE: 'ACCEPTABLE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INVALID: 'INVALID'
});

const PLACEHOLDER_CHOICE = /^(?:候補[Ａ-ＺA-Z]|choice\s*[a-z0-9]+)$/i;

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function validatePack(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw new Error('pack must be an object');
  for (const field of ['id', 'title', 'focus', 'difficulty', 'version']) assertNonEmptyString(pack[field], field);
  if (!Array.isArray(pack.scenarios) || pack.scenarios.length === 0) throw new Error('scenarios must be non-empty');

  const ids = new Set();
  for (const scenario of pack.scenarios) {
    assertNonEmptyString(scenario.id, 'scenario.id');
    assertNonEmptyString(scenario.sourceScenarioType, 'scenario.sourceScenarioType');
    assertNonEmptyString(scenario.prompt, 'scenario.prompt');
    assertNonEmptyString(scenario.context, 'scenario.context');
    if (ids.has(scenario.id)) throw new Error(`duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
    if (!Array.isArray(scenario.choices) || scenario.choices.length < 2) {
      throw new Error(`${scenario.id}: choices must have at least 2 items`);
    }
    if (new Set(scenario.choices.map(String)).size !== scenario.choices.length) {
      throw new Error(`${scenario.id}: choices must be unique`);
    }
    for (const choice of scenario.choices) {
      assertNonEmptyString(String(choice), `${scenario.id}: choice`);
      if (PLACEHOLDER_CHOICE.test(String(choice).trim())) {
        throw new Error(`${scenario.id}: placeholder choice is not distributable: ${choice}`);
      }
    }
    const policy = scenario.answerPolicy;
    if (!policy || typeof policy !== 'object') throw new Error(`${scenario.id}: answerPolicy is required`);
    if (policy.mode === 'REVIEW_REQUIRED') {
      if ((policy.recommended || []).length || (policy.acceptable || []).length) {
        throw new Error(`${scenario.id}: REVIEW_REQUIRED cannot assert recommended/acceptable answers`);
      }
    } else if (policy.mode === 'SCORABLE') {
      if (!Array.isArray(policy.recommended) || policy.recommended.length === 0) {
        throw new Error(`${scenario.id}: SCORABLE requires recommended answers`);
      }
      const choices = new Set(scenario.choices.map(String));
      for (const answer of [...policy.recommended, ...(policy.acceptable || [])].map(String)) {
        if (!choices.has(answer)) throw new Error(`${scenario.id}: answer not present in choices: ${answer}`);
      }
    } else {
      throw new Error(`${scenario.id}: unsupported answerPolicy mode`);
    }
  }
  return true;
}

function evaluateAnswer(scenario, answer) {
  if (!scenario || !scenario.answerPolicy) return TRAINING_RESULT.INVALID;
  const policy = scenario.answerPolicy;
  if (policy.mode === 'REVIEW_REQUIRED') return TRAINING_RESULT.REVIEW_REQUIRED;
  const normalized = String(answer);
  if ((policy.recommended || []).map(String).includes(normalized)) return TRAINING_RESULT.MATCH;
  if ((policy.acceptable || []).map(String).includes(normalized)) return TRAINING_RESULT.ACCEPTABLE;
  return TRAINING_RESULT.INVALID;
}

function stablePackUrl(baseUrl, pack) {
  validatePack(pack);
  const url = new URL(baseUrl);
  url.searchParams.set('pack', pack.id);
  url.searchParams.set('version', pack.version);
  return url.toString();
}

function summarizeResults(pack, results) {
  validatePack(pack);
  const byId = new Map((results || []).map(item => [item.scenarioId, item]));
  const summary = {
    packId: pack.id,
    version: pack.version,
    focus: pack.focus,
    completed: 0,
    scorable: 0,
    matched: 0,
    acceptable: 0,
    reviewRequired: 0,
    invalid: 0
  };

  for (const scenario of pack.scenarios) {
    const result = byId.get(scenario.id);
    if (!result) continue;
    summary.completed += 1;
    if (result.status === TRAINING_RESULT.REVIEW_REQUIRED) {
      summary.reviewRequired += 1;
    } else {
      summary.scorable += 1;
      if (result.status === TRAINING_RESULT.MATCH) summary.matched += 1;
      else if (result.status === TRAINING_RESULT.ACCEPTABLE) summary.acceptable += 1;
      else summary.invalid += 1;
    }
  }

  summary.matchRate = summary.scorable ? summary.matched / summary.scorable : null;
  summary.acceptanceRate = summary.scorable ? (summary.matched + summary.acceptable) / summary.scorable : null;
  return summary;
}

const api = { TRAINING_RESULT, validatePack, evaluateAnswer, stablePackUrl, summarizeResults };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.TrainingPack = api;
