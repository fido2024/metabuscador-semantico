# ══════════════════════════════════════════════════════════
# MetaBuscador Semántico — Backend Python v2
# server.py — owlready2 + SPARQLWrapper + Flask
# ══════════════════════════════════════════════════════════

from flask import Flask, request, jsonify
from flask_cors import CORS
from SPARQLWrapper import SPARQLWrapper, JSON
from owlready2 import get_ontology, default_world
import os, traceback, tempfile

app = Flask(__name__)
CORS(app, origins="*")

onto              = None
ontologia_cargada = False
individuos_cache  = []

# ── Construye el cache de individuos desde owlready2 ─────
def construir_cache():
    global individuos_cache
    individuos_cache = []
    if not onto:
        return
    for ind in onto.individuals():
        clases = list(ind.is_a)
        clase_nombre = ""
        for c in clases:
            nombre = getattr(c, 'name', '')
            if nombre and nombre not in ('Thing', 'NamedIndividual'):
                clase_nombre = nombre.replace("_", " ")
                break
        if not clase_nombre:
            continue
        props = {}
        for prop in onto.data_properties():
            vals = list(prop[ind])
            if vals:
                props[prop.name] = str(vals[0])
        for prop in onto.object_properties():
            vals = list(prop[ind])
            if vals:
                props[prop.name] = getattr(vals[0], 'name', str(vals[0])).replace("_", " ")
        individuos_cache.append({
            "id":          ind.name,
            "nombre":      ind.name.replace("_", " "),
            "clase":       clase_nombre,
            "propiedades": props
        })
    print(f"[owlready2] Cache: {len(individuos_cache)} individuos")

# ── Auto-carga al iniciar ─────────────────────────────────
def auto_cargar():
    global onto, ontologia_cargada
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for nombre in ["web-semanticas.owx", "electrodomesticos.owl",
                   "electrodomesticos.owx", "ontologia.owl"]:
        ruta = os.path.join(base_dir, "ontologia", nombre)
        if os.path.exists(ruta):
            print(f"  Auto-cargando: {ruta}")
            try:
                # CAMBIA ESTO:
                # ruta_url = "file:///" + ruta.replace("\\", "/")
                
                # POR ESTO (Solo dos barras):
                ruta_url = "file://" + ruta.replace("\\", "/")
                
                onto = get_ontology(ruta_url).load()
                onto = get_ontology(ruta_url).load()
                ontologia_cargada = True
                construir_cache()
                print(f"  ✓ Cargado: {len(individuos_cache)} individuos")
            except Exception as e:
                print(f"  ✗ Error: {e}")
            return

# ══════════════════════════════════════════════════════════
# RUTAS
# ══════════════════════════════════════════════════════════

@app.route("/cargar_archivo", methods=["POST"])
def cargar_archivo():
    global onto, ontologia_cargada
    if 'owl_file' not in request.files:
        return jsonify({"ok": False, "error": "No se recibió archivo"}), 400
    archivo = request.files['owl_file']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.owx') as tmp:
        archivo.save(tmp.name)
        ruta_tmp = tmp.name
    try:
        # CAMBIA ESTO:
        # ruta_url = "file:///" + ruta_tmp.replace("\\", "/")
        
        # POR ESTO (Solo dos barras):
        ruta_url = "file://" + ruta_tmp.replace("\\", "/")
        
        onto = get_ontology(ruta_url).load()
        onto = get_ontology(ruta_url).load()
        ontologia_cargada = True
        construir_cache()
        os.unlink(ruta_tmp)
        return jsonify({"ok": True, "archivo": archivo.filename,
                        "individuos": len(individuos_cache)})
    except Exception as e:
        if os.path.exists(ruta_tmp): os.unlink(ruta_tmp)
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/buscar", methods=["GET"])
def buscar_local():
    if not ontologia_cargada:
        return jsonify({"ok": False, "error": "Ontología no cargada"}), 400
    
    term         = request.args.get("term",  "").strip().lower()
    clase_filtro = request.args.get("clase", "").strip().lower()
    resultados = []

    # 1. Dividimos el término de búsqueda en palabras individuales (tokens)
    tokens_busqueda = term.split() if term else []

    for ind in individuos_cache:
        # Filtro por clase
        if clase_filtro and clase_filtro not in ind["clase"].lower():
            continue
            
        # Filtro por término de búsqueda (Tokenización)
        if tokens_busqueda:
            texto = (ind["nombre"] + " " + ind["clase"] + " " +
                     " ".join(str(v) for v in ind["propiedades"].values())).lower()
            
            # 2. Verificamos que TODAS las palabras existan en el texto
            # Usamos all() para asegurar que coincida "gas" Y "cocina" en cualquier orden
            if not all(token in texto for token in tokens_busqueda):
                continue
                
        resultados.append(ind)
        
    return jsonify({"ok": True, "term": term,
                    "total": len(resultados), "resultados": resultados[:200]})


