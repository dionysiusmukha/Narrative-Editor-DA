import React, { useState } from 'react';
import { useNarrativeStore } from '../store/useNarrativeStore';
import { AuthoredDrink, DRINK_INGREDIENTS } from '../types/narrative';
import { isValidSnakeCaseId } from '../utils/validator';

const vessels = DRINK_INGREDIENTS.filter((item) => item.id === 'test_shot' || item.id === 'test_glass');
const ingredients = DRINK_INGREDIENTS.filter((item) => !vessels.some((vessel) => vessel.id === item.id));

export const DrinksEditor: React.FC = () => {
  const { project, updateNarrative } = useNarrativeStore();
  const drinks = project.drinks || [];
  const [newId, setNewId] = useState('');
  const [error, setError] = useState('');

  const save = (next: AuthoredDrink[]) => updateNarrative({ drinks: next });
  const update = (id: string, patch: Partial<AuthoredDrink>) => save(drinks.map((drink) => drink.id === id ? { ...drink, ...patch } : drink));
  const add = () => {
    const id = newId.trim();
    if (!isValidSnakeCaseId(id) || drinks.some((drink) => drink.id === id)) {
      setError('Укажите новый уникальный ID в snake_case.');
      return;
    }
    save([...drinks, { id, title: 'Новый напиток', description: '', vessel_id: vessels[0]?.id || 'test_shot', components_ml: {}, tolerance_ml: 3 }]);
    setNewId(''); setError('');
  };
  const remove = (id: string) => {
    if (project.dialogues.some((dialogue) => dialogue.nodes.some((node) => node.drink_gate?.expected_drink_id === id || node.drink_gate?.on_other_drinks.some((outcome) => outcome.drink_id === id)))) {
      setError('Напиток используется в диалоге. Сначала измените ветку.');
      return;
    }
    save(drinks.filter((drink) => drink.id !== id));
    setError('');
  };
  return <div className="page-container">
    <div className="card"><h2>Напитки для сюжетных сцен</h2>
      <p>Задайте состав и посуду. Редактор сравнит рецепт с фактически приготовленным напитком; выбор момента и реплик задаётся в узле диалога.</p>
      <div className="field-grid-2"><input aria-label="ID нового напитка" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ID, например vera_stvor_shot" />
        <button className="btn btn-primary" onClick={add}>+ Создать напиток</button></div>
      {error && <p role="alert">{error}</p>}
    </div>
    {drinks.map((drink) => <div className="card" key={drink.id}>
      <div className="card-header-inline"><h3>{drink.title} <code>{drink.id}</code></h3><button className="btn btn-danger btn-sm" onClick={() => remove(drink.id)}>Удалить</button></div>
      <div className="field-grid-2"><label>Название<input value={drink.title} onChange={(e) => update(drink.id, { title: e.target.value })} /></label>
        <label>Посуда<select value={drink.vessel_id} onChange={(e) => update(drink.id, { vessel_id: e.target.value })}>{vessels.map((vessel) => <option key={vessel.id} value={vessel.id}>{vessel.label}</option>)}</select></label></div>
      <label>Описание<textarea value={drink.description} onChange={(e) => update(drink.id, { description: e.target.value })} /></label>
      <label>Допуск сравнения, мл<input type="number" min="0" max="20" step="0.5" value={drink.tolerance_ml} onChange={(e) => update(drink.id, { tolerance_ml: Number(e.target.value) })} /></label>
      <h4>Состав, мл</h4>
      <div className="field-grid-2">{ingredients.map((item) => <label key={item.id}>{item.label}<input type="number" min="0" step="0.5" value={drink.components_ml[item.id] || ''} onChange={(e) => { const components_ml = { ...drink.components_ml }; const amount = Number(e.target.value); if (amount > 0) components_ml[item.id] = amount; else delete components_ml[item.id]; update(drink.id, { components_ml }); }} /></label>)}</div>
    </div>)}
  </div>;
};
