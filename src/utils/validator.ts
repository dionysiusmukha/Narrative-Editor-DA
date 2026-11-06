import { validateStartRules } from './dialogueStarts.ts';
import type {
  DialogueDocument,
  NarrativeProject,
  ValidationIssue,
} from '../types/narrative.ts';
import { computedConditions, validateMemoryProject } from './npcMemory.ts';

import { validateJournal } from './journal.ts';

const SNAKE_CASE_REGEX = /^[a-z][a-z0-9_]*$/;

export function isValidSnakeCaseId(id: string): boolean {
  return typeof id === 'string' && SNAKE_CASE_REGEX.test(id);
}

export function validateProject(project: NarrativeProject): ValidationIssue[] {
  const issues: ValidationIssue[] = validateJournal(project);
  const characterIds = new Set<string>();
  for (const character of project.characters) {
    if (!isValidSnakeCaseId(character.id) || characterIds.has(character.id)) {
      issues.push({ level: 'error', path: `characters.${character.id}`, message: 'Некорректный или повторный ID персонажа' });
    }
    characterIds.add(character.id);
  }

  const termIds = new Set<string>();
  for (const term of project.terms) {
    if (!isValidSnakeCaseId(term.id)) {
      issues.push({
        level: 'error',
        path: `terms.${term.id}`,
        message: `ID термина "${term.id}" должен быть в snake_case (^[a-z][a-z0-9_]*$)`,
      });
    }
    if (termIds.has(term.id)) {
      issues.push({
        level: 'error',
        path: `terms.${term.id}`,
        message: `Дубликат ID термина "${term.id}"`,
      });
    }
    termIds.add(term.id);
  }

  const conclusionIds = new Set<string>();
  for (const group of project.reasoning_groups) {
    if (!isValidSnakeCaseId(group.id)) {
      issues.push({
        level: 'error',
        path: `reasoning_groups.${group.id}`,
        message: `ID группы выводов "${group.id}" должен быть в snake_case`,
      });
    }
    for (const tid of group.terms) {
      if (!termIds.has(tid)) {
        issues.push({
          level: 'error',
          path: `reasoning_groups.${group.id}.terms`,
          message: `Группа "${group.id}" ссылается на несуществующий термин "${tid}"`,
        });
      }
    }
    for (const opt of group.options) {
      if (!isValidSnakeCaseId(opt.id)) {
        issues.push({
          level: 'error',
          path: `reasoning_groups.${group.id}.options.${opt.id}`,
          message: `ID вывода "${opt.id}" должен быть в snake_case`,
        });
      }
      conclusionIds.add(opt.id);
    }
  }

  const variableIds = new Set<string>();
  for (const v of project.variables) {
    if (!isValidSnakeCaseId(v.id)) {
      issues.push({
        level: 'error',
        path: `variables.${v.id}`,
        message: `ID переменной "${v.id}" должен быть в snake_case`,
      });
    }
    if (variableIds.has(v.id)) {
      issues.push({
        level: 'error',
        path: `variables.${v.id}`,
        message: `Дубликат ID переменной "${v.id}"`,
      });
    }
    variableIds.add(v.id);
  }

  const dialogueIds = new Set<string>();
  for (const dialogue of project.dialogues) {
    if (dialogueIds.has(dialogue.id) || (dialogue.character_id && !characterIds.has(dialogue.character_id))) {
      issues.push({ level: 'error', path: `dialogue.${dialogue.id}`, message: 'Повторный ID диалога или отсутствующий персонаж', dialogueId: dialogue.id });
    }
    dialogueIds.add(dialogue.id);
    const allowed = new Set(variableIds);
    if (project.narrative_events?.length) {
      for (const condition of computedConditions(project.narrative_events, dialogue.character_id)) allowed.add(condition.id);
    }
    issues.push(...validateDialogue(dialogue, termIds, conclusionIds, variableIds, allowed));
  }

  return [...issues, ...validateMemoryProject(project), ...validateStartRules(project)];
}

