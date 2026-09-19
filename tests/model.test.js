import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, today, weekStart, addDays, occurrences, progress, validate } from '../src/model.js';

test('seed includes the supplied Excedere plan', () => {
  const state = seed('2026-09-20');
  assert.equal(state.tasks.length, 16);
  assert.equal(state.ideas.length, 20);
  assert.equal(state.projects.length, 16);
  assert.equal(state.tasks[0].title, 'Set up or improve one Excedere marketing channel');
});

test('weekly tasks generate occurrences in a requested week', () => {
  const state = seed('2026-09-20');
  const rows = occurrences(state, '2026-09-20', '2026-09-26');
  assert.equal(rows.length, 16);
  assert.equal(progress(rows).total, 16);
  assert.equal(weekStart('2026-09-23'), '2026-09-21');
  assert.equal(addDays('2026-09-20', 6), '2026-09-26');
});

test('invalid imported records are rejected', () => {
  const state = seed('2026-09-20');
  state.tasks[0].status = 'made-up';
  assert.throws(() => validate(state));
});

test('today is timezone formatted', () => {
  assert.equal(today('UTC', new Date('2026-09-18T23:30:00Z')), '2026-09-18');
  assert.equal(today('Asia/Manila', new Date('2026-09-18T23:30:00Z')), '2026-09-19');
});
