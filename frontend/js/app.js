/* ══════════════════════════════════════════════
   METABUSCADOR SEMÁNTICO — UMSS Web Semántica
   app.js v2 — Backend RDFLib + SPARQLWrapper
   ══════════════════════════════════════════════ */

const API = 'http://localhost:5000';

// ══════════════════════════════════════════════
// TEMA CLARO / OSCURO
// ══════════════════════════════════════════════
function toggleTheme() {
  const html     = document.documentElement;
  const newTheme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  document.getElementById('themeToggle').textContent = newTheme === 'light' ? '🌙' : '🌞';
}
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ══════════════════════════════════════════════
// DATOS GLOBALES
// ══════════════════════════════════════════════
let currentFilter = '';
let currentQuery  = '';
let ontologiaCargada = false;

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('themeToggle').textContent = savedTheme === 'light' ? '🌙' : '🌞';
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
  document.getElementById('dbpSearchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doDbpSearch();
  });

  // Verifica si el backend ya cargó la ontología automáticamente
  await verificarBackend();
});

// ══════════════════════════════════════════════
// VERIFICAR BACKEND Y AUTO-CARGA
// ══════════════════════════════════════════════
async function verificarBackend() {
  try {
    const resp = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();

    if (data.ontologia_cargada) {
      // La ontología ya fue cargada automáticamente por el servidor
      ontologiaCargada = true;
      await cargarEstadisticas();
      renderApp();
    } else {
      // Muestra el cargador de archivo
      mostrarCargador();
    }
  } catch(e) {
    // Backend no está corriendo
    document.getElementById('loaderSection').innerHTML = `
      <div class="search-section" style="max-width:500px; margin:0 auto; text-align:center;">
        <span style="font-size:36px; display:block; margin-bottom:12px;">⚠️</span>
        <p style="color:var(--text); font-weight:700; margin-bottom:8px;">Backend no encontrado</p>
        <p style="color:var(--muted); font-size:12px; font-family:'Space Mono',monospace;">
          Ejecuta en tu terminal:<br><br>
          <code style="color:var(--accent3)">cd backend</code><br>
          <code style="color:var(--accent3)">python server.py</code>
        </p>
      </div>`;
  }
}

function mostrarCargador() {
  // El cargador ya está en el HTML, solo nos aseguramos que esté visible
  document.getElementById('loaderSection').style.display = 'block';
}

// ══════════════════════════════════════════════
// CARGA DE ARCHIVO OWL
// ══════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

