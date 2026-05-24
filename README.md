# 🔍 MetaBuscador Semántico — Electrodomésticos
 
**Práctica 2do Parcial · Web Semántica · UMSS**
 
Metabuscador semántico basado en OWL + SPARQL para el dominio de electrodomésticos.
 
##  Cómo usar
 
1. Abrir `index.html` en cualquier navegador moderno
2. Arrastrar el archivo `ontologia/web-semanticas.owx` al área de carga
3. ¡Buscar!
##  Estructura
 
```
metabuscador-semantico/
├── index.html          ← Página principal
├── css/
│   └── style.css       ← Estilos (modo claro/oscuro)
├── js/
│   └── app.js          ← Lógica: parser OWL, motor fuzzy, SPARQL
└── ontologia/
    └── web-semanticas.owx  ← Ontología OWL de electrodomésticos
```
 
##  Características
 
- **Sin backend ni DBMS** — todo corre en el navegador (HTML5)
- **Parser OWL** — lee el archivo `.owx` directamente con DOMParser
- **SPARQL** — cada búsqueda genera una consulta SPARQL visible
- **Búsqueda Fuzzy** — algoritmo Levenshtein + sinónimos + tokens desordenados
- **Modo claro/oscuro** — toggle persistente
- **Filtros por clase** — navega por categorías semánticas
- **Ranking por relevancia** — resultados ordenados por % de coincidencia
##  Tecnologías
 
| Tecnología | Uso |
|-----------|-----|
| HTML5 | Estructura y APIs nativas (DOMParser, FileReader, Drag & Drop) |
| CSS3 | Diseño responsivo con variables CSS para temas |
| JavaScript ES6+ | Lógica de búsqueda, parser OWL, motor fuzzy |
| OWL/XML | Formato de la ontología |
| SPARQL | Lenguaje de consulta semántica |
 
##  Integrantes
 
- Vasquez Carata Fidel
- [Nombre 2]
- [Nombre 3]
- [Nombre 4]
- [Nombre 5]
---
*UMSS · Carrera de Sistemas · Web Semántica 2025*