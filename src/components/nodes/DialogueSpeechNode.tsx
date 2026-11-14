import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  DialogueNode,
  NPC_EMOTIONS,
  ValidationIssue,
} from '../../types/narrative';
import {
  Play,
  Flag,
  Sparkles,
  BookOpen,
  Sliders,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export interface SpeechNodeData extends Record<string, unknown> {
  node: DialogueNode;
  isStart: boolean;
  isSelected: boolean;
  avatarColor: string;
  issues: ValidationIssue[];
  termTitles: Record<string, string>;
  variableTitles: Record<string, string>;
  conclusionTitles: Record<string, string>;
  eventTitles: Record<string, string>;
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="highlighted-term">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export const DialogueSpeechNode: React.FC<NodeProps> = ({ data }) => {
  const { node, isStart, isSelected, avatarColor, issues, termTitles, variableTitles, conclusionTitles, eventTitles } =
    data as unknown as SpeechNodeData;

  const emotionMeta =
    NPC_EMOTIONS.find((e) => e.id === node.emotion) || NPC_EMOTIONS[0];

  return (
    <div
      className={`rf-speech-node ${isSelected ? 'selected' : ''} ${
        node.end ? 'is-end' : ''
      } ${isStart ? 'is-start' : ''} ${issues.length > 0 ? 'has-error' : ''}`}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="rf-handle rf-handle-target"
      />

      {/* Node Header */}
      <div
        className="rf-node-header"
        style={{ borderTop: `3px solid ${avatarColor || '#38bdf8'}` }}
      >
        <div className="rf-node-badges">
          {isStart && (
            <span className="node-badge badge-start">
              <Play size={10} /> Начало
            </span>
          )}
          {node.end && (
            <span className="node-badge badge-end">
              <Flag size={10} /> Финал
            </span>
          )}
          <strong className="rf-node-title">{node.title || "Реплика"}</strong>
        </div>
        {issues.length > 0 && (
          <span
            className="node-badge badge-error"
            title={issues.map((i) => i.message).join('\n')}
          >
            <AlertTriangle size={11} /> {issues.length}
          </span>
        )}
      </div>

      {/* Speaker & Emotion Row */}
      <div className="rf-speaker-row">
        <span className="rf-speaker-name">{node.speaker}</span>
        {node.emotion && (
          <span
            className="rf-emotion-tag"
            style={{
              borderColor: emotionMeta.color,
              color: emotionMeta.color,
            }}
          >
            {emotionMeta.label}
          </span>
        )}
      </div>

      {/* Speech Text */}
      <div className="rf-speech-body">{renderFormattedText(node.text)}</div>

      {/* Entry Effects (Consequences) */}
      {node.effects && node.effects.length > 0 && (
        <div className="rf-effects-box">
          <div className="rf-section-caption">
            <Sparkles size={11} /> Последствия входа ({node.effects.length})
          </div>
          <div className="rf-effect-pills">
            {node.effects.map((ef) => {
              if (ef.type === 'grant_term') {
                return (
                  <span key={ef.effect_id} className="effect-pill pill-term">
                    <BookOpen size={10} /> +{termTitles[ef.term_id || ''] || ef.term_id}
                  </span>
                );
              }
              if (ef.type === 'add_variable' || ef.type === 'set_variable') {
                const sign =
                  ef.type === 'add_variable'
                    ? Number(ef.value) >= 0
                      ? `+${ef.value}`
                      : `${ef.value}`
                    : `=${String(ef.value)}`;
                return (
                  <span key={ef.effect_id} className="effect-pill pill-var">
                    <Sliders size={10} /> {variableTitles[ef.variable_id || ''] || ef.variable_id} {sign}
                  </span>
                );
              }
              return (
                <span key={ef.effect_id} className="effect-pill pill-event">
                  ⚡ {ef.type === 'npc_event' && ef.event === 'remember' ? `Запомнить: ${eventTitles[ef.arg || ''] || ef.arg}` : ef.title || 'Событие'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Choices & Output Handles */}
      {!node.end && (
        <div className="rf-choices-box">
          <div className="rf-section-caption">Варианты ответа</div>
          {node.choices.map((ch) => {
            const hasConditions =
              (ch.required_terms && ch.required_terms.length > 0) ||
              (ch.required_conclusions && ch.required_conclusions.length > 0) ||
              (ch.conditions && ch.conditions.length > 0);
            return (
              <div key={ch.id} className="rf-choice-item">
                <div className="rf-choice-content">
                  <div className="rf-choice-text">{ch.text}</div>
                  {hasConditions && (
                    <div className="rf-choice-conditions">
                      {(ch.required_terms || []).map((t) => (
                        <span key={t} className="cond-pill cond-term">
                          <Lock size={9} /> сведение: {termTitles[t] || t}
                        </span>
                      ))}
                      {(ch.required_conclusions || []).map((c) => (
                        <span key={c} className="cond-pill cond-conc">
                          <Lock size={9} /> вывод: {conclusionTitles[c] || c}
                        </span>
                      ))}
                      {(ch.conditions || []).map((cond, idx) => (
                        <span key={idx} className="cond-pill cond-var">
                          {variableTitles[cond.variable_id] || cond.variable_id} {cond.op} {String(cond.value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={ch.id}
                  className="rf-handle rf-handle-source"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
