import type { NarrativeProject, ValidationIssue } from "../types/narrative.ts";
import type {
  JournalCondition,
  JournalElement,
  JournalPreviewState,
  Point,
} from "../types/journal.ts";
import schema from "../data/journalLayoutSchema.json" with { type: "json" };

// Небольшой валидатор используемого подмножества официальной схемы, без новой зависимости.
export function journalShapeErrors(value: unknown): string[] {
  const errors: string[] = [];
  function check(v: any, s: any, path: string) {
    if (s.$ref)
      return check(v, (schema.$defs as any)[s.$ref.split("/").pop()], path);
    const fail = () => errors.push(`${path}: неверный формат`);
    if ("const" in s && v !== s.const) fail();
    if (s.enum && !s.enum.includes(v)) fail();
    if (s.type === "object") {
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        fail();
        return;
      }
      for (const k of s.required || [])
        if (!(k in v)) errors.push(`${path}.${k}: обязательное поле`);
      for (const k of Object.keys(v)) {
        if (s.properties?.[k]) check(v[k], s.properties[k], `${path}.${k}`);
        else if (s.additionalProperties === false)
          errors.push(`${path}.${k}: неизвестное поле`);
      }
    }
    if (
      s.type === "array" ||
      (Array.isArray(v) && ("minItems" in s || "maxItems" in s))
    ) {
      if (!Array.isArray(v)) {
        fail();
        return;
      }
      if (
        v.length < (s.minItems ?? 0) ||
        v.length > (s.maxItems ?? Infinity) ||
        (s.uniqueItems &&
          new Set(v.map((x) => JSON.stringify(x))).size !== v.length)
      )
        fail();
      if (s.items) v.forEach((x, i) => check(x, s.items, `${path}[${i}]`));
    }
    if (
      s.type === "string" &&
      (typeof v !== "string" ||
        v.length < (s.minLength ?? 0) ||
        v.length > (s.maxLength ?? Infinity) ||
        (s.pattern && !new RegExp(s.pattern).test(v)))
    )
      fail();
    if (
      (s.type === "number" || s.type === "integer") &&
      (typeof v !== "number" ||
        !Number.isFinite(v) ||
        (s.type === "integer" && !Number.isInteger(v)) ||
        v < (s.minimum ?? -Infinity) ||
        v > (s.maximum ?? Infinity))
    )
      fail();
    if (s.type === "boolean" && typeof v !== "boolean") fail();
    for (const rule of s.allOf || [])
      if (
        Object.entries(rule.if.properties).every(
          ([k, p]: any) => v?.[k] === p.const,
        )
      )
        check(v, rule.then, path);
      else check(v, rule.else, path);
    // then/else contain property constraints without their own type.
    if (!s.type && s.properties && v && typeof v === "object")
      for (const k of Object.keys(s.properties))
        if (k in v) check(v[k], s.properties[k], `${path}.${k}`);
  }
  check(value, schema, "journal_layout");
  return errors;
}
export function conditionMet(
  c: JournalCondition,
  s: JournalPreviewState,
): boolean {
  return (["terms", "conclusions", "completed"] as const).every((k) =>
    (c[k] || []).every((id) => s[k].includes(id)),
  );
}
export function elementVisible(
  e: JournalElement,
  p: NarrativeProject,
  s: JournalPreviewState,
): boolean {
  if (!conditionMet(e.reveal_condition, s)) return false;
  if (e.type === "term" || e.type === "quote")
    return s.terms.includes(e.reference_id);
  if (e.type === "conclusion") return s.conclusions.includes(e.reference_id);
  if (e.type === "group")
    return !!p.reasoning_groups
      .find((g) => g.id === e.reference_id)
      ?.terms.some((t) => s.terms.includes(t));
  const page = p.journal_layout?.pages.find((x) => x.id === e.reference_id);
  return !!page && conditionMet(page.reveal_condition, s);
}
export function elementText(
  e: JournalElement,
  p: NarrativeProject,
  state?: JournalPreviewState,
): string {
  if (e.type === "page_link")
    return (
      "→ " +
      (p.journal_layout?.pages.find((x) => x.id === e.reference_id)?.title ||
        e.reference_id)
    );
  if (e.type === "group") {
    const g = p.reasoning_groups.find((x) => x.id === e.reference_id);
    return g
      ? g.terms
          .filter((t) => !state || state.terms.includes(t))
          .map((t) => p.terms.find((x) => x.id === t)?.title || t)
          .join(" · ")
      : e.reference_id;
  }
  if (e.type === "conclusion")
    return (
      p.reasoning_groups
        .flatMap((g) => g.options)
        .find((o) => o.id === e.reference_id)?.text || e.reference_id
    );
  const t = p.terms.find((x) => x.id === e.reference_id);
  return (e.type === "quote" ? t?.description : t?.title) || e.reference_id;
}
export function curvePath(
  points: Point[],
  curve = false,
  closed = false,
): string {
  if (!points.length) return "";
  let d = `M ${points[0].join(" ")}`;
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i],
      b = points[(i + 1) % n],
      prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)],
      next = points[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    d += curve
      ? ` C ${a[0] + (b[0] - prev[0]) / 6} ${a[1] + (b[1] - prev[1]) / 6}, ${b[0] - (next[0] - a[0]) / 6} ${b[1] - (next[1] - a[1]) / 6}, ${b.join(" ")}`
      : ` L ${b.join(" ")}`;
  }
  return d + (closed ? " Z" : "");
}
export function validateJournal(p: NarrativeProject): ValidationIssue[] {
  if (!p.journal_layout) return [];
  const l = p.journal_layout;
  const out: ValidationIssue[] = [];
  const add = (
    id: string,
    message: string,
    level: "error" | "warning" = "error",
  ) => out.push({ level, path: `journal_layout.${id}`, message });
  const shape = journalShapeErrors(l);
  if (shape.length)
    return shape.map((message) => ({
      level: "error",
      path: "journal_layout",
      message,
    }));
  const seen = new Set<string>();
  const id = (s: string) => {
    if (seen.has(s)) add(s, "Повторный ID");
    seen.add(s);
  };
  id(l.id);
  const elements = l.pages.flatMap((x) => x.elements);
  const byId = new Map(elements.map((e) => [e.id, e]));
  const terms = new Set(p.terms.map((x) => x.id)),
    groups = new Set(p.reasoning_groups.map((x) => x.id)),
    conclusions = new Set(
      p.reasoning_groups.flatMap((g) => g.options.map((o) => o.id)),
    ),
    pages = new Set(l.pages.map((x) => x.id)),
    completed = new Set(
      l.interactions.filter((x) => x.type !== "revise").map((x) => x.id),
    );
  function condition(c: JournalCondition, owner: string) {
    for (const [key, values] of Object.entries(c))
      for (const ref of values)
        if (!({ terms, conclusions, completed } as any)[key].has(ref))
          add(owner, `Условие: отсутствует ${ref}`);
  }
  const pageFor = (eid: string) =>
    l.pages.find((x) => x.elements.some((e) => e.id === eid));
  for (const page of l.pages) {
    id(page.id);
    condition(page.reveal_condition, page.id);
    if (
      l.pages.some(
        (x) =>
          x !== page && x.section === page.section && x.order === page.order,
      )
    )
      add(page.id, "Повторный порядок страницы");
    for (const e of page.elements) {
      id(e.id);
      condition(e.reveal_condition, e.id);
      const refs =
        e.type === "group"
          ? groups
          : e.type === "conclusion"
            ? conclusions
            : e.type === "page_link"
              ? pages
              : terms;
      if (!refs.has(e.reference_id))
        add(e.id, "Отсутствует исходный объект " + e.reference_id);
      if (
        e.size.some((x) => x <= 0) ||
        e.position.some((v, i) => v + e.size[i] > 1.000001)
      )
        add(e.id, "Элемент выходит за границы страницы");
      if (e.size[0] < 0.08 || e.size[1] < 0.035)
        add(e.id, "Слишком маленькая область текста", "warning");
      for (const other of page.elements.slice(0, page.elements.indexOf(e)))
        if (
          e.position[0] < other.position[0] + other.size[0] &&
          other.position[0] < e.position[0] + e.size[0] &&
          e.position[1] < other.position[1] + other.size[1] &&
          other.position[1] < e.position[1] + e.size[1]
        )
          add(e.id, "Пересечение текстовых областей с " + other.id, "warning");
    }
  }
  for (const c of l.connections) {
    id(c.id);
    condition(c.activation_condition, c.id);
    if (
      !byId.has(c.source_id) ||
      !byId.has(c.target_id) ||
      pageFor(c.source_id) !== pageFor(c.target_id)
    )
      add(c.id, "Концы линии должны существовать на одной странице");
  }
  for (const i of l.interactions) {
    id(i.id);
    i.options.forEach((o) => id(o.id));
    condition(i.activation_condition, i.id);
    const expected =
      i.type === "compare" ? "quote" : i.type === "connect" ? "group" : "term";
    if (
      i.source_ids.length !== (i.type === "revise" ? 1 : 2) ||
      i.source_ids.some((x) => byId.get(x)?.type !== expected)
    )
      add(i.id, "Неверные источники взаимодействия");
    if (i.strike_ids.some((x) => !byId.has(x)))
      add(i.id, "Отсутствует зачёркиваемый элемент");
  }
  function visit(i: string, trail: string[]) {
    if (trail.includes(i)) {
      add(i, "Цикл условий взаимодействия");
      return;
    }
    const interaction = l.interactions.find((x) => x.id === i);
    const sources = (interaction?.source_ids || []).flatMap((x) => [
      ...(byId.get(x)?.reveal_condition.completed || []),
      ...(pageFor(x)?.reveal_condition.completed || []),
    ]);
    for (const dep of [
      ...(interaction?.activation_condition.completed || []),
      ...sources,
    ])
      visit(dep, [...trail, i]);
  }
  l.interactions.forEach((i) => visit(i.id, []));
  if (elements.length > 512) add(l.id, "Более 512 элементов");
  if (new TextEncoder().encode(JSON.stringify(l)).length > 1048576)
    add(l.id, "Layout превышает 1 МиБ");
  return out;
}
