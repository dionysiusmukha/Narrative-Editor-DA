import { characterId } from '../utils/ids';
import { generateId } from '../utils/ids';
import { create } from 'zustand';
import {
  CharacterRelationship,
  DialogueChoice,
  DialogueDocument,
  DialogueEffect,
  DialogueNode,
  GlossaryTerm,
  NarrativeCharacter,
  NarrativeProject,
  NarrativeVariable,
  ReasoningGroup,
} from '../types/narrative';
import { DEFAULT_ARKADIY_PROJECT } from '../data/arkadiyProject';
import { validateProject } from '../utils/validator';
import { assertProjectShape } from '../utils/projectImport';

export type EditorTab =
  | 'journal'
  | 'characters'
  | 'dialogues'
  | 'variables'
  | 'glossary'
  | 'simulator'
  | 'events'
  | 'export';

interface SaveStatus {
  state: 'unknown' | 'saving' | 'saved' | 'outdated' | 'error';
  message?: string;
  lastSavedAt?: string;
  paths?: string[];
}

interface NarrativeStoreState {
  project: NarrativeProject;
  updateNarrative: (patch: Pick<Partial<NarrativeProject>, 'narrative_events' | 'testimony_links' | 'journal_layout'>) => void;
  activeTab: EditorTab;
  selectedCharacterId: string;
  selectedDialogueId: string;
  selectedNodeId: string | null;
  browserSave: SaveStatus;
  projectSave: SaveStatus;
  godotExport: SaveStatus;

  setActiveTab: (tab: EditorTab) => void;
  setSelectedCharacterId: (id: string) => void;
  setSelectedDialogueId: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setGodotProjectPath: (path: string) => void;

  // Characters
  addCharacter: (char: NarrativeCharacter) => void;
  updateCharacter: (id: string, patch: Partial<NarrativeCharacter>) => void;
  deleteCharacter: (id: string) => void;
  upsertRelationship: (charId: string, rel: CharacterRelationship) => void;
  removeRelationship: (charId: string, targetId: string) => void;

  // Variables
  addVariable: (variable: NarrativeVariable) => void;
  updateVariable: (id: string, patch: Partial<NarrativeVariable>) => void;
  deleteVariable: (id: string) => void;

  // Glossary & Journal Reasoning
  addTerm: (term: GlossaryTerm) => void;
  updateTerm: (id: string, patch: Partial<GlossaryTerm>) => void;
  deleteTerm: (id: string) => void;
  addReasoningGroup: (group: ReasoningGroup) => void;
  updateReasoningGroup: (id: string, patch: Partial<ReasoningGroup>) => void;
  deleteReasoningGroup: (id: string) => void;

  // Dialogues & Nodes
  addDialogue: (dialogue: DialogueDocument) => void;
  updateDialogueMeta: (id: string, patch: Partial<DialogueDocument>) => void;
  deleteDialogue: (id: string) => void;
  addDialogueNode: (dialogueId: string, node?: Partial<DialogueNode>) => string;
  updateDialogueNode: (
    dialogueId: string,
    nodeId: string,
    patch: Partial<DialogueNode>
  ) => void;
  renameDialogueNodeId: (dialogueId: string, oldId: string, newId: string) => void;
  updateNodePosition: (
    dialogueId: string,
    nodeId: string,
    position: { x: number; y: number }
  ) => void;
  deleteDialogueNode: (dialogueId: string, nodeId: string) => void;

  // Choices & Connections
  addChoice: (dialogueId: string, nodeId: string) => void;
  updateChoice: (
    dialogueId: string,
    nodeId: string,
    choiceId: string,
    patch: Partial<DialogueChoice>
  ) => void;
  deleteChoice: (dialogueId: string, nodeId: string, choiceId: string) => void;
  connectChoiceToTarget: (
    dialogueId: string,
    sourceNodeId: string,
    choiceId: string,
    targetNodeId: string
  ) => void;

