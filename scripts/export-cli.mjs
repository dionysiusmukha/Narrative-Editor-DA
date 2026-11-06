import fs from 'node:fs';
import path from 'node:path';
import { compileGodotFiles } from '../src/utils/godotExporter.ts';
import { assertProjectShape } from '../src/utils/projectImport.ts';
import { validateProject } from '../src/utils/validator.ts';

/**
 * CLI-скрипт экспорта project.narrative.json в папку Godot проекта (c:\Dev\Dark-Alone\content).
 */
const projectFile = path.resolve(process.cwd(), process.argv[3] || 'project.narrative.json');
if (!fs.existsSync(projectFile)) {
  console.error('Файл project.narrative.json не найден.');
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
assertProjectShape(project);
const issues = validateProject(project).filter((issue) => issue.level === 'error');
if (issues.length) {
  for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);
  process.exit(1);
}
const godotDir = process.argv[2] || project.godot_project_path || 'c:\\Dev\\Dark-Alone';

const filesToWrite = compileGodotFiles(project);

if (filesToWrite.some((file) => !/^content\/[a-z]+\/[a-z][a-z0-9_]*\.json$/.test(file.relativePath))) {
  console.error('Некорректный ID в пути экспорта');
  process.exit(1);
}
for (const f of filesToWrite) {
  const fullPath = path.resolve(godotDir, f.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, f.content, 'utf-8');
  console.log(`Exported: ${fullPath}`);
}
