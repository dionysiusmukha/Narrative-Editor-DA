import { JournalCanvas } from "./JournalCanvas";
import { JournalInspector } from "./JournalInspector";
import { useJournalEditorModel } from "./useJournalEditorModel";
import "./journal.css";
export function JournalEditor() {
  const model = useJournalEditorModel();
  const {
    project,
    saveProjectToServer,
    importProjectJson,
    l,
    page,
    setPageId,
    selected,
    select,
    search,
    setSearch,
    filter,
    setFilter,
    zoom,
    setZoom,
    preview,
    setPreview,
    state,
    setState,
    pending,
    setPending,
    notice,
    setNotice,
    change,
    mutate,
    element,
    line,
    patchElement,
    patchPage,
    library,
    add,
    addPage,
    removeElement,
    createLine,
    activate,
    issues,
  } = model;
  return (
    <div className="journal-editor">
      <div className="journal-toolbar">
        <strong>Компоновка страниц</strong>
        <button onClick={addPage}>+ Страница</button>
        <button onClick={() => saveProjectToServer()}>Сохранить проект</button>
        <button
          onClick={async () => {
            try {
              const data = await fetch(
                new URL(
                  "../../../examples/north-journal.narrative.json",
                  import.meta.url,
                ).href,
              ).then((r) => r.json());
              if (
                confirm(
                  "Заменить открытый проект TEST-примером? Сначала сохраните текущий проект.",
                )
              ) {
                importProjectJson(data);
                setPageId("");
                select("");
              }
            } catch (e) {
              setNotice(String(e));
            }
          }}
        >
          TEST «Северный сектор»
        </button>
        <label>
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => {
              setPreview(e.target.checked);
              setPending("");
            }}
          />
          Предпросмотр игрока
        </label>
        <label>
          Масштаб{" "}
          <input
            aria-label="Масштаб"
            type="range"
            min=".4"
            max="1.5"
            step=".1"
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
        </label>
      </div>
      <aside className="journal-library">
        <h3>Страницы</h3>
        {[...l.pages]
          .sort((a, b) => a.order - b.order)
          .map((p) => (
            <button
              className={p.id === page?.id ? "chosen" : ""}
              key={p.id}
              onClick={() => {
                setPageId(p.id);
                select("");
              }}
            >
              {p.section === "words" ? "Словарь" : "Заметки"} · {p.order + 1} ·{" "}
              {p.title}
            </button>
          ))}
        <h3>Библиотека</h3>
        <input
          placeholder="Поиск по тексту или ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Все типы</option>
          {["term", "quote", "group", "conclusion", "page_link"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {library
          .filter(
            (x) =>
              (filter === "all" || x.type === filter) &&
              `${x.text} ${x.ref}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((x) => (
            <button
              key={x.type + x.ref}
              draggable={!preview}
              disabled={preview || !page}
              onDragStart={(e) =>
                e.dataTransfer.setData("application/journal", JSON.stringify(x))
              }
              onClick={() => add(x.type, x.ref)}
            >
              <small>
                {x.type} · {x.ref}
              </small>
              {x.text}
            </button>
          ))}
        <p>
          Перетащите запись на лист. Клик добавляет её в начало листа.
          Свидетельства версии 1 представлены цитатами получаемых терминов.
        </p>
      </aside>
      <main className="journal-workspace">
        {page ? (
          <JournalCanvas
            project={project}
            layout={l}
            page={page}
            selected={selected}
            select={select}
            change={change}
            preview={preview}
            state={state}
            zoom={zoom}
            add={add}
            onActivate={activate}
          />
        ) : (
          <p>Создайте первую страницу или откройте TEST-пример.</p>
        )}
      </main>
      <JournalInspector model={model} />
    </div>
  );
}
