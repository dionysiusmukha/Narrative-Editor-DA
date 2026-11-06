import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileGodotFiles } from '../src/utils/godotExporter.ts';
import { computedConditions, evaluateCondition, memoryReferences, rememberEvent, visibleRecords } from '../src/utils/npcMemory.ts';
import { assertProjectShape } from '../src/utils/projectImport.ts';
import { validateProject } from '../src/utils/validator.ts';

const sample = JSON.parse(fs.readFileSync(new URL('../examples/arkadiy-memory.narrative.json', import.meta.url), 'utf8'));
const events = sample.narrative_events;
const dialogue = sample.dialogues.find((item) => item.id === 'arkadiy_memory_demo');

function available(nodeId, choiceId, history, shift) {
  const choice = dialogue.nodes.find((node) => node.id === nodeId).choices.find((item) => item.id === choiceId);
  return choice.conditions.every((condition) => evaluateCondition(condition, {}, events, history, dialogue.character_id, shift));
}

test('первая встреча, противоположные ветки второй смены и извинение', () => {
  assert.equal(available('arrival', 'listen', {}, 1), true);
  assert.equal(available('arrival', 'tense_return', {}, 1), false);
  const rude = rememberEvent(events, {}, 'player_rude_to_arkady', 1);
  assert.equal(rememberEvent(events, rude, 'player_rude_to_arkady', 2), rude);
  assert.equal(available('arrival', 'tense_return', rude, 2), true);
  assert.equal(available('arrival', 'warm_return', rude, 2), false);
  const repaired = rememberEvent(events, rude, 'player_apologized_to_arkady', 2);
  assert.equal(available('arrival', 'tense_return', repaired, 3), false);
  assert.equal(available('arrival', 'repaired_return', repaired, 3), true);
  const memories = visibleRecords(events, repaired, 'arkadiy').filter(({ record }) => record.kind === 'memory');
  assert.deepEqual(memories.map(({ record, shift }) => [record.id, shift]), [['arkadiy_rude_reply', 1], ['arkadiy_apology', 2]]);
  const kind = rememberEvent(events, {}, 'arkadiy_supported', 1);
  assert.equal(available('arrival', 'warm_return', kind, 2), true);
  assert.equal(available('arrival', 'repaired_return', {}, 1), false);
  assert.equal(rememberEvent(events, {}, 'unscripted', 1).unscripted, undefined);
});

test('личные записи разделены, свидетельства доступны в условиях разных NPC', () => {
  const rude = rememberEvent(events, {}, 'player_rude_to_arkady', 1);
  const belief = { variable_id: 'belief_arkadiy_player_dislikes_him', op: '==', value: true };
  assert.equal(evaluateCondition(belief, {}, events, rude, 'arkadiy', 2), true);
  assert.equal(evaluateCondition(belief, {}, events, rude, 'night_guard', 2), false);
  assert.deepEqual(visibleRecords(events, rude, 'night_guard'), []);
  assert.equal(computedConditions(events, 'night_guard').some((item) => item.id === belief.variable_id), false);
  let history = rude;
  for (const who of ['arkadiy', 'voronov', 'guard']) {
    assert.equal(available('arrival', 'compare_accounts', history, 2), false);
    history = rememberEvent(events, history, `heard_${who}_departure`, 2);
  }
  assert.equal(available('arrival', 'compare_accounts', history, 2), true);
  const witnesses = ['arkadiy', 'inspector_voronov', 'night_guard'].flatMap((id) => visibleRecords(events, history, id))
    .filter(({ record }) => record.kind === 'testimony');
  assert.equal(new Set(witnesses.map(({ record }) => record.text)).size, 3);
  assert.ok(witnesses.every(({ record }) => record.event_id === 'incident_night_01' && record.source));
});