  // Effects
  addEffect: (dialogueId: string, nodeId: string, effect?: Partial<DialogueEffect>) => void;
  updateEffect: (
    dialogueId: string,
    nodeId: string,
    effectId: string,
    patch: Partial<DialogueEffect>
  ) => void;
  deleteEffect: (dialogueId: string, nodeId: string, effectId: string) => void;
  quickGrantTermOnNode: (
    dialogueId: string,
    nodeId: string,
    termId: string,
    termTitle: string,
    termDescription: string
  ) => void;

  // Persistence & Godot Sync
  loadProjectFromServer: () => Promise<void>;
  saveProjectToServer: () => Promise<void>;
  syncWithGodot: () => Promise<{ ok: boolean; files?: string[]; error?: string }>;
  importProjectJson: (project: NarrativeProject) => void;
  resetToArkadiyDefault: () => void;
}

const STORAGE_KEY = 'dark_alone_narrative_editor_v1';

function readLocalProject(): NarrativeProject | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const project: unknown = JSON.parse(raw);
      assertProjectShape(project);
      return project;
    }
  } catch {
    // ignore storage errors
  }
}

function persistLocal(project: NarrativeProject): string | undefined {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'Не удалось сохранить черновик в браузере';
  }
}

export const useNarrativeStore = create<NarrativeStoreState>((set, get) => {
  const initial = readLocalProject() ?? structuredClone(DEFAULT_ARKADIY_PROJECT);

  return {
    project: initial,
    activeTab: 'dialogues',
    selectedCharacterId: initial.characters[0]?.id || 'arkadiy',
    selectedDialogueId: initial.dialogues[0]?.id || 'arkadiy_intro',
    selectedNodeId: initial.dialogues[0]?.start_node || 'opening',
    browserSave: { state: readLocalProject() ? 'saved' : 'unknown' },
    projectSave: { state: 'unknown' },
    godotExport: { state: 'unknown' },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
    setSelectedDialogueId: (id) => {
      const dlg = get().project.dialogues.find((d) => d.id === id);
      set({
        selectedDialogueId: id,
        selectedNodeId: dlg?.start_node || dlg?.nodes[0]?.id || null,
      });
    },
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setGodotProjectPath: (godot_project_path) =>
      set((state) => {
        const next = { ...state.project, godot_project_path };
        return { project: next };
      }),

    addCharacter: (char) =>
      set((state) => {
        const next = {
          ...state.project,
          characters: [...state.project.characters, char],
        };
        return { project: next, selectedCharacterId: char.id };
      }),

    updateCharacter: (id, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          characters: state.project.characters.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        };
        return { project: next };
      }),

    deleteCharacter: (id) =>
      set((state) => {
        const filtered = state.project.characters.filter((c) => c.id !== id);
        const next = { ...state.project, characters: filtered };
        return {
          project: next,
          selectedCharacterId: filtered[0]?.id || '',
        };
      }),

    upsertRelationship: (charId, rel) =>
      set((state) => {
        const next = {
          ...state.project,
          characters: state.project.characters.map((c) => {
            if (c.id !== charId) return c;
            const exists = c.relationships.some((r) => r.target_id === rel.target_id);
            const relationships = exists
              ? c.relationships.map((r) => (r.target_id === rel.target_id ? rel : r))
              : [...c.relationships, rel];
            return { ...c, relationships };
          }),
        };
        return { project: next };
      }),

    removeRelationship: (charId, targetId) =>
      set((state) => {
        const next = {
          ...state.project,
          characters: state.project.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  relationships: c.relationships.filter((r) => r.target_id !== targetId),
                }
              : c
          ),
        };
        return { project: next };
      }),

    addVariable: (variable) =>
      set((state) => {
        const next = {
          ...state.project,
          variables: [...state.project.variables, variable],
        };
        return { project: next };
      }),

    updateVariable: (id, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          variables: state.project.variables.map((v) =>
            v.id === id ? { ...v, ...patch } : v
          ),
        };
        return { project: next };
      }),

    deleteVariable: (id) =>
      set((state) => {
        const next = {
          ...state.project,
          variables: state.project.variables.filter((v) => v.id !== id),
        };
        return { project: next };
      }),

    addTerm: (term) =>
      set((state) => {
        const next = {
          ...state.project,
          terms: [...state.project.terms, term],
        };
        return { project: next };
      }),

    updateTerm: (id, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          terms: state.project.terms.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        };
        return { project: next };
      }),

    deleteTerm: (id) =>
      set((state) => {
        const next = {
          ...state.project,
          terms: state.project.terms.filter((t) => t.id !== id),
        };
        return { project: next };
      }),

    addReasoningGroup: (group) =>
      set((state) => {
        const next = {
          ...state.project,
          reasoning_groups: [...state.project.reasoning_groups, group],
        };
        return { project: next };
      }),

    updateReasoningGroup: (id, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          reasoning_groups: state.project.reasoning_groups.map((g) =>
            g.id === id ? { ...g, ...patch } : g
          ),
        };
        return { project: next };
      }),

    deleteReasoningGroup: (id) =>
      set((state) => {
        const next = {
          ...state.project,
          reasoning_groups: state.project.reasoning_groups.filter((g) => g.id !== id),
        };
        return { project: next };
      }),

    addDialogue: (dialogue) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: [...state.project.dialogues, dialogue],
        };
        return {
          project: next,
          selectedDialogueId: dialogue.id,
          selectedNodeId: dialogue.start_node,
        };
      }),

    updateDialogueMeta: (id, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
        };
        return { project: next };
      }),

    deleteDialogue: (id) =>
      set((state) => {
        const dialogues = state.project.dialogues.filter((d) => d.id !== id);
        const next = { ...state.project, dialogues };
        return {
          project: next,
          selectedDialogueId: dialogues[0]?.id || '',
          selectedNodeId: dialogues[0]?.start_node || null,
        };
      }),

    addDialogueNode: (dialogueId, nodePatch) => {
      const state = get();
      const dlg = state.project.dialogues.find((d) => d.id === dialogueId);
      const char = state.project.characters.find(
        (c) => c.id === (dlg?.character_id || state.selectedCharacterId)
      );
      const index = (dlg?.nodes.length || 0) + 1;
      const newId = characterId('node', char?.name || dlg?.character_id || 'Персонаж', nodePatch?.title || (nodePatch?.end ? 'Завершение разговора' : 'Новая реплика персонажа'), dlg?.nodes.map((n) => n.id));

      const isEnd = nodePatch?.end ?? false;
      const newNode: DialogueNode = {
        id: newId,
        title: nodePatch?.title || (isEnd ? 'Завершение разговора' : 'Новая реплика персонажа'),
        speaker: nodePatch?.speaker || char?.name || 'Аркадий',
        character_id: nodePatch?.character_id || char?.id || 'arkadiy',
        emotion: nodePatch?.emotion || char?.default_emotion || 'neutral',
        text: nodePatch?.text || 'Новая реплика персонажа...',
        end: isEnd,
        effects: nodePatch?.effects || [],
        choices: isEnd
          ? []
          : nodePatch?.choices || [
              {
                id: characterId('choice', char?.name || 'Персонаж', 'Продолжить'), title: 'Продолжить',
                text: 'Продолжить...',
                target: dlg?.nodes.find((n) => n.end)?.id || newId,
                required_terms: [],
                required_conclusions: [],
                conditions: [],
              },
            ],
        position: nodePatch?.position || {
          x: 250 + ((index * 160) % 700),
          y: 140 + ((index * 110) % 400),
        },
        notes: nodePatch?.notes || '',
      };

      set((s) => {
        const next = {
          ...s.project,
          dialogues: s.project.dialogues.map((d) =>
            d.id === dialogueId ? { ...d, nodes: [...d.nodes, newNode] } : d
          ),
        };
        return { project: next, selectedNodeId: newId };
      });
      return newId;
    },

    updateDialogueNode: (dialogueId, nodeId, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                const updated = { ...n, ...patch };
                if (patch.end === true) {
                  updated.choices = [];
                } else if (patch.end === false && updated.choices.length === 0) {
                  const fallbackTarget =
                    d.nodes.find((other) => other.id !== nodeId)?.id || nodeId;
                  updated.choices = [
                    {
                      id: characterId('choice', state.project.characters.find((c) => c.id === d.character_id)?.name || d.character_id, 'Ответ игрока'), title: 'Ответ игрока',
                      text: 'Ответить...',
                      target: fallbackTarget,
                      required_terms: [],
                      required_conclusions: [],
                      conditions: [],
                    },
                  ];
                }
                return updated;
              }),
            };
          }),
        };
        return { project: next };
      }),

    renameDialogueNodeId: (dialogueId, oldId, newId) =>
      set((state) => {
        if (!newId || oldId === newId) return state;
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            if (d.nodes.some((n) => n.id === newId)) return d;
            return {
              ...d,
              start_node: d.start_node === oldId ? newId : d.start_node,
              starts: d.starts?.map((start) => start.node_id === oldId ? { ...start, node_id: newId } : start),
              nodes: d.nodes.map((n) => ({
                ...n,
                id: n.id === oldId ? newId : n.id,
                choices: n.choices.map((c) => ({
                  ...c,
                  target: c.target === oldId ? newId : c.target,
                })),
              })),
            };
          }),
        };
        return {
          project: next,
          selectedNodeId: state.selectedNodeId === oldId ? newId : state.selectedNodeId,
        };
      }),

    updateNodePosition: (dialogueId, nodeId, position) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) =>
            d.id === dialogueId
              ? {
                  ...d,
                  nodes: d.nodes.map((n) =>
                    n.id === nodeId ? { ...n, position } : n
                  ),
                }
              : d
          ),
        };
        return { project: next };
      }),

    deleteDialogueNode: (dialogueId, nodeId) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            const remaining = d.nodes.filter((n) => n.id !== nodeId);
            const fallbackStart =
              d.start_node === nodeId ? remaining[0]?.id || '' : d.start_node;
            return {
              ...d,
              start_node: fallbackStart,
              nodes: remaining,
            };
          }),
        };
        return {
          project: next,
          selectedNodeId:
            state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        };
      }),

    addChoice: (dialogueId, nodeId) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            const defaultTarget =
              d.nodes.find((n) => n.end)?.id ||
              d.nodes.find((n) => n.id !== nodeId)?.id ||
              nodeId;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                const choiceId = characterId('choice', state.project.characters.find((c) => c.id === d.character_id)?.name || d.character_id, 'Вариант ответа игрока', n.choices.map((c) => c.id));
                return {
                  ...n,
                  end: false,
                  choices: [
                    ...n.choices,
                    {
                      id: choiceId,
                      title: 'Вариант ответа игрока',
                      text: 'Вариант ответа игрока...',
                      target: defaultTarget,
                      required_terms: [],
                      required_conclusions: [],
                      conditions: [],
                    },
                  ],
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    updateChoice: (dialogueId, nodeId, choiceId, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  choices: n.choices.map((c) =>
                    c.id === choiceId ? { ...c, ...patch } : c
                  ),
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    deleteChoice: (dialogueId, nodeId, choiceId) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  choices: n.choices.filter((c) => c.id !== choiceId),
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    connectChoiceToTarget: (dialogueId, sourceNodeId, choiceId, targetNodeId) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== sourceNodeId) return n;
                return {
                  ...n,
                  choices: n.choices.map((c) =>
                    c.id === choiceId ? { ...c, target: targetNodeId } : c
                  ),
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    addEffect: (dialogueId, nodeId, effectPatch) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                const effectId = characterId('effect', state.project.characters.find((c) => c.id === d.character_id)?.name || d.character_id, effectPatch?.title || 'Новый эффект', d.nodes.flatMap((node) => node.effects.map((e) => e.effect_id)));
                const newEffect: DialogueEffect = {
                  title: effectPatch?.title || 'Новый эффект',
                  effect_id: effectId.replace(/[^a-z0-9_]/g, '_'),
                  type: effectPatch?.type || 'grant_term',
                  term_id:
                    effectPatch?.term_id || state.project.terms[0]?.id || 'northern_stvor',
                  variable_id:
                    effectPatch?.variable_id ||
                    state.project.variables[0]?.id ||
                    'arkadiy_trust',
                  value: effectPatch?.value ?? 1,
                  event: effectPatch?.event || 'react',
                  arg: effectPatch?.arg || 'interested',
                };
                return {
                  ...n,
                  effects: [...n.effects, newEffect],
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    updateEffect: (dialogueId, nodeId, effectId, patch) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  effects: n.effects.map((ef) =>
                    ef.effect_id === effectId ? { ...ef, ...patch } : ef
                  ),
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    deleteEffect: (dialogueId, nodeId, effectId) =>
      set((state) => {
        const next = {
          ...state.project,
          dialogues: state.project.dialogues.map((d) => {
            if (d.id !== dialogueId) return d;
            return {
              ...d,
              nodes: d.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                  ...n,
                  effects: n.effects.filter((ef) => ef.effect_id !== effectId),
                };
              }),
            };
          }),
        };
        return { project: next };
      }),

    quickGrantTermOnNode: (dialogueId, nodeId, termId, termTitle, termDescription) =>
      set((state) => {
        const termExists = state.project.terms.some((t) => t.id === termId);
        const terms = termExists
          ? state.project.terms
          : [
              ...state.project.terms,
              { id: termId, title: termTitle, description: termDescription },
            ];

        const dialogues = state.project.dialogues.map((d) => {
          if (d.id !== dialogueId) return d;
          return {
            ...d,
            nodes: d.nodes.map((n) => {
              if (n.id !== nodeId) return n;
              const effectId = characterId('effect', state.project.characters.find((c) => c.id === d.character_id)?.name || d.character_id, `Выдать термин ${termTitle}`, d.nodes.flatMap((node) => node.effects.map((e) => e.effect_id)));
              if (n.effects.some((e) => e.type === 'grant_term' && e.term_id === termId)) {
                return n;
              }
              return {
                ...n,
                effects: [
                  ...n.effects,
                  {
                    effect_id: effectId,
                    title: `Выдать термин ${termTitle}`,
                    type: 'grant_term' as const,
                    term_id: termId,
                  },
                ],
              };
            }),
          };
        });

        const next = { ...state.project, terms, dialogues };
        return { project: next };
      }),

    loadProjectFromServer: async () => {
      const localProject = readLocalProject();
      const startingProject = get().project;
      try {
        const res = await fetch('/api/project');
        if (!res.ok) throw new Error('Не удалось проверить проект редактора');
        const data = (await res.json()) as { exists: boolean; project?: NarrativeProject };
        if (data.exists && data.project) {
          assertProjectShape(data.project);
          if (!localProject && get().project === startingProject) {
            set({
              project: data.project,
              selectedCharacterId: data.project.characters[0]?.id || 'arkadiy',
              selectedDialogueId: data.project.dialogues[0]?.id || 'arkadiy_intro',
              selectedNodeId: data.project.dialogues[0]?.start_node || null,
            });
          }
        }
        const current = get().project;
        if (get().projectSave.state !== 'saving') {
          set({
            projectSave: {
              state: data.exists && data.project && JSON.stringify(data.project) === JSON.stringify(current)
                ? 'saved' : 'outdated',
            },
          });
        }
        const exportRes = await fetch('/api/check-godot-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ godotPath: current.godot_project_path, project: current }),
        });
        const exportData = (await exportRes.json()) as { matches?: boolean; paths?: string[]; error?: string };
        if (get().project === current && get().godotExport.state !== 'saving') {
          set({
            godotExport: exportRes.ok
              ? { state: exportData.matches ? 'saved' : 'outdated', paths: exportData.paths }
              : { state: 'unknown', message: exportData.error || 'Не удалось проверить файлы игры' },
          });
        }
      } catch (error) {
        set((state) => ({
          projectSave: state.projectSave.state === 'unknown'
            ? { state: 'unknown', message: error instanceof Error ? error.message : 'Сервер недоступен' }
            : state.projectSave,
          godotExport: state.godotExport.state === 'unknown'
            ? { state: 'unknown', message: 'Не удалось проверить файлы игры' }
            : state.godotExport,
        }));
      }
    },

    saveProjectToServer: async () => {
      const project = get().project;
      set((state) => ({
        projectSave: { state: 'saving', lastSavedAt: state.projectSave.lastSavedAt },
      }));
      try {
        const res = await fetch('/api/save-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(project),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Ошибка сохранения проекта');
        set({
          projectSave: get().project === project
            ? { state: 'saved', lastSavedAt: new Date().toLocaleTimeString() }
            : { state: 'outdated', message: 'После сохранения появились новые правки', lastSavedAt: new Date().toLocaleTimeString() },
        });
      } catch (error) {
        set((state) => ({
          projectSave: {
            state: 'error',
            message: error instanceof Error ? error.message : 'Сервер недоступен',
            lastSavedAt: state.projectSave.lastSavedAt,
          },
        }));
      }
    },

    syncWithGodot: async () => {
      const project = get().project;
      const issue = validateProject(project).find((item) => item.level === 'error');
      if (issue) {
        const error = `${issue.path}: ${issue.message}`;
        set({ godotExport: { state: 'error', message: error } });
        return { ok: false, error };
      }
      set((state) => ({
        godotExport: {
          state: 'saving',
          lastSavedAt: state.godotExport.lastSavedAt,
          paths: state.godotExport.paths,
        },
      }));
      try {
        const res = await fetch('/api/sync-godot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ godotPath: project.godot_project_path, project }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          writtenFiles?: string[];
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Ошибка выгрузки в Godot');
        const current = get().project;
        const isCurrent = current === project;
        const now = new Date().toLocaleTimeString();
        set({
          projectSave: isCurrent
            ? { state: 'saved', lastSavedAt: now }
            : { state: 'outdated', message: 'После выгрузки появились новые правки', lastSavedAt: now },
          godotExport: isCurrent
            ? { state: 'saved', lastSavedAt: now, paths: data.writtenFiles }
            : { state: 'outdated', message: 'После выгрузки появились новые правки', lastSavedAt: now, paths: data.writtenFiles },
        });
        return { ok: true, files: data.writtenFiles };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set((state) => ({
          godotExport: {
            state: 'error',
            message,
            lastSavedAt: state.godotExport.lastSavedAt,
            paths: state.godotExport.paths,
          },
        }));
        return { ok: false, error: message };
      }
    },

    importProjectJson: (project) => {
      assertProjectShape(project);
      const issue = validateProject(project).find((item) => item.level === 'error');
      if (issue) throw new Error(`${issue.path}: ${issue.message}`);
      set({
        project,
        selectedCharacterId: project.characters[0]?.id || '',
        selectedDialogueId: project.dialogues[0]?.id || '',
        selectedNodeId: project.dialogues[0]?.start_node || null,
      });
    },

    updateNarrative: (patch) => set((state) => {
      const project = { ...state.project, ...patch };
      return { project };
    }),

    resetToArkadiyDefault: () => {
      const fresh = structuredClone(DEFAULT_ARKADIY_PROJECT);
      set({
        project: fresh,
        selectedCharacterId: 'arkadiy',
        selectedDialogueId: 'arkadiy_intro',
        selectedNodeId: 'opening',
      });
    },
  };
});

useNarrativeStore.subscribe((state, previous) => {
  if (state.project === previous.project) return;
  const error = persistLocal(state.project);
  useNarrativeStore.setState({
    browserSave: error
      ? { state: 'error', message: error }
      : { state: 'saved', lastSavedAt: new Date().toLocaleTimeString() },
    projectSave: { state: 'outdated', lastSavedAt: state.projectSave.lastSavedAt },
    godotExport: { state: 'outdated', lastSavedAt: state.godotExport.lastSavedAt, paths: state.godotExport.paths },
  });
});
