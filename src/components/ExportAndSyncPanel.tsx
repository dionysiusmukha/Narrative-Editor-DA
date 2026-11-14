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
    browserSave,
    projectSave,
    godotExport,
    setGodotProjectPath,
    syncWithGodot,
    saveProjectToServer,
    importProjectJson,
    resetToArkadiyDefault,
    setActiveTab,
    setSelectedDialogueId,
    setSelectedNodeId,
  } = useNarrativeStore();

  const compiledFiles = useMemo(() => compileGodotFiles(project), [project]);
  const issues = useMemo(() => validateProject(project), [project]);

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const exampleUrl = new URL('../../examples/arkadiy-memory.narrative.json', import.meta.url).href;

  const activeFile = compiledFiles[selectedFileIndex] || compiledFiles[0];


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
        importProjectJson(parsed);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Ошибка чтения JSON файла проекта');
      }
    };
    reader.onerror = () => alert('Не удалось прочитать файл проекта');
    reader.readAsText(file);
    e.target.value = '';
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
          <button type="button" className="btn btn-secondary" onClick={async () => {
            if (!confirm('Открыть пример памяти вместо текущего проекта? Сначала скачайте копию проекта, если нужно сохранить черновик.')) return;
            try {
              const response = await fetch(exampleUrl);
              if (!response.ok) throw new Error('Пример недоступен');
              importProjectJson(await response.json());
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Не удалось открыть пример');
            }
          }}>Пример памяти Аркадия</button>
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
            <label>Путь к проекту Dark Alone или папке для выгрузки</label>
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
            disabled={projectSave.state === 'saving'}
          >
            Сохранить проект редактора
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => syncWithGodot()}
            disabled={issues.length > 0 || godotExport.state === 'saving'}
          >
            <FolderSync size={16} /> Выгрузить в Dark Alone ({compiledFiles.length}{' '}
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
                    {iss.dialogueId && <button className="btn btn-secondary btn-xs" onClick={() => {
                      setSelectedDialogueId(iss.dialogueId!);
                      if (iss.nodeId) setSelectedNodeId(iss.nodeId);
                      setActiveTab('dialogues');
                    }}>Открыть диалог</button>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="alert-box alert-success">
            <CheckCircle2 size={16} />
            <span>
              Проверки редактора пройдены. {project.narrative_events?.length ? 'Укажите пакет событий в Main.narrative_events_path нужной сцены Godot.' : 'Графы, словарь и переменные готовы к экспорту.'}
            </span>
          </div>
        )}

        <div className="sync-status-line">
          <div>Черновик в браузере: <strong>{browserSave.state === 'saved' ? 'сохранён'
            : browserSave.state === 'error' ? 'ошибка сохранения' : 'не проверен'}</strong>
            {browserSave.message && <span> — {browserSave.message}</span>}
          </div>
          <div>Проект редактора: <strong>{projectSave.state === 'saved' ? 'текущая версия сохранена'
            : projectSave.state === 'saving' ? 'сохраняется…'
            : projectSave.state === 'outdated' ? 'есть несохранённые изменения'
            : projectSave.state === 'error' ? 'ошибка сохранения' : 'не проверен'}</strong>
            {projectSave.lastSavedAt && <span> ({projectSave.lastSavedAt})</span>}
            {projectSave.message && <span> — {projectSave.message}</span>}
          </div>
          <div>Файлы Godot: <strong>{godotExport.state === 'saved' ? 'текущая версия выгружена'
            : godotExport.state === 'saving' ? 'выгружается…'
            : godotExport.state === 'outdated' ? 'текущие изменения не выгружены'
            : godotExport.state === 'error' ? 'ошибка выгрузки' : 'не проверены'}</strong>
            {godotExport.lastSavedAt && <span> ({godotExport.lastSavedAt})</span>}
            {godotExport.message && <span> — {godotExport.message}</span>}
          </div>
          <small>Выгрузка подтверждает запись файлов, а не их загрузку запущенной игрой.</small>
        </div>

        {(godotExport.paths?.length || 0) > 0 && (
          <div className="written-files-box">
            <small>Последние подтверждённые файлы в папке Dark Alone:</small>
            <div className="chip-group">
              {godotExport.paths?.map((p) => (
                <code key={p} className="code-badge">{p}</code>
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
                  disabled={issues.length > 0}
                  onClick={() =>
                    navigator.clipboard.writeText(activeFile.content)
                  }
                >
                  <Copy size={13} /> Копировать JSON
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={issues.length > 0}
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
