import { useState } from 'react';
import { useNarrativeStore } from '../store/useNarrativeStore';
import { RECORD_KINDS, type NarrativeEvent, type NarrativeRecord, type RecordKind, type TestimonyLink } from '../types/narrative';
import { KIND_LABELS, memoryReferences, recordKey } from '../utils/npcMemory';

const emptyRecord = (kind: RecordKind, character_id: string, event_id: string): NarrativeRecord => {
  const base = { id: '', character_id, text: '' };
  if (kind === 'memory') return { ...base, kind, interpretation: '', emotion: 'neutral', significance: 0.5, confidence: 0.5 };
  if (kind === 'testimony') return { ...base, kind, event_id, source: '', related: [] };
  return { ...base, kind };
};

interface Draft { eventId: string; original?: string; record: NarrativeRecord }

export function MemoryEditor({ characterId }: { characterId?: string }) {
  const { project, updateNarrative, setActiveTab, setSelectedCharacterId, setSelectedDialogueId } = useNarrativeStore();
  const events = project.narrative_events || [];
  const links = project.testimony_links || [];
  const [section, setSection] = useState<RecordKind | 'events'>(characterId ? 'memory' : 'events');
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [eventDraft, setEventDraft] = useState<NarrativeEvent>();
  const [draft, setDraft] = useState<Draft>();
  const [linkDraft, setLinkDraft] = useState<TestimonyLink>();
  const [message, setMessage] = useState('');
  const matches = (...values: string[]) => values.some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
  const records = events.flatMap((event) => event.records.map((record) => ({ event, record })));
  const testimonies = records.filter(({ record }) => record.kind === 'testimony');
  const validId = (id: string) => /^[a-z][a-z0-9_]*$/.test(id);
  const characterName = (id: string) => project.characters.find((character) => character.id === id)?.name || id;
  const openCharacter = (id: string) => { setSelectedCharacterId(id); setActiveTab('characters'); };
  const jumpToEvents = (id: string) => { if (characterId) setActiveTab('events'); else { setSection('events'); setQuery(id); } };
  const updateRecord = (record: NarrativeRecord) => { if (draft) setDraft({ ...draft, record }); };

  function saveEvent() {
    if (!eventDraft) return;
    if (!validId(eventDraft.id) || !eventDraft.fact.trim() || (eventDraft.service && !validId(eventDraft.service.drink_id))) {
      setMessage('Укажите ID в snake_case, факт и, для триггера подачи, корректный ID напитка.');
      return;
    }
    const exists = events.find((event) => event.id === eventDraft.id);
    if (exists && eventDraft.records !== exists.records) { setMessage('Событие с таким ID уже существует.'); return; }
    updateNarrative({ narrative_events: exists ? events.map((event) => event.id === eventDraft.id ? eventDraft : event) : [...events, eventDraft] });
    setEventDraft(undefined);
    setMessage('Событие сохранено.');
  }

  function saveRecord() {
    if (!draft) return;
    const { record, eventId, original } = draft;
    const key = recordKey(record);
    if (!validId(record.id) || !record.text.trim() || !project.characters.some((character) => character.id === record.character_id) || !events.some((event) => event.id === eventId) ||
        (!original && records.some((item) => recordKey(item.record) === key)) ||
        (record.kind === 'memory' && (!record.interpretation.trim() || !validId(record.emotion) || ![record.significance, record.confidence].every((value) => value >= 0 && value <= 1))) ||
        (record.kind === 'testimony' && (!record.source.trim() || !events.some((event) => event.id === record.event_id)))) {
      setMessage('Проверьте уникальный ID, обязательные поля и числовые оценки от 0 до 1.');
      return;
    }
    updateNarrative({ narrative_events: events.map((event) => {
      const remaining = event.records.filter((item) => recordKey(item) !== original);
      return { ...event, records: event.id === eventId ? [...remaining, record] : remaining };
    }) });
    setDraft(undefined);
    setMessage('Запись сохранена.');
  }

  function remove(event: NarrativeEvent, record?: NarrativeRecord) {
    const affected = record ? [record] : event.records;
    const refs = memoryReferences(project, event.id, affected.map(recordKey), !record);
    const linked = affected.some((item) => item.kind === 'testimony' && links.some((link) => link.from === item.id || link.to === item.id));
    if (refs.dialogues.length || refs.testimony.length || linked) {
      setMessage(`Сначала удалите ссылки. Диалоги: ${refs.dialogues.map((item) => item.id).join(', ') || '—'}. Свидетельства: ${refs.testimony.map((item) => item.id).join(', ') || '—'}.${linked ? ' Есть редакторские связи.' : ''}`);
      return;
    }
    if (!window.confirm(`Удалить ${record?.id || event.id}?`)) return;
    updateNarrative({ narrative_events: record ? events.map((item) => item.id === event.id ? { ...item, records: item.records.filter((item) => recordKey(item) !== recordKey(record)) } : item) : events.filter((item) => item.id !== event.id) });
    setMessage('Удалено.');
  }

  function saveLink() {
    if (!linkDraft || !linkDraft.to || linkDraft.from === linkDraft.to || links.some((link) => [link.from, link.to].includes(linkDraft.from) && [link.from, link.to].includes(linkDraft.to))) {
      setMessage('Выберите другое свидетельство без существующей связи.'); return;
    }
    updateNarrative({ testimony_links: [...links, linkDraft] });
    setLinkDraft(undefined);
    setMessage('Связь сохранена в проекте редактора.');
  }

  const eventOptions = events.map((event) => <option key={event.id} value={event.id}>{event.id} · {event.fact}</option>);
  const characterOptions = project.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>);
  const record = draft?.record;
  return <section className={`memory-editor ${characterId ? '' : 'page-container'}`}>
    <div className="card-header-inline"><h3>{characterId ? 'Состояние персонажа' : 'Сюжетные события и свидетельства'}</h3></div>
    <div className="inline-controls memory-tabs">
      {(['events', ...RECORD_KINDS] as const).filter((kind) => !characterId || kind !== 'events').map((kind) =>
        <button key={kind} type="button" className={`btn ${section === kind ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSection(kind); setQuery(''); setDraft(undefined); setEventDraft(undefined); setLinkDraft(undefined); setMessage(''); }}>{kind === 'events' ? 'События' : KIND_LABELS[kind]}</button>)}
    </div>
    <div className="inline-controls memory-tabs">
      <input aria-label="Поиск по ID или тексту" placeholder="Поиск по ID или тексту" value={query} onChange={(e) => setQuery(e.target.value)} />
      {section !== 'events' && <select aria-label="Фильтр по событию" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}><option value="">Все события</option>{eventOptions}</select>}
      <button type="button" className="btn btn-primary" disabled={section !== 'events' && !events.length} onClick={() => {
        setMessage('');
        if (section === 'events') setEventDraft({ id: '', fact: '', records: [] });
        else setDraft({ eventId: eventFilter || events[0].id, record: emptyRecord(section, characterId || project.characters[0]?.id || '', eventFilter || events[0].id) });
      }}>{section === 'events' ? '+ Событие' : '+ Запись'}</button>
      {characterId && !events.length && <button className="btn btn-secondary" onClick={() => setActiveTab('events')}>Сначала создайте событие</button>}
    </div>
    {message && <p role="status" className="memory-status">{message}</p>}

    {eventDraft && <form className="card memory-form" onSubmit={(e) => { e.preventDefault(); saveEvent(); }}>
      <h3>Сюжетное событие</h3>
      <label>ID<input required readOnly={events.some((event) => event.records === eventDraft.records)} value={eventDraft.id} onChange={(e) => setEventDraft({ ...eventDraft, id: e.target.value })} /></label>
      <label>Объективный факт<textarea required value={eventDraft.fact} onChange={(e) => setEventDraft({ ...eventDraft, fact: e.target.value })} /></label>
      <label><input type="checkbox" checked={!!eventDraft.service} onChange={(e) => setEventDraft({ ...eventDraft, service: e.target.checked ? { character_id: project.characters[0]?.id || '', drink_id: 'prepared_drink' } : undefined })} /> Записать при успешной подаче</label>
      {eventDraft.service && <div className="field-grid-2">
        <label>Гость<select value={eventDraft.service.character_id} onChange={(e) => setEventDraft({ ...eventDraft, service: { ...eventDraft.service!, character_id: e.target.value } })}>{characterOptions}</select></label>
        <label>ID напитка<input value={eventDraft.service.drink_id} onChange={(e) => setEventDraft({ ...eventDraft, service: { ...eventDraft.service!, drink_id: e.target.value } })} /></label>
      </div>}
      <div className="inline-controls"><button className="btn btn-primary">Сохранить событие</button><button type="button" className="btn btn-secondary" onClick={() => setEventDraft(undefined)}>Отмена</button></div>
    </form>}

    {record && draft && <form className="card memory-form" onSubmit={(e) => { e.preventDefault(); saveRecord(); }}>
      <h3>{KIND_LABELS[record.kind]}</h3>
      <div className="field-grid-2">
        <label>ID<input required readOnly={!!draft.original} value={record.id} onChange={(e) => updateRecord({ ...record, id: e.target.value })} /></label>
        <label>Персонаж<select disabled={!!characterId} value={record.character_id} onChange={(e) => updateRecord({ ...record, character_id: e.target.value })}>{characterOptions}</select></label>
      </div>
      <label>{record.kind === 'testimony' ? 'Событие получения' : 'Исходное событие'}<select value={draft.eventId} onChange={(e) => setDraft({ ...draft, eventId: e.target.value })}>{eventOptions}</select></label>
      <label>{record.kind === 'testimony' ? 'Утверждение' : 'Содержание'}<textarea aria-label={record.kind === 'testimony' ? 'Утверждение' : 'Содержание'} required value={record.text} onChange={(e) => updateRecord({ ...record, text: e.target.value })} /></label>
      {record.kind === 'memory' && <>
        <label>Интерпретация<textarea aria-label="Интерпретация" required value={record.interpretation} onChange={(e) => updateRecord({ ...record, interpretation: e.target.value })} /></label>
        <div className="field-grid-2">
          <label>ID эмоции<input required value={record.emotion} onChange={(e) => updateRecord({ ...record, emotion: e.target.value })} /></label>
          <label>Значимость<input type="number" min="0" max="1" step="any" required value={record.significance} onChange={(e) => updateRecord({ ...record, significance: Number(e.target.value) })} /></label>
          <label>Уверенность<input type="number" min="0" max="1" step="any" required value={record.confidence} onChange={(e) => updateRecord({ ...record, confidence: Number(e.target.value) })} /></label>
        </div>
      </>}
      {record.kind === 'testimony' && <>
        <label>Событие, о котором говорят<select value={record.event_id} onChange={(e) => updateRecord({ ...record, event_id: e.target.value })}>{eventOptions}</select></label>
        <label>Источник<input required value={record.source} onChange={(e) => updateRecord({ ...record, source: e.target.value })} /></label>
        <label>Связанные факты и убеждения<select multiple value={record.related} onChange={(e) => updateRecord({ ...record, related: Array.from(e.target.selectedOptions, (item) => item.value) })}>
          {events.map((event) => <option key={event.id} value={`fact_${event.id}`}>Факт · {event.id}</option>)}
          {records.filter(({ record }) => record.kind === 'belief').map(({ record }) => <option key={record.id} value={recordKey(record)}>Убеждение · {record.id}</option>)}
        </select></label>
      </>}
      <p className="muted-text">Смена определяется при срабатывании события. Условия задаются на ответе, ведущем к узлу с эффектом remember.</p>
      <div className="inline-controls"><button className="btn btn-primary">Сохранить запись</button><button type="button" className="btn btn-secondary" onClick={() => setDraft(undefined)}>Отмена</button></div>
    </form>}

    {linkDraft && <form className="card memory-form" onSubmit={(e) => { e.preventDefault(); saveLink(); }}>
      <h3>Связь для {linkDraft.from}</h3>
      <label>Свидетельство<select required value={linkDraft.to} onChange={(e) => setLinkDraft({ ...linkDraft, to: e.target.value })}>
        <option value="">Выберите запись</option>{testimonies.filter(({ record }) => record.id !== linkDraft.from).map(({ record }) => <option key={record.id} value={record.id}>{record.id} · {characterName(record.character_id)}</option>)}
      </select></label>
      <label>Тип<select value={linkDraft.kind} onChange={(e) => setLinkDraft({ ...linkDraft, kind: e.target.value === 'related' ? 'related' : 'contradiction' })}><option value="contradiction">Возможное противоречие</option><option value="related">Связанные показания</option></select></label>
      <div className="inline-controls"><button className="btn btn-primary">Сохранить связь</button><button type="button" className="btn btn-secondary" onClick={() => setLinkDraft(undefined)}>Отмена</button></div>
    </form>}

    {section === 'events' ? events.filter((event) => matches(event.id, event.fact)).map((event) => {
      const refs = memoryReferences(project, event.id, event.records.map(recordKey), true);
      return <article key={event.id} className="card memory-card">
        <div className="card-header-inline"><code>{event.id}</code><div className="inline-controls"><button className="btn btn-secondary btn-sm" onClick={() => setEventDraft({ ...event })}>Править</button><button className="btn btn-danger btn-sm" onClick={() => remove(event)}>Удалить</button></div></div>
        <p>{event.fact}</p>
        <div className="inline-controls">
          {RECORD_KINDS.map((kind) => <button key={kind} className="btn btn-secondary btn-xs" onClick={() => { setSection(kind); setEventFilter(event.id); setQuery(''); }}>{KIND_LABELS[kind]}</button>)}
          {refs.dialogues.map((dialogue) => <button key={dialogue.id} className="btn btn-secondary btn-xs" onClick={() => { setSelectedDialogueId(dialogue.id); setActiveTab('dialogues'); }}>{dialogue.id}</button>)}
        </div>
      </article>;
    }) : records.filter(({ event, record }) => record.kind === section && (!characterId || record.character_id === characterId) &&
      (!eventFilter || (record.kind === 'testimony' ? record.event_id === eventFilter : event.id === eventFilter)) && matches(record.id, record.text, event.id, characterName(record.character_id))).map(({ event, record }) => {
        const key = recordKey(record);
        const refs = memoryReferences(project, event.id, event.records.map(recordKey), true);
        return <article key={key} className="card memory-card">
          <div className="card-header-inline"><code>{key}</code><div className="inline-controls"><button className="btn btn-secondary btn-sm" onClick={() => setDraft({ eventId: event.id, original: key, record })}>Править</button><button className="btn btn-danger btn-sm" onClick={() => remove(event, record)}>Удалить</button></div></div>
          <p>{record.text}</p>
          {record.kind === 'memory' && <p className="muted-text">{record.interpretation} · {record.emotion} · значимость {record.significance} · уверенность {record.confidence}</p>}
          {record.kind === 'testimony' && <>
            <p className="muted-text">Источник — {record.source}. О событии {record.event_id}. {record.related.join(', ')}</p>
            <ul>{links.filter((link) => link.from === record.id || link.to === record.id).map((link) => <li key={`${link.from}:${link.to}`}>
              {link.kind === 'contradiction' ? 'Возможное противоречие' : 'Связь'} · {link.from === record.id ? link.to : link.from}{' '}
              <button className="btn btn-secondary btn-xs" onClick={() => updateNarrative({ testimony_links: links.filter((item) => item !== link) })}>Снять связь</button>
            </li>)}</ul>
            <button className="btn btn-secondary btn-xs" onClick={() => setLinkDraft({ from: record.id, to: '', kind: 'contradiction' })}>+ Связь свидетельств</button>
          </>}
          <div className="inline-controls">
            {!characterId && <button className="btn btn-secondary btn-xs" onClick={() => openCharacter(record.character_id)}>{characterName(record.character_id)}</button>}
            <button className="btn btn-secondary btn-xs" title={event.fact} onClick={() => jumpToEvents(event.id)}>{event.id}</button>
            {refs.dialogues.map((dialogue) => <button key={dialogue.id} className="btn btn-secondary btn-xs" onClick={() => { setSelectedDialogueId(dialogue.id); setActiveTab('dialogues'); }}>{dialogue.id}</button>)}
          </div>
        </article>;
      })}
  </section>;
}
