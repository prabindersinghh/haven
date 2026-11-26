// Tests for the reference Awaaz ranking (src/awaaz/match.ts), bundled on the fly with esbuild.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const out = path.join(os.tmpdir(), `haven-match-${process.pid}.mjs`);
await build({ entryPoints: ['src/awaaz/match.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
const { rankPhrases, emptyHabits, recordConfirmation, ABSTAIN_THRESHOLD } = await import(pathToFileURL(out).href);

const top = (s, h = emptyHabits()) => rankPhrases([s], h, 'en');

test('matches romanised Hindi, Devanagari, Gurmukhi and English', () => {
  assert.equal(top('mujhe paani chahiye').candidates[0].phraseId, 'water');
  assert.equal(top('मुझे दर्द हो रहा है').candidates[0].phraseId, 'pain');
  assert.equal(top('ਮੈਨੂੰ ਸਾਹ ਨਹੀਂ ਆ ਰਿਹਾ').candidates[0].phraseId, 'breath');
  assert.equal(top('I fell down').candidates[0].phraseId, 'fell');
});

test('abstains instead of guessing on unrelated speech', () => {
  const r = top('blah blah weather');
  assert.equal(r.abstained, true);
  assert.ok(r.candidates.every((c) => c.score < ABSTAIN_THRESHOLD));
});

test('returns at most three candidates', () => {
  assert.ok(top('pain water help').candidates.length <= 3);
});

test('confirmed phrases raise the score through the habit prior', () => {
  let h = emptyHabits();
  const before = top('paani', h).candidates[0].score;
  for (let i = 0; i < 5; i++) h = recordConfirmation(h, 'water');
  assert.ok(top('paani', h).candidates[0].score > before);
});

test('empty input abstains', () => {
  assert.equal(top('').abstained, true);
});
