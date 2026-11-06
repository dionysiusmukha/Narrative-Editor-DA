import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { NarrativeProject } from "../../types/narrative";
import type {
  JournalPage,
  JournalElement,
  JournalLayout,
  JournalPreviewState,
  Point,
} from "../../types/journal";
import {
  curvePath,
  conditionMet,
  elementVisible,
  elementText,
} from "../../utils/journal";
export function JournalCanvas({
  project,
  layout,
  page,
  selected,
  select,
  change,
  preview,
  state,
  zoom,
  add,
  onActivate,
}: {
  project: NarrativeProject;
  layout: JournalLayout;
  page: JournalPage;
  selected: string;
  select: (id: string) => void;
  change: (l: JournalLayout) => void;
  preview: boolean;
  state: JournalPreviewState;
  zoom: number;
  add: (type: JournalElement["type"], ref: string, point: Point) => void;
  onActivate: (e: JournalElement) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const point = (e: { clientX: number; clientY: number }): Point => {
    const b = svg.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    ];
  };
  const gesture = useRef<null | {
    kind: "move" | "size" | "line" | "contour";
    id: string;
    index: number;
    start: Point;
    original: JournalLayout;
  }>(null);
  function start(
    e: ReactPointerEvent,
    kind: "move" | "size" | "line" | "contour",
    id: string,
    index = 0,
  ) {
    if (preview) return;
    e.stopPropagation();
    e.preventDefault();
    select(id);
    gesture.current = {
      kind,
      id,
      index,
      start: point(e),
      original: structuredClone(layout),
    };
    svg.current!.setPointerCapture(e.pointerId);
  }
  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    const next = structuredClone(g.original);
    const elem = next.pages
      .flatMap((p) => p.elements)
      .find((x) => x.id === g.id);
    const snap = (v: number) => Math.round(v * 100) / 100;
    if (g.kind === "line")
      next.connections.find((x) => x.id === g.id)!.path_points[g.index] = p;
    if (elem) {
      if (g.kind === "move")
        elem.position = elem.position.map((v, i) =>
          Math.max(0, Math.min(1 - elem.size[i], snap(v + p[i] - g.start[i]))),
        ) as Point;
      if (g.kind === "size")
        elem.size = elem.size.map((v, i) =>
          Math.max(
            0.03,
            Math.min(1 - elem.position[i], snap(v + p[i] - g.start[i])),
          ),
        ) as Point;
      if (g.kind === "contour")
        elem.style.contour![g.index] = p.map((v, i) =>
          Math.max(0, Math.min(1, (v - elem.position[i]) / elem.size[i])),
        ) as Point;
    }
    change(next);
  };
  const visible = (e: JournalElement) =>
    !preview || elementVisible(e, project, state);
  const pageVisible = !preview || conditionMet(page.reveal_condition, state);
  const lines = layout.connections.filter(
    (c) =>
      page.elements.some((e) => e.id === c.source_id) &&
      (!preview ||
        (conditionMet(c.activation_condition, state) &&
          [c.source_id, c.target_id].every((id) => {
            const e = page.elements.find((x) => x.id === id);
            return e && visible(e);
          }))),
  );
  const layers = [
    ...lines.map((c) => ({ id: c.id, layer: c.style.layer ?? 0, line: c })),
    ...page.elements
      .filter(visible)
      .map((e) => ({ id: e.id, layer: e.style.layer ?? 10, element: e })),
  ].sort((a, b) => a.layer - b.layer);
  return (
    <div
      className="journal-paper"
      style={{ width: 600 * zoom, height: 850 * zoom }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (preview) return;
        try {
          const d = JSON.parse(e.dataTransfer.getData("application/journal"));
          add(d.type, d.ref, point(e));
        } catch {}
      }}
    >
      <svg
        ref={svg}
        viewBox="0 0 600 850"
        width="100%"
        height="100%"
        onPointerMove={move}
        onPointerUp={() => (gesture.current = null)}
        onPointerCancel={() => (gesture.current = null)}
        onClick={() => {
          if (!preview && !gesture.current) return;
        }}
      >
        <defs>
          <marker
            id="journal-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="none" stroke="#51412d" />
          </marker>
        </defs>
        {!preview && (
          <g opacity=".12" stroke="#806d52">
            {Array.from({ length: 19 }, (_, i) => (
              <line
                key={i}
                x1={(i + 1) * 30}
                x2={(i + 1) * 30}
                y1="0"
                y2="850"
              />
            ))}
            {Array.from({ length: 27 }, (_, i) => (
              <line
                key={i}
                y1={(i + 1) * 30}
                y2={(i + 1) * 30}
                x1="0"
                x2="600"
              />
            ))}
          </g>
        )}
        {pageVisible && (
          <>
            <text
              x="30"
              y="40"
              fontFamily="Georgia"
              fontSize="22"
              fill="#51412d"
            >
              {page.title}
            </text>
            {layers.map((item) => {
              if ("line" in item) {
                const c = item.line!;
                return (
                  <g
                    key={c.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!preview) select(c.id);
                    }}
                  >
                    <path
                      d={curvePath(
                        c.path_points.map(([x, y]) => [x * 600, y * 850]),
                        c.style.curve,
                      )}
                      fill="none"
                      stroke={
                        selected === c.id && !preview ? "#b75b27" : "#51412d"
                      }
                      strokeWidth="2"
                      markerEnd={
                        c.style.arrow === false
                          ? undefined
                          : "url(#journal-arrow)"
                      }
                      style={{ cursor: preview ? "default" : "pointer" }}
                    />
                    {!preview &&
                      selected === c.id &&
                      c.path_points.map(([x, y], i) => (
                        <circle
                          key={i}
                          cx={x * 600}
                          cy={y * 850}
                          r="6"
                          fill="#b75b27"
                          onPointerDown={(e) => start(e, "line", c.id, i)}
                        />
                      ))}
                  </g>
                );
              }
              const el = ("element" in item ? item.element : undefined)!;
              const [x, y] = el.position.map((v, i) => v * (i ? 850 : 600));
              const [w, h] = el.size.map((v, i) => v * (i ? 850 : 600));
              const contour =
                el.style.contour ||
                Array.from({ length: 12 }, (_, i) => {
                  const a = (i * Math.PI) / 6;
                  return [
                    0.5 + 0.47 * Math.cos(a),
                    0.5 + 0.46 * Math.sin(a),
                  ] as Point;
                });
              const group = project.reasoning_groups.find(
                (g) => g.id === el.reference_id,
              );
              const showContour =
                el.type === "group" &&
                (!preview ||
                  !group ||
                  group.terms.filter((t) => state.terms.includes(t)).length >=
                    group.minimum_terms);
              return (
                <g
                  key={el.id}
                  onPointerDown={(e) => start(e, "move", el.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    preview ? onActivate(el) : select(el.id);
                  }}
                  style={{ cursor: preview ? "pointer" : "move" }}
                >
                  {showContour && (
                    <path
                      d={curvePath(
                        contour.map(([a, b]) => [x + a * w, y + b * h]),
                        true,
                        true,
                      )}
                      fill="none"
                      stroke="#51412d"
                      strokeWidth="1.7"
                    />
                  )}
                  <foreignObject
                    x={x + 8}
                    y={y + 8}
                    width={Math.max(1, w - 16)}
                    height={Math.max(1, h - 16)}
                  >
                    <div
                      style={{
                        color: "#453622",
                        fontFamily: "Georgia, serif",
                        fontSize: (el.style.font_size || 26) * 0.65,
                        lineHeight: 1.35,
                        overflowWrap: "anywhere",
                        height: "100%",
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      {elementText(el, project, preview ? state : undefined)}
                    </div>
                  </foreignObject>
                  {preview &&
                    layout.interactions.some(
                      (i) =>
                        i.type === "compare" &&
                        state.completed.includes(i.id) &&
                        i.source_ids.includes(el.id),
                    ) && (
                      <>
                        <line
                          x1={x + 8}
                          x2={x + w - 8}
                          y1={y + h - 8}
                          y2={y + h - 8}
                          stroke="#51412d"
                        />
                        <text
                          x={x + 8}
                          y={y + h + 14}
                          fill="#51412d"
                          fontSize="13"
                        >
                          Не сходится?
                        </text>
                      </>
                    )}
                  {preview &&
                    layout.interactions.some(
                      (i) =>
                        state.completed.includes(i.id) &&
                        i.strike_ids.includes(el.id),
                    ) && (
                      <line
                        x1={x}
                        x2={x + w}
                        y1={y + h / 2}
                        y2={y + h / 2}
                        stroke="#51412d"
                      />
                    )}
                  {!preview && selected === el.id && (
                    <>
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill="none"
                        stroke="#b75b27"
                        strokeDasharray="5 3"
                      />
                      <rect
                        x={x + w - 8}
                        y={y + h - 8}
                        width="12"
                        height="12"
                        fill="#b75b27"
                        onPointerDown={(e) => start(e, "size", el.id)}
                      />
                      {el.style.contour?.map(([a, b], i) => (
                        <circle
                          key={i}
                          cx={x + a * w}
                          cy={y + b * h}
                          r="5"
                          fill="#b75b27"
                          onPointerDown={(e) => start(e, "contour", el.id, i)}
                        />
                      ))}
                    </>
                  )}
                </g>
              );
            })}
            <text x="560" y="825" fill="#74634c" fontSize="14">
              {page.order + 1}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
