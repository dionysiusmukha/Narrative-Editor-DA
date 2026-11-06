import { EventGateEditor } from './EventGateEditor';
import { characterId } from '../utils/ids';
import { AutomaticId } from './AutomaticId';
import { generateId } from '../utils/ids';
import React, { useState } from 'react';
import { MemoryEditor } from './MemoryEditor';
import {
  DRINK_INGREDIENTS,
  NPC_EMOTIONS,
  NpcEmotion,
} from '../types/narrative';
import { useNarrativeStore } from '../store/useNarrativeStore';
import { isValidSnakeCaseId } from '../utils/validator';
import {
  Plus,
  Trash2,
  User,
  HeartHandshake,
  Wine,
  Sparkles,
  Lock,
  EyeOff,
} from 'lucide-react';

export const CharacterEditor: React.FC = () => {
  const {
    project,
    selectedCharacterId,
    setSelectedCharacterId,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    upsertRelationship,
    removeRelationship,
  } = useNarrativeStore();

  const [newCharName, setNewCharName] = useState('');
  const [relTargetId, setRelTargetId] = useState('');

  const selectedChar =
    project.characters.find((c) => c.id === selectedCharacterId) ||
    project.characters[0];

  const handleCreateCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = generateId('character', newCharName, project.characters.map((item) => item.id));
    if (!cleanId || !isValidSnakeCaseId(cleanId)) return;
    if (project.characters.some((c) => c.id === cleanId)) return;

    addCharacter({
      id: cleanId,
      name: newCharName.trim() || cleanId,
      role: 'Новый гость бара',
      biography: '',
      personality: '',
      motivation: '',
      secrets: '',
      default_emotion: 'neutral',
      available_emotions: ['neutral', 'interested', 'thoughtful', 'tense', 'disagree'],
      preferences: ['test_glass'],
      relationships: [],
      avatar_color: '#38bdf8',
    });
    setNewCharName('');
  };

  const toggleEmotion = (emotion: NpcEmotion) => {
    if (!selectedChar) return;
    const exists = selectedChar.available_emotions.includes(emotion);
    const next = exists
      ? selectedChar.available_emotions.filter((e) => e !== emotion)
      : [...selectedChar.available_emotions, emotion];
    if (next.length === 0) return;
    updateCharacter(selectedChar.id, { available_emotions: next });
  };

  const togglePreference = (prefId: string) => {
    if (!selectedChar) return;
    const exists = selectedChar.preferences.includes(prefId);
    const next = exists
      ? selectedChar.preferences.filter((p) => p !== prefId)
      : [...selectedChar.preferences, prefId];
    updateCharacter(selectedChar.id, { preferences: next });
  };

  // Compute all node reactions mapped to this character across dialogues
  const mappedReactions: Array<{ key: string; emotion: string; text: string }> = [];
  if (selectedChar) {
    for (const dlg of project.dialogues) {
      for (const node of dlg.nodes) {
        if (
          (node.character_id === selectedChar.id || dlg.character_id === selectedChar.id) &&
          node.emotion
        ) {
          mappedReactions.push({
            key: `${dlg.id}:${node.id}`,
            emotion: node.emotion,
            text: node.text.slice(0, 70) + (node.text.length > 70 ? '…' : ''),
          });
        }
      }
    }
  }

  return (
    <div className="split-layout">
      {/* Left Sidebar: Characters List */}
      <aside className="sidebar-list">
        <div className="sidebar-header">
          <h3>Персонажи ({project.characters.length})</h3>
        </div>

        <div className="item-list">
          {project.characters.map((char) => (
            <button
              key={char.id}
              className={`list-item ${char.id === selectedChar?.id ? 'active' : ''}`}
              onClick={() => setSelectedCharacterId(char.id)}
            >
              <span
                className="avatar-dot"
                style={{ backgroundColor: char.avatar_color || '#38bdf8' }}
              />
              <div className="list-item-text">
                <strong>{char.name}</strong>
                <small>{char.id} · {char.role}</small>
              </div>
            </button>
          ))}
        </div>

        <form className="add-form" onSubmit={handleCreateCharacter}>
          <h4>Новый персонаж</h4>
          <AutomaticId value={generateId('character', newCharName, project.characters.map((item) => item.id))} />
          <input
            type="text"
            placeholder="Имя (напр. Аркадий)"
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={15} /> Создать персонажа
          </button>
        </form>
      </aside>

      {/* Main Content: Selected Character Details */}
      {selectedChar ? (
        <div className="detail-pane">
          <div className="detail-header">
            <div className="detail-title-group">
              <span
                className="avatar-badge"
                style={{ backgroundColor: selectedChar.avatar_color }}
              >
                <User size={20} />
              </span>
              <div>
                <h2>{selectedChar.name}</h2>
                <span className="code-badge">content/characters/{selectedChar.id}.json</span>
              </div>
            </div>
            {project.characters.length > 1 && (
              <button
                className="btn btn-danger"
                onClick={() => deleteCharacter(selectedChar.id)}
              >
                <Trash2 size={15} /> Удалить
              </button>
            )}
          </div>

          <details className="card memory-details" key={selectedChar.id}>
            <summary>Память, знания, убеждения и свидетельства</summary>
            <MemoryEditor characterId={selectedChar.id} />
          </details>
          <details className="card"><summary>Имя, которое знает игрок</summary>
            <label>Имя до знакомства<input placeholder="Например: Незнакомец" value={selectedChar.unknown_name || ''} onChange={(e) => updateCharacter(selectedChar.id, { unknown_name: e.target.value })} /></label>
            <p>Основное имя выше используется для авторских данных и ID. Здесь задаются имена, видимые игроку. Событие знакомства может произойти в диалоге любого персонажа.</p>
            <button className="btn btn-secondary" onClick={() => updateCharacter(selectedChar.id, { name_rules: [...(selectedChar.name_rules || []), { id: characterId('name', selectedChar.name, 'Новое имя', selectedChar.name_rules?.map((x) => x.id)), name: selectedChar.name, required_events: [], excluded_events: [], min_shift: 1 }] })}>+ Вариант имени</button>
            {(selectedChar.name_rules || []).map((rule, index) => {
              const patch = (values: Partial<typeof rule>) => updateCharacter(selectedChar.id, { name_rules: selectedChar.name_rules!.map((x) => x.id === rule.id ? { ...x, ...values } : x) });
              return <div className="subcard" key={rule.id}><label>Отображаемое имя<input value={rule.name} onChange={(e) => patch({ name: e.target.value })} /></label>
                <EventGateEditor project={project} value={rule} onChange={patch} />
                <button className="btn btn-secondary" disabled={!index} onClick={() => { const rules = [...selectedChar.name_rules!]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; updateCharacter(selectedChar.id, { name_rules: rules }); }}>Выше по приоритету</button>
                <button className="btn btn-danger" onClick={() => updateCharacter(selectedChar.id, { name_rules: selectedChar.name_rules!.filter((x) => x.id !== rule.id) })}>Удалить имя</button>
              </div>;
            })}
          </details>
          <div className="form-grid-2">
            <div className="card">
              <h3>Основные данные</h3>
              <div className="field-row">
                <label>Имя персонажа</label>
                <input
                  type="text"
                  value={selectedChar.name}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { name: e.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <label>Роль / Профессия</label>
                <input
                  type="text"
                  value={selectedChar.role}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { role: e.target.value })
                  }
                />
              </div>
              <div className="field-grid-2">
                <div className="field-row">
                  <label>Базовая эмоция в Godot</label>
                  <select
                    value={selectedChar.default_emotion}
                    onChange={(e) =>
                      updateCharacter(selectedChar.id, {
                        default_emotion: e.target.value as NpcEmotion,
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
                <div className="field-row">
                  <label>Цвет метки в графе</label>
                  <input
                    type="color"
                    value={selectedChar.avatar_color}
                    onChange={(e) =>
                      updateCharacter(selectedChar.id, {
                        avatar_color: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <label>Доступные процедурные реакции (VisitorModel.react)</label>
                <div className="chip-group">
                  {NPC_EMOTIONS.map((em) => {
                    const active = selectedChar.available_emotions.includes(em.id);
                    return (
                      <button
                        key={em.id}
                        type="button"
                        className={`chip ${active ? 'chip-active' : ''}`}
                        style={
                          active
                            ? { borderColor: em.color, color: em.color }
                            : undefined
                        }
                        onClick={() => toggleEmotion(em.id)}
                      >
                        {em.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-row">
                <label>
                  <Wine size={14} /> Предпочтения в баре (VisitorProfile.preferences)
                </label>
                <div className="chip-group">
                  {DRINK_INGREDIENTS.map((item) => {
                    const active = selectedChar.preferences.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`chip ${active ? 'chip-active' : ''}`}
                        onClick={() => togglePreference(item.id)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Психология, Мотивация и Секреты</h3>
              <div className="field-row">
                <label>Биография</label>
                <textarea
                  rows={3}
                  value={selectedChar.biography}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { biography: e.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <label>Характер и манера речи</label>
                <textarea
                  rows={2}
                  value={selectedChar.personality}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { personality: e.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <label>Мотивация</label>
                <textarea
                  rows={2}
                  value={selectedChar.motivation}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { motivation: e.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <label>
                  <Lock size={14} /> Секреты (скрытая информация для сценариста)
                </label>
                <textarea
                  rows={3}
                  value={selectedChar.secrets}
                  onChange={(e) =>
                    updateCharacter(selectedChar.id, { secrets: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Relationships Section */}
          <div className="form-grid-2">
            <div className="card">
              <div className="card-header-inline">
                <h3>
                  <HeartHandshake size={16} /> Отношения с другими персонажами
                </h3>
                <div className="inline-controls">
                  <select
                    value={relTargetId}
                    onChange={(e) => setRelTargetId(e.target.value)}
                  >
                    <option value="">Выберите персонажа...</option>
                    {project.characters
                      .filter((c) => c.id !== selectedChar.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!relTargetId}
                    onClick={() => {
                      if (!relTargetId) return;
                      upsertRelationship(selectedChar.id, {
                        target_id: relTargetId,
                        trust: 0,
                        conflict: 0,
                        hidden: false,
                        note: '',
                      });
                      setRelTargetId('');
                    }}
                  >
                    <Plus size={14} /> Добавить связь
                  </button>
                </div>
              </div>

              {selectedChar.relationships.length === 0 ? (
                <p className="muted-text">Связи пока не заданы.</p>
              ) : (
                <div className="relationship-list">
                  {selectedChar.relationships.map((rel) => {
                    const targetChar = project.characters.find(
                      (c) => c.id === rel.target_id
                    );
                    return (
                      <div key={rel.target_id} className="relationship-card">
                        <div className="relationship-top">
                          <strong>
                            → {targetChar?.name || rel.target_id}{' '}
                            <span className="code-badge">{rel.target_id}</span>
                          </strong>
                          <div className="inline-controls">
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={rel.hidden}
                                onChange={(e) =>
                                  upsertRelationship(selectedChar.id, {
                                    ...rel,
                                    hidden: e.target.checked,
                                  })
                                }
                              />
                              <EyeOff size={13} /> Скрытое
                            </label>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() =>
                                removeRelationship(selectedChar.id, rel.target_id)
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="field-grid-2">
                          <div className="field-row">
                            <label>Доверие (Trust): {rel.trust}</label>
                            <input
                              type="range"
                              min={-10}
                              max={10}
                              value={rel.trust}
                              onChange={(e) =>
                                upsertRelationship(selectedChar.id, {
                                  ...rel,
                                  trust: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="field-row">
                            <label>Конфликт (Conflict): {rel.conflict}</label>
                            <input
                              type="range"
                              min={0}
                              max={10}
                              value={rel.conflict}
                              onChange={(e) =>
                                upsertRelationship(selectedChar.id, {
                                  ...rel,
                                  conflict: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Контекст отношений / скрытый конфликт..."
                          value={rel.note}
                          onChange={(e) =>
                            upsertRelationship(selectedChar.id, {
                              ...rel,
                              note: e.target.value,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Automatic VisitorProfile.reactions Preview */}
            <div className="card">
              <h3>
                <Sparkles size={16} /> Таблица реакций Godot (VisitorProfile.reactions)
              </h3>
              <p className="muted-text">
                Автоматически собирается из узлов диалогов этого персонажа и
                используется в <code>VisitorBehavior._on_line()</code>:
              </p>
              <div className="reactions-table">
                {mappedReactions.length === 0 ? (
                  <p className="muted-text">Нет привязанных реплик с эмоциями.</p>
                ) : (
                  mappedReactions.map((item) => (
                    <div key={item.key} className="reaction-row">
                      <code>"{item.key}"</code>
                      <span className={`emotion-pill emotion-${item.emotion}`}>
                        &"{item.emotion}"
                      </span>
                      <span className="reaction-preview">{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
