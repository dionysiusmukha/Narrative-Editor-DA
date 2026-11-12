import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateProject } from '../src/utils/validator.ts';
import { compileGodotFiles } from '../src/utils/godotExporter.ts';
import { assertProjectShape } from '../src/utils/projectImport.ts';

const original = JSON.parse(fs.readFileSync(new URL('../examples/arkadiy-memory.narrative.json', import.meta.url), 'utf8'));
function fixture() {
  const project = structuredClone(original);
  project.drinks = [
    { id: 'stvor_shot', title: 'Створ без добавок', description: '', vessel_id: 'test_shot', components_ml: { test_stvor: 45 }, tolerance_ml: 3 },
    { id: 'water_shot', title: 'Вода', description: '', vessel_id: 'test_shot', components_ml: { test_water: 40 }, tolerance_ml: 3 },
  ];
  project.dialogues = [{ id: 'drink_gate_test', title: 'Подача', character_id: project.characters[0].id, start_node: 'opening', allow_cycles: false, test_content: true, nodes: [
    { id: 'opening', speaker: 'Гость', text: 'Налейте.', end: false, effects: [], choices: [], position: { x: 0, y: 0 }, drink_gate: { expected_drink_id: 'stvor_shot', resume_after: 'sipped', on_expected: 'expected', on_other_drinks: [{ drink_id: 'water_shot', target: 'water', consumed: false }], on_fallback: 'other', fallback_consumed: true } },
    ...['expected', 'water', 'other'].map((id) => ({ id, speaker: 'Гость', text: id, end: true, effects: [], choices: [], position: { x: 0, y: 0 } })),
  ] }];
  return project;
}

test('authored drink and pause branches survive import and export', () => {
  const project = fixture();
  assert.doesNotThrow(() => assertProjectShape(project));
  assert.deepEqual(validateProject(project), []);
  const files = compileGodotFiles(project);
  const drinks = JSON.parse(files.find((file) => file.relativePath === 'content/drinks/narrative_drinks.json').content);
  assert.deepEqual(drinks.drinks, project.drinks);
  const dialogue = files.map((file) => JSON.parse(file.content)).find((data) => data.dialogues?.[0]?.id === 'drink_gate_test');
  assert.deepEqual(dialogue.dialogues[0].nodes[0].drink_gate, project.dialogues[0].nodes[0].drink_gate);
});

test('missing recipe and missing outcome target fail validation', () => {
  const project = fixture();
  project.dialogues[0].nodes[0].drink_gate.expected_drink_id = 'missing';
  project.dialogues[0].nodes[0].drink_gate.on_fallback = 'gone';
  const issues = validateProject(project);
  assert.ok(issues.some((issue) => issue.path.includes('drink_gate')));
  assert.ok(issues.some((issue) => issue.message.includes('отсутствующий узел')));
});

test('recipe volume must fit the selected glass', () => {
  const project = fixture();
  project.drinks[0].components_ml.test_stvor = 70;
  assert.ok(validateProject(project).some((issue) => issue.path === 'drinks.stvor_shot'));
});
