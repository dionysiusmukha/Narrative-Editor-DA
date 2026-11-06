# Интеграция с Godot

Редактор сохраняет авторский проект v1 и продолжает экспортировать существующие пакеты. При непустом реестре он добавляет `content/narrative/narrative_events.json` с корнем `{ "schema_version": 1, "events": [...] }`. В таком проекте тестовые диалоги экспортируются отдельно в `content/narrative/<character_id>_test_dialogues.json`, чтобы метка `test_content` не смешивалась с основной. Реестр, имена путей и валидацию памяти используют браузер и CLI. Временное состояние симулятора и редакторские связи противоречий остаются вне игровых файлов.

```json
{
  "schema_version": 1,
  "events": [{
    "id": "player_rude_to_arkady",
    "fact": "Игрок перебил Аркадия.",
    "records": [{
      "id": "arkadiy_rude_reply",
      "kind": "memory",
      "character_id": "arkadiy",
      "text": "Бармен перебил меня.",
      "interpretation": "Он хотел, чтобы я ушёл.",
      "emotion": "tense",
      "significance": 0.8,
      "confidence": 0.65
    }]
  }]
}
```

Эффект входа в узел и условие ответа используют существующую схему диалога.

```json
{ "effect_id": "remember_rude_reply", "type": "npc_event", "event": "remember", "arg": "player_rude_to_arkady" }
```

```json
{ "variable_id": "memory_arkadiy_rude_reply", "op": "==", "value": true }
```

Доступны `fact_<event_id>`, `memory_<id>`, `knowledge_<id>`, `belief_<id>` и `testimony_<id>` с `==` или `!=` и логическим значением. Личные записи фильтруются по `dialogue.character_id`. `narrative_shift` сравнивается с положительным целым номером. Эти ID вычисляются движком и отсутствуют в реестре обычных переменных. Ограничение по смене задаётся на ответах. Контракт пока не определяет расписание NPC или условие для запуска диалога целиком.

Триггер `service: { "character_id": "arkadiy", "drink_id": "prepared_drink" }` срабатывает после подтверждённой подачи. `service_event: request_drink` остаётся сигналом существующего формата. Симулятор позволяет вручную подтвердить подачу для теста. Он не управляет барной механикой игры.

```powershell
npm run export-godot -- ./export.local ./examples/arkadiy-memory.narrative.json
```

Первый аргумент задаёт папку выгрузки, второй — файл проекта. Чтобы подключить выгрузку в Godot, настройте `Main.narrative_events_path` на пакет событий и добавьте нужные диалоговые пакеты в `Main.dialogue_paths`. Уберите предыдущий пакет, если он содержит те же ID диалогов. Словарь и переменные загружаются обычным способом. Синхронизация через интерфейс пишет в указанную папку с работающим Vite dev server. Для сравнения файлов перед заменой можно экспортировать в отдельную папку.

## Проверки и изменённые файлы

Проверки TypeScript и сборка Vite прошли. `npm test` запускает пять тестов, включая сохранение двух воспоминаний после извинения, изоляцию знаний, три свидетельства, ошибки импорта и совпадение выгрузок браузера и CLI. Отдельный тест фиксирует SHA256 шести файлов исходного проекта. Линтер в репозитории не настроен.

Автоматизированная проверка в Edge прошла создание, редактирование, поиск, удаление и восстановление локального черновика, фильтрацию событий для эффекта памяти, изменение значения условия в графе, обе ветки Аркадия, три смены и сбор свидетельств. Экспортированный пример загружен и исполнен в Godot 4.7.2 headless на отдельной копии `DialogueCatalog`, `DialogueRunner` и `NarrativeMemory`. Проверены перенос события во вторую смену, извинение и условие по трём полученным показаниям.

- `src/types/narrative.ts`, `src/utils/npcMemory.ts`, `src/utils/projectImport.ts`, `src/utils/validator.ts` — типы, валидация, вычисляемые условия и сериализация пакета.
- `src/App.tsx`, `src/styles.css`, `src/components/MemoryEditor.tsx`, `src/components/CharacterEditor.tsx`, `src/components/DialogueGraphEditor.tsx`, `src/components/DialogueSimulator.tsx` — интерфейс работы с памятью, диалогами и сменами.
- `src/components/ExportAndSyncPanel.tsx`, `src/store/useNarrativeStore.ts`, `src/utils/godotExporter.ts`, `vite.config.ts`, `scripts/export-cli.mjs` — импорт, сохранение, просмотр и экспорт.
- `examples/arkadiy-memory.narrative.json`, `tests/npc-memory.test.mjs`, `package.json` — пример и проверки.
- `README.md`, `docs/NPC_MEMORY.md`, `docs/TESTIMONY_SYSTEM.md`, `docs/GODOT_INTEGRATION.md`, `docs/NARRATIVE_EDITOR_GUIDE.md` — документация.
