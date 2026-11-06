/** Stable IDs are assigned once at creation; references never change on title edits. */
const letters: Record<string, string> = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
  х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
};
export function idSlug(title: string): string {
  return Array.from(title.toLowerCase(), (letter) => letters[letter] ?? letter).join('')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64).replace(/_+$/g, '');
}
export function generateId(prefix: string, title: string, existing: Iterable<string> = []): string {
  const key = idSlug(prefix) || 'item';
  const slug = idSlug(title) || 'novyy';
  const base = slug.startsWith(key + '_') ? slug : `${key}_${slug}`;
  const used = new Set(existing);
  let id = base;
  for (let suffix = 2; used.has(id); suffix++) id = `${base}_${suffix}`;
  return id;
}

export function characterId(prefix: string, name: string, title: string, existing: Iterable<string> = []): string {
  return generateId(prefix, `${name}_${title}`, existing);
}
