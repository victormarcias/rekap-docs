# rekap-docs

Visor web en vivo del repo [Rekap](https://github.com/victormarcias/Rekap) — se sirve bajo `victormarcias.online/rekap`, repo aparte del [portfolio](https://github.com/victormarcias/portfolio), sin relación de código con él (mismo espíritu que `fastapi-blog` bajo `/hero-blog`: repo y deploy propios, el portfolio solo lo rutea).

No hay build ni export intermedio: el sidebar se arma en el cliente pidiendo el árbol del repo Rekap a la API de GitHub, y cada página se pide en vivo a `raw.githubusercontent.com` y se renderiza con `marked` + `highlight.js` (ambos por CDN, sin bundler).

## Estructura

- `public/index.html` — shell de la página
- `public/rekap.js` — fetch del árbol (con cache de 1h en `localStorage`), armado del sidebar, routing por hash (`#carpeta/archivo.md`), carga y renderizado de cada página
- `public/rekap.css` — estilos (variables de color propias, sin depender del `styles.css` del portfolio)
- `main.py` — Cloud Function (`serve_rekap`, 2nd gen, Python) que sirve los archivos de `public/`, resolviendo el prefijo `/rekap` — no hace falta Docker: `gcloud`/Firebase arman el container solos a partir de esto.

## Correr local

```bash
./run-local.sh
```

Sirve `public/` en `http://localhost:8002` (ahí queda en la raíz, no bajo `/rekap` — el prefijo lo agrega la Cloud Function recién en producción).

## Deploy (Cloud Function, sin Docker)

```bash
gcloud functions deploy serve_rekap \
  --gen2 \
  --runtime=python312 \
  --region=us-east4 \
  --entry-point=serve_rekap \
  --trigger-http \
  --allow-unauthenticated \
  --source=.
```

En el proyecto de Firebase Hosting del portfolio, `/rekap` y `/rekap/**` se rutean con un rewrite tipo `function` a `serve_rekap` (ver `firebase.json` en el repo `portfolio`) — mismo mecanismo que ya usa `/cv` ahí (`serve_cv`), solo que este código vive en este repo aparte.

Sin base de datos, sin variables de entorno, sin estado — la función solo lee un archivo de `public/` y lo devuelve con el `Content-Type` correcto.
