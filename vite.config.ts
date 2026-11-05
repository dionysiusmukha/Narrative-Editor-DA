import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

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
            fs.writeFileSync(projectFile, JSON.stringify(parsed, null, 2), 'utf-8');
            return sendJson(200, { ok: true, path: projectFile });
          }

          if (req.method === 'POST' && req.url === '/api/sync-godot') {
            const raw = await readBody();
            const payload = JSON.parse(raw) as {
              godotPath: string;
              project: unknown;
              files: Array<{ relativePath: string; content: string }>;
            };

            // Also persist project.narrative.json in editor workspace
            if (payload.project) {
              fs.writeFileSync(projectFile, JSON.stringify(payload.project, null, 2), 'utf-8');
            }

            const baseDir = payload.godotPath || 'c:\\Dev\\Dark-Alone';
            if (!fs.existsSync(baseDir)) {
              return sendJson(400, {
                ok: false,
                error: `Папка проекта Godot не найдена: ${baseDir}`,
              });
            }

            const writtenFiles: string[] = [];
            for (const f of payload.files) {
              const targetPath = path.resolve(baseDir, f.relativePath);
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(targetPath, f.content, 'utf-8');
              writtenFiles.push(targetPath);
            }

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
