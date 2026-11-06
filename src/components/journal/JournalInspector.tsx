import type { JournalElement, Point } from "../../types/journal";
import { ConditionEditor } from "./ConditionEditor";
import { uid, useJournalEditorModel } from "./useJournalEditorModel";
export function JournalInspector({
  model,
}: {
  model: ReturnType<typeof useJournalEditorModel>;
}) {
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
    <aside className="journal-properties">
      {notice && <p role="status">{notice}</p>}
      {preview ? (
        <>
          <h3>Состояние расследования</h3>
          <p>
            Скрытые записи отсутствуют. Позиции остаются фиксированными. Это
            приближённый макет, точное письмо проверяется в Godot.
          </p>
          <button
            onClick={() =>
              setState({ terms: [], conclusions: [], completed: [] })
            }
          >
            Пустая страница
          </button>
          <button
            onClick={() =>
              setState({
                terms: project.terms.map((t) => t.id),
                conclusions: [],
                completed: [],
              })
            }
          >
            Все сведения, без сопоставлений
          </button>
          {(["terms", "conclusions", "completed"] as const).map((k) => (
            <fieldset key={k}>
              <legend>
                {
                  {
                    terms: "Полученные записи",
                    conclusions: "Выбранные гипотезы",
                    completed: "Завершённые действия",
                  }[k]
                }
              </legend>
              {(k === "terms"
                ? project.terms.map((t) => ({ id: t.id, text: t.title }))
                : k === "conclusions"
                  ? project.reasoning_groups.flatMap((g) => g.options)
                  : l.interactions
                      .filter((i) => i.type !== "revise")
                      .map((i) => ({ id: i.id, text: i.id }))
              ).map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={state[k].includes(t.id)}
                    onChange={(e) =>
                      setState((s) => {
                        let values = s[k];
                        if (k === "conclusions" && e.target.checked) {
                          const g = project.reasoning_groups.find((g) =>
                            g.options.some((o) => o.id === t.id),
                          );
                          values = values.filter(
                            (id) => !g?.options.some((o) => o.id === id),
                          );
                        }
                        return {
                          ...s,
                          [k]: e.target.checked
                            ? [...values, t.id]
                            : values.filter((x) => x !== t.id),
                        };
                      })
                    }
                  />
                  {t.text}
                </label>
              ))}
            </fieldset>
          ))}
          <p>
            Для сравнения кликните две заранее связанные цитаты; можно перейти
            по ссылке на другой лист. {pending && `Выбрано: ${pending}`}
          </p>
        </>
      ) : (
        <>
          {page && (
            <>
              <h3>Страница</h3>
              <small>{page.id}</small>
              <input
                aria-label="Название страницы"
                value={page.title}
                maxLength={120}
                onChange={(e) => patchPage({ title: e.target.value })}
              />
              <select
                aria-label="Раздел"
                value={page.section}
                onChange={(e) =>
                  patchPage({
                    section: e.target.value as "notes" | "words",
                    order:
                      Math.max(
                        -1,
                        ...l.pages
                          .filter((p) => p.section === e.target.value)
                          .map((p) => p.order),
                      ) + 1,
                  })
                }
              >
                <option value="notes">Заметки</option>
                <option value="words">Словарь</option>
              </select>
              <div className="journal-buttons">
                {[-1, 1].map((delta) => (
                  <button
                    key={delta}
                    onClick={() =>
                      mutate((n) => {
                        const pages = n.pages
                          .filter((p) => p.section === page.section)
                          .sort((a, b) => a.order - b.order);
                        const at = pages.findIndex((p) => p.id === page.id),
                          other = pages[at + delta];
                        if (other)
                          [pages[at].order, other.order] = [
                            other.order,
                            pages[at].order,
                          ];
                      })
                    }
                  >
                    {delta < 0 ? "↑ Раньше" : "↓ Позже"}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const id = uid("page");
                    mutate((n) => {
                      const copy = structuredClone(page);
                      copy.id = id;
                      copy.title += " (копия)";
                      copy.order =
                        Math.max(
                          ...n.pages
                            .filter((p) => p.section === page.section)
                            .map((p) => p.order),
                        ) + 1;
                      const map = new Map(
                        copy.elements.map((e) => [e.id, uid("entry")]),
                      );
                      copy.elements.forEach((e) => (e.id = map.get(e.id)!));
                      n.pages.push(copy);
                      n.connections.push(
                        ...n.connections
                          .filter(
                            (c) => map.has(c.source_id) && map.has(c.target_id),
                          )
                          .map((c) => ({
                            ...structuredClone(c),
                            id: uid("line"),
                            source_id: map.get(c.source_id)!,
                            target_id: map.get(c.target_id)!,
                          })),
                      );
                    });
                    setPageId(id);
                  }}
                >
                  Дублировать страницу
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Удалить страницу? Ссылки на неё будут показаны как ошибки.",
                      )
                    ) {
                      mutate((n) => {
                        n.pages = n.pages.filter((p) => p.id !== page.id);
                        n.connections = n.connections.filter(
                          (c) =>
                            !page.elements.some(
                              (e) =>
                                e.id === c.source_id || e.id === c.target_id,
                            ),
                        );
                      });
                      select("");
                    }
                  }}
                >
                  Удалить страницу
                </button>
              </div>
              <ConditionEditor
                label="Видимость страницы"
                value={page.reveal_condition}
                onChange={(v) => patchPage({ reveal_condition: v })}
                project={project}
                layout={l}
              />
            </>
          )}
          {element && (
            <>
              <h3>Элемент</h3>
              <small>{element.id}</small>
              <label>
                Источник
                <input
                  value={element.reference_id}
                  onChange={(e) =>
                    patchElement({ reference_id: e.target.value })
                  }
                />
              </label>
              <label>
                Тип
                <select
                  value={element.type}
                  onChange={(e) =>
                    patchElement({
                      type: e.target.value as JournalElement["type"],
                    })
                  }
                >
                  {["term", "quote", "group", "conclusion", "page_link"].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </label>
              {(["position", "size"] as const).map((k) => (
                <label key={k}>
                  {k === "position" ? "Позиция" : "Размер"} (0–1)
                  <div className="journal-buttons">
                    {element[k].map((v, i) => (
                      <input
                        key={i}
                        aria-label={`${k} ${i}`}
                        type="number"
                        min="0"
                        max="1"
                        step=".01"
                        value={v}
                        onChange={(e) => {
                          const a = [...element[k]] as Point;
                          a[i] = +e.target.value;
                          patchElement({ [k]: a });
                        }}
                      />
                    ))}
                  </div>
                </label>
              ))}
              <label>
                Размер шрифта
                <input
                  type="number"
                  min="22"
                  max="48"
                  value={element.style.font_size || 26}
                  onChange={(e) =>
                    patchElement({
                      style: { ...element.style, font_size: +e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Слой
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={element.style.layer ?? 10}
                  onChange={(e) =>
                    patchElement({
                      style: { ...element.style, layer: +e.target.value },
                    })
                  }
                />
              </label>
              <button
                onClick={() =>
                  patchElement({
                    position: [0.5 - element.size[0] / 2, element.position[1]],
                  })
                }
              >
                По центру листа
              </button>
              <button
                onClick={() => {
                  const copy = structuredClone(element);
                  copy.id = uid("entry");
                  copy.position = [
                    Math.min(1 - copy.size[0], copy.position[0] + 0.03),
                    Math.min(1 - copy.size[1], copy.position[1] + 0.03),
                  ];
                  mutate((n) =>
                    n.pages.find((p) => p.id === page.id)!.elements.push(copy),
                  );
                  select(copy.id);
                }}
              >
                Дублировать представление
              </button>
              <button onClick={removeElement}>Удалить представление</button>
              {element.type === "group" && (
                <>
                  <h4>Авторский контур</h4>
                  <p>Точки контура перетаскиваются на листе.</p>
                  <button
                    onClick={() =>
                      patchElement({
                        style: {
                          ...element.style,
                          contour: Array.from({ length: 12 }, (_, i) => {
                            const a = (i * Math.PI) / 6;
                            return [
                              0.5 + (0.46 + (i % 2) * 0.02) * Math.cos(a),
                              0.5 + 0.46 * Math.sin(a),
                            ] as Point;
                          }),
                        },
                      })
                    }
                  >
                    Создать рукописный овал
                  </button>
                  <button onClick={() => patchElement({ size: [0.42, 0.14] })}>
                    Вытянутый овал
                  </button>
                  <button
                    onClick={() =>
                      patchElement({
                        size: [
                          0.4,
                          Math.min(
                            0.3,
                            0.08 +
                              (project.reasoning_groups.find(
                                (g) => g.id === element.reference_id,
                              )?.terms.length || 1) *
                                0.035,
                          ),
                        ],
                      })
                    }
                  >
                    Подогнать под слова
                  </button>
                  <p>
                    Слова, порог и гипотезы редактируются в «Дневник и Выводы».
                  </p>
                </>
              )}
              <ConditionEditor
                label="Видимость элемента"
                value={element.reveal_condition}
                onChange={(v) => patchElement({ reveal_condition: v })}
                project={project}
                layout={l}
              />
              <label>
                Нарисовать линию к
                <select value="" onChange={(e) => createLine(e.target.value)}>
                  <option value="">Выберите элемент листа</option>
                  {page.elements
                    .filter((e) => e.id !== element.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.reference_id}
                      </option>
                    ))}
                </select>
              </label>
              {(element.type === "quote" || element.type === "group") && (
                <label>
                  {element.type === "quote"
                    ? "Сопоставление цитат (включая другие страницы)"
                    : "Логическое соединение групп"}
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const id = uid(
                        element.type === "quote" ? "compare" : "connect",
                      );
                      mutate((n) =>
                        n.interactions.push({
                          id,
                          type:
                            element.type === "quote" ? "compare" : "connect",
                          source_ids: [element.id, e.target.value],
                          options: [],
                          strike_ids: [],
                          activation_condition: {},
                        }),
                      );
                      setNotice(
                        "Создано действие " +
                          id +
                          ". Для появления линии выберите его в её условии активации.",
                      );
                    }}
                  >
                    <option value="">Второй источник</option>
                    {l.pages.flatMap((p) =>
                      p.elements
                        .filter(
                          (e) => e.type === element.type && e.id !== element.id,
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {p.title} · {e.reference_id}
                          </option>
                        )),
                    )}
                  </select>
                </label>
              )}
            </>
          )}
          {line && (
            <>
              <h3>Визуальная связь</h3>
              <small>{line.id}</small>
              <p>
                Перетаскивайте узлы маршрута на бумаге. Маршрут не создаёт
                логического действия.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={line.style.arrow !== false}
                  onChange={(e) =>
                    mutate(
                      (n) =>
                        (n.connections.find(
                          (c) => c.id === line.id,
                        )!.style.arrow = e.target.checked),
                    )
                  }
                />
                Стрелка
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={line.style.curve || false}
                  onChange={(e) =>
                    mutate(
                      (n) =>
                        (n.connections.find(
                          (c) => c.id === line.id,
                        )!.style.curve = e.target.checked),
                    )
                  }
                />
                Плавная кривая
              </label>
              <button
                onClick={() =>
                  mutate((n) => {
                    const c = n.connections.find((c) => c.id === line.id)!;
                    const a = c.path_points[0],
                      b = c.path_points[1];
                    c.path_points.splice(1, 0, [
                      (a[0] + b[0]) / 2,
                      (a[1] + b[1]) / 2,
                    ]);
                  })
                }
              >
                Добавить контрольную точку
              </button>
              <button
                onClick={() =>
                  mutate((n) => {
                    const c = n.connections.find((c) => c.id === line.id)!;
                    if (c.path_points.length > 2) c.path_points.splice(1, 1);
                  })
                }
              >
                Убрать промежуточную точку
              </button>
              <ConditionEditor
                label="Активация линии"
                value={line.activation_condition}
                onChange={(v) =>
                  mutate(
                    (n) =>
                      (n.connections.find(
                        (c) => c.id === line.id,
                      )!.activation_condition = v),
                  )
                }
                project={project}
                layout={l}
              />
              <button onClick={removeElement}>Удалить линию</button>
            </>
          )}
          <h3>Логические действия</h3>
          {l.interactions.map((i) => (
            <details key={i.id}>
              <summary>
                {i.type} · {i.id}
              </summary>
              <p>{i.source_ids.join(" ↔ ")}</p>
              <ConditionEditor
                label="Доступность действия"
                value={i.activation_condition}
                onChange={(v) =>
                  mutate(
                    (n) =>
                      (n.interactions.find(
                        (x) => x.id === i.id,
                      )!.activation_condition = v),
                  )
                }
                project={project}
                layout={l}
              />
              <button
                onClick={() =>
                  mutate(
                    (n) =>
                      (n.interactions = n.interactions.filter(
                        (x) => x.id !== i.id,
                      )),
                  )
                }
              >
                Удалить действие
              </button>
            </details>
          ))}
        </>
      )}
      <h3>Проверка ({issues.length})</h3>
      {issues.map((i, k) => (
        <p key={k} className={i.level}>
          {i.level === "error" ? "Ошибка" : "Внимание"} · {i.path}: {i.message}
        </p>
      ))}
      <p>
        Контракт 1: заметки и словарь. Рецепты сохраняют прежний редактор.
        Условия переменных, произвольные эффекты и анимации требуют следующей
        версии игрового контракта.
      </p>
    </aside>
  );
}
