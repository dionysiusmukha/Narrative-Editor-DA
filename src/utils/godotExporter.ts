import type { DialogueDocument, NarrativeProject } from '../types/narrative.ts';
import { compileMemoryFile, dialogueBundlePath } from './npcMemory.ts';

export interface ExportedGodotFile {
  relativePath: string;
  description: string;
  content: string;
}

/**
 * Компилирует данные редактора в чистые JSON-файлы для Godot (Dark Alone, ветка narrative-editor).
 */
export function compileGodotFiles(project: NarrativeProject): ExportedGodotFile[] {
  const files: ExportedGodotFile[] = [];

  // 1. Словарь терминов, групп выводов и рецептов дневника (content/glossary/narrative_terms.json)
  const glossaryJson = {
    schema_version: 1,
    test_content: false,
    terms: project.terms.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
    })),
    reasoning_groups: project.reasoning_groups.map((g) => ({
      id: g.id,
      title: g.title,
      terms: g.terms,
      minimum_terms: g.minimum_terms,
      sheet: g.sheet,
      position: g.position,
      options: g.options.map((o) => {
        const opt: Record<string, unknown> = {
          id: o.id,
          text: o.text,
        };
        if (o.required_conclusions && o.required_conclusions.length > 0) {
          opt.required_conclusions = o.required_conclusions;
        }
        return opt;
      }),
    })),
    ...(project.reasoning_links.length > 0
      ? {
          reasoning_links: project.reasoning_links.map((l) => {
            const link: Record<string, unknown> = {
              from: l.from,
              to: l.to,
            };
            if (l.when) link.when = l.when;
            if (l.required_conclusions && l.required_conclusions.length > 0) {
              link.required_conclusions = l.required_conclusions;
            }
            return link;
          }),
        }
      : {}),
    journal_recipes: project.journal_recipes.map((r) => ({
      id: r.id,
      title: r.title,
      text: r.text,
      required_terms: r.required_terms,
    })),
  };

  files.push({
    relativePath: 'content/glossary/narrative_terms.json',
    description: 'Словарь терминов, группы выводов и рецепты дневника (Narrative Editor)',
    content: JSON.stringify(glossaryJson, null, 2) + '\n',
  });

  // 2. Реестр сюжетных переменных (content/variables/narrative_variables.json)
  const variablesJson = {
    schema_version: 1,
    test_content: false,
    variables: project.variables.map((v) => ({
      id: v.id,
      title: v.title,
      type: v.type,
      default_value: v.default_value,
      category: v.category,
      ...(v.character_id ? { character_id: v.character_id } : {}),
      ...(v.min !== undefined ? { min: v.min } : {}),
      ...(v.max !== undefined ? { max: v.max } : {}),
      ...(v.enum_values && v.enum_values.length > 0 ? { enum_values: v.enum_values } : {}),
      description: v.description,
    })),
  };

  files.push({
    relativePath: 'content/variables/narrative_variables.json',
    description: 'Реестр сюжетных переменных и состояний персонажей',
    content: JSON.stringify(variablesJson, null, 2) + '\n',
  });

  // 3. Персонажи и их реакции по узлам (content/characters/<id>.json)
  for (const char of project.characters) {
    const reactions: Record<string, string> = {};
    for (const dlg of project.dialogues) {
      for (const node of dlg.nodes) {
        if ((node.character_id === char.id || dlg.character_id === char.id) && node.emotion) {
          reactions[`${dlg.id}:${node.id}`] = node.emotion;
        }
      }
    }

    const characterJson = {
      schema_version: 1,
      test_content: false,
      id: char.id,
      name: char.name,
      role: char.role,
      biography: char.biography,
      personality: char.personality,
      motivation: char.motivation,
      secrets: char.secrets,
      default_emotion: char.default_emotion,
      available_emotions: char.available_emotions,
      preferences: char.preferences,
      relationships: char.relationships,
      reactions,
    };

    files.push({
      relativePath: `content/characters/${char.id}.json`,
      description: `Профиль и реакции персонажа: ${char.name}`,
      content: JSON.stringify(characterJson, null, 2) + '\n',
    });
  }

  // 4. Диалоги по персонажам (content/dialogues/<character_id>.json)
  const dialoguesByChar = new Map<string, DialogueDocument[]>();
  for (const dlg of project.dialogues) {
    const key = dialogueBundlePath(project, dlg);
    if (!dialoguesByChar.has(key)) {
      dialoguesByChar.set(key, []);
    }
    dialoguesByChar.get(key)!.push(dlg);
  }

  for (const [relativePath, dialogues] of dialoguesByChar.entries()) {
    const dialogueBundle = {
      schema_version: 1,
      test_content: dialogues.every((d) => d.test_content),
      dialogues: dialogues.map((dlg) => {
        const dObj: Record<string, unknown> = {
          id: dlg.id,
          character_id: dlg.character_id,
          title: dlg.title,
          start_node: dlg.start_node,
          allow_cycles: dlg.allow_cycles,
        };
        if (dlg.allow_cycles && dlg.cycle_note) {
          dObj.cycle_note = dlg.cycle_note;
        }
        dObj.nodes = dlg.nodes.map((n) => {
          const nObj: Record<string, unknown> = {
            id: n.id,
            speaker: n.speaker,
            ...(n.emotion ? { emotion: n.emotion } : {}),
            text: n.text,
            end: n.end,
            effects: (n.effects || []).map((ef) => {
              if (ef.type === 'grant_term') {
                return {
                  effect_id: ef.effect_id,
                  type: 'grant_term',
                  term_id: ef.term_id || '',
                };
              }
              if (ef.type === 'set_variable' || ef.type === 'add_variable') {
                return {
                  effect_id: ef.effect_id,
                  type: ef.type,
                  variable_id: ef.variable_id || '',
                  value: ef.value ?? 0,
                };
              }
              return {
                effect_id: ef.effect_id,
                type: ef.type,
                event: ef.event || 'react',
                arg: ef.arg || 'neutral',
              };
            }),
            choices: (n.choices || []).map((ch) => {
              const chObj: Record<string, unknown> = {
                id: ch.id,
                text: ch.text,
                target: ch.target,
                required_terms: ch.required_terms || [],
              };
              if (ch.required_conclusions && ch.required_conclusions.length > 0) {
                chObj.required_conclusions = ch.required_conclusions;
              }
              if (ch.conditions && ch.conditions.length > 0) {
                chObj.conditions = ch.conditions;
              }
              return chObj;
            }),
          };
          return nObj;
        });
        return dObj;
      }),
    };

    files.push({
      relativePath,
      description: `Пакет диалогов (${dialogues[0].character_id || 'general'})`,
      content: JSON.stringify(dialogueBundle, null, 2) + '\n',
    });
  }

  const memory = compileMemoryFile(project);
  if (memory) files.push(memory);
  return files;
}