async function handleFile(file) {
  if (!file) return;

  document.getElementById('loaderSection').innerHTML = `
    <div style="padding:60px 0; text-align:center;">
      <div class="spinner"></div>
      <p style="color:var(--muted); font-family:'Space Mono',monospace; font-size:12px;">
        Cargando ontología con RDFLib...
      </p>
    </div>`;

  // Envía el archivo al backend para que RDFLib lo procese
  const formData = new FormData();
  formData.append('owl_file', file);

  try {
    const resp = await fetch(`${API}/cargar_archivo`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
    const data = await resp.json();

    if (data.ok) {
      ontologiaCargada = true;
      await cargarEstadisticas();
      renderApp();
    } else {
      document.getElementById('loaderSection').innerHTML = `
        <div style="text-align:center; padding:40px;">
          <p style="color:#ff6b6b;">Error: ${escapeHtml(data.error)}</p>
        </div>`;
    }
  } catch(e) {
    document.getElementById('loaderSection').innerHTML = `
      <div style="text-align:center; padding:40px;">
        <p style="color:#ff6b6b;">No se pudo conectar al backend: ${escapeHtml(e.message)}</p>
      </div>`;
  }
}

// ══════════════════════════════════════════════
// CARGAR ESTADÍSTICAS DESDE BACKEND
// ══════════════════════════════════════════════
async function cargarEstadisticas() {
  try {
    const [statsResp, clasesResp] = await Promise.all([
      fetch(`${API}/stats`),
      fetch(`${API}/clases`)
    ]);
    const stats  = await statsResp.json();
    const clases = await clasesResp.json();

    if (stats.ok) {
      // Cuenta individuos reales
      const buscarResp = await fetch(`${API}/buscar?term=`);
      const buscarData = await buscarResp.json();
      const nInd = buscarData.ok ? buscarData.total : '—';

      document.getElementById('statIndividuals').textContent = nInd;
      document.getElementById('statClasses').textContent     = stats.clases || '—';
      document.getElementById('statProps').textContent       = stats.propiedades || '—';
      document.getElementById('statTriples').textContent     = (stats.triples || 0).toLocaleString();
    }

    if (clases.ok) {
      // Filtra clases relevantes (con individuos)
      const clasesConIndividuos = clases.clases
        .filter(c => c.total > 0 && !['Thing','NamedIndividual'].includes(c.clase))
        .slice(0, 20);

      // Botones de filtro
      document.getElementById('filterBtns').innerHTML = clasesConIndividuos.map(c =>
        `<button class="filter-btn" onclick="setFilter('${escapeAttr(c.clase)}', this)">
           ${escapeHtml(c.clase)} <span style="opacity:0.5">(${c.total})</span>
         </button>`
      ).join('');

      // Explorador de ontología
      document.getElementById('classGrid').innerHTML = clasesConIndividuos.map(c =>
        `<div class="class-chip" onclick="searchByClass('${escapeAttr(c.clase)}')">
           ${escapeHtml(c.clase)}<span class="count">${c.total}</span>
         </div>`
      ).join('');
    }
  } catch(e) {
    console.error('Error cargando estadísticas:', e);
  }
}

// ══════════════════════════════════════════════
// RENDER APP
// ══════════════════════════════════════════════
function renderApp() {
  document.getElementById('loaderSection').style.display = 'none';
  document.getElementById('appSection').style.display    = 'block';
  doSearch(); // muestra todos al inicio
}

// ══════════════════════════════════════════════
// SPARQL BUILDER (para mostrar en pantalla)
// ══════════════════════════════════════════════
function buildSPARQLQuery(term, claseFilter) {
  const base = 'http://www.umss.edu.bo/ontologias/electrodomesticos.owl#';
  let q = `<span class="comment"># MetaBuscador Semántico — RDFLib + SPARQL</span>\n`;
  q += `<span class="comment"># Ejecutado por: Python RDFLib en el backend</span>\n\n`;
  q += `<span class="kw">PREFIX</span> : &lt;${base}&gt;\n`;
  q += `<span class="kw">PREFIX</span> rdf:  &lt;http://www.w3.org/1999/02/22-rdf-syntax-ns#&gt;\n`;
  q += `<span class="kw">PREFIX</span> rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt;\n`;
  q += `<span class="kw">PREFIX</span> owl:  &lt;http://www.w3.org/2002/07/owl#&gt;\n\n`;
  q += `<span class="kw">SELECT DISTINCT</span> <span class="var">?individuo</span> <span class="var">?clase</span>\n`;
  q += `<span class="kw">WHERE</span> {\n`;
  q += `  <span class="var">?individuo</span> rdf:type <span class="var">?clase</span> .\n`;
  q += `  <span class="var">?clase</span> rdf:type owl:Class .\n`;
  if (claseFilter) {
    q += `  <span class="comment"># Filtro por clase seleccionada</span>\n`;
    q += `  <span class="kw">FILTER</span>(<span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?clase</span>)), <span class="str">"${escapeHtml(claseFilter.toLowerCase())}"</span>))\n`;
  }
  if (term) {
    q += `  <span class="comment"># Búsqueda semántica fuzzy</span>\n`;
    q += `  <span class="kw">FILTER</span>(<span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?individuo</span>)), <span class="str">"${escapeHtml(term.toLowerCase())}"</span>))\n`;
  }
  q += `}\n<span class="kw">ORDER BY</span> <span class="var">?clase</span> <span class="var">?individuo</span>\n<span class="kw">LIMIT</span> 200`;
  return q;
}

// ══════════════════════════════════════════════
// BÚSQUEDA LOCAL — llama al backend RDFLib
// ══════════════════════════════════════════════
async function doSearch() {
  const term = document.getElementById('searchInput').value.trim().toLowerCase();
  currentQuery = term;
  await runQuery(term, currentFilter);
}

function setFilter(cls, btn) {
  currentFilter = cls;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  runQuery(currentQuery, cls);
}

function searchByClass(cls) {
  currentFilter = cls;
  document.getElementById('searchInput').value = '';
  currentQuery = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  runQuery('', cls);
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

async function runQuery(term, claseFilter) {
  document.getElementById('sparqlDisplay').innerHTML = buildSPARQLQuery(term, claseFilter);

  const params = new URLSearchParams();
  if (term)        params.set('term', term);
  if (claseFilter) params.set('clase', claseFilter);

  try {
    const container = document.getElementById('results');
    
    // 1. Mostrar estado de carga unificado
    container.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <div class="spinner"></div>
        <p style="margin-top:15px; color:var(--accent);">Realizando búsqueda Híbrida (Local + DBpedia)...</p>
      </div>`;
    document.getElementById('resultsCount').innerHTML = 'Buscando...';

    // 2. Hacer las DOS peticiones AL MISMO TIEMPO (Promise.all)
    const fetchLocal = fetch(`${API}/buscar?${params}`, { signal: AbortSignal.timeout(15000) })
                        .then(r => r.json()).catch(e => ({ok: false, error: e.message}));

    let fetchDbpedia = Promise.resolve({ok: true, resultados: []});
    if (term) {
       // Solo buscamos en DBpedia si el usuario escribió una palabra en el buscador
       fetchDbpedia = fetch(`${API}/dbpedia?term=${encodeURIComponent(term)}`, { signal: AbortSignal.timeout(60000) })
                       .then(r => r.json()).catch(e => ({ok: false, error: e.message}));
    }

    const [dataLocal, dataDbpedia] = await Promise.all([fetchLocal, fetchDbpedia]);

    // 3. Renderizar primero las tarjetas locales
    if (dataLocal.ok) {
      renderResults(dataLocal.resultados, term); 
    } else {
      renderError(dataLocal.error);
    }

    // 4. Si DBpedia trajo resultados, los ADJUNTAMOS debajo de los locales
    if (term && dataDbpedia.ok && dataDbpedia.resultados && dataDbpedia.resultados.length > 0) {
       const dbpCardsHtml = generateDbpCardsHtml(dataDbpedia.resultados);
       
       // Agregamos un separador y las tarjetas de DBpedia al mismo contenedor
       container.innerHTML += `
         <div style="margin-top:40px; margin-bottom:20px; padding-bottom:10px; border-bottom:2px solid var(--accent3); display:flex; align-items:center; gap:10px;">
           <span style="font-size:24px;">🌐</span>
           <h3 style="color:var(--accent3); margin:0;">Resultados Externos (DBpedia)</h3>
         </div>
         ${dbpCardsHtml}
       `;

       // Sumamos ambos contadores en la interfaz
       const localTotal = dataLocal.resultados ? dataLocal.resultados.length : 0;
       const dbpTotal   = dataDbpedia.resultados.length;
       document.getElementById('resultsCount').innerHTML = `<span>${localTotal + dbpTotal}</span> resultados totales · <span style="color:var(--accent3)">Búsqueda Híbrida</span>`;
    }

  } catch(e) {
    renderError('Error general de conexión: ' + e.message);
  }
}

// ══════════════════════════════════════════════
// FUNCIÓN AUXILIAR (Pégala justo debajo de runQuery)
// ══════════════════════════════════════════════
function generateDbpCardsHtml(resultados) {
  function iconForName(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('refriger') || n.includes('fridge')) return '🧊';
    if (n.includes('wash') || n.includes('laundry'))    return '🫧';
    if (n.includes('television') || n.includes('tv'))   return '📺';
    if (n.includes('computer') || n.includes('laptop')) return '💻';
    if (n.includes('microwave') || n.includes('oven'))  return '📡';
    if (n.includes('vacuum'))  return '🌀';
    return '🔌';
  }

  return resultados.map(r => {
    const icon = iconForName(r.nombre);
    const desc = r.descripcion ? (r.descripcion.length > 280 ? r.descripcion.slice(0, 280) + '...' : r.descripcion) : '<em style="opacity:0.5">Sin descripción disponible.</em>';
    const imgHtml = r.imagen ? `<img class="dbp-img" src="${r.imagen}" alt="${escapeHtml(r.nombre)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
    const placeholderHtml = `<div class="dbp-img-placeholder" ${r.imagen ? 'style="display:none"' : ''}>${icon}</div>`;

    return `
      <div class="dbp-card" style="margin-bottom:15px; border-left: 4px solid var(--accent3);">
        <div class="dbp-card-top">
          ${imgHtml}${placeholderHtml}
          <div class="dbp-info">
            <div class="dbp-name">${escapeHtml(r.nombre)}</div>
            <span class="dbp-type">DBpedia · Recurso Externo</span>
            <p class="dbp-abstract">${desc}</p>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          ${r.wikiPage ? `<a class="dbp-link" href="${r.wikiPage}" target="_blank" rel="noopener">🌐 Ver en Wikipedia</a>` : ''}
          ${r.dbpediaLink ? `<a class="dbp-link" style="border-color:rgba(124,106,247,0.3);color:var(--accent)" href="${r.dbpediaLink}" target="_blank" rel="noopener">◈ Recurso DBpedia (RDF)</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// RENDER RESULTADOS OWL
// ══════════════════════════════════════════════
const KEY_PROPS = [
  'consumo_potencia','capacidad_litros','capacidad_lavado','capacidad_refrigeracion',
  'eficiencia_energetica','tamano_pantalla','voltaje_aparato','peso_aparato',
  'numero_hornillas','capacidad_tazas','capacidad_carga','rpm_centrifugado',
  'potencia_microondas','area_cobertura','numero_velocidades','memoria_ram',
  'almacenamiento_interno','capacidad_congelacion','vida_util_estimada',
  'tecnologia_inverter','tv_smart','portable','conectividad_red'
];

function renderResults(resultados, term) {
  const container = document.getElementById('results');
  const countEl   = document.getElementById('resultsCount');

  if (!resultados || resultados.length === 0) {
    countEl.innerHTML = '';
    container.innerHTML = `
      <div class="state-msg">
        <span class="icon">🔍</span>
        <h3>Sin resultados</h3>
        <p>No se encontraron coincidencias para "<strong>${escapeHtml(term)}</strong>"</p>
      </div>`;
    return;
  }

  countEl.innerHTML = `<span>${resultados.length}</span> resultado${resultados.length !== 1 ? 's' : ''} · <span style="color:var(--accent3)">RDFLib SPARQL local</span>`;

  const tokens = term ? term.split(/\s+/).filter(t => t.length >= 2) : [];

  container.innerHTML = resultados.slice(0, 60).map(ind => {
    const props = ind.propiedades || {};
    const shownProps = KEY_PROPS.filter(p => props[p] !== undefined).slice(0, 4);

    const propsHtml = shownProps.map(p => {
      let val = props[p], valClass = '';
      if (val === 'true')  { val = '✓ Sí'; valClass = 'bool-true'; }
      if (val === 'false') { val = '✗ No'; valClass = 'bool-false'; }
      return `<div class="prop-item">
        <span class="prop-key">${p.replace(/_/g,' ')}</span>
        <span class="prop-val ${valClass}">${escapeHtml(String(val))}</span>
      </div>`;
    }).join('');

    const nombre = highlightTokens(escapeHtml(ind.nombre), tokens);

    return `
      <div class="result-card" onclick="showDetail(${JSON.stringify(ind)})">
        <div class="card-top">
          <div class="card-name">${nombre}</div>
          <div class="card-class">${escapeHtml(ind.clase)}</div>
        </div>
        ${propsHtml ? `<div class="card-props">${propsHtml}</div>`
          : '<p style="color:var(--muted);font-size:12px;font-family:Space Mono,monospace">Sin propiedades registradas</p>'}
      </div>`;
  }).join('');

  if (resultados.length > 60) {
    container.innerHTML += `
      <div class="state-msg" style="padding:20px">
        <p>Mostrando 60 de ${resultados.length} resultados. Refina tu búsqueda.</p>
      </div>`;
  }
}

function renderError(msg) {
  document.getElementById('results').innerHTML = `
    <div class="state-msg">
      <span class="icon">⚠️</span>
      <h3>Error</h3>
      <p>${escapeHtml(msg)}</p>
    </div>`;
}

// ══════════════════════════════════════════════
// MODAL DETALLE
// ══════════════════════════════════════════════
function showDetail(ind) {
  document.getElementById('modalName').textContent  = ind.nombre;
  document.getElementById('modalClass').innerHTML   = `<span class="card-class">${escapeHtml(ind.clase)}</span>`;
  const props = Object.entries(ind.propiedades || {});
  document.getElementById('modalProps').innerHTML   = props.length === 0
    ? '<p style="color:var(--muted);font-family:Space Mono,monospace;font-size:12px;">Sin propiedades registradas</p>'
    : props.map(([k, v]) => {
        let val = v, color = '';
        if (val === 'true')  { val = '✓ Sí'; color = 'color:var(--success)'; }
        if (val === 'false') { val = '✗ No'; color = 'color:#ff6b6b'; }
        return `<div class="modal-prop">
          <span class="modal-prop-key">${escapeHtml(k.replace(/_/g,' '))}</span>
          <span class="modal-prop-val" style="${color}">${escapeHtml(String(val))}</span>
        </div>`;
      }).join('');
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
}

// ══════════════════════════════════════════════
// SPARQL TOGGLE
// ══════════════════════════════════════════════
function toggleSparql() {
  const body   = document.getElementById('sparqlBody');
  const toggle = document.getElementById('sparqlToggle');
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▼ ocultar' : '▶ ver consulta';
}
function toggleDbpSparql() {
  const body   = document.getElementById('dbpSparqlBody');
  const toggle = document.getElementById('dbpSparqlToggle');
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▼ ocultar' : '▶ ver consulta';
}

// ══════════════════════════════════════════════
// PESTAÑAS
// ══════════════════════════════════════════════
function switchTab(tab) {
  document.getElementById('tabOwl').style.display     = tab === 'owl'     ? 'block' : 'none';
  document.getElementById('tabDbpedia').style.display = tab === 'dbpedia' ? 'block' : 'none';
  document.getElementById('tabOwlBtn').classList.toggle('active', tab === 'owl');
  document.getElementById('tabDbpBtn').classList.toggle('active', tab === 'dbpedia');
}

// ══════════════════════════════════════════════
// DBPEDIA — llama al backend SPARQLWrapper
// ══════════════════════════════════════════════
function dbpQuick(term) {
  document.getElementById('dbpSearchInput').value = term;
  doDbpSearch();
}

async function doDbpSearch() {
  const term = document.getElementById('dbpSearchInput').value.trim();
  if (!term) return;

  // Muestra la consulta SPARQL
  updateDbpSparqlPanel(term);
  showDbpLoading(term);

  try {
    const resp = await fetch(`${API}/dbpedia?term=${encodeURIComponent(term)}`, {
      signal: AbortSignal.timeout(50000)
    });
    const data = await resp.json();

    if (data.ok) {
      renderDbpResults(data.resultados, term);
    } else {
      showDbpError(term, data.error);
    }
  } catch(e) {
    showDbpError(term, e.message.includes('fetch')
      ? '⚠️ Backend no corriendo. Ejecuta: python server.py'
      : e.message);
  }
}

function updateDbpSparqlPanel(term) {
  const q = `<span class="comment"># BC Remota — DBpedia SPARQL</span>
<span class="comment"># Ejecutado por: Python SPARQLWrapper en el backend</span>
<span class="comment"># Endpoint: https://dbpedia.org/sparql</span>

<span class="kw">PREFIX</span> dbo:  &lt;http://dbpedia.org/ontology/&gt;
<span class="kw">PREFIX</span> rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt;
<span class="kw">PREFIX</span> foaf: &lt;http://xmlns.com/foaf/0.1/&gt;

<span class="kw">SELECT DISTINCT</span> <span class="var">?recurso</span> <span class="var">?nombre</span> <span class="var">?descripcion</span> <span class="var">?imagen</span> <span class="var">?wikiPage</span>
<span class="kw">WHERE</span> {
  <span class="var">?recurso</span> rdfs:label <span class="var">?nombre</span> .
  <span class="kw">FILTER</span>(LANG(<span class="var">?nombre</span>) = <span class="str">"en"</span>)
  <span class="kw">FILTER</span>(<span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?nombre</span>)), <span class="str">"${escapeHtml(term.toLowerCase())}"</span>))
  <span class="var">?recurso</span> dbo:abstract <span class="var">?descripcion</span> .
  <span class="kw">FILTER</span>(LANG(<span class="var">?descripcion</span>) = <span class="str">"en"</span>)
  <span class="kw">FILTER</span>(<span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?descripcion</span>)), <span class="str">"appliance"</span>) || ...)
  <span class="kw">OPTIONAL</span> { <span class="var">?recurso</span> dbo:thumbnail <span class="var">?imagen</span> . }
  <span class="kw">OPTIONAL</span> { <span class="var">?recurso</span> foaf:isPrimaryTopicOf <span class="var">?wikiPage</span> . }
}
<span class="kw">ORDER BY</span> <span class="var">?nombre</span>
<span class="kw">LIMIT</span> 10`;
  document.getElementById('dbpSparqlDisplay').innerHTML = q;
}

function showDbpLoading(term) {
  document.getElementById('dbpResults').innerHTML = `
    <div class="dbp-loading">
      <div class="spinner"></div>
      <p>Consultando DBpedia para "<strong>${escapeHtml(term)}</strong>"...</p>
      <p style="font-size:11px;margin-top:8px;opacity:0.6">
        Endpoint: dbpedia.org/sparql · SPARQLWrapper · puede tardar 10-30s
      </p>
    </div>`;
  document.getElementById('dbpResultsCount').innerHTML  = '';
  document.getElementById('dbpEndpointStatus').textContent = '';
}

function showDbpError(term, msg) {
  document.getElementById('dbpResults').innerHTML = `
    <div class="state-msg">
      <span class="icon">⚠️</span>
      <h3>Error al consultar DBpedia</h3>
      <p>${escapeHtml(msg)}</p>
    </div>`;
}

function renderDbpResults(resultados, term) {
  const container = document.getElementById('dbpResults');
  const countEl   = document.getElementById('dbpResultsCount');
  const statusEl  = document.getElementById('dbpEndpointStatus');

  statusEl.textContent = 'dbpedia.org/sparql · SPARQLWrapper · Python backend';

  if (!resultados || resultados.length === 0) {
    countEl.innerHTML = '';
    container.innerHTML = `
      <div class="state-msg">
        <span class="icon">🔍</span>
        <h3>Sin resultados en DBpedia</h3>
        <p>Intenta: "washing machine", "refrigerator", "microwave oven"</p>
      </div>`;
    return;
  }

  countEl.innerHTML = `<span>${resultados.length}</span> resultado${resultados.length !== 1 ? 's' : ''} · <span style="color:var(--accent3)">DBpedia SPARQL remoto</span>`;

  function iconForName(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('refriger') || n.includes('fridge')) return '🧊';
    if (n.includes('wash') || n.includes('laundry'))    return '🫧';
    if (n.includes('television') || n.includes('tv'))   return '📺';
    if (n.includes('computer') || n.includes('laptop')) return '💻';
    if (n.includes('microwave') || n.includes('oven'))  return '📡';
    if (n.includes('vacuum'))  return '🌀';
    if (n.includes('air') || n.includes('condition'))   return '❄️';
    if (n.includes('coffee') || n.includes('cafe'))     return '☕';
    return '🔌';
  }

  container.innerHTML = resultados.map(r => {
    const icon = iconForName(r.nombre);
    const desc = r.descripcion
      ? (r.descripcion.length > 280 ? r.descripcion.slice(0, 280) + '...' : r.descripcion)
      : '<em style="opacity:0.5">Sin descripción disponible.</em>';

    const imgHtml = r.imagen
      ? `<img class="dbp-img" src="${r.imagen}" alt="${escapeHtml(r.nombre)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const placeholderHtml = `<div class="dbp-img-placeholder" ${r.imagen ? 'style="display:none"' : ''}>${icon}</div>`;

    return `
      <div class="dbp-card">
        <div class="dbp-card-top">
          ${imgHtml}${placeholderHtml}
          <div class="dbp-info">
            <div class="dbp-name">${escapeHtml(r.nombre)}</div>
            <span class="dbp-type">DBpedia · Electrodoméstico</span>
            <p class="dbp-abstract">${desc}</p>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          ${r.wikiPage    ? `<a class="dbp-link" href="${r.wikiPage}" target="_blank" rel="noopener">🌐 Ver en Wikipedia</a>` : ''}
          ${r.dbpediaLink ? `<a class="dbp-link" style="border-color:rgba(124,106,247,0.3);color:var(--accent)" href="${r.dbpediaLink}" target="_blank" rel="noopener">◈ Recurso DBpedia (RDF)</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function highlightTokens(text, tokens) {
  if (!tokens.length) return text;
  let result = text;
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    try {
      result = result.replace(new RegExp(`(${escapeReg(tok)})`, 'gi'),
        '<mark style="background:rgba(124,106,247,0.3);color:var(--accent);border-radius:3px;padding:0 2px">$1</mark>');
    } catch(e) {}
  }
  return result;
}

function escapeReg(s)  { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeAttr(s) { return String(s).replace(/'/g, "\\'"); }
function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}