export function validateDialogue(
  dialogue: DialogueDocument,
  termIds: Set<string>,
  conclusionIds: Set<string>,
  variableIds: Set<string>,
  conditionIds = variableIds
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isValidSnakeCaseId(dialogue.id)) {
    issues.push({
      level: 'error',
      dialogueId: dialogue.id,
      path: `dialogue.${dialogue.id}.id`,
      message: `ID диалога "${dialogue.id}" должен соответствовать ^[a-z][a-z0-9_]*$`,
    });
  }

  if (!dialogue.title.trim()) {
    issues.push({
      level: 'error',
      dialogueId: dialogue.id,
      path: `dialogue.${dialogue.id}.title`,
      message: `Название диалога не может быть пустым`,
    });
  }

  if (dialogue.allow_cycles && !dialogue.cycle_note?.trim()) {
    issues.push({
      level: 'error',
      dialogueId: dialogue.id,
      path: `dialogue.${dialogue.id}.cycle_note`,
      message: `При allow_cycles=true необходимо заполнить cycle_note (правило Godot валидатора)`,
    });
  }

  const nodeMap = new Map<string, DialogueDocument['nodes'][number]>();
  const effectIds = new Set<string>();

  for (const node of dialogue.nodes) {
    if (!isValidSnakeCaseId(node.id)) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.id`,
        message: `ID узла "${node.id}" должен быть в snake_case (только a-z, 0-9, _)`,
      });
    }
    if (nodeMap.has(node.id)) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.id`,
        message: `Дубликат ID узла "${node.id}"`,
      });
    }
    nodeMap.set(node.id, node);

    if (!node.speaker.trim()) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.speaker`,
        message: `В узле "${node.id}" не указан говорящий (speaker)`,
      });
    }

    if (!node.text.trim()) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.text`,
        message: `В узле "${node.id}" пустой текст реплики`,
      });
    }

    if (node.end && node.choices.length > 0) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.choices`,
        message: `Конечный узел "${node.id}" (end: true) не должен иметь вариантов ответа`,
      });
    }

    if (!node.end && node.choices.length === 0) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: node.id,
        path: `node.${node.id}.choices`,
        message: `Неконечный узел "${node.id}" (end: false) обязан иметь хотя бы один вариант ответа`,
      });
    }

    const choiceIds = new Set<string>();
    for (const choice of node.choices) {
      if (!isValidSnakeCaseId(choice.id)) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: node.id,
          path: `node.${node.id}.choice.${choice.id}`,
          message: `ID ответа "${choice.id}" в узле "${node.id}" должен быть в snake_case`,
        });
      }
      if (choiceIds.has(choice.id)) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: node.id,
          path: `node.${node.id}.choice.${choice.id}`,
          message: `Дубликат ID ответа "${choice.id}" внутри узла "${node.id}"`,
        });
      }
      choiceIds.add(choice.id);

      if (!choice.text.trim()) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: node.id,
          path: `node.${node.id}.choice.${choice.id}.text`,
          message: `Пустой текст ответа "${choice.id}" в узле "${node.id}"`,
        });
      }

      for (const reqTerm of choice.required_terms || []) {
        if (!termIds.has(reqTerm)) {
          issues.push({
            level: 'error',
            dialogueId: dialogue.id,
            nodeId: node.id,
            path: `node.${node.id}.choice.${choice.id}.required_terms`,
            message: `Ответ "${choice.id}" требует неизвестный термин "${reqTerm}"`,
          });
        }
      }

      for (const reqConc of choice.required_conclusions || []) {
        if (!conclusionIds.has(reqConc)) {
          issues.push({
            level: 'error',
            dialogueId: dialogue.id,
            nodeId: node.id,
            path: `node.${node.id}.choice.${choice.id}.required_conclusions`,
            message: `Ответ "${choice.id}" требует неизвестный вывод "${reqConc}"`,
          });
        }
      }

      for (const cond of choice.conditions || []) {
        if (!conditionIds.has(cond.variable_id)) {
          issues.push({
            level: 'error',
            dialogueId: dialogue.id,
            nodeId: node.id,
            path: `node.${node.id}.choice.${choice.id}.conditions`,
            message: `Условие ответа "${choice.id}" ссылается на неизвестную переменную "${cond.variable_id}"`,
          });
        }
      }
    }

    for (const effect of node.effects || []) {
      if (!isValidSnakeCaseId(effect.effect_id)) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: node.id,
          path: `node.${node.id}.effects.${effect.effect_id}`,
          message: `ID эффекта "${effect.effect_id}" должен быть в snake_case`,
        });
      }
      if (effectIds.has(effect.effect_id)) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: node.id,
          path: `node.${node.id}.effects.${effect.effect_id}`,
          message: `ID эффекта "${effect.effect_id}" должен быть уникален во всём диалоге`,
        });
      }
      effectIds.add(effect.effect_id);

      if (effect.type === 'grant_term') {
        if (!effect.term_id || !termIds.has(effect.term_id)) {
          issues.push({
            level: 'error',
            dialogueId: dialogue.id,
            nodeId: node.id,
            path: `node.${node.id}.effects.${effect.effect_id}`,
            message: `Эффект grant_term "${effect.effect_id}" ссылается на неизвестный термин "${effect.term_id || ''}"`,
          });
        }
      } else if (effect.type === 'set_variable' || effect.type === 'add_variable') {
        if (!effect.variable_id || !variableIds.has(effect.variable_id)) {
          issues.push({
            level: 'error',
            dialogueId: dialogue.id,
            nodeId: node.id,
            path: `node.${node.id}.effects.${effect.effect_id}`,
            message: `Эффект "${effect.effect_id}" ссылается на неизвестную переменную "${effect.variable_id || ''}"`,
          });
        }
      }
    }
  }

  // Topology checks matching DialogueContentValidator._validate_graph()
  if (!nodeMap.has(dialogue.start_node)) {
    issues.push({
      level: 'error',
      dialogueId: dialogue.id,
      path: `dialogue.${dialogue.id}.start_node`,
      message: `Начальный узел start_node "${dialogue.start_node}" не найден в диалоге`,
    });
    return issues;
  }

  const edges = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  const degree = new Map<string, number>();
  const endings: string[] = [];

  for (const [id, node] of nodeMap.entries()) {
    edges.set(id, []);
    reverse.set(id, []);
    degree.set(id, 0);
    if (node.end) {
      endings.push(id);
    }
  }

  for (const [id, node] of nodeMap.entries()) {
    for (const choice of node.choices) {
      if (!choice.target || !nodeMap.has(choice.target)) {
        issues.push({
          level: 'error',
          dialogueId: dialogue.id,
          nodeId: id,
          path: `node.${id}.choice.${choice.id}.target`,
          message: `Ответ "${choice.id}" в узле "${id}" ведёт на несуществующий узел "${choice.target || ''}"`,
        });
        continue;
      }
      edges.get(id)!.push(choice.target);
      reverse.get(choice.target)!.push(id);
      degree.set(choice.target, (degree.get(choice.target) || 0) + 1);
    }
  }

  const walk = (starts: string[], adj: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const pending = [...starts];
    while (pending.length > 0) {
      const curr = pending.pop()!;
      if (seen.has(curr)) continue;
      seen.add(curr);
      for (const next of adj.get(curr) || []) {
        pending.push(next);
      }
    }
    return seen;
  };

  const reachable = walk(dialogue.starts?.length ? dialogue.starts.map((start) => start.node_id).filter((id) => nodeMap.has(id)) : [dialogue.start_node], edges);
  const canEnd = walk(endings, reverse);

  for (const id of nodeMap.keys()) {
    if (!reachable.has(id)) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: id,
        path: `node.${id}`,
        message: `Узел "${id}" недостижим из начального узла "${dialogue.start_node}"`,
      });
    }
    if (!canEnd.has(id)) {
      issues.push({
        level: 'error',
        dialogueId: dialogue.id,
        nodeId: id,
        path: `node.${id}`,
        message: `Из узла "${id}" нет пути ни к одному финальному узлу (end: true)`,
      });
    }
  }

  // Topological sort for cycle detection
  const ready: string[] = [];
  for (const [id, deg] of degree.entries()) {
    if (deg === 0) ready.push(id);
  }
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.pop()!;
    visited++;
    for (const target of edges.get(id) || []) {
      const nextDeg = (degree.get(target) || 0) - 1;
      degree.set(target, nextDeg);
      if (nextDeg === 0) ready.push(target);
    }
  }

  if (visited !== nodeMap.size && !dialogue.allow_cycles) {
    issues.push({
      level: 'error',
      dialogueId: dialogue.id,
      path: `dialogue.${dialogue.id}.allow_cycles`,
      message: `В графе обнаружен цикл! Включите allow_cycles=true и укажите cycle_note или разорвите цикл.`,
    });
  }

  return issues;
}
