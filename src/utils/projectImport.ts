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
  for (const [index, dialogue] of (value.dialogues as Record<string, unknown>[]).entries()) {
    if (!objects(dialogue.nodes) || dialogue.nodes.some((node) => !objects(node.choices) ||
        (node.effects !== undefined && !objects(node.effects)) ||
        (node.choices as Record<string, unknown>[]).some((choice) => choice.conditions !== undefined && !objects(choice.conditions)))) {
      throw new Error(`dialogues[${index}]: повреждены узлы, ответы, условия или эффекты`);
    }
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
