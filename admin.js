/**
 * Panel de Administración Independiente - APK Store (Firebase Firestore Integration)
 */

let db = null;
let gamesList = [];
const ADMIN_PASSWORD = "admin";

// Configuración de Firebase (Proyecto: cooapk-2cd82)
const firebaseConfig = {
  apiKey: "AIzaSyDDyvPywg4F64A7NpsVwiqOCBRLwLFyraw",
  authDomain: "cooapk-2cd82.firebaseapp.com",
  projectId: "cooapk-2cd82",
  storageBucket: "cooapk-2cd82.firebasestorage.app",
  messagingSenderId: "561236943097",
  appId: "1:561236943097:web:8d70652e7a07b86c814228",
  measurementId: "G-NE6BDMNN6Z"
};

// Inicializar Firebase
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase Firestore conectado en Panel Admin");
  } catch (e) {
    console.error("Error al inicializar Firebase:", e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupLogin();
  setupNavigation();
  setupForms();
});

/**
 * 1. Autenticación / Login
 */
function setupLogin() {
  const loginForm = document.getElementById('loginForm');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const loginScreen = document.getElementById('loginScreen');
  const adminDashboard = document.getElementById('adminDashboard');
  const logoutBtn = document.getElementById('logoutBtn');

  // Si ya inició sesión previamente en esta pestaña
  if (sessionStorage.getItem('admin_authenticated') === 'true') {
    loginScreen.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    initAdminData();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (loginPassword.value === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      loginScreen.classList.add('hidden');
      adminDashboard.classList.remove('hidden');
      loginError.classList.add('hidden');
      initAdminData();
    } else {
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('admin_authenticated');
    location.reload();
  });
}

/**
 * 2. Navegación del Panel Lateral (Pestañas)
 */
function setupNavigation() {
  const menuCatBtn = document.getElementById('menuCatBtn');
  const menuSettingsBtn = document.getElementById('menuSettingsBtn');
  const menuAnalyticsBtn = document.getElementById('menuAnalyticsBtn');

  const viewCatalog = document.getElementById('viewCatalog');
  const viewSettings = document.getElementById('viewSettings');
  const viewAnalytics = document.getElementById('viewAnalytics');

  const navItems = [
    { btn: menuCatBtn, view: viewCatalog },
    { btn: menuSettingsBtn, view: viewSettings },
    { btn: menuAnalyticsBtn, view: viewAnalytics }
  ];

  navItems.forEach(item => {
    item.btn.addEventListener('click', () => {
      navItems.forEach(i => {
        i.btn.className = "w-full text-left px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-sm flex items-center justify-between border border-slate-800 transition-colors";
        i.view.classList.add('hidden');
      });

      item.btn.className = "w-full text-left px-4 py-3 rounded-2xl bg-green-500/10 text-green-400 border border-green-500/20 font-bold text-sm flex items-center justify-between shadow-sm";
      item.view.classList.remove('hidden');

      if (item.btn === menuAnalyticsBtn) loadAnalytics();
      if (item.btn === menuSettingsBtn) loadHeaderSettings();
    });
  });
}

/**
 * 3. Inicialización de Datos de Firebase
 */
function initAdminData() {
  if (!db) return;

  // Escuchar cambios en la colección 'games'
  db.collection("games").onSnapshot(snapshot => {
    gamesList = [];
    snapshot.forEach(doc => {
      gamesList.push({ docId: doc.id, ...doc.data() });
    });
    renderAdminGamesTable();
  }, err => console.error("Error al escuchar games:", err));

  // Escuchar descargas en tiempo real (con fallback robusto por si falta índice en Firestore)
  try {
    db.collection("downloads").onSnapshot(snapshot => {
      loadAnalyticsFromSnapshot(snapshot);
    }, err => {
      console.warn("Snapshot con ordenamiento falló, usando consulta simple:", err);
      db.collection("downloads").onSnapshot(snap => loadAnalyticsFromSnapshot(snap));
    });
  } catch(e) {
    db.collection("downloads").get().then(snap => loadAnalyticsFromSnapshot(snap));
  }

  loadHeaderSettings();
}

/**
 * 4. Gestión del Formulario de Juegos
 */
