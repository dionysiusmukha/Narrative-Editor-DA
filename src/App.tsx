import { JournalEditor } from './components/journal/JournalEditor';
import React, { useEffect } from 'react';
import { useNarrativeStore, EditorTab } from './store/useNarrativeStore';
import { CharacterEditor } from './components/CharacterEditor';
import { MemoryEditor } from './components/MemoryEditor';
import { DialogueGraphEditor } from './components/DialogueGraphEditor';
import { VariablesAndGlossaryEditor } from './components/VariablesAndGlossaryEditor';
import { DialogueSimulator } from './components/DialogueSimulator';
import { ExportAndSyncPanel } from './components/ExportAndSyncPanel';
import {
  Users,
  GitFork,
  Database,
  BookOpen,
  PlayCircle,
  FolderSync,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    project,
    activeTab,
    setActiveTab,
    browserSave,
    projectSave,
    godotExport,
    loadProjectFromServer,
    syncWithGodot,
  } = useNarrativeStore();

  useEffect(() => {
    loadProjectFromServer();
  }, [loadProjectFromServer]);

  const navItems: Array<{
    id: EditorTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'journal', label: 'Дневник → Компоновка страниц', icon: <BookOpen size={16} /> },
    { id: 'events', label: 'События', icon: <BookOpen size={16} />, badge: project.narrative_events?.length },
    {
      id: 'characters',
      label: 'Персонажи',
      icon: <Users size={16} />,
      badge: project.characters.length,
    },
    {
      id: 'dialogues',
      label: 'Граф диалогов',
      icon: <GitFork size={16} />,
      badge: project.dialogues.length,
    },
    {
      id: 'variables',
      label: 'Переменные',
      icon: <Database size={16} />,
      badge: project.variables.length,
    },
    {
      id: 'glossary',
      label: 'Дневник и Выводы',
      icon: <BookOpen size={16} />,
      badge: project.terms.length,
    },
    {
      id: 'simulator',
      label: 'Симулятор',
      icon: <PlayCircle size={16} />,
    },
    {
      id: 'export',
      label: 'Экспорт в Godot',
      icon: <FolderSync size={16} />,
    },
  ];

  return (
    <div className="app-shell">
      {/* Top Navigation Header */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo">DA</div>
          <div>
            <h1>Dark Alone — Narrative Editor</h1>
            <small>{project.project_name}</small>
          </div>
        </div>

        <nav className="app-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-tab ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {([
            ['Браузер', browserSave],
            ['Проект', projectSave],
            ['Godot', godotExport],
          ] as const).map(([label, status]) => (
            <span
              key={label}
              className={`sync-pill ${status.state === 'saved' ? 'synced' : status.state === 'error' ? 'error' : ''}`}
              title={status.message || (status.lastSavedAt ? `Последнее сохранение: ${status.lastSavedAt}` : '')}
            >
              {label}: {status.state === 'saved' ? 'сохранено'
                : status.state === 'saving' ? 'сохранение…'
                : status.state === 'outdated' ? 'есть изменения'
                : status.state === 'error' ? 'ошибка'
                : 'не проверено'}
            </span>
          ))}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => syncWithGodot()}
            disabled={godotExport.state === 'saving'}
            title="Записать JSON-файлы в выбранную папку Godot"
          >
            <FolderSync size={15} /> Выгрузить в Godot
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {activeTab === 'journal' && <JournalEditor />}
        {activeTab === 'characters' && <CharacterEditor />}
        {activeTab === 'events' && <MemoryEditor />}
        {activeTab === 'dialogues' && <DialogueGraphEditor />}
        {activeTab === 'variables' && (
          <VariablesAndGlossaryEditor mode="variables" />
        )}
        {activeTab === 'glossary' && (
          <VariablesAndGlossaryEditor mode="glossary" />
        )}
        {activeTab === 'simulator' && <DialogueSimulator />}
        {activeTab === 'export' && <ExportAndSyncPanel />}
      </main>
    </div>
  );
};
