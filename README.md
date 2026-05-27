# Metabuscador Semántico - Electrodomésticos

Proyecto de Web Semántica desarrollado para la Universidad Mayor de San Simón (UMSS). El sistema permite realizar búsquedas híbridas sobre una ontología local (.owx) y el grafo de conocimiento global de DBpedia.

---

## 🚀 Requisitos previos

Para ejecutar el proyecto, asegúrate de tener instalado:

- [Python 3.x](https://www.python.org/downloads/)
- Navegador web moderno (Chrome, Firefox o Edge)

---

## 🛠️ Guía de Instalación y Ejecución

### 1. Configurar el Backend (Python)

El backend gestiona las consultas SPARQL hacia DBpedia y sirve como puente semántico.

1. Abre una terminal y dirígete a la carpeta `backend`:

```bash
cd backend
```

2. Instala las dependencias necesarias:

```bash
pip install -r requirements.txt
```

3. Ejecuta el servidor:

```bash
python server.py
```

El servidor iniciará en:

```txt
http://127.0.0.1:5000
```

---

### 2. Ejecutar el Frontend

El frontend es una aplicación cliente que procesa la ontología local.

1. Asegúrate de que el backend esté ejecutándose.

2. Abre la carpeta `frontend`.

3. Abre el archivo `index.html` en tu navegador.

> Recomendación: Si usas VS Code, utiliza la extensión **Live Server** para abrir el archivo.  
> Si lo abres directamente como archivo local, asegúrate de que el backend esté activo para permitir la comunicación.

---

## 📂 Estructura del Proyecto

```txt
/backend    -> Lógica de Python, servidor Flask y consultas SPARQL
/frontend   -> Interfaz de usuario (HTML, CSS y JS)
/ontologia  -> Archivo fuente web-semanticas.owx
```

---

## ⚙️ Notas Técnicas

- **Arquitectura:** Cliente 100% (Frontend) + Servidor Proxy (Backend).
- **Tecnologías:** Flask, SPARQLWrapper, DOMParser API, CSS Vanilla.
- **Consulta de errores:**  
  Si el buscador no carga resultados, presiona `F12` en tu navegador y revisa la pestaña `Console` para verificar la comunicación con el servidor.

---

## 🎓 Información Académica

Desarrollado para la materia de **Web Semántica - UMSS 2026**.

