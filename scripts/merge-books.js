// TintaJunta — fusión idempotente del catálogo de libros.
// El repo (data/books.json) es la fuente de los CLÁSICOS.
// El volumen persistente guarda además los libros que publican los creadores.
// Este script:
//   1. AGREGA los libros del repo que falten en el volumen (por id), y
//   2. ACTUALIZA los clásicos existentes con el contenido del repo (capítulos,
//      idioma), SIN TOCAR los campos de runtime (ventas, destacados, portada
//      subida, estado, etc.).
//   2b. ACTUALIZA también los libros demo marcados con repoManaged:true
//      (contenido semilla del repo que no es clásico). Los libros publicados
//      por creadores reales (sin la marca) no se tocan jamás.
// Los libros de creadores reales (sin classic ni repoManaged) no se tocan jamás.
// Se ejecuta en cada arranque desde railway-start.sh.
const fs = require('fs');
const path = require('path');

const repoFile = path.join(__dirname, '..', 'data', 'books.json');
const volFile = process.argv[2] || path.join('/data', 'data', 'books.json');

// Campos que solo vive el runtime y deben conservarse del volumen
const RUNTIME_FIELDS = ['sales', 'featured', 'featuredUntil', 'status', 'ageRating'];

function readArr(f) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

const repo = readArr(repoFile).filter(b => b && b.id && b.title);
const vol = readArr(volFile);
const repoById = new Map(repo.map(b => [b.id, b]));
const have = new Set(vol.map(b => b && b.id));

let added = 0;
let updated = 0;
const merged = vol.map(v => {
  const r = v && repoById.get(v.id);
  if (r && (r.classic || r.repoManaged)) {
    // Clásico o demo del repo: el repo manda en contenido; el volumen conserva su runtime.
    const nb = { ...r };
    for (const k of RUNTIME_FIELDS) {
      if (v[k] !== undefined) nb[k] = v[k];
    }
    if (v.coverUrl) nb.coverUrl = v.coverUrl; // portada subida en runtime manda
    updated++;
    return nb;
  }
  return v;
});
for (const b of repo) {
  if (!have.has(b.id)) { merged.push(b); added++; }
}

if (added || updated) {
  fs.mkdirSync(path.dirname(volFile), { recursive: true });
  fs.writeFileSync(volFile, JSON.stringify(merged));
  console.log(`[tintajunta] catálogo fusionado: +${added} nuevos, ~${updated} clásicos actualizados (${repo.length} en repo, ${vol.length} en volumen)`);
} else {
  console.log(`[tintajunta] catálogo al día: ${vol.length} libros en volumen, 0 cambios del repo`);
}