function setupForms() {
  const adminGameForm = document.getElementById('adminGameForm');
  const adminFormReset = document.getElementById('adminFormReset');
  const headerSettingsForm = document.getElementById('headerSettingsForm');
  const copyFullJsonBtn = document.getElementById('copyFullJsonBtn');

  adminGameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveGame();
  });

  adminFormReset.addEventListener('click', resetAdminGameForm);

  headerSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveHeaderSettings();
  });

  const stepSettingsForm = document.getElementById('stepSettingsForm');
  stepSettingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveStepSettings();
  });

  copyFullJsonBtn.addEventListener('click', () => {
    const cleanGames = gamesList.map(g => {
      const { docId, createdAt, ...rest } = g;
      return rest;
    });
    const jsonStr = JSON.stringify(cleanGames, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert("¡JSON de catálogo copiado al portapapeles! Puedes pegarlo en GitHub.");
    }).catch(() => prompt("Copia el JSON:", jsonStr));
  });

  const autoFetchBtn = document.getElementById('autoFetchBtn');
  const autoFetchQuery = document.getElementById('autoFetchQuery');
  if (autoFetchBtn && autoFetchQuery) {
    autoFetchBtn.addEventListener('click', async () => {
      const query = autoFetchQuery.value.trim();
      if (!query) {
        alert("Por favor ingresa el link de la app de Play Store o su paquete/nombre.");
        return;
      }
      await fetchPlayStoreData(query);
    });
  }
}

/**
 * Función de Autocompletado Play Store — Multi-estrategia con proxies de respaldo
 */
