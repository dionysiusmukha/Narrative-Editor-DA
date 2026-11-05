import React, { useMemo, useState } from 'react';
import { useNarrativeStore } from '../store/useNarrativeStore';
import { compileGodotFiles } from '../utils/godotExporter';
import { validateProject } from '../utils/validator';
import {
  FolderSync,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RotateCcw,
  Copy,
  Upload,
} from 'lucide-react';

export const ExportAndSyncPanel: React.FC = () => {
  const {
    project,
    syncStatus,
    setGodotProjectPath,
    syncWithGodot,
    saveProjectToServer,
    importProjectJson,
    resetToArkadiyDefault,
  } = useNarrativeStore();

  const compiledFiles = useMemo(() => compileGodotFiles(project), [project]);
  const issues = useMemo(() => validateProject(project), [project]);

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [lastSyncedPaths, setLastSyncedPaths] = useState<string[]>([]);

  const activeFile = compiledFiles[selectedFileIndex] || compiledFiles[0];

  const handleSync = async () => {
    const result = await syncWithGodot();
    if (result.ok && result.files) {
      setLastSyncedPaths(result.files);
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.characters && parsed.dialogues) {
          importProjectJson(parsed);
        }
      } catch {
        alert('Ошибка чтения JSON файла проекта');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>
            <FolderSync size={20} /> Экспорт JSON и Синхронизация с Godot (Dark Alone)
          </h2>
          <p className="muted-text">
            Компилирует данные персонажей, переменных, словаря и графов диалогов в
            игровой формат <code>schema_version: 1</code> и записывает напрямую в
            репозиторий игры.
          </p>
        </div>

        <div className="inline-controls">
          <label className="btn btn-secondary">
            <Upload size={14} /> Импорт проекта
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              handleDownloadFile(
                'project.narrative.json',
                JSON.stringify(project, null, 2)
              )
            }
          >
            <Download size={14} /> Скачать project.narrative.json
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (
                confirm(
                  'Сбросить проект к эталонному сценарию Аркадия?'
                )
              ) {
                resetToArkadiyDefault();
              }
            }}
          >
            <RotateCcw size={14} /> Эталон Аркадия
          </button>
        </div>
      </div>

      {/* Sync Controls Card */}
      <div className="card sync-banner-card">
        <div className="sync-row">
          <div className="field-row" style={{ flex: 1 }}>
            <label>Путь к локальному репозиторию Dark Alone (ветка narrative-editor)</label>
            <input
              type="text"
              value={project.godot_project_path}
              onChange={(e) => setGodotProjectPath(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={saveProjectToServer}
          >
            Сохранить проект редактора
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSync}
            disabled={issues.length > 0}
          >
            <FolderSync size={16} /> Синхронизировать с Dark Alone ({compiledFiles.length}{' '}
            файлов)
          </button>
        </div>

        {issues.length > 0 ? (
          <div className="alert-box alert-error">
            <AlertTriangle size={16} />
            <div>
              <strong>
                Обнаружено ошибок валидации ({issues.length}). Исправьте их перед
                экспортом в Godot:
              </strong>
              <ul>
                {issues.map((iss, idx) => (
                  <li key={idx}>
                    <code>{iss.path}</code>: {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="alert-box alert-success">
            <CheckCircle2 size={16} />
            <span>
              Все проверки <code>DialogueContentValidator</code> пройдены успешно!
              Графы диалогов, словарь и переменные готовы к загрузке в Godot.
            </span>
          </div>
        )}

        {syncStatus.message && (
          <div className="sync-status-line">
            Статус: <strong>{syncStatus.message}</strong>{' '}
            {syncStatus.lastSyncAt && <span>({syncStatus.lastSyncAt})</span>}
          </div>
        )}

        {lastSyncedPaths.length > 0 && (
          <div className="written-files-box">
            <small>Записанные файлы в репозиторий Dark Alone:</small>
            <div className="chip-group">
              {lastSyncedPaths.map((p) => (
                <code key={p} className="code-badge">
                  {p}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Compiled Files */}
      <div className="export-preview-layout">
        <div className="card export-file-list">
          <h3>Скомпилированные файлы Godot</h3>
          {compiledFiles.map((file, idx) => (
            <button
              key={file.relativePath}
              type="button"
              className={`list-item ${idx === selectedFileIndex ? 'active' : ''}`}
              onClick={() => setSelectedFileIndex(idx)}
            >
              <FileJson size={16} />
              <div className="list-item-text">
                <strong>{file.relativePath}</strong>
                <small>{file.description}</small>
              </div>
            </button>
          ))}
        </div>

        {activeFile && (
          <div className="card export-code-viewer">
            <div className="card-header-inline">
              <div>
                <h3>
                  <code>{activeFile.relativePath}</code>
                </h3>
                <small className="muted-text">{activeFile.description}</small>
              </div>
              <div className="inline-controls">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    navigator.clipboard.writeText(activeFile.content)
                  }
                >
                  <Copy size={13} /> Копировать JSON
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    handleDownloadFile(
                      activeFile.relativePath,
                      activeFile.content
                    )
                  }
                >
                  <Download size={13} /> Скачать файл
                </button>
              </div>
            </div>
            <pre className="json-pre">{activeFile.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
