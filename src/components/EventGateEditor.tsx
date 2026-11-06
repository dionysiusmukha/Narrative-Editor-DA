import type { EventGate, NarrativeProject } from '../types/narrative';
export function EventGateEditor({ value, onChange, project }: { value: EventGate; onChange: (gate: EventGate) => void; project: NarrativeProject }) {
  const events = project.narrative_events || [];
  return <div className="event-gate-editor">
    <label>Начиная со смены<input type="number" min="1" step="1" value={value.min_shift} onChange={(e) => onChange({ ...value, min_shift: Number(e.target.value) })} /></label>
    <p className="muted-text">Все указанные условия должны выполняться. Пустые списки подходят для любой истории. При совпадении нескольких правил используется первое сверху.</p>
    {(['required_events', 'excluded_events'] as const).map((key) => <fieldset key={key}><legend>{key === 'required_events' ? 'События произошли' : 'События ещё не произошли'}</legend>
      {!events.length && <small>Сначала создайте сюжетные события.</small>}
      {events.map((event) => <label className="checkbox-inline" key={event.id}><input type="checkbox" checked={value[key].includes(event.id)} onChange={(e) => onChange({ ...value, [key]: e.target.checked ? [...value[key], event.id] : value[key].filter((id) => id !== event.id) })} />{event.title || event.id}</label>)}
    </fieldset>)}
  </div>;
}
