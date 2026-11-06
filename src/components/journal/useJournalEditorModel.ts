import { useState } from "react";
import { useNarrativeStore } from "../../store/useNarrativeStore";
import type {
  JournalLayout,
  JournalElement,
  JournalPage,
  JournalPreviewState,
  Point,
} from "../../types/journal";
import {
  conditionMet,
  elementVisible,
  validateJournal,
} from "../../utils/journal";
export const uid = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
const blank = (): JournalLayout => ({
  schema_version: 1,
  id: uid("layout"),
  test_content: false,
  pages: [],
  connections: [],
  interactions: [],
});
export function useJournalEditorModel() {
  const { project, updateNarrative, saveProjectToServer, importProjectJson } =
    useNarrativeStore();
  const [initial] = useState(blank);
  const l = project.journal_layout || initial;
  const [pageId, setPageId] = useState("");
  const page =
    l.pages.find((p) => p.id === pageId) ||
    [...l.pages].sort((a, b) => a.order - b.order)[0];
  const [selected, select] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(0.8);
  const [preview, setPreview] = useState(false);
  const [state, setState] = useState<JournalPreviewState>({
    terms: [],
    conclusions: [],
    completed: [],
  });
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const change = (next: JournalLayout) =>
    updateNarrative({ journal_layout: next });
  const mutate = (fn: (next: JournalLayout) => void) => {
    const n = structuredClone(l);
    fn(n);
    change(n);
  };
  const element = page?.elements.find((e) => e.id === selected);
  const line = l.connections.find((c) => c.id === selected);
  const patchElement = (patch: Partial<JournalElement>) =>
    mutate((n) =>
      Object.assign(
        n.pages.flatMap((p) => p.elements).find((e) => e.id === selected)!,
        patch,
      ),
    );
  const patchPage = (patch: Partial<JournalPage>) =>
    mutate((n) =>
      Object.assign(
        n.pages.find((p) => p.id === page.id)!,
        patch,
      ),
    );
  const library = [
    ...project.terms.flatMap((t) => [
      { type: "term" as const, ref: t.id, text: t.title },
      { type: "quote" as const, ref: t.id, text: t.description },
    ]),
    ...project.reasoning_groups.map((g) => ({
      type: "group" as const,
      ref: g.id,
      text: g.title,
    })),
    ...project.reasoning_groups.flatMap((g) =>
      g.options.map((o) => ({
        type: "conclusion" as const,
        ref: o.id,
        text: o.text,
      })),
    ),
    ...l.pages
      .filter((p) => p.id !== page?.id)
      .map((p) => ({ type: "page_link" as const, ref: p.id, text: p.title })),
  ];
  function add(
    type: JournalElement["type"],
    ref: string,
    point: Point = [0.1, 0.15],
  ) {
    if (!page) return;
    const id = uid("entry");
    mutate((n) =>
      n.pages
        .find((p) => p.id === page.id)!
        .elements.push({
          id,
          type,
          reference_id: ref,
          position: [Math.min(0.65, point[0]), Math.min(0.78, point[1])],
          size: [0.3, 0.16],
          style: {},
          reveal_condition: {},
        }),
    );
    select(id);
  }
  function addPage() {
    const id = uid("page");
    mutate((n) =>
      n.pages.push({
        id,
        title: "Новая страница",
        section: "notes",
        order:
          Math.max(
            -1,
            ...n.pages.filter((p) => p.section === "notes").map((p) => p.order),
          ) + 1,
        elements: [],
        reveal_condition: {},
      }),
    );
    setPageId(id);
    select("");
  }
  function removeElement() {
    mutate((n) => {
      n.pages.forEach(
        (p) => (p.elements = p.elements.filter((e) => e.id !== selected)),
      );
      n.connections = n.connections.filter((c) => c.id !== selected);
    });
    select("");
  }
  function createLine(target: string) {
    if (!element || !target) return;
    const b = page.elements.find((e) => e.id === target)!;
    const id = uid("line");
    mutate((n) =>
      n.connections.push({
        id,
        source_id: element.id,
        target_id: b.id,
        path_points: [
          [
            element.position[0] + element.size[0] / 2,
            element.position[1] + element.size[1],
          ],
          [b.position[0] + b.size[0] / 2, b.position[1]],
        ],
        style: { arrow: true, curve: true },
        activation_condition: {},
      }),
    );
    select(id);
  }
  function activate(e: JournalElement) {
    if (e.type === "page_link") {
      setPageId(e.reference_id);
      return;
    }
    if (e.type === "group") {
      const g = project.reasoning_groups.find((g) => g.id === e.reference_id);
      if (
        !g ||
        g.terms.filter((t) => state.terms.includes(t)).length < g.minimum_terms
      )
        return;
      setNotice("Выберите гипотезу в панели предпросмотра.");
    }
    const i = l.interactions.find(
      (i) =>
        i.type !== "revise" &&
        i.source_ids.includes(e.id) &&
        i.source_ids.includes(pending) &&
        conditionMet(i.activation_condition, state) &&
        i.source_ids.every((id) => {
          const el = l.pages
            .flatMap((p) => p.elements)
            .find((e) => e.id === id);
          const pg = l.pages.find((p) => p.elements.some((e) => e.id === id));
          return (
            el &&
            pg &&
            conditionMet(pg.reveal_condition, state) &&
            elementVisible(el, project, state)
          );
        }),
    );
    if (i) {
      setState((s) => ({
        ...s,
        completed: [...new Set([...s.completed, i.id])],
      }));
      setNotice("Сопоставление отмечено: " + i.id);
      setPending("");
    } else setPending(e.id);
  }
  const issues = validateJournal(project);
  return {
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
  };
}
