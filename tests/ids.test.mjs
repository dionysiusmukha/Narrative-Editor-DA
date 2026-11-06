import assert from 'node:assert/strict';
import test from 'node:test';
import { generateId } from '../src/utils/ids.ts';

test('Russian names, punctuation, digits and empty names produce valid prefixed IDs', () => {
  assert.equal(generateId('character', 'Аркадий'), 'character_arkadiy');
  assert.equal(generateId('term', 'Ключ от депо'), 'term_klyuch_ot_depo');
  assert.equal(generateId('event', 'Ёж, щука и подъезд!'), 'event_yozh_shchuka_i_podezd');
  assert.equal(generateId('term', 'term_key'), 'term_key');
  for (const title of ['', '!!!', '123', '中文', 'Очень длинное название '.repeat(20)]) {
    assert.match(generateId('memory', title), /^memory_[a-z0-9_]+$/);
  }
});

test('Repeated and transliteration-equivalent names cannot overwrite existing records', () => {
  const ids = ['term_klyuch', 'term_klyuch_2', 'term_klyuch_4'];
  assert.equal(generateId('term', 'Ключ', ids), 'term_klyuch_3');
  assert.equal(generateId('term', 'klyuch', ids), 'term_klyuch_3');
  assert.equal(generateId('term', 'Ключ', ids), generateId('term', 'Ключ', ids));
  assert.deepEqual(ids, ['term_klyuch', 'term_klyuch_2', 'term_klyuch_4']);
});
