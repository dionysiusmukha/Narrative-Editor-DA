import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewNarrativeConsistency } from '../src/utils/validator.ts';

function fixture() {
  return {
    characters: [
      { id: 'arkadiy', name: 'Аркадий' },
      { id: 'inspector_voronov', name: 'Инспектор Воронов' },
    ],
    dialogues: [{
      id: 'after_shift',
      character_id: 'inspector_voronov',
      nodes: [
        { id: 'opening', character_id: 'arkadiy', speaker: 'Аркадий' },
        { id: 'ending', character_id: 'arkadiy', speaker: 'Аркадий' },
      ],
    }],
  };
}

test('a dialogue owned by another character gets an editorial warning', () => {
  const warnings = reviewNarrativeConsistency(fixture());
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, 'warning');
  assert.equal(warnings[0].dialogueId, 'after_shift');
  assert.match(warnings[0].message, /Аркадий/);
  assert.match(warnings[0].message, /Инспектор Воронов/);
});

test('mixed-speaker dialogue does not get the all-speakers warning', () => {
  const project = fixture();
  project.dialogues[0].nodes[1].character_id = 'inspector_voronov';
  assert.equal(reviewNarrativeConsistency(project).length, 0);
});
