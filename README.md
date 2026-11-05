# Dark Alone — Narrative Editor

Отдельное веб-приложение (`React + TypeScript + Vite + @xyflow/react + Zustand`) для создания персонажей, диалоговых графов, сюжетных переменных, связей дневника и прямой синхронизации с репозиторием игры **Dark Alone** (`c:\Dev\Dark-Alone`, ветка `narrative-editor`).

## Возможности 1-го этапа (MVP + Аркадий)

- **Редактор персонажей:** биография, характер, мотивация, секреты, доступные эмоции (`VisitorModel.react`: `neutral`, `interested`, `thoughtful`, `tense`, `disagree`), предпочтения напитков в баре (`VisitorProfile.preferences`), отношения с другими персонажами (доверие, конфликт, скрытые связи) и автоматическая таблица реакций `VisitorProfile.reactions`.
- **Графовый редактор диалогов (`@xyflow/react`):**
  - Визуальные узлы реплик с подсветкой `**терминов**` и кнопкой быстрого создания термина в словаре.
  - Варианты ответа (`choices`) с условиями по терминам (`required_terms`), выводам дневника (`required_conclusions`) и сюжетным переменным (`conditions`: `==`, `!=`, `>`, `>=`, `<`, `<=`).
  - Последствия входа (`effects`): `grant_term` (выдача термина в дневник), `add_variable` / `set_variable` (изменение доверия, флагов и состояний), `npc_event` (реакции и команды NPC), `service_event` (заказ напитка).
  - Живой валидатор графа, повторяющий правила `DialogueContentValidator` из Godot (`snake_case`, достижимость от `start_node`, наличие пути к `end: true`, контроль циклов `allow_cycles`).
- **Реестр сюжетных переменных и Дневника:** управление переменными (`content/variables/narrative_variables.json`), терминами и группами выводов (`content/glossary/narrative_terms.json`).
- **Интерактивный симулятор диалога:** проверка веток, блокировок выбора, накопления терминов, выводов дневника и изменения переменных без запуска игры.
- **Прямая синхронизация с Godot:** запись скомпилированных JSON-файлов напрямую в `c:\Dev\Dark-Alone\content\` одной кнопкой в интерфейсе или через CLI.

## Запуск

```powershell
npm install
npm run dev
```

Откройте `http://localhost:5173`.

## Экспорт из командной строки

```powershell
npm run export-godot
```
