# 🚀 Telegram Mini App (TMA) - APK Store & Monetización con Monetag

Arquitectura y código completo para una **Telegram Mini App** de catálogo y descarga de archivos APK para Android, diseñada con una interfaz moderna estilo **Google Play / App Store en Modo Oscuro** y optimizada para monetizar con **Monetag** (Interstitial, Rewarded o SmartLink direct).

---

## 📁 Estructura del Proyecto

```text
app telegram/
├── index.html        # UI Principal, TailwindCSS, Telegram WebApp SDK & Monetag
├── app.js            # Lógica de renderizado, filtro dinámico, temporizador e integración Monetag
├── games.json        # Base de datos ligera/Catálogo de juegos y APKs
├── bot.js            # Bot de Telegram en Node.js (Telegraf) para lanzar la WebApp
├── package.json      # Dependencias del Bot (Telegraf, Dotenv)
└── README.md         # Instrucciones de configuración y despliegue
```

---

## 🛠️ 1. Despliegue de la Mini App (Frontend)

Para que Telegram cargue la Mini App, el código del frontend debe estar publicado en un servidor **HTTPS** seguro.

### Opción A: Netlify (Recomendado)
1. Crea una cuenta gratuita en [Netlify](https://www.netlify.com/).
2. Arrastra y suelta la carpeta `app telegram` (solo los archivos `index.html`, `app.js` y `games.json`) en la sección **Sites > Add new site > Deploy manually**.
3. Copia la URL pública generada (Ejemplo: `https://apk-store-tma.netlify.app`).

### Opción B: Vercel / Cloudflare Pages
1. Instala el CLI de Vercel (`npm i -g vercel`) y ejecuta `vercel` en la carpeta del proyecto.
2. O sube el repositorio a GitHub y conéctalo directamente a **Cloudflare Pages** / **Vercel**.

---

## 🤖 2. Configuración en @BotFather (Telegram)

1. Abre Telegram y busca el bot oficial [@BotFather](https://t.me/BotFather).
2. Envía el comando `/newbot` y sigue las instrucciones para crear tu bot y obtener tu `BOT_TOKEN`.
3. Envía el comando `/mybots` y selecciona tu bot recién creado.
4. Entra en **Bot Settings** > **Menu Button** > **Configure menu button**.
5. Envía la URL HTTPS de tu app (ejemplo: `https://apk-store-tma.netlify.app`).
6. Asigna el texto que aparecerá en el botón del menú (Ejemplo: `🎮 Abrir APK Store`).
7. *(Opcional)* Si quieres crear un enlace directo para compartir en canales o grupos:
   - Ve a **Bot Settings** > **Direct Link** / **Mini Apps** > **Create New App**.
   - Asigna la URL de tu frontend.

---

## 💵 3. Integración y Configuración de Monetag

En el archivo `app.js` e `index.html`:

1. **SmartLink / Direct Link:** Reemplaza el valor de `MONETAG_SMARTLINK_URL` en `app.js` con tu enlace Smartlink generado en el panel de Monetag:
   ```javascript
   const MONETAG_SMARTLINK_URL = "https://www.highperformanceformat.com/TU_SMARTLINK_ID";
   ```
2. **In-Page Push / Interstitial:** En `index.html`, reemplaza el script placeholder en el `<head>` con el script Anti-Adblock / Direct Script que te proporciona Monetag.

---

## 💻 4. Ejecución del Bot de Telegram (Backend Node.js)

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Reemplaza en `bot.js` tu `BOT_TOKEN` y `WEB_APP_URL`.
3. Inicia el bot:
   ```bash
   npm start
   ```