test('проверяет битый импорт, дубли, владельцев, ссылки и типы условий', () => {
  assert.doesNotThrow(() => assertProjectShape(sample));
  assert.deepEqual(validateProject(sample), []);
  assert.throws(() => assertProjectShape({ ...sample, narrative_events: [{ id: 'bad' }] }), /narrative_events\[0\]/);
  const broken = structuredClone(sample);
  broken.narrative_events.push(broken.narrative_events[0]);
  broken.testimony_links.push({ from: 'missing', to: 'guard_departure', kind: 'contradiction' });
  broken.narrative_events[0].records[0].character_id = 'missing';
  broken.narrative_events[0].records[0].confidence = 2;
  broken.dialogues[0].nodes[0].choices[0].conditions[0].value = '1';
  broken.dialogues[0].nodes[0].effects[0].arg = 'removed';
  const issues = validateProject(broken);
  for (const expected of [/повторный ID события/, /Персонаж отсутствует/, /оценки/, /недопустимое условие/i, /remember/, /связь свидетельств/]) {
    assert.ok(issues.some((issue) => expected.test(issue.message)), String(expected));
  }
  assert.ok(memoryReferences(sample, 'player_rude_to_arkady', [], true).dialogues.some((item) => item.id === dialogue.id));
  assert.equal(memoryReferences(sample, 'incident_night_01', [], true).testimony.length, 3);
});

test('выгрузка примера совпадает в браузере и CLI и отделяет редакторские связи', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'da-memory-export-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/export-cli.mjs', directory, 'examples/arkadiy-memory.narrative.json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const file of compileGodotFiles(sample)) assert.equal(fs.readFileSync(path.join(directory, file.relativePath), 'utf8'), file.content);
    const memory = JSON.parse(fs.readFileSync(path.join(directory, 'content/narrative/narrative_events.json'), 'utf8'));
    assert.deepEqual(memory, { schema_version: 1, events });
    const demo = JSON.parse(fs.readFileSync(path.join(directory, 'content/narrative/arkadiy_test_dialogues.json'), 'utf8'));
    assert.equal(demo.test_content, true);
    assert.equal(demo.dialogues[0].nodes[0].effects[0].event, 'remember');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('неизменённый проект даёт шесть прежних файлов побайтно', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'da-legacy-export-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/export-cli.mjs', directory], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const expected = {
      'characters/arkadiy.json': 'b1777b4f7a129b77035a6d1c90e0cb9c53203f28a58296e18cb92c1d75b0383a',
      'characters/bartender.json': 'ff7bdf5c74ab4b97e9e0c1ab7c14cb35ab0b82c116cab8a12a6858d3feb9240e',
      'characters/inspector_voronov.json': '19e7123e7ad0b503745322bcfb2cff26d42d4ee8cbb750f02dee1f69609dd2fd',
      'dialogues/arkadiy.json': 'faf6c8e765b30c3632741cba9f050100e33cab7788a3db61656e7dd4d2d6d285',
      'glossary/narrative_terms.json': '178cf9a38ebff8396f1ac4a0809da221e038bc8000f5d45ec8903272e1a7faf6',
      'variables/narrative_variables.json': 'b0973223efbf4205526b57599d151cd69fec8aa463ff399ec906837d7db97ef2',
    };
    for (const [name, hash] of Object.entries(expected)) {
      assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory, 'content', name))).digest('hex'), hash, name);
    }
    assert.equal(fs.existsSync(path.join(directory, 'content/narrative')), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});


test('editor titles survive save/import without changing the Godot export contract', () => {
  const titled = structuredClone(sample);
  for (const event of titled.narrative_events) {
    event.title = 'Название события';
    for (const record of event.records) record.title = 'Название записи';
  }
  for (const doc of titled.dialogues) for (const node of doc.nodes) {
    node.title = 'Название реплики';
    for (const choice of node.choices) choice.title = 'Название ответа';
    for (const effect of node.effects || []) effect.title = 'Название эффекта';
  }
  const restored = JSON.parse(JSON.stringify(titled));
  assert.doesNotThrow(() => assertProjectShape(restored));
  assert.equal(restored.narrative_events[0].records[0].title, 'Название записи');
  assert.deepEqual(compileGodotFiles(restored), compileGodotFiles(sample));
  assert.deepEqual(validateProject(restored), []);
});
