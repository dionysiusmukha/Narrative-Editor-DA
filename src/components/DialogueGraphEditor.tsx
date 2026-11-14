import { EventGateEditor } from './EventGateEditor';
import { characterId } from '../utils/ids';
import { AutomaticId } from './AutomaticId';
import { generateId } from '../utils/ids';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  NodeChange,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNarrativeStore } from '../store/useNarrativeStore';
import {
  ConditionOperator,
  DialogueChoice,
  NarrativeProject,
  DialogueEffectType,
  DRINK_INGREDIENTS,
  NPC_EMOTIONS,
  NpcEmotion,
} from '../types/narrative';
import { DialogueSpeechNode } from './nodes/DialogueSpeechNode';
import { isValidSnakeCaseId, reviewNarrativeConsistency, validateProject } from '../utils/validator';
import { computedConditions } from '../utils/npcMemory';
import {
  Plus,
  Trash2,
  Play,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Sliders,
  GitCommit,
  Flag,
} from 'lucide-react';

const nodeTypes = {
  speech: DialogueSpeechNode,
};

function RememberEventSelect({ project, value, onChange }: { project: NarrativeProject; value: string; onChange: (id: string) => void }) {
  const [characterId, setCharacterId] = useState('');
  const events = project.narrative_events || [];
  return <>
    <select aria-label="Персонаж для фильтра событий" value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
      <option value="">Все персонажи</option>
      {project.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
    </select>
    <select aria-label="Событие памяти" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Выберите событие</option>
      {value && !events.some((event) => event.id === value) && <option value={value}>Неизвестное: {value}</option>}
      {events.filter((event) => !characterId || event.id === value || event.records.some((record) => record.character_id === characterId))
        .map((event) => <option key={event.id} value={event.id}>{event.id} · {event.fact}</option>)}
    </select>
  </>;
}

export const DialogueGraphEditor: React.FC = () => {
  const {
    project,
    selectedDialogueId,
    selectedNodeId,
    setSelectedDialogueId,
    setSelectedNodeId,
    addDialogue,
    updateDialogueMeta,
    addDialogueNode,
    updateDialogueNode,
    updateNodePosition,
    deleteDialogueNode,
    addChoice,
    updateChoice,
    deleteChoice,
    connectChoiceToTarget,
    addEffect,
    updateEffect,
    deleteEffect,
    quickGrantTermOnNode,
    setActiveTab,
  } = useNarrativeStore();

  const [creatingDialogue, setCreatingDialogue] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [newDlgCharacter, setNewDlgCharacter] = useState(project.characters[0]?.id || '');
  const [newDlgTitle, setNewDlgTitle] = useState('');

  const currentDialogue =
    project.dialogues.find((d) => d.id === selectedDialogueId) ||
    project.dialogues[0];

  const selectedNode = currentDialogue?.nodes.find(
    (n) => n.id === selectedNodeId
  );

  // Run live validator
  const allIssues = useMemo(() => validateProject(project), [project]);
  const conditionOptions = [
    ...project.variables.map((variable) => ({ ...variable, label: variable.title })),
    ...(project.narrative_events?.length ? computedConditions(project.narrative_events, currentDialogue?.character_id || '') : []),
  ];
  const dialogueIssues = useMemo(
    () =>
      allIssues.filter(
        (iss) => !iss.dialogueId || iss.dialogueId === currentDialogue?.id
      ),
    [allIssues, currentDialogue?.id]
  );

  const technicalErrors = dialogueIssues.filter((issue) => issue.level === 'error');
  const editorialWarnings = useMemo(
    () => reviewNarrativeConsistency(project).filter((issue) => issue.dialogueId === currentDialogue?.id),
    [project, currentDialogue?.id]
  );

  const allConclusions = useMemo(() => {
    const list: Array<{ id: string; text: string; groupTitle: string }> = [];
    for (const g of project.reasoning_groups) {
      for (const o of g.options) {
        list.push({ id: o.id, text: o.text, groupTitle: g.title });
      }
    }
    return list;
  }, [project.reasoning_groups]);

  const describeChoice = (choice: DialogueChoice): string => {
    const parts: string[] = [];
    const termCount = choice.required_terms?.length || 0;
    if (termCount) parts.push(`${termCount} ${termCount === 1 ? 'термин' : termCount < 5 ? 'термина' : 'терминов'}`);
    const conclusionCount = choice.required_conclusions?.length || 0;
    if (conclusionCount) parts.push(`${conclusionCount} ${conclusionCount === 1 ? 'вывод' : conclusionCount < 5 ? 'вывода' : 'выводов'}`);
    for (const condition of choice.conditions || []) {
      const label = conditionOptions.find((option) => option.id === condition.variable_id)?.label || condition.variable_id;
      parts.push(`${label} ${condition.op} ${typeof condition.value === 'boolean' ? (condition.value ? 'да' : 'нет') : String(condition.value)}`);
    }
    return parts.length ? `Нужно: ${parts.join(' · ')}` : 'Без дополнительных условий';
  };

  // Convert DialogueNodes to ReactFlow Nodes
  const rfNodes: Node[] = useMemo(() => {
    if (!currentDialogue) return [];
    const termTitles = Object.fromEntries(project.terms.map((term) => [term.id, term.title]));
    const variableTitles = Object.fromEntries(conditionOptions.map((option) => [option.id, option.label]));
    const conclusionTitles = Object.fromEntries(allConclusions.map((conclusion) => [conclusion.id, conclusion.text]));
    const eventTitles = Object.fromEntries((project.narrative_events || []).map((event) => [event.id, event.fact]));
    return currentDialogue.nodes.map((node) => {
      const char = project.characters.find(
        (c) => c.id === (node.character_id || currentDialogue.character_id)
      );
      const nodeIssues = dialogueIssues.filter((i) => i.nodeId === node.id);
      return {
        id: node.id,
        type: 'speech',
        position: node.position || { x: 100, y: 100 },
        data: {
          node,
          isStart: currentDialogue.start_node === node.id || !!currentDialogue.starts?.some((start) => start.node_id === node.id),
          isSelected: selectedNodeId === node.id,
          avatarColor: char?.avatar_color || '#38bdf8',
          issues: nodeIssues,
          termTitles,
          variableTitles,
          conclusionTitles,
          eventTitles,
        },
      };
    });
  }, [currentDialogue, project.characters, project.terms, project.variables, project.narrative_events, allConclusions, selectedNodeId, dialogueIssues]);

  // Convert DialogueChoices to ReactFlow Edges
  const rfEdges: Edge[] = useMemo(() => {
    if (!currentDialogue) return [];
    const edges: Edge[] = [];
    for (const node of currentDialogue.nodes) {
      if (node.end) continue;
      for (const ch of node.choices) {
        if (!ch.target) continue;
        const hasCond =
          (ch.required_terms && ch.required_terms.length > 0) ||
          (ch.required_conclusions && ch.required_conclusions.length > 0) ||
          (ch.conditions && ch.conditions.length > 0);
        edges.push({
          id: `e-${node.id}-${ch.id}-${ch.target}`,
          source: node.id,
          sourceHandle: ch.id,
          target: ch.target,
          animated: hasCond,
          label: ch.title || ch.text.slice(0, 36) || 'Ответ игрока',
          style: {
            stroke: hasCond ? '#f59e0b' : '#38bdf8',
            strokeWidth: 2,
          },
          labelStyle: {
            fill: '#cbd5e1',
            fontSize: 13,
            fontFamily: 'sans-serif',
          },
          labelBgStyle: {
            fill: '#0f172a',
            fillOpacity: 0.85,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: hasCond ? '#f59e0b' : '#38bdf8',
          },
        });
      }
    }
    return edges;
  }, [currentDialogue]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!currentDialogue) return;
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateNodePosition(currentDialogue.id, change.id, change.position);
        }
      }
    },
    [currentDialogue, updateNodePosition]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (
        !currentDialogue ||
        !connection.source ||
        !connection.sourceHandle ||
        !connection.target
      ) {
        return;
      }
      connectChoiceToTarget(
        currentDialogue.id,
        connection.source,
        connection.sourceHandle,
        connection.target
      );
    },
    [currentDialogue, connectChoiceToTarget]
  );

  // Extract **highlighted words** from current node text for 1-click term creation
  const extractedBoldWords = useMemo(() => {
    if (!selectedNode) return [];
    const matches = selectedNode.text.match(/\*\*([^*]+)\*\*/g) || [];
    return matches.map((m) => m.slice(2, -2).trim()).filter(Boolean);
  }, [selectedNode]);

  const handleCreateNewDialogue = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = characterId('dialogue', project.characters.find((c) => c.id === newDlgCharacter)?.name || newDlgCharacter, newDlgTitle, project.dialogues.map((item) => item.id));
    if (!cleanId || !isValidSnakeCaseId(cleanId)) return;
    if (project.dialogues.some((d) => d.id === cleanId)) return;

    const char = project.characters.find((c) => c.id === newDlgCharacter);
    if (!char || !newDlgTitle.trim()) return;
    addDialogue({
      id: cleanId,
      character_id: char?.id || 'arkadiy',
      title: newDlgTitle.trim() || `Диалог: ${cleanId}`,
      start_node: characterId('node', char.name, 'Начальная реплика'),
      allow_cycles: false,
      test_content: false,
      nodes: [
        {
          id: characterId('node', char.name, 'Начальная реплика'), title: 'Начальная реплика',
          speaker: char?.name || 'Аркадий',
          character_id: char?.id || 'arkadiy',
          emotion: 'neutral',
          text: 'Начальная реплика разговора...',
          end: false,
          position: { x: 100, y: 180 },
          effects: [],
          choices: [
            {
              id: characterId('choice', char.name, 'Закончить разговор'), title: 'Закончить разговор',
              text: 'Закончить разговор',
              target: characterId('node', char.name, 'Завершение разговора'),
              required_terms: [],
              required_conclusions: [],
              conditions: [],
            },
          ],
        },
        {
          id: characterId('node', char.name, 'Завершение разговора'), title: 'Завершение разговора',
          speaker: char?.name || 'Аркадий',
          character_id: char?.id || 'arkadiy',
          emotion: 'neutral',
          text: 'Завершение разговора.',
          end: true,
          position: { x: 540, y: 180 },
          effects: [],
          choices: [],
        },
      ],
    });
    setNewDlgTitle('');
    setCreatingDialogue(false);
    setInspectorOpen(true);
  };

  if (!currentDialogue) {
    return <div className="page-container">          <form className="card dialogue-create-form" onSubmit={handleCreateNewDialogue}>
            <h3>Новый диалог</h3><label>Персонаж<select value={newDlgCharacter} onChange={(e) => setNewDlgCharacter(e.target.value)}>{project.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <div className="field-grid-2">
              <details className="technical-details"><summary>Служебный ID</summary><AutomaticId value={characterId('dialogue', project.characters.find((c) => c.id === newDlgCharacter)?.name || newDlgCharacter, newDlgTitle, project.dialogues.map((item) => item.id))} /></details>
              <input
                type="text"
                placeholder="Название диалога"
                required value={newDlgTitle}
                onChange={(e) => setNewDlgTitle(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">
              <Plus size={13} /> Добавить диалог
            </button>
          <button type="button" className="btn btn-secondary" onClick={() => setCreatingDialogue(false)}>Отмена</button></form></div>;
  }

  return (
    <div className="graph-workspace">
{creatingDialogue &&           <form className="card dialogue-create-form" onSubmit={handleCreateNewDialogue}>
            <h3>Новый диалог</h3><label>Персонаж<select value={newDlgCharacter} onChange={(e) => setNewDlgCharacter(e.target.value)}>{project.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <div className="field-grid-2">
              <AutomaticId value={characterId('dialogue', project.characters.find((c) => c.id === newDlgCharacter)?.name || newDlgCharacter, newDlgTitle, project.dialogues.map((item) => item.id))} />
              <input
                type="text"
                placeholder="Название диалога"
                required value={newDlgTitle}
                onChange={(e) => setNewDlgTitle(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">
              <Plus size={13} /> Добавить диалог
            </button>
          <button type="button" className="btn btn-secondary" onClick={() => setCreatingDialogue(false)}>Отмена</button></form>}
      {/* Top Dialogue Bar */}
      <div className="graph-toolbar">
        <div className="toolbar-group">
          <button className="btn btn-primary" onClick={() => setCreatingDialogue(!creatingDialogue)}>+ Новый диалог</button><label>Диалог:</label>
          <select
            className="dialogue-select"
            value={currentDialogue.id}
            onChange={(e) => setSelectedDialogueId(e.target.value)}
          >
            {project.dialogues.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          <label>Персонаж:</label>
          <select
            value={currentDialogue.character_id}
            onChange={(e) =>
              updateDialogueMeta(currentDialogue.id, {
                character_id: e.target.value,
              })
            }
          >
            {project.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => addDialogueNode(currentDialogue.id, { end: false })}
          >
            <Plus size={15} /> + Узел реплики
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              addDialogueNode(currentDialogue.id, {
                id: `end_${currentDialogue.nodes.length + 1}`,
                text: 'Финальная реплика разговора.',
                end: true,
              })
            }
          >
            <Flag size={14} /> + Финальный узел
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => setActiveTab('simulator')}
          >
            <Play size={14} /> Симулятор диалога
          </button>
        </div>

        {/* Validator Badge */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`btn ${inspectorOpen ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setInspectorOpen((open) => !open)}
            aria-pressed={inspectorOpen}
          >
            {inspectorOpen ? 'Обзор графа' : 'Редактировать реплику'}
          </button>
          {technicalErrors.length === 0 ? (
            <span className="validator-pill valid">
              <CheckCircle2 size={14} /> Структура пригодна для Godot ({currentDialogue.nodes.length} узлов)
            </span>
          ) : (
            <span
              className="validator-pill invalid"
              title={technicalErrors.map((i) => i.message).join('\n')}
            >
              <AlertCircle size={14} /> Ошибок структуры: {technicalErrors.length}
            </span>
          )}
        </div>
      </div>

      <div className="authoring-path" aria-label="Шаги работы над диалогом">
        <span>Путь автора:</span>
        <button type="button" onClick={() => setActiveTab('characters')}>1. Персонаж</button>
        <button type="button" onClick={() => { setSelectedNodeId(selectedNode?.id || currentDialogue.start_node); setInspectorOpen(true); }}>2. Реплика</button>
        <button type="button" onClick={() => { setSelectedNodeId(selectedNode?.id || currentDialogue.start_node); setInspectorOpen(true); requestAnimationFrame(() => document.getElementById('dialogue-choices-section')?.scrollIntoView({ block: 'start' })); }}>3. Ответы</button>
        <button type="button" onClick={() => setActiveTab('simulator')}>4. Проверка</button>
        <small>Подробные параметры диалога и эффекты раскрываются по необходимости.</small>
      </div>
      {editorialWarnings.length > 0 && (
        <div className="graph-editorial-warning" role="status">
          <strong>Сюжетное замечание:</strong> {editorialWarnings.map((warning) => warning.message).join(' ')}
          <small>Техническая проверка ниже отвечает только за структуру файлов.</small>
        </div>
      )}

      {/* Main Split: Canvas + Inspector */}
      <div className={`graph-main-area ${inspectorOpen ? "graph-edit-mode" : "graph-overview-mode"}`}>
        <div className="rf-canvas-wrapper">
          <ReactFlow
            key={inspectorOpen ? "graph-edit" : "graph-overview"}
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
            }}
            onNodeDoubleClick={(_, node) => {
              setSelectedNodeId(node.id);
              setInspectorOpen(true);
            }}
            fitView
            minZoom={0.25}
            maxZoom={1.6}
          >
            <Background color="#1e293b" gap={22} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as { isStart?: boolean; node?: { end?: boolean } };
                if (d?.isStart) return '#38bdf8';
                if (d?.node?.end) return '#10b981';
                return '#475569';
              }}
              maskColor="rgba(15, 23, 42, 0.75)"
            />
          </ReactFlow>

          {/* Validation Issues Drawer if any */}
          {technicalErrors.length > 0 && (
            <div className="validation-Overlay">
              <h4>
                <AlertCircle size={14} /> Ошибки структуры диалога:
              </h4>
              <ul>
                {technicalErrors.map((iss, idx) => (
                  <li
                    key={idx}
                    onClick={() => { if (iss.nodeId) { setSelectedNodeId(iss.nodeId); setInspectorOpen(true); } }}
                  >
                    <code>{iss.path}</code>: {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right-Hand Node & Dialogue Inspector */}
        {inspectorOpen && <aside className="node-inspector">
          {/* Dialogue Metadata Collapsible / Header */}
          <details className="inspector-section">
            <summary>Параметры диалога</summary>
            <div className="field-row">
              <label>Название (title)</label>
              <input
                type="text"
                value={currentDialogue.title}
                onChange={(e) =>
                  updateDialogueMeta(currentDialogue.id, { title: e.target.value })
                }
              />
            </div>
            <div className="field-grid-2">
              <div className="field-row">
                <label>Первая реплика</label>
                <select
                  value={currentDialogue.start_node}
                  onChange={(e) =>
                    updateDialogueMeta(currentDialogue.id, {
                      start_node: e.target.value,
                    })
                  }
                >
                  {currentDialogue.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title || n.text.slice(0, 40) || n.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label className="checkbox-inline" style={{ marginTop: 22 }}>
                  <input
                    type="checkbox"
                    checked={currentDialogue.allow_cycles}
                    onChange={(e) =>
                      updateDialogueMeta(currentDialogue.id, {
                        allow_cycles: e.target.checked,
                      })
                    }
                  />
                  Разрешить циклы
                </label>
              </div>
            </div>
            <details className="dialogue-starts"><summary>Старты и предусловия ({currentDialogue.starts?.length || 0})</summary>
              <p>Задайте отдельный старт для каждой встречи. Если несколько подходят, первым считается верхний. Обычный начальный узел используется, пока список пуст.</p>
              <button className="btn btn-secondary" onClick={() => updateDialogueMeta(currentDialogue.id, { starts: [...(currentDialogue.starts || []), { id: characterId('start', project.characters.find((c) => c.id === currentDialogue.character_id)?.name || currentDialogue.character_id, 'Новый старт', currentDialogue.starts?.map((x) => x.id)), title: 'Новый старт', node_id: selectedNode?.id || currentDialogue.start_node, required_events: [], excluded_events: [], min_shift: 1 }] })}>+ Старт</button>
              {(currentDialogue.starts || []).map((start, index) => {
                const patch = (values: Partial<typeof start>) => updateDialogueMeta(currentDialogue.id, { starts: currentDialogue.starts!.map((x) => x.id === start.id ? { ...x, ...values } : x) });
                return <div className="subcard" key={start.id}>
                  <label>Название старта<input value={start.title} onChange={(e) => patch({ title: e.target.value })} /></label><AutomaticId value={start.id} />
                  <label>Первая реплика<select value={start.node_id} onChange={(e) => patch({ node_id: e.target.value })}>{currentDialogue.nodes.map((n) => <option key={n.id} value={n.id}>{n.title || n.id}</option>)}</select></label>
                  <EventGateEditor project={project} value={start} onChange={patch} />
                  <button className="btn btn-secondary" disabled={!index} onClick={() => { const starts = [...currentDialogue.starts!]; [starts[index - 1], starts[index]] = [starts[index], starts[index - 1]]; updateDialogueMeta(currentDialogue.id, { starts }); }}>Выше по приоритету</button>
                  <button className="btn btn-danger" onClick={() => updateDialogueMeta(currentDialogue.id, { starts: currentDialogue.starts!.filter((x) => x.id !== start.id) })}>Удалить старт</button>
                </div>;
              })}
            </details>
            {currentDialogue.allow_cycles && (
              <div className="field-row">
                <label>Описание цикла</label>
                <input
                  type="text"
                  placeholder="Поясните, где выход из цикла..."
                  value={currentDialogue.cycle_note || ''}
                  onChange={(e) =>
                    updateDialogueMeta(currentDialogue.id, {
                      cycle_note: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </details>

          {selectedNode ? (
            <div className="inspector-body">
              <div className="inspector-header">
                <h3>
                  <GitCommit size={16} /> {selectedNode.title || 'Реплика'}
                </h3>
                <div className="inline-controls">
                  {currentDialogue.start_node !== selectedNode.id && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        updateDialogueMeta(currentDialogue.id, {
                          start_node: selectedNode.id,
                        })
                      }
                    >
                      Сделать START
                    </button>
                  )}
                  {currentDialogue.nodes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        deleteDialogueNode(currentDialogue.id, selectedNode.id)
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Node ID Rename & Speaker & Emotion */}
              <div className="field-grid-2">
                <div className="field-row">
                  <label>Название реплики</label>
                  <input value={selectedNode.title || ''} onChange={(e) => updateDialogueNode(currentDialogue.id, selectedNode.id, { title: e.target.value })} />
                  <details className="technical-details"><summary>Служебный ID</summary><AutomaticId value={selectedNode.id} /></details>
                </div>
                <div className="field-row">
                  <label>Эмоция реплики</label>
                  <select
                    value={selectedNode.emotion || 'neutral'}
                    onChange={(e) =>
                      updateDialogueNode(currentDialogue.id, selectedNode.id, {
                        emotion: e.target.value as NpcEmotion,
                      })
                    }
                  >
                    {NPC_EMOTIONS.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-grid-2">
                <div className="field-row">
                  <label>Говорящий</label>
                  <input
                    type="text"
                    value={selectedNode.speaker}
                    onChange={(e) =>
                      updateDialogueNode(currentDialogue.id, selectedNode.id, {
                        speaker: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field-row">
                  <label className="checkbox-inline" style={{ marginTop: 22 }}>
                    <input
                      type="checkbox"
                      checked={selectedNode.end}
                      onChange={(e) =>
                        updateDialogueNode(currentDialogue.id, selectedNode.id, {
                          end: e.target.checked,
                        })
                      }
                    />
                    Завершает разговор
                  </label>
                </div>
              </div>

              {/* Speech Text */}
              <div className="field-row">
                <label>
                  Текст реплики (выделяйте важные слова как <code>**термин**</code>)
                </label>
                <textarea
                  rows={4}
                  value={selectedNode.text}
                  onChange={(e) =>
                    updateDialogueNode(currentDialogue.id, selectedNode.id, {
                      text: e.target.value,
                    })
                  }
                />
              </div>

              {/* Quick Term Helper from **bold** words */}
              {extractedBoldWords.length > 0 && (
                <div className="quick-terms-helper">
                  <small>
                    <BookOpen size={12} /> Найдены выделенные слова в реплике:
                  </small>
                  <div className="chip-group">
                    {extractedBoldWords.map((word, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="chip"
                        onClick={() => {
                          const clean = characterId('term', project.characters.find((c) => c.id === currentDialogue.character_id)?.name || currentDialogue.character_id, word, project.terms.map((t) => t.id));
                          quickGrantTermOnNode(
                            currentDialogue.id,
                            selectedNode.id,
                            clean,
                            word,
                            `Запись из разговора (${selectedNode.speaker}): «${word}».`
                          );
                        }}
                      >
                        + Выдать термин «{word}»
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry Effects (Consequences) */}
              <details className="inspector-subsection">
                <summary>Эффекты при входе в реплику ({selectedNode.effects.length})</summary>
                <div className="subsection-header">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      addEffect(currentDialogue.id, selectedNode.id)
                    }
                  >
                    <Plus size={13} /> Добавить эффект
                  </button>
                </div>

                {selectedNode.effects.length === 0 ? (
                  <p className="muted-text">Эффектов при входе в узел нет.</p>
                ) : (
                  <div className="effects-editor-list">
                    {selectedNode.effects.map((ef) => (
                      <div key={ef.effect_id} className="subcard">
                        <div className="subcard-top">
                          <select
                            value={ef.type}
                            onChange={(e) =>
                              updateEffect(
                                currentDialogue.id,
                                selectedNode.id,
                                ef.effect_id,
                                {
                                  type: e.target.value as DialogueEffectType,
                                }
                              )
                            }
                          >
                            <option value="grant_term">
                              Дневник: Выдать термин (grant_term)
                            </option>
                            <option value="add_variable">
                              Переменная: Изменить число / доверие (add_variable)
                            </option>
                            <option value="set_variable">
                              Переменная: Установить значение (set_variable)
                            </option>
                            <option value="npc_event">
                              Событие NPC: Реакция / Действие (npc_event)
                            </option>
                            <option value="service_event">
                              Событие Бара: Заказ напитка (service_event)
                            </option>
                          </select>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              deleteEffect(
                                currentDialogue.id,
                                selectedNode.id,
                                ef.effect_id
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <label>Название эффекта<input value={ef.title || ''} onChange={(e) => updateEffect(currentDialogue.id, selectedNode.id, ef.effect_id, { title: e.target.value })} /></label>
                        {ef.type === 'grant_term' && (
                          <div className="field-row">
                            <label>Термин словаря (term_id)</label>
                            <select
                              value={ef.term_id || ''}
                              onChange={(e) =>
                                updateEffect(
                                  currentDialogue.id,
                                  selectedNode.id,
                                  ef.effect_id,
                                  { term_id: e.target.value }
                                )
                              }
                            >
                              {project.terms.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title} ({t.id})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {(ef.type === 'add_variable' ||
                          ef.type === 'set_variable') && (
                          <div className="field-grid-2">
                            <div className="field-row">
                              <label>Переменная</label>
                              <select
                                value={ef.variable_id || ''}
                                onChange={(e) =>
                                  updateEffect(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ef.effect_id,
                                    { variable_id: e.target.value }
                                  )
                                }
                              >
                                {project.variables.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.title} ({v.id})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="field-row">
                              <label>
                                {ef.type === 'add_variable'
                                  ? 'Прибавить (+/-)'
                                  : 'Новое значение'}
                              </label>
                              {(() => {
                                const targetVar = project.variables.find(
                                  (v) => v.id === ef.variable_id
                                );
                                if (
                                  ef.type === 'set_variable' &&
                                  targetVar?.type === 'boolean'
                                ) {
                                  return (
                                    <select
                                      value={String(ef.value)}
                                      onChange={(e) =>
                                        updateEffect(
                                          currentDialogue.id,
                                          selectedNode.id,
                                          ef.effect_id,
                                          { value: e.target.value === 'true' }
                                        )
                                      }
                                    >
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  );
                                }
                                if (
                                  ef.type === 'add_variable' ||
                                  targetVar?.type === 'number'
                                ) {
                                  return (
                                    <input
                                      type="number"
                                      value={Number(ef.value ?? 0)}
                                      onChange={(e) =>
                                        updateEffect(
                                          currentDialogue.id,
                                          selectedNode.id,
                                          ef.effect_id,
                                          { value: Number(e.target.value) }
                                        )
                                      }
                                    />
                                  );
                                }
                                return (
                                  <input
                                    type="text"
                                    value={String(ef.value ?? '')}
                                    onChange={(e) =>
                                      updateEffect(
                                        currentDialogue.id,
                                        selectedNode.id,
                                        ef.effect_id,
                                        { value: e.target.value }
                                      )
                                    }
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {ef.type === 'npc_event' && (
                          <div className="field-grid-2">
                            <div className="field-row">
                              <label>Тип действия NPC</label>
                              <select
                                value={ef.event || 'react'}
                                onChange={(e) =>
                                  updateEffect(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ef.effect_id,
                                    { event: e.target.value, arg: e.target.value === 'remember' ? '' : e.target.value === 'command' ? 'wait' : 'interested' }
                                  )
                                }
                              >
                                <option value="remember">Запомнить событие (remember)</option>
                                <option value="react">Изменить эмоцию</option>
                                <option value="command">
                                  Команда (VisitorBehavior.command)
                                </option>
                              </select>
                            </div>
                            <div className="field-row">
                              <label>Аргумент</label>
                              {ef.event === 'remember' ? (
                                <RememberEventSelect project={project} value={ef.arg || ''} onChange={(arg) =>
                                  updateEffect(currentDialogue.id, selectedNode.id, ef.effect_id, { arg })
                                } />
                              ) : ef.event === 'command' ? (
                                <select
                                  value={ef.arg || 'wait'}
                                  onChange={(e) =>
                                    updateEffect(
                                      currentDialogue.id,
                                      selectedNode.id,
                                      ef.effect_id,
                                      { arg: e.target.value }
                                    )
                                  }
                                >
                                  <option value="wait">wait (Ожидать)</option>
                                  <option value="drink">drink (Взять напиток)</option>
                                  <option value="leave">leave (Уйти по концу смены)</option>
                                </select>
                              ) : (
                                <select
                                  value={ef.arg || 'interested'}
                                  onChange={(e) =>
                                    updateEffect(
                                      currentDialogue.id,
                                      selectedNode.id,
                                      ef.effect_id,
                                      { arg: e.target.value }
                                    )
                                  }
                                >
                                  {NPC_EMOTIONS.map((em) => (
                                    <option key={em.id} value={em.id}>
                                      {em.id}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        )}

                        {ef.type === 'service_event' && (
                          <div className="field-grid-2">
                            <div className="field-row">
                              <label>Событие бара</label>
                              <select
                                value={ef.event || 'request_drink'}
                                onChange={(e) =>
                                  updateEffect(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ef.effect_id,
                                    { event: e.target.value }
                                  )
                                }
                              >
                                <option value="request_drink">
                                  Заказ напитка (request_drink)
                                </option>
                              </select>
                            </div>
                            <div className="field-row">
                              <label>Желаемый компонент / посуда</label>
                              <select
                                value={ef.arg || 'test_stvor'}
                                onChange={(e) =>
                                  updateEffect(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ef.effect_id,
                                    { arg: e.target.value }
                                  )
                                }
                              >
                                {DRINK_INGREDIENTS.map((dr) => (
                                  <option key={dr.id} value={dr.id}>
                                    {dr.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </details>

              {/* Player Choices & Conditions */}
              {!selectedNode.end && (
                <div className="inspector-subsection" id="dialogue-choices-section">
                  <div className="subsection-header">
                    <h4>
                      <Sliders size={15} /> Варианты ответа и Условия ({selectedNode.choices.length})
                    </h4>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        addChoice(currentDialogue.id, selectedNode.id)
                      }
                    >
                      <Plus size={13} /> Добавить ответ
                    </button>
                  </div>

                  <div className="choices-editor-list">
                    {selectedNode.choices.map((ch) => (
                      <details key={ch.id} className="subcard choice-subcard">
                         <summary className="choice-summary">
                           <strong>{ch.text || ch.title || 'Ответ игрока'}</strong>
                           <span>{describeChoice(ch)}</span>
                         </summary>
                        <label>Название ответа<input value={ch.title || ''} onChange={(e) => updateChoice(currentDialogue.id, selectedNode.id, ch.id, { title: e.target.value })} /></label>
                        <div className="subcard-top">
                          <details className="technical-details"><summary>Служебный ID</summary><AutomaticId value={ch.id} /></details>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              deleteChoice(
                                currentDialogue.id,
                                selectedNode.id,
                                ch.id
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="field-row">
                          <label>Текст ответа игрока</label>
                          <input
                            type="text"
                            value={ch.text}
                            onChange={(e) =>
                              updateChoice(
                                currentDialogue.id,
                                selectedNode.id,
                                ch.id,
                                { text: e.target.value }
                              )
                            }
                          />
                        </div>

                        <div className="field-row">
                          <label>Следующая реплика</label>
                          <select
                            value={ch.target}
                            onChange={(e) =>
                              updateChoice(
                                currentDialogue.id,
                                selectedNode.id,
                                ch.id,
                                { target: e.target.value }
                              )
                            }
                          >
                            {currentDialogue.nodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.title || n.text.slice(0, 38) || n.id}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Required Terms */}
                        <div className="field-row">
                          <label>Нужные сведения из дневника:</label>
                          <div className="chip-group">
                            {project.terms.map((t) => {
                              const active = (ch.required_terms || []).includes(
                                t.id
                              );
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={`chip chip-sm ${
                                    active ? 'chip-active' : ''
                                  }`}
                                  onClick={() => {
                                    const cur = ch.required_terms || [];
                                    const next = active
                                      ? cur.filter((x) => x !== t.id)
                                      : [...cur, t.id];
                                    updateChoice(
                                      currentDialogue.id,
                                      selectedNode.id,
                                      ch.id,
                                      { required_terms: next }
                                    );
                                  }}
                                >
                                  {t.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Required Conclusions */}
                        <div className="field-row">
                          <label>
                            Требуемые выводы дневника (required_conclusions):
                          </label>
                          <div className="chip-group">
                            {allConclusions.map((conc) => {
                              const active = (
                                ch.required_conclusions || []
                              ).includes(conc.id);
                              return (
                                <button
                                  key={conc.id}
                                  type="button"
                                  className={`chip chip-sm ${
                                    active ? 'chip-active' : ''
                                  }`}
                                  title={conc.text}
                                  onClick={() => {
                                    const cur = ch.required_conclusions || [];
                                    const next = active
                                      ? cur.filter((x) => x !== conc.id)
                                      : [...cur, conc.id];
                                    updateChoice(
                                      currentDialogue.id,
                                      selectedNode.id,
                                      ch.id,
                                      { required_conclusions: next }
                                    );
                                  }}
                                >
                                  {conc.id}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Variable Conditions */}
                        <div className="field-row">
                          <div className="subsection-header">
                            <label>Условия по переменным, памяти и смене</label>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => {
                                const firstVar = conditionOptions[0];
                                if (!firstVar) return;
                                const nextConds = [
                                  ...(ch.conditions || []),
                                  {
                                    variable_id: firstVar.id,
                                    op: '==' as ConditionOperator,
                                    value: firstVar.default_value,
                                  },
                                ];
                                updateChoice(
                                  currentDialogue.id,
                                  selectedNode.id,
                                  ch.id,
                                  { conditions: nextConds }
                                );
                              }}
                            >
                              + Условие
                            </button>
                          </div>

                          {(ch.conditions || []).map((cond, cIdx) => {
                            const option = conditionOptions.find((item) => item.id === cond.variable_id);
                            const changeValue = (raw: string) => {
                              const value = option?.type === 'number' ? Number(raw) : option?.type === 'boolean' ? raw === 'true' : raw;
                              const conditions = ch.conditions.map((item, index) => index === cIdx ? { ...item, value } : item);
                              updateChoice(currentDialogue.id, selectedNode.id, ch.id, { conditions });
                            };
                            return (
                            <div key={cIdx} className="condition-row">
                              <select
                                aria-label="Условие ответа"
                                value={cond.variable_id}
                                onChange={(e) => {
                                  const next = (ch.conditions || []).map(
                                    (item, i) =>
                                      i === cIdx
                                        ? { variable_id: e.target.value, op: '==' as const, value: conditionOptions.find((option) => option.id === e.target.value)?.default_value ?? true }
                                        : item
                                  );
                                  updateChoice(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ch.id,
                                    { conditions: next }
                                  );
                                }}
                              >
                                {!conditionOptions.some((option) => option.id === cond.variable_id) && <option value={cond.variable_id}>Недоступно: {cond.variable_id}</option>}
                                {conditionOptions.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.label || v.id}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={cond.op}
                                onChange={(e) => {
                                  const next = (ch.conditions || []).map(
                                    (item, i) =>
                                      i === cIdx
                                        ? {
                                            ...item,
                                            op: e.target
                                              .value as ConditionOperator,
                                          }
                                        : item
                                  );
                                  updateChoice(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ch.id,
                                    { conditions: next }
                                  );
                                }}
                              >
                                <option value="==">равно</option>
                                <option value="!=">не равно</option>
                                {option?.type !== 'boolean' &&
                                  ['>=', '>', '<=', '<'].map((op) => <option key={op} value={op}>{op === '>=' ? 'не меньше' : op === '>' ? 'больше' : op === '<=' ? 'не больше' : 'меньше'}</option>)}
                              </select>
                              {option?.type === 'boolean' ? (
                                <select aria-label="Значение условия" value={String(cond.value)} onChange={(event) => changeValue(event.target.value)}>
                                  <option value="true">Да</option><option value="false">Нет</option>
                                </select>
                              ) : <input aria-label="Значение условия" type={option?.type === 'number' ? 'number' : 'text'}
                                value={String(cond.value)} onChange={(event) => changeValue(event.target.value)} />}
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => {
                                  const next = (ch.conditions || []).filter(
                                    (_, i) => i !== cIdx
                                  );
                                  updateChoice(
                                    currentDialogue.id,
                                    selectedNode.id,
                                    ch.id,
                                    { conditions: next }
                                  );
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="inspector-empty">
              Кликните на узел графа, чтобы редактировать реплику, условия и
              последствия.
            </div>
          )}

          {/* Create New Dialogue Footer */}

        </aside>}
      </div>
    </div>
  );
};
