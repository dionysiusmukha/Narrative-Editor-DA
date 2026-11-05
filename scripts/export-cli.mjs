import fs from 'node:fs';
import path from 'node:path';

/**
 * CLI-скрипт экспорта project.narrative.json в папку Godot проекта (c:\Dev\Dark-Alone\content).
 */
const projectFile = path.resolve(process.cwd(), 'project.narrative.json');
if (!fs.existsSync(projectFile)) {
  console.error('Файл project.narrative.json не найден.');
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
const godotDir = process.argv[2] || project.godot_project_path || 'c:\\Dev\\Dark-Alone';

// 1. Glossary
const glossaryJson = {
  schema_version: 1,
  test_content: false,
  terms: project.terms.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
  })),
  reasoning_groups: project.reasoning_groups.map((g) => ({
    id: g.id,
    title: g.title,
    terms: g.terms,
    minimum_terms: g.minimum_terms,
    sheet: g.sheet,
    position: g.position,
    options: g.options.map((o) => {
      const opt = { id: o.id, text: o.text };
      if (o.required_conclusions && o.required_conclusions.length > 0) {
        opt.required_conclusions = o.required_conclusions;
      }
      return opt;
    }),
  })),
  ...(project.reasoning_links && project.reasoning_links.length > 0
    ? { reasoning_links: project.reasoning_links }
    : {}),
  journal_recipes: project.journal_recipes.map((r) => ({
    id: r.id,
    title: r.title,
    text: r.text,
    required_terms: r.required_terms,
  })),
};

// 2. Variables
const variablesJson = {
  schema_version: 1,
  test_content: false,
  variables: project.variables.map((v) => ({
    id: v.id,
    title: v.title,
    type: v.type,
    default_value: v.default_value,
    category: v.category,
    ...(v.character_id ? { character_id: v.character_id } : {}),
    ...(v.min !== undefined ? { min: v.min } : {}),
    ...(v.max !== undefined ? { max: v.max } : {}),
    ...(v.enum_values && v.enum_values.length > 0 ? { enum_values: v.enum_values } : {}),
    description: v.description,
  })),
};

const filesToWrite = [
  {
    relativePath: 'content/glossary/narrative_terms.json',
    content: JSON.stringify(glossaryJson, null, 2) + '\n',
  },
  {
    relativePath: 'content/variables/narrative_variables.json',
    content: JSON.stringify(variablesJson, null, 2) + '\n',
  },
];

// 3. Characters
for (const char of project.characters) {
  const reactions = {};
  for (const dlg of project.dialogues) {
    for (const node of dlg.nodes) {
      if ((node.character_id === char.id || dlg.character_id === char.id) && node.emotion) {
        reactions[`${dlg.id}:${node.id}`] = node.emotion;
      }
    }
  }
  const characterJson = {
    schema_version: 1,
    test_content: false,
    id: char.id,
    name: char.name,
    role: char.role,
    biography: char.biography,
    personality: char.personality,
    motivation: char.motivation,
    secrets: char.secrets,
    default_emotion: char.default_emotion,
    available_emotions: char.available_emotions,
    preferences: char.preferences,
    relationships: char.relationships,
    reactions,
  };
  filesToWrite.push({
    relativePath: `content/characters/${char.id}.json`,
    content: JSON.stringify(characterJson, null, 2) + '\n',
  });
}

// 4. Dialogues
const byChar = new Map();
for (const dlg of project.dialogues) {
  const key = dlg.character_id || 'general';
  if (!byChar.has(key)) byChar.set(key, []);
  byChar.get(key).push(dlg);
}

for (const [charId, dialogues] of byChar.entries()) {
  const bundle = {
    schema_version: 1,
    test_content: dialogues.every((d) => d.test_content),
    dialogues: dialogues.map((dlg) => {
      const dObj = {
        id: dlg.id,
        character_id: dlg.character_id,
        title: dlg.title,
        start_node: dlg.start_node,
        allow_cycles: dlg.allow_cycles,
      };
      if (dlg.allow_cycles && dlg.cycle_note) {
        dObj.cycle_note = dlg.cycle_note;
      }
      dObj.nodes = dlg.nodes.map((n) => ({
        id: n.id,
        speaker: n.speaker,
        ...(n.emotion ? { emotion: n.emotion } : {}),
        text: n.text,
        end: n.end,
        effects: (n.effects || []).map((ef) => {
          if (ef.type === 'grant_term') {
            return { effect_id: ef.effect_id, type: 'grant_term', term_id: ef.term_id || '' };
          }
          if (ef.type === 'set_variable' || ef.type === 'add_variable') {
            return {
              effect_id: ef.effect_id,
              type: ef.type,
              variable_id: ef.variable_id || '',
              value: ef.value ?? 0,
            };
          }
          return {
            effect_id: ef.effect_id,
            type: ef.type,
            event: ef.event || 'react',
            arg: ef.arg || 'neutral',
          };
        }),
        choices: (n.choices || []).map((ch) => {
          const chObj = {
            id: ch.id,
            text: ch.text,
            target: ch.target,
            required_terms: ch.required_terms || [],
          };
          if (ch.required_conclusions && ch.required_conclusions.length > 0) {
            chObj.required_conclusions = ch.required_conclusions;
          }
          if (ch.conditions && ch.conditions.length > 0) {
            chObj.conditions = ch.conditions;
          }
          return chObj;
        }),
      }));
      return dObj;
    }),
  };

  filesToWrite.push({
    relativePath: `content/dialogues/${charId}.json`,
    content: JSON.stringify(bundle, null, 2) + '\n',
  });
}

for (const f of filesToWrite) {
  const fullPath = path.resolve(godotDir, f.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, f.content, 'utf-8');
  console.log(`Exported: ${fullPath}`);
}
