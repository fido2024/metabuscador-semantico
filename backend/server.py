# ══════════════════════════════════════════════
# MetaBuscador Semántico — Backend Python
# server.py
#
# Rol: Puente entre el frontend y DBpedia
#      Resuelve el problema de CORS
#
# Tecnología: Python + Flask
# Puerto: 5000
#
# Uso:
#   pip install -r requirements.txt
#   python server.py
# ══════════════════════════════════════════════

from flask import Flask, request, jsonify
from flask_cors import CORS
import urllib.request
import urllib.parse
import json

app = Flask(__name__)

# Permite peticiones desde el frontend (cualquier origen local)
CORS(app, origins=["http://localhost:5500",
                   "http://127.0.0.1:5500",
                   "http://localhost:3000",
                   "null",        # archivo abierto directo en navegador
                   "*"])          # desarrollo: permitir todo

DBPEDIA_ENDPOINT = "https://dbpedia.org/sparql"

# ── Ruta principal: proxy a DBpedia ──────────────
@app.route("/dbpedia", methods=["GET"])
def query_dbpedia():
    term = request.args.get("term", "").strip()

    if not term:
        return jsonify({"error": "Parámetro 'term' requerido"}), 400

    # Construye la consulta SPARQL para DBpedia
    sparql = f"""
PREFIX dbo:  <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT DISTINCT ?recurso ?nombre ?descripcion ?imagen ?wikiPage
WHERE {{
  ?recurso rdfs:label ?nombre .
  FILTER(LANG(?nombre) = "en")
  FILTER(CONTAINS(LCASE(STR(?nombre)), "{term.lower()}"))
  OPTIONAL {{
    ?recurso dbo:abstract ?descripcion .
    FILTER(LANG(?descripcion) = "es")
  }}
  OPTIONAL {{ ?recurso dbo:thumbnail ?imagen . }}
  OPTIONAL {{ ?recurso foaf:isPrimaryTopicOf ?wikiPage . }}
}}
ORDER BY ?nombre
LIMIT 10
"""

    params = urllib.parse.urlencode({
        "query":  sparql,
        "format": "application/sparql-results+json"
    })

    url = f"{DBPEDIA_ENDPOINT}?{params}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "Accept":     "application/sparql-results+json",
                "User-Agent": "MetaBuscador-Semantico/1.0 (UMSS)"
            }
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw  = resp.read()
            data = json.loads(raw)
            return jsonify({
                "ok":       True,
                "endpoint": DBPEDIA_ENDPOINT,
                "term":     term,
                "results":  data
            })

    except urllib.error.HTTPError as e:
        print(f"[DBpedia HTTPError] {e.code}: {e.reason}")
        return jsonify({
            "ok":    False,
            "error": f"DBpedia HTTP {e.code}: {e.reason}"
        }), 502

    except urllib.error.URLError as e:
        print(f"[DBpedia URLError] {str(e.reason)}")
        return jsonify({
            "ok":    False,
            "error": f"No se pudo conectar a DBpedia: {str(e.reason)}"
        }), 503

    except Exception as e:
        print(f"[Error general] {type(e).__name__}: {str(e)}")
        return jsonify({
            "ok":    False,
            "error": str(e)
        }), 500


# ── Ruta de salud: verifica que el servidor corre ──
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":   "ok",
        "servidor": "MetaBuscador Semántico Backend",
        "endpoint": DBPEDIA_ENDPOINT
    })


# ── Inicio ──────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  MetaBuscador Semántico — Backend Python")
    print("  Puerto: http://localhost:5000")
    print("  Endpoint DBpedia:", DBPEDIA_ENDPOINT)
    print("=" * 50)
    app.run(debug=True, port=5000)