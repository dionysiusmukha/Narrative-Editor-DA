import type { EventGate, NarrativeCharacter, DialogueDocument, NarrativeProject, ValidationIssue } from '../types/narrative.ts';
export function gateMatches(gate: EventGate, history: Record<string, number>, shift: number): boolean {
  return shift >= gate.min_shift && gate.required_events.every((id) => Object.hasOwn(history, id)) && gate.excluded_events.every((id) => !Object.hasOwn(history, id));
}
export function resolveStart(dialogue: DialogueDocument, history: Record<string, number>, shift: number): string | undefined {
  return dialogue.starts?.length ? dialogue.starts.find((start) => gateMatches(start, history, shift))?.node_id : dialogue.start_node;
}
export function displayCharacterName(character: NarrativeCharacter, history: Record<string, number>, shift: number): string {
  return character.name_rules?.find((rule) => gateMatches(rule, history, shift))?.name || character.unknown_name || character.name;
}
export function prepareStart(gate: EventGate): { history: Record<string, number>; shift: number } {
  const shift = Math.max(1, gate.min_shift);
  return { shift, history: Object.fromEntries(gate.required_events.map((id) => [id, Math.max(1, shift - 1)])) };
}

export function validateStartRules(project: NarrativeProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const events = new Set(project.narrative_events?.map((event) => event.id));
  function check(gate: EventGate & { id: string }, title: string, path: string, ids: Set<string>, dialogueId?: string) {
    const error = (message: string) => issues.push({ level: 'error', path, message, dialogueId });
    if (!/^[a-z][a-z0-9_]*$/.test(gate.id) || ids.has(gate.id)) error('Некорректный или повторный ID правила');
    ids.add(gate.id);
    if (!title.trim()) error('Укажите название старта или отображаемое имя');
    if (!Number.isInteger(gate.min_shift) || gate.min_shift < 1) error('Минимальная смена должна быть целым числом от 1');
    for (const id of [...gate.required_events, ...gate.excluded_events]) if (!events.has(id)) error(`Неизвестное событие ${id}`);
    if (gate.required_events.some((id) => gate.excluded_events.includes(id))) error('Одно событие одновременно требуется и запрещено');
  }
  for (const dialogue of project.dialogues) {
    const ids = new Set<string>();
    for (const start of dialogue.starts || []) {
      const path = `dialogue.${dialogue.id}.starts.${start.id}`;
      check(start, start.title, path, ids, dialogue.id);
      if (!dialogue.nodes.some((node) => node.id === start.node_id)) issues.push({ level: 'error', path, dialogueId: dialogue.id, message: 'Начальная реплика старта не найдена' });
    }
  }
  for (const character of project.characters) {
    const ids = new Set<string>();
    for (const rule of character.name_rules || []) check(rule, rule.name, `characters.${character.id}.name_rules.${rule.id}`, ids);
  }
  return issues;
}
