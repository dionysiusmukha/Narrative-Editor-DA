import type { NarrativeProject } from '../types/narrative.ts';

import { journalShapeErrors } from './journal.ts';

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function objects(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(object);
}

export function assertProjectShape(value: unknown): asserts value is NarrativeProject {
  if (!object(value) || value.schema_version !== 1) throw new Error('Ожидается project.narrative.json версии 1');
  if (value.journal_layout !== undefined) { const errors = journalShapeErrors(value.journal_layout); if(errors.length) throw new Error(errors[0]); }
  for (const key of ['characters', 'variables', 'terms', 'reasoning_groups', 'reasoning_links', 'journal_recipes', 'dialogues']) {
    if (!objects(value[key])) throw new Error(`${key}: ожидается массив объектов`);
  }
  const gateShape = (gate: Record<string, unknown>) => Array.isArray(gate.required_events) && gate.required_events.every((id) => typeof id === 'string') && Array.isArray(gate.excluded_events) && gate.excluded_events.every((id) => typeof id === 'string') && typeof gate.min_shift === 'number';
  for (const character of value.characters as Record<string, unknown>[]) {
    if (character.unknown_name !== undefined && typeof character.unknown_name !== 'string') throw new Error('unknown_name: ожидается строка');
    if (character.name_rules !== undefined && (!objects(character.name_rules) || character.name_rules.some((rule) => !gateShape(rule) || typeof rule.name !== 'string' || typeof rule.id !== 'string'))) throw new Error('name_rules: повреждены правила имени');
  }
  for (const [index, dialogue] of (value.dialogues as Record<string, unknown>[]).entries()) {
    if (dialogue.starts !== undefined && (!objects(dialogue.starts) || dialogue.starts.some((start) => !gateShape(start) || typeof start.id !== 'string' || typeof start.title !== 'string' || typeof start.node_id !== 'string'))) throw new Error(`dialogues[${index}].starts: повреждены старты`);
    if (!objects(dialogue.nodes) || dialogue.nodes.some((node) => !objects(node.choices) ||
        (node.effects !== undefined && !objects(node.effects)) ||
        (node.choices as Record<string, unknown>[]).some((choice) => choice.conditions !== undefined && !objects(choice.conditions)))) {
      throw new Error(`dialogues[${index}]: повреждены узлы, ответы, условия или эффекты`);
    }
  }
  for (const character of value.characters as Record<string, unknown>[]) {
    if (character.name_rules !== undefined && !objects(character.name_rules)) throw new Error('name_rules: ожидается массив');
  }
  if (value.narrative_events !== undefined) {
    if (!objects(value.narrative_events)) throw new Error('narrative_events: ожидается массив событий');
    for (const [index, event] of value.narrative_events.entries()) {
      if (!objects(event.records) || (event.service !== undefined && !object(event.service)) || event.records.some((record) =>
        record.kind === 'testimony' && (!Array.isArray(record.related) || record.related.some((id) => typeof id !== 'string')))) {
        throw new Error(`narrative_events[${index}]: повреждены записи, связи или триггер подачи`);
      }
    }
  }
  if (value.testimony_links !== undefined && !objects(value.testimony_links)) throw new Error('testimony_links: ожидается массив связей');
}