@app.route("/clases", methods=["GET"])
def listar_clases():
    if not ontologia_cargada:
        return jsonify({"ok": False, "error": "Ontología no cargada"}), 400
    conteo = {}
    for ind in individuos_cache:
        c = ind["clase"]
        conteo[c] = conteo.get(c, 0) + 1
    clases = [{"clase": k, "total": v}
              for k, v in sorted(conteo.items(), key=lambda x: -x[1])]
    return jsonify({"ok": True, "clases": clases})


@app.route("/stats", methods=["GET"])
def stats():
    if not ontologia_cargada:
        return jsonify({"ok": False, "error": "Ontología no cargada"}), 400
    return jsonify({
        "ok":          True,
        "triples":     len(individuos_cache) * 3,
        "clases":      len(set(i["clase"] for i in individuos_cache)),
        "propiedades": len(set(p for i in individuos_cache for p in i["propiedades"]))
    })

@app.route("/dbpedia", methods=["GET"])
def query_dbpedia():
    term = request.args.get("term", "").strip()
    if not term:
        return jsonify({"ok": False, "error": "Parámetro 'term' requerido"}), 400

    term_cap = term.capitalize()
    term_low = term.lower()
    term_title = term.title()

    # Consulta con UNION estable + captura de rdfs:comment (la descripción corta)
    # Consulta ajustada para traer ES e EN
    # Consulta actualizada: ¡Ahora buscamos dbo:description!
    sparql_query = f"""
    PREFIX dbo:  <http://dbpedia.org/ontology/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT DISTINCT ?recurso ?nombre ?descripcion ?imagen ?wikiPage
    WHERE {{
      {{ ?recurso rdfs:label "{term_cap}"@en . BIND("{term_cap}"@en AS ?nombre) }}
      UNION
      {{ ?recurso rdfs:label "{term_low}"@en . BIND("{term_low}"@en AS ?nombre) }}
      UNION
      {{ ?recurso rdfs:label "{term_title}"@en . BIND("{term_title}"@en AS ?nombre) }}
      UNION
      {{ ?recurso rdfs:label "{term_cap}"@es . BIND("{term_cap}"@es AS ?nombre) }}
      UNION
      {{ ?recurso rdfs:label "{term_low}"@es . BIND("{term_low}"@es AS ?nombre) }}

      # Buscamos en dbo:description, si no hay, en rdfs:comment, y finalmente en dbo:abstract
      OPTIONAL {{ ?recurso dbo:description ?desc . FILTER(LANG(?desc) = "es") }}
      OPTIONAL {{ ?recurso rdfs:comment ?desc . FILTER(LANG(?desc) = "es" && !BOUND(?desc)) }}
      OPTIONAL {{ ?recurso dbo:abstract ?desc . FILTER(LANG(?desc) = "es" && !BOUND(?desc)) }}
      BIND(?desc AS ?descripcion)

      OPTIONAL {{ ?recurso dbo:thumbnail ?imagen . }}
      OPTIONAL {{ ?recurso foaf:isPrimaryTopicOf ?wikiPage . }}
    }}
    LIMIT 10
    """
    try:
        sparql = SPARQLWrapper("https://dbpedia.org/sparql")
        sparql.setQuery(sparql_query)
        sparql.setReturnFormat(JSON)
        sparql.setTimeout(15) 
        sparql.addCustomHttpHeader("User-Agent", "Mozilla/5.0")
        
        data = sparql.query().convert()
        bindings = data.get("results", {}).get("bindings", [])
        resultados, seen = [], set()
        
        for b in bindings:
            recurso = b.get("recurso", {}).get("value", "")
            if recurso in seen: continue
            seen.add(recurso)
            
            # Prioridad: 1. Abstract ES, 2. Abstract EN, 3. Mensaje por defecto
            desc_es = b.get("descripcion", {}).get("value", "")
            desc_en = b.get("descEn", {}).get("value", "")
            
            # Si ambos están vacíos, ponemos un texto informativo
            desc_raw = b.get("descripcion", {}).get("value", "")
            desc_final = desc_raw if desc_raw else f"Información sobre {b.get('nombre', {}).get('value', 'este recurso')}. Consulta los enlaces para más detalles."

            # Luego usas desc_final en tu append:
            resultados.append({
                "recurso": recurso,
                "nombre": b.get("nombre", {}).get("value", ""),
                "descripcion": desc_final,
                "imagen":      b.get("imagen", {}).get("value", ""),
                "wikiPage":    b.get("wikiPage", {}).get("value", ""),
                "dbpediaLink": recurso.replace("http://dbpedia.org/resource/", "https://dbpedia.org/page/")
            })
            
        return jsonify({
            "ok": True,
            "total": len(resultados),
            "resultados": resultados
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500



@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":            "ok",
        "ontologia_cargada": ontologia_cargada,
        "individuos":        len(individuos_cache),
        "triples":           len(individuos_cache) * 3,
        "librerias":         ["owlready2", "SPARQLWrapper", "flask", "flask-cors"]
    })


if __name__ == "__main__":
    print("=" * 55)
    print("  MetaBuscador Semántico — Backend Python v2")
    print("  owlready2 + SPARQLWrapper + Flask")
    print("  Puerto: http://localhost:5000")
    print("=" * 55)
    auto_cargar()
    app.run(debug=True, port=5000)