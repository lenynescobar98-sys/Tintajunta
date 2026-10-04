// TintaJunta — fusión idempotente del catálogo de libros.
// El repo (data/books.json) es la fuente de los clásicos de muestra.
// El volumen persistente guarda además los libros que publican los creadores.
// Este script AGREGA los libros del repo que falten en el volumen (por id)
// y NUNCA borra ni modifica los que ya existen (incluidos los publicados).
// Se ejecuta en cada arranque desde railway-start.sh.
const fs = require('fs');
const path = require('path');

const repoFile = path.join(__dirname, '..', 'data', 'books.json');
const volFile = process.argv[2] || path.join('/data', 'data', 'books.json');

function readArr(f) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

const repo = readArr(repoFile).filter(b => b && b.id && b.title);
const vol = readArr(volFile);
const have = new Set(vol.map(b => b && b.id));
const missing = repo.filter(b => !have.has(b.id));

if (missing.length) {
  fs.mkdirSync(path.dirname(volFile), { recursive: true });
  fs.writeFileSync(volFile, JSON.stringify([...vol, ...missing]));
  console.log(`[tintajunta] catálogo fusionado: +${missing.length} libros del repo (${repo.length} en repo, ${vol.length} en volumen)`);
} else {
  console.log(`[tintajunta] catálogo al día: ${vol.length} libros en volumen, 0 nuevos del repo`);
}
