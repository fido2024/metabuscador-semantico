/* ══════════════════════════════════════════════
   METABUSCADOR SEMÁNTICO — UMSS Web Semántica
   app.js
   ══════════════════════════════════════════════ */

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

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('themeToggle').textContent = savedTheme === 'light' ? '🌙' : '🌞';
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
  document.getElementById('dropzone').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
});

// ══════════════════════════════════════════════
// DATOS GLOBALES
// ══════════════════════════════════════════════
let ontologyData  = { individuals: [], classes: [], properties: [], tripleCount: 0 };
let currentFilter = '';
let currentQuery  = '';

// ══════════════════════════════════════════════
// CARGA DE ARCHIVO
// ══════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    showLoading();
    setTimeout(() => parseOWL(e.target.result), 100);
  };
  reader.readAsText(file);
}

function showLoading() {
  document.getElementById('loaderSection').innerHTML = `
    <div style="padding:60px 0; text-align:center;">
      <div class="spinner"></div>
      <p style="color:var(--muted); font-family:'Space Mono',monospace; font-size:12px;">
        Parseando ontología OWL...
      </p>
    </div>`;
}

// ══════════════════════════════════════════════
// PARSER OWL
// ══════════════════════════════════════════════
function parseOWL(xmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlText, 'application/xml');

  // Clases
  const classes = new Set();
  doc.querySelectorAll('Declaration > Class').forEach(el => {
    const iri  = el.getAttribute('IRI') || '';
    const name = iri.replace(/^#/, '').replace(/_/g, ' ');
    if (name && !name.includes('http')) classes.add(name);
  });

  // Propiedades de datos
  const propNames = [];
  doc.querySelectorAll('Declaration > DataProperty').forEach(el => {
    const iri  = el.getAttribute('IRI') || '';
    const name = iri.replace(/^#/, '');
    if (name) propNames.push(name);
  });

  // Individuos
  const individualMap = {};

  // ClassAssertion → individuo : clase
  doc.querySelectorAll('ClassAssertion').forEach(el => {
    const classEl = el.querySelector('Class');
    const indEl   = el.querySelector('NamedIndividual');
    if (!classEl || !indEl) return;
    const cls = (classEl.getAttribute('IRI') || '').replace(/^#/, '').replace(/_/g, ' ');
    const ind = (indEl.getAttribute('IRI')   || '').replace(/^#/, '');
    if (!ind || !cls) return;
    if (!individualMap[ind])
      individualMap[ind] = { id: ind, name: ind.replace(/_/g, ' '), class: cls, properties: {} };
    else
      individualMap[ind].class = cls;
  });

  // DataPropertyAssertion → individuo : propiedad = valor
  let tripleCount = 0;
  doc.querySelectorAll('DataPropertyAssertion').forEach(el => {
    const propEl = el.querySelector('DataProperty');
    const indEl  = el.querySelector('NamedIndividual');
    const litEl  = el.querySelector('Literal');
    if (!propEl || !indEl || !litEl) return;
    const prop = (propEl.getAttribute('IRI') || '').replace(/^#/, '');
    const ind  = (indEl.getAttribute('IRI')  || '').replace(/^#/, '');
    const val  = litEl.textContent.trim();
    if (!ind || !prop) return;
    if (!individualMap[ind])
      individualMap[ind] = { id: ind, name: ind.replace(/_/g, ' '), class: 'Electrodomestico', properties: {} };
    individualMap[ind].properties[prop] = val;
    tripleCount++;
  });

  // ObjectPropertyAssertion → individuo : relación → individuo2
  doc.querySelectorAll('ObjectPropertyAssertion').forEach(el => {
    const propEl = el.querySelector('ObjectProperty');
    const ind1El = el.querySelectorAll('NamedIndividual')[0];
    const ind2El = el.querySelectorAll('NamedIndividual')[1];
    if (!propEl || !ind1El || !ind2El) return;
    const prop = (propEl.getAttribute('IRI')  || '').replace(/^#/, '');
    const ind1 = (ind1El.getAttribute('IRI')  || '').replace(/^#/, '');
    const ind2 = (ind2El.getAttribute('IRI')  || '').replace(/^#/, '');
    if (!individualMap[ind1])
      individualMap[ind1] = { id: ind1, name: ind1.replace(/_/g, ' '), class: 'Electrodomestico', properties: {} };
    if (!individualMap[ind1].properties[prop])
      individualMap[ind1].properties[prop] = ind2.replace(/_/g, ' ');
    tripleCount++;
  });

  const individuals = Object.values(individualMap).filter(i => i.class);
  ontologyData = {
    individuals,
    classes:    [...classes],
    properties: propNames,
    tripleCount: tripleCount + individuals.length * 2
  };

  renderApp();
}

// ══════════════════════════════════════════════
// RENDER APP
// ══════════════════════════════════════════════
function renderApp() {
  document.getElementById('loaderSection').style.display = 'none';
  document.getElementById('appSection').style.display   = 'block';

  document.getElementById('statIndividuals').textContent = ontologyData.individuals.length;
  document.getElementById('statClasses').textContent     = ontologyData.classes.length;
  document.getElementById('statProps').textContent       = ontologyData.properties.length;
  document.getElementById('statTriples').textContent     = ontologyData.tripleCount.toLocaleString();

  const classCounts = {};
  ontologyData.individuals.forEach(i => {
    classCounts[i.class] = (classCounts[i.class] || 0) + 1;
  });
  const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

  // Botones de filtro
  document.getElementById('filterBtns').innerHTML = sortedClasses.map(([cls, count]) =>
    `<button class="filter-btn" onclick="setFilter('${cls}', this)">
       ${cls} <span style="opacity:0.5">(${count})</span>
     </button>`
  ).join('');

  // Explorador de clases
  document.getElementById('classGrid').innerHTML = sortedClasses.map(([cls, count]) =>
    `<div class="class-chip" onclick="searchByClass('${cls}')">
       ${cls}<span class="count">${count}</span>
     </div>`
  ).join('');

  doSearch();
}

// ══════════════════════════════════════════════
// SPARQL BUILDER
// ══════════════════════════════════════════════
function buildSPARQLQuery(term, classFilter) {
  const base = 'http://www.umss.edu.bo/ontologias/electrodomesticos.owl';
  let q = '';
  q += `<span class="comment"># MetaBuscador Semántico — Búsqueda Fuzzy + SPARQL</span>\n`;
  q += `<span class="comment"># Ontología: electrodomesticos.owl</span>\n\n`;
  q += `<span class="kw">PREFIX</span> : &lt;${base}#&gt;\n`;
  q += `<span class="kw">PREFIX</span> rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#&gt;\n`;
  q += `<span class="kw">PREFIX</span> xsd:  &lt;http://www.w3.org/2001/XMLSchema#&gt;\n\n`;
  q += `<span class="kw">SELECT</span> <span class="var">?individuo</span> <span class="var">?clase</span> <span class="var">?propiedad</span> <span class="var">?valor</span>\n`;
  q += `<span class="kw">WHERE</span> {\n`;
  q += `  <span class="var">?individuo</span> a <span class="var">?clase</span> .`;

  if (classFilter) {
    q += `\n  <span class="comment"># Filtro exacto por clase</span>`;
    q += `\n  <span class="kw">FILTER</span>(<span class="var">?clase</span> = :<span class="str">${classFilter.replace(/ /g, '_')}</span>)`;
  } else {
    q += `\n  <span class="var">?clase</span> rdfs:subClassOf* :Electrodomestico .`;
  }
  q += `\n  <span class="kw">OPTIONAL</span> { <span class="var">?individuo</span> <span class="var">?propiedad</span> <span class="var">?valor</span> . }`;

  if (term) {
    const tokens = term.split(/[\s\-_,]+/).filter(t => t.length >= 2);
    q += `\n  <span class="comment"># Búsqueda fuzzy multi-token (Levenshtein)</span>`;
    q += `\n  <span class="kw">FILTER</span>(`;
    tokens.forEach((tok, i) => {
      if (i > 0) q += `\n    <span class="kw">&&</span>`;
      q += `\n    (<span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?individuo</span>)), <span class="str">"${tok}"</span>)`;
      q += ` || <span class="kw">CONTAINS</span>(<span class="kw">LCASE</span>(<span class="kw">STR</span>(<span class="var">?valor</span>)), <span class="str">"${tok}"</span>))`;
    });
    q += `\n  )`;
  }
  q += `\n}\n`;
  q += `<span class="kw">ORDER BY</span> DESC(<span class="var">?score</span>) <span class="var">?clase</span>\n`;
  q += `<span class="kw">LIMIT</span> 100`;
  return q;
}

// ══════════════════════════════════════════════
// MOTOR FUZZY — LEVENSHTEIN + SINÓNIMOS
// ══════════════════════════════════════════════
function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshtein(a, b) / maxLen : 1;
}

const SYNONYMS = {
  'lavadora':      ['lavarropas', 'washing', 'lavaloza', 'washine'],
  'refrigerador':  ['heladera', 'nevera', 'frigorifico', 'fridge', 'refrigeradora'],
  'televisor':     ['tele', 'tv', 'television', 'pantalla'],
  'computadora':   ['pc', 'laptop', 'computador', 'ordenador', 'notebook'],
  'microondas':    ['micro', 'microwave'],
  'cafetera':      ['cafe', 'coffee', 'cafetero'],
  'aire':          ['ac', 'acondicionado', 'climatizador'],
  'aspiradora':    ['aspirador', 'vacuum'],
  'cocina':        ['estufa', 'horno', 'cocineta'],
  'samsung':       ['sam', 'samsun'],
  'whirlpool':     ['whirl', 'wirlpool', 'wirlpul'],
  'mabe':          ['mave'],
  'panasonic':     ['pana'],
  'bosch':         ['bosh'],
};

function expandToken(token) {
  const variants = [token];
  for (const [key, syns] of Object.entries(SYNONYMS)) {
    if (key.includes(token) || token.includes(key) ||
        syns.some(s => s.includes(token) || token.includes(s))) {
      variants.push(key, ...syns);
    }
  }
  return [...new Set(variants)];
}

function tokenScore(token, text) {
  if (!token || !text) return 0;
  if (text.includes(token)) return 1.0;
  const expanded = expandToken(token);
  for (const v of expanded) if (v && text.includes(v)) return 0.95;
  if (token.length >= 3) {
    const words = text.split(/[\s_\-]+/);
    for (const w of words) {
      const sim = similarity(token, w);
      if (sim >= 0.72) return sim * 0.85;
      if (w.startsWith(token.slice(0, Math.max(3, token.length - 1)))) return 0.7;
    }
    for (let i = 0; i <= text.length - token.length + 1; i++) {
      if (similarity(token, text.substr(i, token.length)) >= 0.78) return 0.75;
    }
  }
  return 0;
}

function scoreIndividual(ind, tokens) {
  if (!tokens.length) return 1;
  const nameText  = ind.name.toLowerCase();
  const classText = ind.class.toLowerCase();
  const propText  = Object.entries(ind.properties)
    .map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase();
  let total = 0, matched = 0;
  for (const token of tokens) {
    const best = Math.max(
      tokenScore(token, nameText)  * 1.5,
      tokenScore(token, classText) * 1.2,
      tokenScore(token, propText)  * 0.9
    );
    if (best > 0.38) { total += best; matched++; }
  }
  if (!matched) return 0;
  return (total / tokens.length) + (matched === tokens.length ? 0.3 : 0);
}

// ══════════════════════════════════════════════
// BÚSQUEDA
// ══════════════════════════════════════════════
function doSearch() {
  const term = document.getElementById('searchInput').value.trim().toLowerCase();
  currentQuery = term;
  runQuery(term, currentFilter);
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

function runQuery(term, classFilter) {
  document.getElementById('sparqlDisplay').innerHTML = buildSPARQLQuery(term, classFilter);
  const tokens = term ? term.split(/[\s\-_,]+/).filter(t => t.length >= 2) : [];
  const results = ontologyData.individuals
    .filter(ind => !classFilter || ind.class === classFilter)
    .map(ind => ({ ...ind, _score: scoreIndividual(ind, tokens) }))
    .filter(ind => !tokens.length || ind._score > 0.35)
    .sort((a, b) => b._score - a._score);
  renderResults(results, term, tokens);
}

// ══════════════════════════════════════════════
// RENDER RESULTADOS
// ══════════════════════════════════════════════
const KEY_PROPS = [
  'consumo_potencia', 'capacidad_litros', 'capacidad_lavado', 'capacidad_refrigeracion',
  'eficiencia_energetica', 'tamano_pantalla', 'voltaje_aparato', 'peso_aparato',
  'numero_hornillas', 'capacidad_tazas', 'capacidad_carga', 'rpm_centrifugado',
  'potencia_microondas', 'area_cobertura', 'numero_velocidades', 'memoria_ram',
  'almacenamiento_interno', 'capacidad_congelacion', 'vida_util_estimada',
  'tecnologia_inverter', 'tv_smart', 'portable', 'conectividad_red'
];

function highlightTokens(text, tokens) {
  if (!tokens.length) return text;
  let result = text;
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    try {
      result = result.replace(
        new RegExp(`(${escapeReg(tok)})`, 'gi'),
        '<mark style="background:rgba(124,106,247,0.3);color:var(--accent);border-radius:3px;padding:0 2px">$1</mark>'
      );
    } catch(e) {}
  }
  return result;
}

function relevanceBadge(score, hasFuzzy) {
  if (!hasFuzzy) return '';
  const pct   = Math.min(100, Math.round(score * 70));
  const color = pct >= 75 ? 'var(--success)' : pct >= 45 ? 'var(--warn)' : 'var(--muted)';
  return `<span class="fuzzy-badge" style="border-color:${color};color:${color}">↑${pct}% relevancia</span>`;
}

function renderResults(results, term, tokens) {
  const container = document.getElementById('results');
  const countEl   = document.getElementById('resultsCount');
  const hasFuzzy  = tokens.length > 0;

  if (results.length === 0) {
    countEl.innerHTML = '';
    container.innerHTML = `
      <div class="state-msg">
        <span class="icon">🔍</span>
        <h3>Sin resultados</h3>
        No se encontraron coincidencias para "<strong>${escapeHtml(term || currentFilter)}</strong>"
        ${hasFuzzy ? '<br><small style="opacity:0.6">El motor fuzzy buscó también con variantes y errores tipográficos</small>' : ''}
      </div>`;
    return;
  }

  countEl.innerHTML = `<span>${results.length}</span> resultado${results.length !== 1 ? 's' : ''}
    ${hasFuzzy ? ' · <span style="color:var(--accent3)">búsqueda fuzzy activa</span>' : ''}`;

  container.innerHTML = results.slice(0, 60).map(ind => {
    const shownProps = KEY_PROPS.filter(p => ind.properties[p] !== undefined).slice(0, 4);
    const propsHtml  = shownProps.map(p => {
      let val = ind.properties[p], valClass = '';
      if (val === 'true')  { val = '✓ Sí'; valClass = 'bool-true'; }
      if (val === 'false') { val = '✗ No'; valClass = 'bool-false'; }
      return `<div class="prop-item">
        <span class="prop-key">${p.replace(/_/g, ' ')}</span>
        <span class="prop-val ${valClass}">${highlightTokens(String(val), tokens)}</span>
      </div>`;
    }).join('');

    return `
      <div class="result-card" onclick="showDetail('${escapeAttr(ind.id)}')">
        <div class="card-top">
          <div class="card-name">
            ${highlightTokens(ind.name, tokens)}
            ${relevanceBadge(ind._score, hasFuzzy)}
          </div>
          <div class="card-class">${ind.class}</div>
        </div>
        ${propsHtml
          ? `<div class="card-props">${propsHtml}</div>`
          : '<p style="color:var(--muted);font-size:12px;font-family:Space Mono,monospace">Sin propiedades registradas</p>'
        }
      </div>`;
  }).join('');

  if (results.length > 60) {
    container.innerHTML += `
      <div class="state-msg" style="padding:20px">
        <p>Mostrando 60 de ${results.length} resultados. Refina tu búsqueda para ver más.</p>
      </div>`;
  }
}

// ══════════════════════════════════════════════
// MODAL DETALLE
// ══════════════════════════════════════════════
function showDetail(id) {
  const ind = ontologyData.individuals.find(i => i.id === id);
  if (!ind) return;
  document.getElementById('modalName').textContent  = ind.name;
  document.getElementById('modalClass').innerHTML   = `<span class="card-class">${ind.class}</span>`;
  const props = Object.entries(ind.properties);
  document.getElementById('modalProps').innerHTML   = props.length === 0
    ? '<p style="color:var(--muted);font-family:Space Mono,monospace;font-size:12px;">Sin propiedades registradas</p>'
    : props.map(([k, v]) => {
        let val = v, color = '';
        if (val === 'true')  { val = '✓ Sí'; color = 'color:var(--success)'; }
        if (val === 'false') { val = '✗ No'; color = 'color:#ff6b6b'; }
        return `<div class="modal-prop">
          <span class="modal-prop-key">${k.replace(/_/g, ' ')}</span>
          <span class="modal-prop-val" style="${color}">${val}</span>
        </div>`;
      }).join('');
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
}

// ══════════════════════════════════════════════
// SPARQL PANEL TOGGLE
// ══════════════════════════════════════════════
function toggleSparql() {
  const body   = document.getElementById('sparqlBody');
  const toggle = document.getElementById('sparqlToggle');
  const open   = body.classList.toggle('open');
  toggle.textContent = open ? '▼ ocultar' : '▶ ver consulta';
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function escapeReg(s)  { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeAttr(s) { return s.replace(/'/g, "\\'"); }
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}