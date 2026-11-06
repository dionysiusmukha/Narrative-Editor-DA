import React, { useEffect, useMemo, useState } from 'react';
import { useNarrativeStore } from '../store/useNarrativeStore';
import {
  DialogueChoice,
  NPC_EMOTIONS,
} from '../types/narrative';
import { RECORD_KINDS } from '../types/narrative';
import { evaluateCondition, KIND_LABELS, rememberEvent, visibleRecords, type EventHistory } from '../utils/npcMemory';
import {
  Play,
  RotateCcw,
  BookOpen,
  Sliders,
  Sparkles,
  CheckCircle2,
  Lock,
  MessageSquare,
} from 'lucide-react';

export const DialogueSimulator: React.FC = () => {
  const { project, selectedDialogueId, setSelectedDialogueId } =
    useNarrativeStore();

  const currentDialogue =
    project.dialogues.find((d) => d.id === selectedDialogueId) ||
    project.dialogues[0];

  const [currentNodeId, setCurrentNodeId] = useState<string>(
    currentDialogue?.start_node || ''
  );
  const [knownTerms, setKnownTerms] = useState<string[]>([]);
  const [chosenConclusions, setChosenConclusions] = useState<
    Record<string, string>
  >({});
  const [variables, setVariables] = useState<
    Record<string, boolean | number | string>
  >(() => {
    const init: Record<string, boolean | number | string> = {};
    for (const v of project.variables) {
      init[v.id] = v.default_value;
    }
    return init;
  });
  const [appliedEffects, setAppliedEffects] = useState<string[]>([]);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [shift, setShift] = useState(1);
  const [history, setHistory] = useState<EventHistory>({});
  const [inspectedCharacter, setInspectedCharacter] = useState('');
  const [reaction, setReaction] = useState('neutral');
  const [serviceTrigger, setServiceTrigger] = useState('');
  const events = project.narrative_events || [];
  const characterId = inspectedCharacter || currentDialogue?.character_id || project.characters[0]?.id || '';
  const acquired = visibleRecords(events, history, characterId);
  const initialVariables = () => Object.fromEntries(project.variables.map((variable) => [variable.id, variable.default_value]));

  const applyNodeEntry = (
    nodeId: string,
    currentApplied: string[],
    currentTerms: string[],
    currentVars: Record<string, boolean | number | string>,
    currentHistory = history,
    currentShift = shift,
  ) => {
    if (!currentDialogue) return;
    const node = currentDialogue.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const nextApplied = [...currentApplied];
    const nextTerms = [...currentTerms];
    const nextVars = { ...currentVars };
    let nextHistory = currentHistory;
    let nextReaction = node.emotion || 'neutral' as string;
    const logs: string[] = [];

    if (node.emotion) {
      logs.push(
        `[VisitorBehavior] Реакция ${node.speaker}: &"${node.emotion}"`
      );
    }

    for (const ef of node.effects || []) {
      const key = `${currentDialogue.id}:${ef.effect_id}`;
      if (nextApplied.includes(key)) continue;
      nextApplied.push(key);

      if (ef.type === 'grant_term' && ef.term_id) {
        if (!nextTerms.includes(ef.term_id)) {
          nextTerms.push(ef.term_id);
          const termObj = project.terms.find((t) => t.id === ef.term_id);
          logs.push(
            `[Дневник] Получен термин: «${termObj?.title || ef.term_id}» (${ef.term_id})`
          );
        }
      } else if (ef.type === 'add_variable' && ef.variable_id) {
        const prev = Number(nextVars[ef.variable_id] ?? 0);
        const delta = Number(ef.value ?? 0);
        nextVars[ef.variable_id] = prev + delta;
        logs.push(
          `[Переменная] ${ef.variable_id}: ${prev} → ${prev + delta} (${
            delta >= 0 ? '+' + delta : delta
          })`
        );
      } else if (ef.type === 'set_variable' && ef.variable_id) {
        nextVars[ef.variable_id] = ef.value ?? '';
        logs.push(
          `[Переменная] ${ef.variable_id} = ${String(ef.value)}`
        );
      } else if (ef.type === 'npc_event') {
        if (ef.event === 'remember') {
          const updated = rememberEvent(events, nextHistory, ef.arg || '', currentShift);
          if (updated !== nextHistory) logs.push(`[Смена ${currentShift}] Событие ${ef.arg} записано`);
          nextHistory = updated;
        } else {
          if (ef.event === 'react' && ef.arg) nextReaction = ef.arg;
          logs.push(`[Событие NPC] ${ef.event}(${ef.arg})`);
        }
      } else if (ef.type === 'service_event') {
        logs.push(`[Событие Бара] ${ef.event}: ${ef.arg}`);
      }
    }

    setCurrentNodeId(nodeId);
    setAppliedEffects(nextApplied);
    setKnownTerms(nextTerms);
    setVariables(nextVars);
    setHistory(nextHistory);
    setReaction(nextReaction);
    if (logs.length > 0) {
      setEventLog((prev) => [...logs, ...prev]);
    }
  };

  const resetSimulation = () => {
    if (!currentDialogue) return;
    setShift(1);
    setChosenConclusions({});
    setEventLog(['--- Симуляция запущена с начального состояния ---']);
    applyNodeEntry(currentDialogue.start_node, [], [], initialVariables(), {}, 1);
  };

  const startMeeting = () => {
    if (currentDialogue) applyNodeEntry(currentDialogue.start_node, appliedEffects, knownTerms, variables);
  };

  const nextShift = () => {
    if (!currentDialogue) return;
    setShift(shift + 1);
    setEventLog((previous) => [`--- Смена ${shift + 1} ---`, ...previous]);
    applyNodeEntry(currentDialogue.start_node, [], knownTerms, initialVariables(), history, shift + 1);
  };

  const simulateService = () => {
    const selected = events.find((event) => event.id === serviceTrigger)?.service;
    if (!selected) return;
    let nextHistory = history;
    for (const event of events) {
      if (event.service?.character_id === selected.character_id && event.service.drink_id === selected.drink_id) {
        nextHistory = rememberEvent(events, nextHistory, event.id, shift);
      }
    }
    setHistory(nextHistory);
    if (nextHistory !== history) setEventLog((previous) => [`[Смена ${shift}] Подача: ${selected.character_id} / ${selected.drink_id}`, ...previous]);
  };

  useEffect(() => {
    startMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDialogue?.id]);

  const currentNode = currentDialogue?.nodes.find(
    (n) => n.id === currentNodeId
  );

  // Evaluate choices just like DialogueRunner.get_choices()
  const evaluatedChoices = useMemo(() => {
    if (!currentNode) return [];
    return currentNode.choices.map((ch: DialogueChoice) => {
      const missingTerms = (ch.required_terms || []).filter(
        (t) => !knownTerms.includes(t)
      );
      const activeConclusionValues = Object.values(chosenConclusions);
      const missingConclusions = (ch.required_conclusions || []).filter(
        (c) => !activeConclusionValues.includes(c)
      );
      const failedConditions = (ch.conditions || []).filter(
        (cond) => !evaluateCondition(cond, variables, events, history, currentDialogue.character_id, shift)
      );

      const available =
        missingTerms.length === 0 &&
        missingConclusions.length === 0 &&
        failedConditions.length === 0;

      return {
        choice: ch,
        available,
        missingTerms,
        missingConclusions,
        failedConditions,
      };
    });
  }, [currentNode, knownTerms, chosenConclusions, variables, events, history, currentDialogue, shift]);

  if (!currentDialogue) {
    return <div className="page-container">Нет выбранного диалога.</div>;
  }

  const emotionMeta =
    NPC_EMOTIONS.find((e) => e.id === reaction) || NPC_EMOTIONS[0];

  return (
    <div className="simulator-layout">
      {/* Left Column: Live State & Journal Controls */}
      <aside className="simulator-sidebar">
        <div className="card memory-card">
          <div className="card-header-inline"><h3>Смена {shift}</h3><button className="btn btn-primary btn-sm" onClick={nextShift}>Следующая смена</button></div>
          <label className="memory-inspector-label">Состояние персонажа<select value={characterId} onChange={(e) => setInspectedCharacter(e.target.value)}>
            {project.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select></label>
          {characterId === currentDialogue.character_id && <p className="muted-text">Текущая реакция · {emotionMeta.label}</p>}
          {RECORD_KINDS.map((kind) => <div key={kind} className="memory-inspector-group"><strong>{KIND_LABELS[kind]}</strong>
            {acquired.filter(({ record }) => record.kind === kind).map(({ record, eventId, shift }) => <p key={record.id}>{record.text}<br />
              <small className="muted-text">{eventId} · смена {shift}{record.kind === 'memory' ? ` · ${record.interpretation}` : record.kind === 'testimony' ? ` · ${record.source}` : ''}</small></p>)}
            {!acquired.some(({ record }) => record.kind === kind) && <p className="muted-text">Пока нет записей</p>}
          </div>)}
          {events.some((event) => event.service) && <div className="memory-inspector-group">
            <label className="memory-inspector-label">Проверка подачи<select value={serviceTrigger} onChange={(e) => setServiceTrigger(e.target.value)}>
              <option value="">Выберите подачу</option>{events.filter((event) => event.service).map((event) => <option key={event.id} value={event.id}>{event.service?.character_id} · {event.service?.drink_id}</option>)}
            </select></label><button className="btn btn-secondary btn-xs" disabled={!serviceTrigger} onClick={simulateService}>Отметить успешную подачу</button>
          </div>}
          <details><summary>Выполненные события ({Object.keys(history).length})</summary><ul>{Object.entries(history).map(([id, shift]) => <li key={id}>{id} · смена {shift}</li>)}</ul></details>
        </div>
        <div className="card">
          <div className="card-header-inline">
            <h3>
              <Sliders size={16} /> Переменные в памяти
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetSimulation}
            >
              <RotateCcw size={13} /> Сброс
            </button>
          </div>
          <div className="sim-vars-list">
            {project.variables.map((v) => (
              <div key={v.id} className="sim-var-row">
                <div>
                  <strong>{v.title}</strong>
                  <small>{v.id}</small>
                </div>
                {v.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(variables[v.id])}
                    onChange={(e) =>
                      setVariables({ ...variables, [v.id]: e.target.checked })
                    }
                  />
                ) : v.type === 'number' ? (
                  <input
                    type="number"
                    className="sim-number-input"
                    value={Number(variables[v.id] ?? 0)}
                    onChange={(e) =>
                      setVariables({
                        ...variables,
                        [v.id]: Number(e.target.value),
                      })
                    }
                  />
                ) : (
                  <input
                    type="text"
                    className="sim-text-input"
                    value={String(variables[v.id] ?? '')}
                    onChange={(e) =>
                      setVariables({ ...variables, [v.id]: e.target.value })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Journal Terms & Conclusions Simulator */}
        <div className="card">
          <h3>
            <BookOpen size={16} /> Дневник (Термины и Выводы)
          </h3>
          <p className="muted-text">
            Кликайте на термины или выбирайте вывод в группе, чтобы протестировать
            закрытые ветки диалога на лету:
          </p>
          <div className="chip-group" style={{ marginBottom: 12 }}>
            {project.terms.map((t) => {
              const known = knownTerms.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${known ? 'chip-active' : ''}`}
                  onClick={() => {
                    setKnownTerms(
                      known
                        ? knownTerms.filter((id) => id !== t.id)
                        : [...knownTerms, t.id]
                    );
                  }}
                >
                  {known ? '✓ ' : ''}
                  {t.title} ({t.id})
                </button>
              );
            })}
          </div>

          <h4>Группы мыслей (JournalReasoning)</h4>
          {project.reasoning_groups.map((grp) => {
            const learnedCount = grp.terms.filter((t) =>
              knownTerms.includes(t)
            ).length;
            const isReady = learnedCount >= grp.minimum_terms;
            const currentConc = chosenConclusions[grp.id] || '';
            return (
              <div key={grp.id} className="sim-reasoning-box">
                <div className="sim-reasoning-header">
                  <strong>{grp.title}</strong>
                  <span className="tag">
                    Слов: {learnedCount}/{grp.minimum_terms}
                  </span>
                </div>
                <select
                  disabled={!isReady}
                  value={currentConc}
                  onChange={(e) =>
                    setChosenConclusions({
                      ...chosenConclusions,
                      [grp.id]: e.target.value,
                    })
                  }
                >
                  <option value="">
                    {isReady
                      ? '— Выберите вывод в дневнике —'
                      : `Нужно ещё слов (${grp.minimum_terms - learnedCount})`}
                  </option>
                  {grp.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text} ({o.id})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center Column: Interactive Dialogue Runner */}
      <div className="simulator-stage">
        <div className="sim-stage-topbar">
          <div className="inline-controls">
            <MessageSquare size={18} />
            <select
              value={currentDialogue.id}
              onChange={(e) => setSelectedDialogueId(e.target.value)}
            >
              {project.dialogues.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.id})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={startMeeting}
          >
            <Play size={14} /> Начать встречу
          </button>
        </div>

        {currentNode ? (
          <div className="sim-dialogue-box">
            {/* NPC Speech Bubble */}
            <div className="sim-voice-bubble">
              <div className="sim-speaker-bar">
                <div className="sim-speaker-title">
                  <strong>{currentNode.speaker}</strong>
                  <code>узел: {currentNode.id}</code>
                </div>
                <span
                  className="rf-emotion-tag"
                  style={{
                    borderColor: emotionMeta.color,
                    color: emotionMeta.color,
                  }}
                >
                  Реакция: {reaction}
                </span>
              </div>

              <div className="sim-speech-text">
                {currentNode.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={i} className="highlighted-term">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            </div>

            {/* Reply Choices Area */}
            <div className="sim-replies-area">
              {currentNode.end ? (
                <div className="sim-terminal-box">
                  <CheckCircle2 size={18} />
                  <span>
                    Конечный узел разговора (<code>end: true</code>). В игре нажатие{' '}
                    <kbd>E</kbd> вызывает <code>runner.finish()</code> и расходует 1
                    деление времени смены.
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={startMeeting}
                  >
                    Пройти диалог ещё раз
                  </button>
                </div>
              ) : (
                evaluatedChoices.map(
                  ({
                    choice,
                    available,
                    missingTerms,
                    missingConclusions,
                    failedConditions,
                  }) => (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={!available}
                      className={`sim-choice-btn ${
                        available ? 'available' : 'locked'
                      }`}
                      onClick={() => {
                        setEventLog((previous) => [`[Смена ${shift}] Ответ: ${choice.text}`, ...previous]);
                        applyNodeEntry(
                          choice.target,
                          appliedEffects,
                          knownTerms,
                          variables
                        );
                      }}
                    >
                      <div className="sim-choice-main">
                        <span className="sim-choice-caption">{choice.text}</span>
                        <code>→ {choice.target}</code>
                      </div>
                      {!available && (
                        <div className="sim-lock-reasons">
                          {missingTerms.length > 0 && (
                            <span>
                              <Lock size={11} /> Нужны термины:{' '}
                              {missingTerms.join(', ')}
                            </span>
                          )}
                          {missingConclusions.length > 0 && (
                            <span>
                              <Lock size={11} /> Нужен вывод дневника:{' '}
                              {missingConclusions.join(', ')}
                            </span>
                          )}
                          {failedConditions.map((fc, i) => (
                            <span key={i}>
                              <Lock size={11} /> Требуется: {fc.variable_id}{' '}
                              {fc.op} {String(fc.value)} (сейчас:{' '}
                              {String(variables[fc.variable_id])})
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                )
              )}
            </div>
          </div>
        ) : null}

        {/* Event Log */}
        <div className="card sim-log-card">
          <h4>
            <Sparkles size={15} /> Журнал сработавших эффектов и событий Godot
          </h4>
          <div className="sim-log-list">
            {eventLog.map((entry, idx) => (
              <div key={idx} className="sim-log-entry">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
