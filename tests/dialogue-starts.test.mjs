import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { gateMatches, prepareStart, resolveStart, displayCharacterName } from '../src/utils/dialogueStarts.ts';
import { characterId } from '../src/utils/ids.ts';
import { validateProject } from '../src/utils/validator.ts';
import { compileGodotFiles } from '../src/utils/godotExporter.ts';
import { assertProjectShape } from '../src/utils/projectImport.ts';
import { memoryReferences } from '../src/utils/npcMemory.ts';
const original = JSON.parse(fs.readFileSync(new URL('../examples/arkadiy-memory.narrative.json', import.meta.url), 'utf8'));
const rude = 'player_rude_to_arkady';
const apology = 'player_apologized_to_arkady';
const gate = { required_events: [rude], excluded_events: [apology], min_shift: 2 };
function fixture() {
  const project = structuredClone(original);
  const node = (id) => ({ id, speaker: 'Аркадий', text: id, end: true, effects: [], choices: [], position: { x: 0, y: 0 } });
  project.dialogues = [{ id: 'dialogue_arkadiy_test', title: 'Вторая встреча', character_id: 'arkadiy', start_node: 'calm', allow_cycles: false, test_content: true,
    nodes: [node('angry'), node('calm')], starts: [
      { ...gate, id: 'start_arkadiy_angry', title: 'После ссоры', node_id: 'angry' },
      { required_events: [], excluded_events: [rude], min_shift: 1, id: 'start_arkadiy_calm', title: 'Без ссоры', node_id: 'calm' },
    ] }];
  return project;
}
test('different endings open different roots; forbidden events and shift are enforced', () => {
  const project = fixture(); const d = project.dialogues[0];
  assert.equal(resolveStart(d, {}, 1), 'calm');
  assert.equal(resolveStart(d, { [rude]: 1 }, 1), undefined);
  assert.equal(resolveStart(d, { [rude]: 1 }, 2), 'angry');
  assert.equal(resolveStart(d, { [rude]: 1, [apology]: 2 }, 3), undefined);
  assert.deepEqual(prepareStart(gate), { history: { [rude]: 1 }, shift: 2 });
  assert.ok(gateMatches(gate, prepareStart(gate).history, prepareStart(gate).shift));
  assert.deepEqual(validateProject(project), []);
  delete d.starts;
  assert.equal(resolveStart(d, {}, 1), 'calm');
});
test('name discovery is global, ordered and can be triggered by another character', () => {
  const character = { ...original.characters[0], name: 'Аркадий', unknown_name: 'Незнакомец', name_rules: [
    { ...gate, id: 'name_alias', name: 'Диспетчер' },
    { required_events: [apology], excluded_events: [], min_shift: 1, id: 'name_real', name: 'Аркадий' },
  ] };
  assert.equal(displayCharacterName(character, {}, 1), 'Незнакомец');
  assert.equal(displayCharacterName(character, { [rude]: 1 }, 2), 'Диспетчер');
  assert.equal(displayCharacterName(character, { [rude]: 1, [apology]: 2 }, 2), 'Аркадий');
  assert.equal(displayCharacterName({ ...character, name_rules: [], unknown_name: '' }, {}, 1), 'Аркадий');
});
test('starts, gates and names round-trip and export; referenced events cannot be removed', () => {
  const project = fixture();
  project.characters[0].unknown_name = 'Незнакомец';
  project.characters[0].name_rules = [{ ...gate, id: 'name_arkadiy', name: 'Аркадий' }];
  const restored = JSON.parse(JSON.stringify(project));
  assert.doesNotThrow(() => assertProjectShape(restored));
  assert.deepEqual(restored, project);
  const files = compileGodotFiles(restored);
  const d = files.map((f) => JSON.parse(f.content)).find((data) => data.dialogues?.some((d) => d.id === project.dialogues[0].id));
  assert.deepEqual(d.dialogues[0].starts, project.dialogues[0].starts);
  const c = files.map((f) => JSON.parse(f.content)).find((data) => data.id === project.characters[0].id);
  assert.equal(c.unknown_name, 'Незнакомец');
  assert.deepEqual(c.name_rules, project.characters[0].name_rules);
  const refs = memoryReferences(project, rude, [], true);
  assert.ok(refs.dialogues.length); assert.ok(refs.nameRules.length);
});
test('invalid roots, contradictory gates, bad shifts and malformed imports are rejected', () => {
  const project = fixture();
  const start = project.dialogues[0].starts[0];
  start.node_id = 'missing'; start.excluded_events.push(rude); start.required_events.push('missing_event'); start.min_shift = 0;
  const issues = validateProject(project);
  assert.ok(issues.some((i) => i.message.includes('не найдена')));
  assert.ok(issues.some((i) => i.message.includes('одновременно')));
  assert.ok(issues.some((i) => i.message.includes('Неизвестное событие')));
  assert.ok(issues.some((i) => i.message.includes('Минимальная смена')));
  start.required_events = null;
  assert.throws(() => assertProjectShape(project), /starts/);
});
test('new character-linked IDs include author name and distinguish identical titles', () => {
  assert.equal(characterId('dialogue', 'Аркадий', 'Встреча'), 'dialogue_arkadiy_vstrecha');
  assert.notEqual(characterId('memory', 'Аркадий', 'Встреча'), characterId('memory', 'Воронов', 'Встреча'));
  const id = characterId('memory', 'Аркадий', 'Встреча');
  assert.equal(characterId('memory', 'Аркадий', 'Встреча', [id]), id + '_2');
});