async function fetchPlayStoreData(query) {
  const statusEl = document.getElementById('autoFetchStatus');
  const btn = document.getElementById('autoFetchBtn');

  if (statusEl) {
    statusEl.textContent = "🔍 Buscando información de la aplicación...";
    statusEl.className = "text-xs mt-2 text-amber-400 font-medium block";
  }
  if (btn) btn.disabled = true;

  // ── PASO 1: Detectar tipo de entrada ──────────────────────────────────────
  let appId = null;       // com.package.name
  let searchTerm = null;  // texto libre para buscar

  const isUrl = query.startsWith('http');

  if (isUrl) {
    try {
      const urlObj = new URL(query);
      // Link directo: play.google.com/store/apps/details?id=com.xxx
      if (urlObj.searchParams.has('id')) {
        appId = urlObj.searchParams.get('id');
      }
      // Link de búsqueda: play.google.com/store/search?q=plantas+vs+zombies
      else if (urlObj.searchParams.has('q')) {
        searchTerm = urlObj.searchParams.get('q').replace(/\+/g, ' ');
      }
    } catch(e) {
      searchTerm = query;
    }
  } else if (query.includes('.') && !query.includes(' ')) {
    // Parece un package ID escrito directo (ej: com.ea.game.pvzfree_row)
    appId = query;
  } else {
    // Texto libre / nombre de la app
    searchTerm = query;
  }

  try {
    let fetchedData = null;

    // ── ESTRATEGIA 1: Si tenemos package ID, scraping via múltiples proxies ──
    if (appId && !fetchedData) {
      const targetUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}&hl=es`;
      const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
      ];

      for (const proxyUrl of proxies) {
        try {
          if (statusEl) statusEl.textContent = `🔍 Intentando proxy ${proxies.indexOf(proxyUrl) + 1}/3...`;
          const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(7000) });
          if (!res.ok) continue;

          let html = '';
          // allorigins devuelve JSON con .contents; los otros devuelven HTML directo
          if (proxyUrl.includes('allorigins')) {
            const json = await res.json();
            html = json.contents || '';
          } else {
            html = await res.text();
          }

          if (!html) continue;

          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
          const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
          const ogDesc  = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
                       || doc.querySelector('meta[name="description"]')?.getAttribute('content');

          if (ogTitle) {
            const cleanTitle = ogTitle
              .replace(/ - Aplicaciones en Google Play.*/i, '')
              .replace(/ - Apps on Google Play.*/i, '')
              .trim();

            let version = 'Varies';
            let size    = 'Varía según dispositivo';

            // Intentar extraer versión del HTML
            const vMatch = html.match(/\[\[\["([0-9]+\.[0-9]+(?:\.[0-9]+)*)"\]\]/);
            if (vMatch?.[1]) version = 'v' + vMatch[1];

            // Intentar extraer tamaño
            const sMatch = html.match(/"([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB))"/i);
            if (sMatch?.[1]) size = sMatch[1];

            fetchedData = { title: cleanTitle, icon: ogImage || '', description: ogDesc || cleanTitle, version, size };
            break; // Éxito — salir del loop de proxies
          }
        } catch(e) {
          // Proxy falló, probar el siguiente
          console.warn('Proxy falló:', e.message);
        }
      }
    }

    // ── ESTRATEGIA 2: Si tenemos package ID pero scraping falló → Google Play API no-oficial ──
    if (appId && !fetchedData) {
      try {
        if (statusEl) statusEl.textContent = "🔍 Consultando API de metadatos...";
        const apiRes = await fetch(`https://play.google.com/store/apps/details?id=${appId}&hl=es`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(6000)
        });
        // Normalmente bloqueará CORS, pero a veces funciona en panel web
        if (apiRes.ok) {
          const html = await apiRes.text();
          const titleMatch = html.match(/<title>([^<]+)<\/title>/);
          if (titleMatch) {
            fetchedData = {
              title: titleMatch[1].replace(/ - Aplicaciones en Google Play.*/i,'').trim(),
              icon: `https://play-lh.googleusercontent.com/a/${appId}`,
              description: appId,
              version: 'Varies',
              size: 'Varía'
            };
          }
        }
      } catch(e) {}
    }

    // ── ESTRATEGIA 3: iTunes Search API (funciona para casi cualquier app popular) ──
    if (!fetchedData) {
      // Si tenemos package ID, extraer términos inteligentes de él
      const terms = searchTerm
        || (appId ? appId.replace(/^com\.|^net\.|^org\.|^io\.|^co\./, '').replace(/\./g, ' ') : query);

      if (statusEl) statusEl.textContent = "🔍 Buscando en base de datos de apps...";

      try {
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(terms)}&entity=software&limit=5`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (itunesRes.ok) {
          const itunesJson = await itunesRes.json();
          if (itunesJson.results?.length > 0) {
            // Elegir el resultado más relevante
            let item = itunesJson.results[0];
            if (itunesJson.results.length > 1 && appId) {
              // Intentar emparejar por bundle similar
              const better = itunesJson.results.find(r =>
                r.bundleId?.toLowerCase().includes(appId.split('.').pop().toLowerCase())
              );
              if (better) item = better;
            }
            const mbSize = item.fileSizeBytes ? (item.fileSizeBytes / (1024 * 1024)).toFixed(0) + ' MB' : 'Varía';
            fetchedData = {
              title: item.trackName,
              icon: item.artworkUrl512 || item.artworkUrl100,
              description: item.description
                ? item.description.substring(0, 200).replace(/\n/g, ' ') + '...'
                : item.trackName,
              version: 'v' + (item.version || '1.0'),
              size: mbSize
            };
          }
        }
      } catch(e) {
        console.warn('iTunes API error:', e.message);
      }
    }

    // ── ESTRATEGIA 4: Búsqueda web fallback con Open Search / DuckDuckGo API ──
    if (!fetchedData && searchTerm) {
      try {
        if (statusEl) statusEl.textContent = "🔍 Última búsqueda alternativa...";
        const ddgRes = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(searchTerm + ' android apk')}&format=json&no_redirect=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (ddgRes.ok) {
          const ddgJson = await ddgRes.json();
          if (ddgJson.AbstractText) {
            fetchedData = {
              title: ddgJson.Heading || searchTerm,
              icon: ddgJson.Image ? 'https://duckduckgo.com' + ddgJson.Image : '',
              description: ddgJson.AbstractText.substring(0, 200) + '...',
              version: 'Varies',
              size: 'Varía'
            };
          }
        }
      } catch(e) {}
    }

    // ── RESULTADO ──────────────────────────────────────────────────────────────
    if (fetchedData) {
      document.getElementById('adminTitle').value = fetchedData.title || '';
      if (fetchedData.icon) document.getElementById('adminIcon').value = fetchedData.icon;
      if (fetchedData.description) document.getElementById('adminDesc').value = fetchedData.description;
      if (fetchedData.version) document.getElementById('adminVersion').value = fetchedData.version;
      if (fetchedData.size) document.getElementById('adminSize').value = fetchedData.size;

      if (statusEl) {
        statusEl.textContent = "✅ ¡Campos autocompletados! Revisa y agrega el enlace de descarga.";
        statusEl.className = "text-xs mt-2 text-green-400 font-bold block";
      }
    } else {
      if (statusEl) {
        statusEl.textContent = "⚠️ No se encontró info automáticamente. Escribe el nombre exacto de la app tal como aparece en Play Store.";
        statusEl.className = "text-xs mt-2 text-amber-400 font-medium block";
      }
    }
  } catch (err) {
    console.warn("AutoFetch Error:", err);
    if (statusEl) {
      statusEl.textContent = "❌ Error de conexión. Intenta con el nombre exacto de la app en lugar del link.";
      statusEl.className = "text-xs mt-2 text-red-400 font-medium block";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveGame() {
  const docId = document.getElementById('adminFormId').value;
  const gameData = {
    id: docId ? parseInt(document.getElementById('adminTitle').getAttribute('data-id') || Date.now()) : Date.now(),
    title: document.getElementById('adminTitle').value.trim(),
    category: document.getElementById('adminCategory').value,
    size: document.getElementById('adminSize').value.trim(),
    version: document.getElementById('adminVersion').value.trim(),
    rating: document.getElementById('adminRating').value,
    icon: document.getElementById('adminIcon').value.trim(),
    downloadUrl: document.getElementById('adminDownloadUrl').value.trim(),
    description: document.getElementById('adminDesc').value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (!db) {
    alert("Error: Firebase no está conectado.");
    return;
  }

  try {
    if (docId) {
      await db.collection("games").doc(docId).update(gameData);
      alert("¡Juego actualizado en la Mini App de Telegram!");
    } else {
      await db.collection("games").add(gameData);
      alert("¡Juego publicado con éxito en Telegram!");
    }
    resetAdminGameForm();
  } catch (err) {
    alert("Error al guardar en Firebase: " + err.message);
  }
}

function resetAdminGameForm() {
  document.getElementById('adminFormId').value = '';
  document.getElementById('adminTitle').value = '';
  document.getElementById('adminCategory').value = 'Nuevo';
  document.getElementById('adminSize').value = '';
  document.getElementById('adminVersion').value = '';
  document.getElementById('adminRating').value = '5.0';
  document.getElementById('adminIcon').value = '';
  document.getElementById('adminDownloadUrl').value = '';
  document.getElementById('adminDesc').value = '';
  document.getElementById('formModeTitle').innerHTML = '<i class="fa-solid fa-plus-circle text-green-400"></i> Publicar Nuevo Juego / App';
}

function renderAdminGamesTable() {
  const container = document.getElementById('gamesAdminTable');
  if (gamesList.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500 py-4 text-center">No hay juegos en la base de datos.</p>';
    return;
  }

  container.innerHTML = gamesList.map(game => `
    <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${game.icon}" class="w-12 h-12 rounded-xl object-cover border border-slate-800 flex-shrink-0">
        <div class="min-w-0">
          <h4 class="font-bold text-sm text-slate-100 truncate">${game.title}</h4>
          <div class="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span class="px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-semibold border border-green-500/20 text-[10px]">${game.category}</span>
            <span class="text-amber-400 font-bold flex items-center gap-1"><i class="fa-solid fa-star text-[10px]"></i> ${game.rating || '5.0'}</span>
            <span>${game.size}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="editGameAdmin('${game.docId}')" class="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 font-bold text-xs rounded-xl flex items-center gap-1">
          <i class="fa-solid fa-pen"></i> Editar
        </button>
        <button onclick="deleteGameAdmin('${game.docId}')" class="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold text-xs rounded-xl flex items-center gap-1">
          <i class="fa-solid fa-trash"></i> Borrar
        </button>
      </div>
    </div>
  `).join('');
}

window.editGameAdmin = function(docId) {
  const game = gamesList.find(g => g.docId === docId);
  if (!game) return;

  document.getElementById('adminFormId').value = game.docId;
  document.getElementById('adminTitle').value = game.title;
  document.getElementById('adminTitle').setAttribute('data-id', game.id || Date.now());
  document.getElementById('adminCategory').value = game.category || 'Nuevo';
  document.getElementById('adminSize').value = game.size;
  document.getElementById('adminVersion').value = game.version;
  document.getElementById('adminRating').value = game.rating || '5.0';
  document.getElementById('adminIcon').value = game.icon;
  document.getElementById('adminDownloadUrl').value = game.downloadUrl;
  document.getElementById('adminDesc').value = game.description;

  document.getElementById('formModeTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400"></i> Editando Juego';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteGameAdmin = async function(docId) {
  if (confirm("¿Estás seguro de eliminar este juego definitivamente de la Mini App?")) {
    try {
      await db.collection("games").doc(docId).delete();
      alert("Juego eliminado con éxito.");
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  }
};

/**
 * 5. Ajustes de Marca (Título / Subtítulo)
 */
async function loadHeaderSettings() {
  if (!db) return;
  try {
    const doc = await db.collection("settings").doc("header").get();
    if (doc.exists) {
      const data = doc.data();
      if (data.title) document.getElementById('headerTitleInput').value = data.title;
      if (data.subtitle) document.getElementById('headerSubtitleInput').value = data.subtitle;
    }

    const stepDoc = await db.collection("settings").doc("stepConfig").get();
    const stepUrlInput = document.getElementById('stepUrlInput');
    const stepFinalDownloadUrlInput = document.getElementById('stepFinalDownloadUrlInput');
    const stepImageUrlInput = document.getElementById('stepImageUrlInput');
    if (stepDoc.exists) {
      const stepData = stepDoc.data();
      if (stepUrlInput) stepUrlInput.value = stepData.stepUrl || 'https://downyattainprojects.com/tvhen99v?key=eee65b92d7f3cff145392cb279dda8c5';
      if (stepFinalDownloadUrlInput) stepFinalDownloadUrlInput.value = stepData.finalDownloadUrl || '';
      if (stepImageUrlInput) stepImageUrlInput.value = stepData.stepImageUrl || '';
    } else {
      if (stepUrlInput) stepUrlInput.value = 'https://downyattainprojects.com/tvhen99v?key=eee65b92d7f3cff145392cb279dda8c5';
    }
  } catch (e) {
    console.warn("Error leyendo header y step settings:", e);
  }
}

async function saveHeaderSettings() {
  const title = document.getElementById('headerTitleInput').value.trim();
  const subtitle = document.getElementById('headerSubtitleInput').value.trim();

  if (!db) return;
  try {
    await db.collection("settings").doc("header").set({ title, subtitle });
    alert("¡Título y subtítulo de la Mini App actualizados con éxito!");
  } catch (e) {
    alert("Error al guardar ajustes: " + e.message);
  }
}

async function saveStepSettings() {
  const stepUrl = document.getElementById('stepUrlInput')?.value.trim();
  const finalDownloadUrl = document.getElementById('stepFinalDownloadUrlInput')?.value.trim() || '';
  const stepImageUrl = document.getElementById('stepImageUrlInput')?.value.trim() || '';

  if (!db) {
    alert("Error: Firebase no está conectado.");
    return;
  }

  try {
    await db.collection("settings").doc("stepConfig").set({
      stepUrl: stepUrl || 'https://downyattainprojects.com/tvhen99v?key=eee65b92d7f3cff145392cb279dda8c5',
      finalDownloadUrl: finalDownloadUrl,
      stepImageUrl: stepImageUrl,
      updatedAt: new Date().toISOString()
    });
    alert("¡Enlaces y ajustes del paso de descarga guardados con éxito!");
  } catch (e) {
    alert("Error al guardar ajustes del paso: " + e.message);
  }
}

/**
 * 6. Analíticas & Registros por País en Tiempo Real
 */
async function loadAnalytics() {
  if (!db) return;
  try {
    let snapshot;
    try {
      snapshot = await db.collection("downloads").orderBy("timestamp", "desc").get();
    } catch (e) {
      snapshot = await db.collection("downloads").get();
    }
    loadAnalyticsFromSnapshot(snapshot);
  } catch (err) {
    console.error("Error al cargar analíticas:", err);
  }
}

function loadAnalyticsFromSnapshot(snapshot) {
  const logsContainer = document.getElementById('analyticsLogsContainer');
  const totalCountEl = document.getElementById('analyticsTotalCount');
  const topCountryEl = document.getElementById('analyticsTopCountry');

  if (!logsContainer || !totalCountEl || !topCountryEl) return;

  const logs = [];
  const countryMap = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    logs.push(data);
    if (data.country) {
      countryMap[data.country] = (countryMap[data.country] || 0) + 1;
    }
  });

  // Ordenar por fecha descendente en cliente (más reciente primero)
  logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  // Mostrar la cantidad real total de descargas de la base de datos
  totalCountEl.textContent = logs.length;

  let maxC = 0;
  let topC = "-";
  Object.keys(countryMap).forEach(c => {
    if (countryMap[c] > maxC) {
      maxC = countryMap[c];
      topC = `${c} (${maxC} descargas)`;
    }
  });
  topCountryEl.textContent = topC;

  if (logs.length === 0) {
    logsContainer.innerHTML = '<p class="text-sm text-slate-500 py-4 text-center">Aún no hay descargas registradas.</p>';
    return;
  }

  // Limitar únicamente la lista de registros renderizados en HTML a los 100 más recientes
  const recentLogs = logs.slice(0, 100);

  logsContainer.innerHTML = recentLogs.map(log => `
    <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
      <div class="min-w-0">
        <h4 class="font-bold text-slate-100 truncate">${log.gameTitle}</h4>
        <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
          ${log.countryFlag && log.countryFlag.startsWith('http') ? `<img src="${log.countryFlag}" class="w-4 h-3 rounded shadow-sm inline">` : '🌐'}
          <span class="font-semibold text-slate-300">${log.country}</span>
        </p>
      </div>
      <span class="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 font-bold text-xs rounded-xl whitespace-nowrap">
        ${log.timeFormatted} (${log.dateFormatted})
      </span>
    </div>
  `).join('');
}
