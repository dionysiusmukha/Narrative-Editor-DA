import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { compileGodotFiles } from './src/utils/godotExporter';
import { assertProjectShape } from './src/utils/projectImport';
import { validateProject } from './src/utils/validator';

function godotSyncPlugin(): Plugin {
  return {
    name: 'godot-sync-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const sendJson = (status: number, data: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };

        const readBody = (): Promise<string> =>
          new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => resolve(body));
            req.on('error', reject);
          });

        try {
          const projectFile = path.resolve(process.cwd(), 'project.narrative.json');

          if (req.method === 'GET' && req.url === '/api/project') {
            if (fs.existsSync(projectFile)) {
              const raw = fs.readFileSync(projectFile, 'utf-8');
              return sendJson(200, { exists: true, project: JSON.parse(raw) });
            }
            return sendJson(200, { exists: false });
          }

          if (req.method === 'POST' && req.url === '/api/save-project') {
            const raw = await readBody();
            const parsed = JSON.parse(raw);
            assertProjectShape(parsed);
            fs.writeFileSync(projectFile, JSON.stringify(parsed, null, 2), 'utf-8');
            return sendJson(200, { ok: true, path: projectFile });
          }

          if (req.method === 'POST' && req.url === '/api/check-godot-export') {
            const raw = await readBody();
            const payload = JSON.parse(raw) as { godotPath: string; project: unknown };
            assertProjectShape(payload.project);
            const files = compileGodotFiles(payload.project);
            if (files.some((file) => !/^content\/[a-z]+\/[a-z][a-z0-9_]*\.json$/.test(file.relativePath))) {
              return sendJson(400, { matches: false, error: 'Некорректный ID в пути экспорта' });
            }
            const baseDir = payload.godotPath || 'c:\\Dev\\Dark-Alone';
            if (!fs.existsSync(baseDir)) return sendJson(200, { matches: false, paths: [] });
            const paths = files.map((file) => path.resolve(baseDir, file.relativePath));
            const matches = files.length > 0 && files.every(
              (file, index) => fs.existsSync(paths[index]) && fs.readFileSync(paths[index], 'utf-8') === file.content
            );
            return sendJson(200, { matches, paths: matches ? paths : [] });
          }

          if (req.method === 'POST' && req.url === '/api/sync-godot') {
            const raw = await readBody();
            const payload = JSON.parse(raw) as {
              godotPath: string;
              project: unknown;
            };
            assertProjectShape(payload.project);
            const issue = validateProject(payload.project).find((item) => item.level === 'error');
            if (issue) return sendJson(400, { ok: false, error: `${issue.path}: ${issue.message}` });
            const files = compileGodotFiles(payload.project);
            if (files.some((file) => !/^content\/[a-z]+\/[a-z][a-z0-9_]*\.json$/.test(file.relativePath))) {
              return sendJson(400, { ok: false, error: 'Некорректный ID в пути экспорта' });
            }

            const baseDir = payload.godotPath || 'c:\\Dev\\Dark-Alone';
            if (!fs.existsSync(baseDir)) {
              return sendJson(400, {
                ok: false,
                error: `Папка проекта Godot не найдена: ${baseDir}`,
              });
            }

            const writtenFiles: string[] = [];
            for (const f of files) {
              const targetPath = path.resolve(baseDir, f.relativePath);
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(targetPath, f.content, 'utf-8');
              writtenFiles.push(targetPath);
            }
            fs.writeFileSync(projectFile, JSON.stringify(payload.project, null, 2), 'utf-8');

            return sendJson(200, {
              ok: true,
              writtenFiles,
            });
          }

          return sendJson(404, { ok: false, error: 'Unknown API endpoint' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return sendJson(500, { ok: false, error: message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), godotSyncPlugin()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
  },
});
