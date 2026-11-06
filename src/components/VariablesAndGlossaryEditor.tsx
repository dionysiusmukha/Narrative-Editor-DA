import { AutomaticId } from './AutomaticId';
import { generateId, characterId } from '../utils/ids';
import React, { useState } from 'react';
import { useNarrativeStore } from '../store/useNarrativeStore';
import {
  VariableCategory,
  VariableType,
} from '../types/narrative';
import { isValidSnakeCaseId } from '../utils/validator';
import {
  BookOpen,
  Database,
  Plus,
  Trash2,
  GitBranch,
  Lock,
} from 'lucide-react';

export const VariablesAndGlossaryEditor: React.FC<{
  mode: 'variables' | 'glossary';
}> = ({ mode }) => {
  const {
    project,
    addVariable,
    updateVariable,
    deleteVariable,
    addTerm,
    updateTerm,
    deleteTerm,
    addReasoningGroup,
    updateReasoningGroup,
    deleteReasoningGroup,
  } = useNarrativeStore();

  // Variable form state
  const [varTitle, setVarTitle] = useState('');
  const [varType, setVarType] = useState<VariableType>('number');
  const [varCategory, setVarCategory] = useState<VariableCategory>('relationship');
  const [varCharId, setVarCharId] = useState('arkadiy');

  // Term form state
  const [termTitle, setTermTitle] = useState('');
  const [termDesc, setTermDesc] = useState('');

  // Reasoning group form state
  const [groupTitle, setGroupTitle] = useState('');

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = characterId('variable', project.characters.find((c) => c.id === varCharId)?.name || '', varTitle, project.variables.map((item) => item.id));
    if (!cleanId || !isValidSnakeCaseId(cleanId)) return;
    if (project.variables.some((v) => v.id === cleanId)) return;

    addVariable({
      id: cleanId,
      title: varTitle.trim() || cleanId,
      type: varType,
      default_value: varType === 'boolean' ? false : varType === 'number' ? 0 : 'default',
      category: varCategory,
      character_id: varCharId || undefined,
      description: '',
    });
    setVarTitle('');
  };

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = generateId('term', termTitle, project.terms.map((item) => item.id));
    if (!cleanId || !isValidSnakeCaseId(cleanId)) return;
    if (project.terms.some((t) => t.id === cleanId)) return;

    addTerm({
      id: cleanId,
      title: termTitle.trim() || cleanId,
      description: termDesc.trim() || 'Описание записи в дневнике...',
    });
    setTermTitle('');
    setTermDesc('');
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = generateId('group', groupTitle, project.reasoning_groups.map((item) => item.id));
    if (!cleanId || !isValidSnakeCaseId(cleanId)) return;
    if (project.reasoning_groups.some((g) => g.id === cleanId)) return;

    const defaultTerms = project.terms.slice(0, 2).map((t) => t.id);
    addReasoningGroup({
      id: cleanId,
      title: groupTitle.trim() || 'Новая группа размышлений',
      terms: defaultTerms,
      minimum_terms: 2,
      sheet: 1,
      position: [0.4, 0.4],
      options: [
        { id: generateId('conclusion', 'Первый вывод', project.reasoning_groups.flatMap((g) => g.options.map((o) => o.id))), title: 'Первый вывод', text: 'Первая версия вывода.' },
        { id: generateId('conclusion', 'Альтернативный вывод', project.reasoning_groups.flatMap((g) => g.options.map((o) => o.id))), title: 'Альтернативный вывод', text: 'Альтернативная версия вывода.' },
      ],
    });
    setGroupTitle('');
  };

  if (mode === 'variables') {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2>
              <Database size={20} /> Сюжетные переменные и состояния
            </h2>
            <p className="muted-text">
              Хранят решения игрока, уровень доверия персонажей и флаги событий.
              Экспортируются в <code>content/variables/narrative_variables.json</code>.
            </p>
          </div>
        </div>

        <div className="form-grid-sidebar">
          <form className="card add-card" onSubmit={handleAddVariable}>
            <h3>Добавить переменную</h3>
            <div className="field-row">
              <label>ID переменной (snake_case)</label>
              <AutomaticId value={characterId('variable', project.characters.find((c) => c.id === varCharId)?.name || '', varTitle, project.variables.map((item) => item.id))} />
            </div>
            <div className="field-row">
              <label>Название</label>
              <input
                type="text"
                placeholder="напр. Аркадий передал ключ"
                value={varTitle}
                onChange={(e) => setVarTitle(e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Тип значения</label>
              <select
                value={varType}
                onChange={(e) => setVarType(e.target.value as VariableType)}
              >
                <option value="number">Число (number — доверие, счётчик)</option>
                <option value="boolean">Флаг (boolean — да / нет)</option>
                <option value="string">Строка / Состояние (string)</option>
              </select>
            </div>
            <div className="field-row">
              <label>Категория</label>
              <select
                value={varCategory}
                onChange={(e) =>
                  setVarCategory(e.target.value as VariableCategory)
                }
              >
                <option value="relationship">Отношения / Доверие</option>
                <option value="character_state">Состояние персонажа</option>
                <option value="event">Произошедшее событие</option>
                <option value="player_decision">Решение игрока</option>
              </select>
            </div>
            <div className="field-row">
              <label>Привязка к персонажу</label>
              <select
                value={varCharId}
                onChange={(e) => setVarCharId(e.target.value)}
              >
                <option value="">Глобальная переменная</option>
                {project.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              <Plus size={15} /> Создать переменную
            </button>
          </form>

          <div className="variable-cards-grid">
            {project.variables.map((v) => (
              <div key={v.id} className="card variable-card">
                <div className="variable-card-header">
                  <div>
                    <code>{v.id}</code>
                    <span className={`tag tag-${v.type}`}>{v.type}</span>
                    <span className="tag">{v.category}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => deleteVariable(v.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="field-grid-2">
                  <div className="field-row">
                    <label>Название</label>
                    <input
                      type="text"
                      value={v.title}
                      onChange={(e) =>
                        updateVariable(v.id, { title: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-row">
                    <label>Значение по умолчанию</label>
                    {v.type === 'boolean' ? (
                      <select
                        value={String(v.default_value)}
                        onChange={(e) =>
                          updateVariable(v.id, {
                            default_value: e.target.value === 'true',
                          })
                        }
                      >
                        <option value="false">false (Нет)</option>
                        <option value="true">true (Да)</option>
                      </select>
                    ) : v.type === 'number' ? (
                      <input
                        type="number"
                        value={Number(v.default_value)}
                        onChange={(e) =>
                          updateVariable(v.id, {
                            default_value: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(v.default_value)}
                        onChange={(e) =>
                          updateVariable(v.id, { default_value: e.target.value })
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="field-row">
                  <label>Описание</label>
                  <input
                    type="text"
                    value={v.description}
                    onChange={(e) =>
                      updateVariable(v.id, { description: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>
            <BookOpen size={20} /> Дневник: Термины и Группы выводов (JournalReasoning)
          </h2>
          <p className="muted-text">
            Синхронизируется с <code>content/glossary/narrative_terms.json</code>.
            Термины открываются эффектом <code>grant_term</code> в узлах диалога,
            а выводы проверяются через <code>required_conclusions</code>.
          </p>
        </div>
      </div>

      <div className="form-grid-2">
        {/* Terms Column */}
        <div className="card">
          <h3>Термины словаря ({project.terms.length})</h3>
          <form className="inline-add-box" onSubmit={handleAddTerm}>
            <div className="field-grid-2">
              <AutomaticId value={generateId('term', termTitle, project.terms.map((item) => item.id))} />
              <input
                type="text"
                placeholder="Заголовок (напр. Ключ от депо)"
                value={termTitle}
                onChange={(e) => setTermTitle(e.target.value)}
              />
            </div>
            <textarea
              rows={2}
              placeholder="Описание термина для страницы дневника..."
              value={termDesc}
              onChange={(e) => setTermDesc(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <Plus size={14} /> Добавить термин
            </button>
          </form>

          <div className="scrollable-list">
            {project.terms.map((term) => (
              <div key={term.id} className="glossary-item-card">
                <div className="glossary-item-top">
                  <div>
                    <code>{term.id}</code>
                    {term.is_system && (
                      <span className="tag" title="Системный термин для тестов Godot">
                        <Lock size={11} /> TEST
                      </span>
                    )}
                  </div>
                  {!term.is_system && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => deleteTerm(term.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={term.title}
                  onChange={(e) =>
                    updateTerm(term.id, { title: e.target.value })
                  }
                />
                <textarea
                  rows={2}
                  value={term.description}
                  onChange={(e) =>
                    updateTerm(term.id, { description: e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Reasoning Groups Column */}
        <div className="card">
          <h3>
            <GitBranch size={16} /> Группы мыслей и Выводы ({project.reasoning_groups.length})
          </h3>
          <form className="inline-add-box" onSubmit={handleAddGroup}>
            <div className="field-grid-2">
              <AutomaticId value={generateId('group', groupTitle, project.reasoning_groups.map((item) => item.id))} />
              <input
                type="text"
                placeholder="Название группы на развороте"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary">
              <Plus size={14} /> Создать группу выводов
            </button>
          </form>

          <div className="scrollable-list">
            {project.reasoning_groups.map((grp) => (
              <div key={grp.id} className="glossary-item-card">
                <div className="glossary-item-top">
                  <div>
                    <code>{grp.id}</code>
                    <span className="tag">Разворот #{grp.sheet}</span>
                    <span className="tag">Мин. слов: {grp.minimum_terms}</span>
                  </div>
                  {grp.id !== 'test_terms_connection' && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => deleteReasoningGroup(grp.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="field-row">
                  <label>Заголовок группы</label>
                  <input
                    type="text"
                    value={grp.title}
                    onChange={(e) =>
                      updateReasoningGroup(grp.id, { title: e.target.value })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>Связанные термины (минимум 2):</label>
                  <div className="chip-group">
                    {project.terms.map((t) => {
                      const active = grp.terms.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`chip ${active ? 'chip-active' : ''}`}
                          onClick={() => {
                            const nextTerms = active
                              ? grp.terms.filter((id) => id !== t.id)
                              : [...grp.terms, t.id];
                            if (nextTerms.length < 2) return;
                            updateReasoningGroup(grp.id, {
                              terms: nextTerms,
                              minimum_terms: Math.min(
                                grp.minimum_terms,
                                nextTerms.length
                              ),
                            });
                          }}
                        >
                          {t.title} ({t.id})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="field-row">
                  <label>Варианты выводов игрока (options):</label>
                  {grp.options.map((opt, idx) => (
                    <div key={opt.id} className="option-edit-row">
                      <AutomaticId value={opt.id} />
                      <label>Название вывода<input value={opt.title || ''} onChange={(e) => updateReasoningGroup(grp.id, { options: grp.options.map((o) => o.id === opt.id ? { ...o, title: e.target.value } : o) })} /></label>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const nextOpts = grp.options.map((o, i) =>
                            i === idx ? { ...o, text: e.target.value } : o
                          );
                          updateReasoningGroup(grp.id, { options: nextOpts });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
