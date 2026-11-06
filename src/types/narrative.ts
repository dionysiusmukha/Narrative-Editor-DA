export type NpcEmotion = 'neutral' | 'interested' | 'thoughtful' | 'tense' | 'disagree';

export const NPC_EMOTIONS: Array<{ id: NpcEmotion; label: string; color: string }> = [
  { id: 'neutral', label: 'Спокойствие (neutral)', color: '#94a3b8' },
  { id: 'interested', label: 'Заинтересованность (interested)', color: '#38bdf8' },
  { id: 'thoughtful', label: 'Задумчивость (thoughtful)', color: '#a78bfa' },
  { id: 'tense', label: 'Напряжение (tense)', color: '#fbbf24' },
  { id: 'disagree', label: 'Несогласие / Отказ (disagree)', color: '#f87171' },
];

export const DRINK_INGREDIENTS: Array<{ id: string; label: string }> = [
  { id: 'test_stvor', label: 'Северный створ · 0,25 л (test_stvor)' },
  { id: 'test_soda', label: 'Газированный компонент (test_soda)' },
  { id: 'test_water', label: 'Талая вода (test_water)' },
  { id: 'test_heavy', label: 'Плотный компонент (test_heavy)' },
  { id: 'test_base', label: 'Базовый компонент (test_base)' },
  { id: 'test_light', label: 'Лёгкий компонент (test_light)' },
  { id: 'test_shot', label: 'Рюмка «Кромка» 60 мл (test_shot)' },
  { id: 'test_glass', label: 'Стакан «Гранитоль» 240 мл (test_glass)' },
];

export interface CharacterRelationship {
  target_id: string;
  trust: number;
  conflict: number;
  hidden: boolean;
  note: string;
}

export interface NarrativeCharacter {
  id: string;
  name: string;
  role: string;
  biography: string;
  personality: string;
  motivation: string;
  secrets: string;
  default_emotion: NpcEmotion;
  available_emotions: NpcEmotion[];
  preferences: string[];
  relationships: CharacterRelationship[];
  avatar_color: string;
}

export type VariableType = 'boolean' | 'number' | 'string';
export type VariableCategory = 'relationship' | 'character_state' | 'event' | 'player_decision';

export interface NarrativeVariable {
  id: string;
  title: string;
  type: VariableType;
  default_value: boolean | number | string;
  min?: number;
  max?: number;
  enum_values?: string[];
  category: VariableCategory;
  character_id?: string;
  description: string;
}

export interface GlossaryTerm {
  id: string;
  title: string;
  description: string;
  is_system?: boolean;
}

export interface ReasoningOption {
  id: string;
  text: string;
  required_conclusions?: string[];
}

export interface ReasoningGroup {
  id: string;
  title: string;
  terms: string[];
  minimum_terms: number;
  sheet: number;
  position: [number, number];
  options: ReasoningOption[];
}

export interface ReasoningLink {
  from: string;
  to: string;
  when?: 'both_conclusions' | 'source_conclusion';
  required_conclusions?: string[];
}

export interface JournalRecipe {
  id: string;
  title: string;
  text: string;
  required_terms: string[];
}

export type ConditionOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface ChoiceCondition {
  variable_id: string;
  op: ConditionOperator;
  value: boolean | number | string;
}

export interface DialogueChoice {
  id: string;
  text: string;
  target: string;
  required_terms: string[];
  required_conclusions: string[];
  conditions: ChoiceCondition[];
}

export type DialogueEffectType =
  | 'grant_term'
  | 'set_variable'
  | 'add_variable'
  | 'npc_event'
  | 'service_event';

export interface DialogueEffect {
  effect_id: string;
  type: DialogueEffectType;
  term_id?: string;
  variable_id?: string;
  value?: boolean | number | string;
  event?: string;
  arg?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  character_id?: string;
  emotion?: NpcEmotion;
  text: string;
  end: boolean;
  effects: DialogueEffect[];
  choices: DialogueChoice[];
  position: { x: number; y: number };
  notes?: string;
}

export interface DialogueDocument {
  id: string;
  character_id: string;
  title: string;
  start_node: string;
  allow_cycles: boolean;
  cycle_note?: string;
  test_content: boolean;
  nodes: DialogueNode[];
}

export interface NarrativeProject {
  journal_layout?: import('./journal').JournalLayout;
  schema_version: 1;
  project_name: string;
  godot_project_path: string;
  characters: NarrativeCharacter[];
  variables: NarrativeVariable[];
  terms: GlossaryTerm[];
  reasoning_groups: ReasoningGroup[];
  reasoning_links: ReasoningLink[];
  journal_recipes: JournalRecipe[];
  dialogues: DialogueDocument[];
  narrative_events?: NarrativeEvent[];
  testimony_links?: TestimonyLink[];
}

export const RECORD_KINDS = ['memory', 'knowledge', 'belief', 'testimony'] as const;
export type RecordKind = typeof RECORD_KINDS[number];

interface RecordBase {
  id: string;
  character_id: string;
  text: string;
}

export type NarrativeRecord = RecordBase & (
  | { kind: 'memory'; interpretation: string; emotion: string; significance: number; confidence: number }
  | { kind: 'knowledge' | 'belief' }
  | { kind: 'testimony'; event_id: string; source: string; related: string[] }
);

export interface NarrativeEvent {
  id: string;
  fact: string;
  records: NarrativeRecord[];
  service?: { character_id: string; drink_id: string };
}

export interface TestimonyLink {
  from: string;
  to: string;
  kind: 'related' | 'contradiction';
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  nodeId?: string;
  dialogueId?: string;
  message: string;
}
