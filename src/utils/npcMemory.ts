import type { ChoiceCondition, DialogueDocument, NarrativeEvent, NarrativeProject, NarrativeRecord, ValidationIssue } from '../types/narrative.ts';

export const MEMORY_PATH = 'content/narrative/narrative_events.json';
export const KIND_LABELS = { memory: 'Память', knowledge: 'Знания', belief: 'Убеждения', testimony: 'Свидетельства' };
export type EventHistory = Record<string, number>;
export const recordKey = (record: NarrativeRecord) => `${record.kind}_${record.id}`;
export const isComputed = (id: string) => /^(fact_|memory_|knowledge_|belief_|testimony_)/.test(id) || id === 'narrative_shift';

export function dialogueBundlePath(project: NarrativeProject, dialogue: DialogueDocument): string {
  const character = dialogue.character_id || 'general';
  return project.narrative_events?.length && dialogue.test_content
    ? `content/narrative/${character}_test_dialogues.json`
    : `content/dialogues/${character}.json`;
}
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9_]*$/.test(id);
const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const rating = (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1;

export function computedConditions(events: NarrativeEvent[], characterId: string) {
  return [
    { id: 'narrative_shift', label: 'Номер смены', default_value: 1, type: 'number' },
    ...events.flatMap((event) => [
      { id: `fact_${event.id}`, label: event.fact, default_value: true, type: 'boolean' },
      ...event.records.filter((record) => record.kind === 'testimony' || record.character_id === characterId)
        .map((record) => ({ id: recordKey(record), label: record.text, default_value: true, type: 'boolean' })),
    ]),
  ];
}

export function rememberEvent(events: NarrativeEvent[], history: EventHistory, id: string, shift: number): EventHistory {
  return Object.hasOwn(history, id) || !events.some((event) => event.id === id) ? history : { ...history, [id]: shift };
}

export function visibleRecords(events: NarrativeEvent[], history: EventHistory, characterId: string) {
  return events.flatMap((event) => Object.hasOwn(history, event.id)
    ? event.records.filter((record) => record.character_id === characterId)
      .map((record) => ({ record, eventId: event.id, shift: history[event.id] })) : []);
}

export function evaluateCondition(condition: ChoiceCondition, variables: Record<string, boolean | number | string>, events: NarrativeEvent[], history: EventHistory, characterId: string, shift: number): boolean {
  const { variable_id: id, op, value } = condition;
  let actual = Object.hasOwn(variables, id) ? variables[id] : typeof value === 'boolean' ? false : typeof value === 'number' ? 0 : '';
  if (events.length > 0 && isComputed(id)) {
    actual = id === 'narrative_shift' ? shift : events.some((event) => Object.hasOwn(history, event.id) && (
      id === `fact_${event.id}` || event.records.some((record) => recordKey(record) === id &&
        (record.kind === 'testimony' || record.character_id === characterId))));
  }
  const equal = typeof actual === 'number' && typeof value === 'number'
    ? actual === value || Math.abs(actual - value) < Math.max(0.00001, Math.abs(actual) * 0.00001)
    : actual === value;
  switch (op) {
    case '==': return equal;
    case '!=': return !equal;
    case '>': return Number(actual) > Number(value);
    case '>=': return Number(actual) >= Number(value);
    case '<': return Number(actual) < Number(value);
    case '<=': return Number(actual) <= Number(value);
    default: return false;
  }
}

export function memoryReferences(project: NarrativeProject, eventId: string, recordKeys: string[], removingEvent = false) {
  const keys = new Set(recordKeys);
  if (removingEvent) {
    keys.add(`fact_${eventId}`);
    if (project.narrative_events?.length === 1) keys.add('narrative_shift');
  }
  const dialogues = project.dialogues.filter((dialogue) => (removingEvent && dialogue.starts?.some((start) => [...start.required_events, ...start.excluded_events].includes(eventId))) || dialogue.nodes.some((node) =>
    (removingEvent && (node.effects || []).some((effect) => effect.type === 'npc_event' && effect.event === 'remember' && effect.arg === eventId)) ||
    node.choices.some((choice) => (choice.conditions || []).some((condition) => keys.has(condition.variable_id)))));
  const testimony = (project.narrative_events || []).filter((event) => !removingEvent || event.id !== eventId)
    .flatMap((event) => event.records.filter((record) => record.kind === 'testimony' &&
      ((removingEvent && record.event_id === eventId) || record.related.some((id) => keys.has(id)))));
  const nameRules = removingEvent ? project.characters.filter((character) => character.name_rules?.some((rule) => [...rule.required_events, ...rule.excluded_events].includes(eventId))) : [];
  return { dialogues, testimony, nameRules };
}

export function validateMemoryProject(project: NarrativeProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (path: string, message: string, dialogueId?: string, nodeId?: string) => issues.push({ level: 'error', path, message, dialogueId, nodeId });
  const events = project.narrative_events || [];
  const eventIds = new Set<string>();
  const records = new Map<string, NarrativeRecord>();
  const characters = new Set(project.characters.map((character) => character.id));
  events.forEach((event, index) => {
    const path = `narrative_events[${index}] (${event.id})`;
    if (!validId(event.id) || eventIds.has(event.id)) error(path, 'Некорректный или повторный ID события');
    eventIds.add(event.id);
    if (!nonempty(event.fact)) error(path, 'Заполните объективный факт');
    if (event.service && (!characters.has(event.service.character_id) || !validId(event.service.drink_id))) error(path, 'Некорректный персонаж или напиток для подачи');
    event.records.forEach((record, recordIndex) => {
      const recordPath = `${path}.records[${recordIndex}] (${record.id})`;
      const key = recordKey(record);
      if (!Object.hasOwn(KIND_LABELS, record.kind) || !validId(record.id) || records.has(key)) error(recordPath, 'Некорректный или повторный ID записи');
      records.set(key, record);
      if (!characters.has(record.character_id)) error(recordPath, 'Персонаж отсутствует в проекте');
      if (!nonempty(record.text)) error(recordPath, 'Заполните содержание записи');
      if (record.kind === 'memory' && (!nonempty(record.interpretation) || !validId(record.emotion) || !rating(record.significance) || !rating(record.confidence)))
        error(recordPath, 'Нужны интерпретация, ID эмоции и обе оценки от 0 до 1');
    });
  });
  for (const [key, record] of records) {
    if (record.kind !== 'testimony') continue;
    if (!eventIds.has(record.event_id) || !nonempty(record.source)) error(key, 'Укажите существующее событие и источник свидетельства');
    for (const id of record.related) {
      if (!(id.startsWith('fact_') && eventIds.has(id.slice(5))) && !(id.startsWith('belief_') && records.has(id))) error(key, `Неизвестная связь ${id}`);
    }
  }
  const links = new Set<string>();
  for (const link of project.testimony_links || []) {
    const key = [link.from, link.to].sort().join(':');
    if (link.from === link.to || links.has(key) || !records.has(`testimony_${link.from}`) || !records.has(`testimony_${link.to}`) || !['related', 'contradiction'].includes(link.kind))
      error(`testimony_links.${key}`, 'Некорректная или повторная связь свидетельств');
    links.add(key);
  }
  for (const variable of project.variables) {
    if (events.length && isComputed(variable.id)) error(`variables.${variable.id}`, 'ID зарезервирован для вычисляемого условия');
  }
  for (const dialogue of project.dialogues) {
    const ids = new Set(computedConditions(events, dialogue.character_id).map((item) => item.id));
    for (const node of dialogue.nodes) {
      for (const effect of node.effects || []) {
        if (effect.type === 'npc_event' && effect.event === 'remember' && !eventIds.has(effect.arg || ''))
          error(`dialogue.${dialogue.id}.${node.id}.${effect.effect_id}`, 'Эффект remember требует существующего события', dialogue.id, node.id);
      }
      for (const choice of node.choices) for (const condition of choice.conditions || []) {
        const id = condition.variable_id;
        if (!isComputed(id) || (!events.length && project.variables.some((variable) => variable.id === id))) continue;
        const valid = id === 'narrative_shift'
          ? Number.isInteger(condition.value) && Number(condition.value) > 0 && ['==', '!=', '<', '<=', '>', '>='].includes(condition.op)
          : typeof condition.value === 'boolean' && ['==', '!='].includes(condition.op);
        if (!events.length || !ids.has(id) || !valid) error(`dialogue.${dialogue.id}.${node.id}.${choice.id}`, `Недопустимое условие ${id}`, dialogue.id, node.id);
      }
    }
  }
  return issues;
}

export function compileMemoryFile(project: NarrativeProject) {
  if (!project.narrative_events?.length) return undefined;
  const events = project.narrative_events.map(({ id, fact, service, records }) => ({
    id, fact, records: records.map((record) => {
      const { id, kind, character_id, text } = record;
      const base = { id, kind, character_id, text };
      if (kind === 'memory') return { ...base, interpretation: record.interpretation, emotion: record.emotion, significance: record.significance, confidence: record.confidence };
      if (kind === 'testimony') return { ...base, event_id: record.event_id, source: record.source, related: record.related };
      return base;
    }),
    ...(service ? { service: { character_id: service.character_id, drink_id: service.drink_id } } : {}),
  }));
  return { relativePath: MEMORY_PATH, description: 'События, память, знания, убеждения и свидетельства', content: JSON.stringify({ schema_version: 1, events }, null, 2) + '\n' };
}
