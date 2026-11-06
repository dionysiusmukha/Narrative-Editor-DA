import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertProjectShape } from "../src/utils/projectImport.ts";
import { validateProject } from "../src/utils/validator.ts";
import { compileGodotFiles } from "../src/utils/godotExporter.ts";
import {
  conditionMet,
  elementVisible,
  journalShapeErrors,
} from "../src/utils/journal.ts";
const sample = JSON.parse(
  fs.readFileSync("examples/north-journal.narrative.json", "utf8"),
);
const legacy = JSON.parse(fs.readFileSync("project.narrative.json", "utf8"));
test("страницы: сериализация, восстановление и детерминированный экспорт без состояния редактора", () => {
  assertProjectShape(sample);
  assert.deepEqual(
    validateProject(sample).filter((i) => i.level === "error"),
    [],
  );
  const recovered = JSON.parse(JSON.stringify(sample));
  assertProjectShape(recovered);
  assert.deepEqual(recovered.journal_layout, sample.journal_layout);
  const files = compileGodotFiles(sample),
    second = compileGodotFiles(recovered);
  assert.deepEqual(files, second);
  const layout = JSON.parse(
    files.find((f) => f.relativePath === "content/journal/journal_layout.json")
      .content,
  );
  assert.deepEqual(layout, sample.journal_layout);
  assert.ok(
    layout.pages.flatMap((p) => p.elements).filter((e) => e.type === "group")
      .length >= 4,
  );
});
test("условия: сведения не завершают сравнение, скрытые записи не двигают композицию", () => {
  const i = sample.journal_layout.interactions.find(
    (i) => i.type === "compare",
  );
  const s = {
    terms: sample.terms.map((t) => t.id),
    conclusions: [],
    completed: [],
  };
  assert.equal(conditionMet({ completed: [i.id] }, s), false);
  assert.equal(
    conditionMet({ completed: [i.id] }, { ...s, completed: [i.id] }),
    true,
  );
  const e = sample.journal_layout.pages
    .flatMap((p) => p.elements)
    .find((e) => e.type === "quote");
  const position = [...e.position];
  assert.equal(
    elementVisible(e, sample, { terms: [], conclusions: [], completed: [] }),
    false,
  );
  assert.equal(elementVisible({ ...e, reveal_condition: {} }, sample, s), true);
  assert.deepEqual(e.position, position);
});
test("ссылки по ID переживают перестановку; ошибки ссылок, границ, условий и циклов блокируют пакет", () => {
  const p = structuredClone(sample);
  p.journal_layout.pages.reverse();
  p.journal_layout.pages.forEach((x, i) => (x.order = i));
  assert.deepEqual(
    validateProject(p).filter((i) => i.level === "error"),
    [],
  );
  const e = p.journal_layout.pages
    .flatMap((p) => p.elements)
    .find((e) => e.type === "page_link");
  e.reference_id = "missing_page";
  e.position = [0.99, 0.99];
  e.reveal_condition = { terms: ["missing_term"] };
  assert.ok(validateProject(p).filter((i) => i.level === "error").length >= 3);
  const i = p.journal_layout.interactions.find((i) => i.type !== "revise");
  i.activation_condition = { completed: [i.id] };
  assert.ok(validateProject(p).some((i) => i.message.includes("Цикл")));
});
test("импорт отклоняет повреждённую схему и неизвестные поля, старые проекты совместимы", () => {
  assertProjectShape(legacy);
  assert.equal(
    compileGodotFiles(legacy).some((f) =>
      f.relativePath.includes("journal_layout"),
    ),
    false,
  );
  assert.throws(() => assertProjectShape({ ...sample, journal_layout: {} }));
  const p = structuredClone(sample);
  p.journal_layout.camera = { x: 0 };
  assert.ok(journalShapeErrors(p.journal_layout).length);
  delete p.journal_layout.camera;
  const i = p.journal_layout.interactions.find((i) => i.type === "compare");
  i.options = [{ id: "invalid_option", text: "invalid" }];
  assert.ok(journalShapeErrors(p.journal_layout).length);
});
test("CLI и общий экспортёр сохраняют один и тот же пакет дневника", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "da-journal-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/export-cli.mjs",
        directory,
        "examples/north-journal.narrative.json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    for (const f of compileGodotFiles(sample))
      assert.equal(
        fs.readFileSync(path.join(directory, f.relativePath), "utf8"),
        f.content,
      );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
