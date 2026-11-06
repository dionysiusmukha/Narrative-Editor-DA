import type { JournalCondition, JournalLayout } from "../../types/journal";
import type { NarrativeProject } from "../../types/narrative";
export function ConditionEditor({
  label,
  value,
  onChange,
  project,
  layout,
}: {
  label: string;
  value: JournalCondition;
  onChange: (v: JournalCondition) => void;
  project: NarrativeProject;
  layout: JournalLayout;
}) {
  const choices = {
    terms: project.terms.map((t) => ({ id: t.id, label: t.title })),
    conclusions: project.reasoning_groups.flatMap((g) =>
      g.options.map((o) => ({ id: o.id, label: o.text })),
    ),
    completed: layout.interactions
      .filter((i) => i.type !== "revise")
      .map((i) => ({ id: i.id, label: i.id })),
  };
  return (
    <details>
      <summary>
        {label} ({Object.values(value).flat().length})
      </summary>
      {(["terms", "conclusions", "completed"] as const).map((k) => (
        <fieldset key={k}>
          <legend>
            {
              {
                terms: "Получены записи",
                conclusions: "Выбраны гипотезы",
                completed: "Выполнены действия",
              }[k]
            }
          </legend>
          {choices[k].map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={value[k]?.includes(c.id) || false}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [k]: e.target.checked
                      ? [...(value[k] || []), c.id]
                      : (value[k] || []).filter((x) => x !== c.id),
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </fieldset>
      ))}
    </details>
  );
}
