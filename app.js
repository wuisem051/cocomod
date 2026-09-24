/**
 * Telegram Mini App - APK Store & Monetag Integration + Admin Panel + Firebase Firestore
 */

// State Application
let games = [];
let activeCategory = 'Todos';
let searchQuery = '';
let currentTimer = null;
let currentGameForDownload = null;
let db = null;

// Configuración de Paso Intermedio (Publicidad / Desbloqueo y Enlace Final)
let stepConfig = {
  stepUrl: 'https://downyattainprojects.com/tvhen99v?key=eee65b92d7f3cff145392cb279dda8c5',
  finalDownloadUrl: '',
  stepImageUrl: ''
};
let stepCountdownTimer = null;

// Configuración de Admin Password & Monetag
const ADMIN_PASSWORD = "admin";

// ----------------------------------------------------
// CONFIGURACIÓN DE FIREBASE (Proyecto: cooapk-2cd82)
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDDyvPywg4F64A7NpsVwiqOCBRLwLFyraw",
  authDomain: "cooapk-2cd82.firebaseapp.com",
  projectId: "cooapk-2cd82",
  storageBucket: "cooapk-2cd82.firebasestorage.app",
  messagingSenderId: "561236943097",
  appId: "1:561236943097:web:8d70652e7a07b86c814228",
  measurementId: "G-NE6BDMNN6Z"
};

// Inicializar Firebase Firestore
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase Firestore conectado exitosamente");
  } catch (e) {
    console.warn("Error al inicializar Firebase:", e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTelegramSDK();
  loadGames();
  loadAppConfigFromFirestore();
  setupEventListeners();
  setupAdminListeners();
  setupStepListeners();

  // Auto-recargar el catálogo cada 15 segundos para sincronizar cambios
  setInterval(() => {
    loadGames();
  }, 15000);
});

/**
 * Cargar configuraciones de Marca y Pasos de Desbloqueo desde Firebase en tiempo real
 */
function loadAppConfigFromFirestore() {
  if (!db) return;

  // Escuchar ajustes de encabezado
  try {
    db.collection("settings").doc("header").onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        const titleEl = document.getElementById('appHeaderTitle');
        const subtitleEl = document.getElementById('appHeaderSubtitle');
        if (titleEl && data.title) titleEl.textContent = data.title;
        if (subtitleEl && data.subtitle) subtitleEl.textContent = data.subtitle;
      }
    }, err => console.warn("Error leyendo header settings:", err));
  } catch(e) {}

  // Escuchar ajustes del paso de desbloqueo y enlace final
  try {
    db.collection("settings").doc("stepConfig").onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.stepUrl) stepConfig.stepUrl = data.stepUrl;
        stepConfig.finalDownloadUrl = data.finalDownloadUrl || '';
        stepConfig.stepImageUrl = data.stepImageUrl || '';
      }
    }, err => console.warn("Error leyendo stepConfig settings:", err));
  } catch(e) {}
}

/**
 * 1. Inicialización de Telegram WebApp SDK
 */
function initTelegramSDK() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.ready();
    document.documentElement.classList.add('dark');
    if (tg.setHeaderColor) {
      tg.setHeaderColor('#0f172a');
    }
    if (tg.BackButton) {
      tg.BackButton.onClick(() => handleBackNavigation());
    }
  }
}

/**
 * 2. Cargar Juegos (Sincronización en tiempo real con Firebase Firestore o games.json)
 */
async function loadGames() {
  if (db) {
    db.collection("games").get().then(async (snapshot) => {
      const fbGames = [];
      snapshot.forEach((doc) => {
        fbGames.push({ docId: doc.id, ...doc.data() });
      });

      let baseJsonGames = [];
      try {
        const res = await fetch('./games.json?v=' + Date.now());
        if (res.ok) baseJsonGames = await res.json();
      } catch(e) {}

      const map = new Map();
      if (Array.isArray(baseJsonGames)) {
        baseJsonGames.forEach(g => { if (g && (g.id || g.docId)) map.set(g.id || g.docId, g); });
      }
      if (Array.isArray(fbGames)) {
        fbGames.forEach(g => { if (g && (g.id || g.docId)) map.set(g.id || g.docId, g); });
      }

      games = Array.from(map.values());
      renderCategories();
      renderGames();
    }).catch((error) => {
      console.warn("Error leyendo Firestore:", error);
      fetchLocalJsonGames();
    });
  } else {
    fetchLocalJsonGames();
  }
}

async function fetchLocalJsonGames() {
  try {
    const response = await fetch('./games.json?t=' + Date.now());
    if (response.ok) {
      games = await response.json();
    }
  } catch (error) {
    console.warn('Error al cargar games.json:', error);
  }

  renderCategories();
  renderGames();
}

/**
 * 3. Renderizado de Categorías Solicitadas: Todos, Nuevo, Apps, Games, Sin internet
 */
function renderCategories() {
  const container = document.getElementById('categoryContainer');
  const customCategories = ['Todos', 'Nuevo', 'Apps', 'Games', 'Sin internet', '32 Bits', '64 Bits'];

  container.innerHTML = customCategories.map(cat => `
    <button 
      class="category-btn whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
        cat === activeCategory 
          ? 'bg-green-500 text-slate-950 shadow-md shadow-green-500/20' 
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
      }"
      data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  container.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeCategory = e.currentTarget.getAttribute('data-category');
      renderCategories();
      renderGames();
      updateBackNavigationVisibility();
    });
  });
}

/**
 * 4. Renderizado Dinámico del Grid de Juegos (Con Sistema de Estrellas)
 */
function renderGames() {
  const grid = document.getElementById('gamesGrid');
  const noResults = document.getElementById('noResults');
  const gameCount = document.getElementById('gameCount');

  const filtered = games.filter(game => {
    let matchesCategory = false;
    const cat = activeCategory.toLowerCase();
    const gameCat = (game.category || '').toLowerCase();

    if (activeCategory === 'Todos') {
      matchesCategory = true;
    } else if (cat === 'nuevo') {
      matchesCategory = gameCat.includes('nuevo') || gameCat.includes('mod') || game.isNew === true;
    } else if (cat === 'apps') {
      matchesCategory = gameCat.includes('app') || gameCat.includes('aplicacion');
    } else if (cat === 'games') {
      matchesCategory = gameCat.includes('game') || gameCat.includes('juego') || gameCat.includes('rpg') || gameCat.includes('acción') || gameCat.includes('accion');
    } else if (cat === 'sin internet') {
      matchesCategory = gameCat.includes('offline') || gameCat.includes('sin internet');
    } else if (cat === '32 bits') {
      matchesCategory = gameCat.includes('32 bits') || gameCat.includes('32bit') || gameCat.includes('32-bit') || gameCat === '32 bits';
    } else if (cat === '64 bits') {
      matchesCategory = gameCat.includes('64 bits') || gameCat.includes('64bit') || gameCat.includes('64-bit') || gameCat === '64 bits';
    } else {
      matchesCategory = gameCat === cat;
    }

    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          gameCat.includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  gameCount.textContent = `${filtered.length} Juego${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noResults.classList.remove('hidden');
    return;
  }

  noResults.classList.add('hidden');
  grid.innerHTML = filtered.map(game => `
    <div class="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-all shadow-sm">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${game.icon}" alt="${game.title}" class="w-14 h-14 rounded-2xl object-cover border border-slate-800 flex-shrink-0 shadow-md">
        <div class="min-w-0">
          <h4 class="font-bold text-sm text-slate-100 truncate">${game.title}</h4>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md">${game.category}</span>
            <span class="text-xs text-amber-400 font-bold flex items-center gap-1">
              <i class="fa-solid fa-star text-[10px]"></i> ${game.rating || '5.0'}
            </span>
            <span class="text-xs text-slate-400 font-medium">${game.size}</span>
          </div>
        </div>
      </div>
      <button 
        onclick="openDownloadModal(${game.id})"
        class="flex-shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-green-500 text-green-400 hover:text-slate-950 font-extrabold text-xs rounded-xl border border-slate-700 hover:border-green-500 transition-all flex items-center gap-1.5 shadow-sm">
        <i class="fa-solid fa-download"></i> APK
      </button>
    </div>
  `).join('');
}

/**
 * 5. Event Listeners Generales
 */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderGames();
    updateBackNavigationVisibility();
  });

  document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
  document.getElementById('headerBackBtn')?.addEventListener('click', handleBackNavigation);
  document.getElementById('minimizeAppBtn')?.addEventListener('click', minimizeOrCloseApp);

  const floatingBackBtn = document.getElementById('floatingBackBtn');
  floatingBackBtn?.addEventListener('click', () => {
    if ((activeCategory && activeCategory !== 'Todos') || (searchQuery && searchQuery.trim() !== '')) {
      handleBackNavigation();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', () => {
    if (floatingBackBtn) {
      if (window.scrollY > 150) {
        floatingBackBtn.classList.remove('hidden');
        floatingBackBtn.classList.add('flex');
      } else {
        floatingBackBtn.classList.add('hidden');
        floatingBackBtn.classList.remove('flex');
      }
    }
  });

  const downloadModal = document.getElementById('downloadModal');
  downloadModal?.addEventListener('click', (e) => {
    if (e.target === downloadModal) closeModal();
  });

  document.getElementById('downloadBtn')?.addEventListener('click', executeMonetagAndDownload);
}

/**
 * 6. Modal de Descarga con Temporizador
 */
function openDownloadModal(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;

  currentGameForDownload = game;

  // Llenar datos en el modal
  document.getElementById('modalTitle').textContent = game.title;
  document.getElementById('modalIcon').src = game.icon;
  document.getElementById('modalCategory').textContent = game.category;
  document.getElementById('modalSize').innerHTML = `<i class="fa-solid fa-hard-drive mr-1"></i>${game.size}`;
  document.getElementById('modalVersion').innerHTML = `<i class="fa-solid fa-code-branch mr-1"></i>${game.version}`;
  document.getElementById('modalReq').textContent = game.androidReq || 'Android 5.0+';
  document.getElementById('modalDesc').textContent = game.description;

  document.getElementById('timerSection').classList.remove('hidden');
  document.getElementById('downloadActionSection').classList.add('hidden');

  const downloadModal = document.getElementById('downloadModal');
  const modalContainer = document.getElementById('modalContainer');
  
  // Abrir modal
  downloadModal.classList.remove('opacity-0', 'pointer-events-none');
  modalContainer.classList.remove('translate-y-full');
  updateBackNavigationVisibility();

  startTimer(7);
}

function closeModal() {
  if (currentTimer) clearInterval(currentTimer);
  const downloadModal = document.getElementById('downloadModal');
  const modalContainer = document.getElementById('modalContainer');
  modalContainer.classList.add('translate-y-full');
  downloadModal.classList.add('opacity-0', 'pointer-events-none');
  updateBackNavigationVisibility();
}

function startTimer(seconds) {
  let timeLeft = seconds;
  const timerText = document.getElementById('timerText');
  const timerProgress = document.getElementById('timerProgress');
  const fullDash = 175.9;

  if (currentTimer) clearInterval(currentTimer);

  timerText.textContent = timeLeft;
  timerProgress.style.strokeDashoffset = '0';

  currentTimer = setInterval(() => {
    timeLeft--;
    timerText.textContent = timeLeft;
    
    const offset = fullDash - (timeLeft / seconds) * fullDash;
    timerProgress.style.strokeDashoffset = offset;

    if (timeLeft <= 0) {
      clearInterval(currentTimer);
      document.getElementById('timerSection').classList.add('hidden');
      document.getElementById('downloadActionSection').classList.remove('hidden');

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    }
  }, 1000);
}

/**
 * 7. Paso Intermedio de Publicidad antes de la Descarga Final
 */
function executeMonetagAndDownload() {
  const proceed = () => {
    closeModal();
    openStepModal();
  };

  if (typeof show_11875578 === 'function') {
    show_11875578().then(proceed).catch(proceed);
  } else {
    proceed();
  }
}

function openStepModal() {
  const stepModal = document.getElementById('stepModal');
  const stepModalContainer = document.getElementById('stepModalContainer');
  const stepFinalDownloadBtn = document.getElementById('stepFinalDownloadBtn');
  const stepCountdownBox = document.getElementById('stepCountdownBox');
  const stepTutorialImage = document.getElementById('stepTutorialImage');
  const stepDefaultGuide = document.getElementById('stepDefaultGuide');

  if (!stepModal) return;

  // Resetear temporizador y estado
  if (stepCountdownTimer) clearInterval(stepCountdownTimer);
  stepCountdownBox?.classList.add('hidden');
  
  if (stepFinalDownloadBtn) {
    stepFinalDownloadBtn.disabled = true;
    stepFinalDownloadBtn.className = "w-full py-3.5 px-4 bg-slate-800 text-slate-500 font-extrabold text-sm rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-not-allowed";
    stepFinalDownloadBtn.innerHTML = '<i class="fa-solid fa-lock"></i> 2️⃣ Descargar APK Ahora (Bloqueado)';
  }

  // Cargar imagen instructiva o guía por defecto
  if (stepConfig.stepImageUrl && stepTutorialImage) {
    stepTutorialImage.src = stepConfig.stepImageUrl;
    stepTutorialImage.classList.remove('hidden');
    if (stepDefaultGuide) stepDefaultGuide.classList.add('hidden');
  } else {
    if (stepTutorialImage) stepTutorialImage.classList.add('hidden');
    if (stepDefaultGuide) stepDefaultGuide.classList.remove('hidden');
  }

  // Mostrar modal
  stepModal.classList.remove('opacity-0', 'pointer-events-none');
  stepModalContainer?.classList.remove('translate-y-full');
  updateBackNavigationVisibility();
}

function closeStepModal() {
  if (stepCountdownTimer) clearInterval(stepCountdownTimer);
  const stepModal = document.getElementById('stepModal');
  const stepModalContainer = document.getElementById('stepModalContainer');
  if (stepModalContainer) stepModalContainer.classList.add('translate-y-full');
  if (stepModal) stepModal.classList.add('opacity-0', 'pointer-events-none');
  updateBackNavigationVisibility();
}

function setupStepListeners() {
  const closeStepModalBtn = document.getElementById('closeStepModalBtn');
  const stepModal = document.getElementById('stepModal');
  const stepGoToPageBtn = document.getElementById('stepGoToPageBtn');
  const stepFinalDownloadBtn = document.getElementById('stepFinalDownloadBtn');

  closeStepModalBtn?.addEventListener('click', closeStepModal);
  stepModal?.addEventListener('click', (e) => {
    if (e.target === stepModal) closeStepModal();
  });

  stepGoToPageBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = stepConfig.stepUrl || 'https://downyattainprojects.com/tvhen99v?key=eee65b92d7f3cff145392cb279dda8c5';
    
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }

    startStepCountdown(4);
  });

  stepFinalDownloadBtn?.addEventListener('click', () => {
    if (stepFinalDownloadBtn.disabled) return;
    if (currentGameForDownload) {
      trackDownload(currentGameForDownload);
    }
    closeStepModal();
    openDownloadLink();
  });
}

function startStepCountdown(seconds) {
  const stepCountdownBox = document.getElementById('stepCountdownBox');
  const stepTimerCount = document.getElementById('stepTimerCount');
  const stepFinalDownloadBtn = document.getElementById('stepFinalDownloadBtn');
  
  if (stepCountdownTimer) clearInterval(stepCountdownTimer);
  stepCountdownBox?.classList.remove('hidden');

  let timeLeft = seconds;
  if (stepTimerCount) stepTimerCount.textContent = timeLeft;

  stepCountdownTimer = setInterval(() => {
    timeLeft--;
    if (stepTimerCount) stepTimerCount.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(stepCountdownTimer);
      stepCountdownBox?.classList.add('hidden');

      if (stepFinalDownloadBtn) {
        stepFinalDownloadBtn.disabled = false;
        stepFinalDownloadBtn.className = "w-full py-3.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer animate-bounce";
        stepFinalDownloadBtn.innerHTML = '<i class="fa-solid fa-circle-check text-base"></i> 2️⃣ 🔓 ¡Descargar APK Desbloqueada Ahora!';
      }

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    }
  }, 1000);
}

/**
 * 8. Registrar Descarga en Analíticas de Firebase
 */
async function trackDownload(game) {
  if (!game || !db) return;

  const now = new Date();
  const downloadLog = {
    gameId: game.id || Date.now(),
    gameTitle: game.title || "Juego APK",
    country: "Desconocido",
    countryFlag: "🌐",
    timestamp: now.toISOString(),
    timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateFormatted: now.toLocaleDateString()
  };

  try {
    // 1. Guardar de INMEDIATO en Firestore sin bloquear la navegación
    const docRef = await db.collection("downloads").add(downloadLog);

    // 2. Intentar obtener el país de fondo sin bloquear el hilo principal (timeout 1.5s)
    fetchGeoCountryWithTimeout(1500).then(geo => {
      if (geo && geo.country && docRef) {
        docRef.update({
          country: geo.country,
          countryFlag: geo.countryFlag
        }).catch(() => {});
      }
    }).catch(() => {});

  } catch (err) {
    console.warn("Error guardando analítica de descarga:", err);
  }
}

async function fetchGeoCountryWithTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const country = data.country_name || "Desconocido";
      const flag = data.country_code ? `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png` : "🌐";
      return { country, countryFlag: flag };
    }
  } catch (e) {
    try {
      const res2 = await fetch('https://ip-api.com/json/?fields=country,countryCode', { signal: AbortSignal.timeout(1000) });
      if (res2.ok) {
        const data2 = await res2.json();
        const country = data2.country || "Desconocido";
        const flag = data2.countryCode ? `https://flagcdn.com/24x18/${data2.countryCode.toLowerCase()}.png` : "🌐";
        return { country, countryFlag: flag };
      }
    } catch(e2) {}
  }
  return null;
}

/**
 * Sistema de Control de Navegación (Atrás, Minimizado/Cierre de Mini App)
 */
function updateBackNavigationVisibility() {
  const headerBackBtn = document.getElementById('headerBackBtn');
  const stepModal = document.getElementById('stepModal');
  const downloadModal = document.getElementById('downloadModal');
  const adminPanelModal = document.getElementById('adminPanelModal');

  const isModalOpen = (stepModal && !stepModal.classList.contains('opacity-0')) ||
                      (downloadModal && !downloadModal.classList.contains('opacity-0')) ||
                      (adminPanelModal && !adminPanelModal.classList.contains('opacity-0'));

  const isFiltered = (activeCategory && activeCategory !== 'Todos') || (searchQuery && searchQuery.trim() !== '');

  const showBack = isModalOpen || isFiltered;

  if (headerBackBtn) {
    if (showBack) {
      headerBackBtn.classList.remove('hidden');
      headerBackBtn.classList.add('flex');
    } else {
      headerBackBtn.classList.add('hidden');
      headerBackBtn.classList.remove('flex');
    }
  }

  // Integración con el botón de atrás nativo de Telegram WebApp
  if (window.Telegram?.WebApp?.BackButton) {
    if (showBack) {
      window.Telegram.WebApp.BackButton.show();
    } else {
      window.Telegram.WebApp.BackButton.hide();
    }
  }
}

function handleBackNavigation() {
  const stepModal = document.getElementById('stepModal');
  const downloadModal = document.getElementById('downloadModal');
  const adminPanelModal = document.getElementById('adminPanelModal');

  if (stepModal && !stepModal.classList.contains('opacity-0')) {
    closeStepModal();
    return;
  }
  if (downloadModal && !downloadModal.classList.contains('opacity-0')) {
    closeModal();
    return;
  }
  if (adminPanelModal && !adminPanelModal.classList.contains('opacity-0')) {
    adminPanelModal.classList.add('opacity-0', 'pointer-events-none');
    updateBackNavigationVisibility();
    return;
  }

  // Si hay filtros o búsqueda activa, volver al catálogo principal "Todos"
  if ((activeCategory && activeCategory !== 'Todos') || (searchQuery && searchQuery.trim() !== '')) {
    activeCategory = 'Todos';
    searchQuery = '';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    renderCategories();
    renderGames();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateBackNavigationVisibility();
}

function minimizeOrCloseApp() {
  if (window.Telegram?.WebApp?.close) {
    window.Telegram.WebApp.close();
  } else {
    // Si se prueba fuera de Telegram (navegador estándar)
    handleBackNavigation();
  }
}

function openDownloadLink() {
  // Usar el enlace administrado del último paso si está configurado, o el del juego como alternativa
  const url = stepConfig.finalDownloadUrl || (currentGameForDownload ? currentGameForDownload.downloadUrl : null);

  if (url) {
    if (currentGameForDownload) {
      trackDownload(currentGameForDownload);
    }

    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
  closeModal();
}

/**
 * 9. PANEL DE ADMINISTRACIÓN (Tabs, Ajustes, Analytics y CRUD)
 */
function setupAdminListeners() {
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminAuthModal = document.getElementById('adminAuthModal');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const adminAuthForm = document.getElementById('adminAuthForm');
  const adminPassInput = document.getElementById('adminPassInput');
  const authErrorMsg = document.getElementById('authErrorMsg');

  const adminPanelModal = document.getElementById('adminPanelModal');
  const closeAdminPanelBtn = document.getElementById('closeAdminPanelBtn');

  // URL Query Param Admin Check
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === 'true') {
    adminLoginBtn?.classList.remove('hidden');
  }

  // Cargar Ajustes de Header Guardados
  loadAppSettings();

  // Tabs del Admin
  const tabGamesBtn = document.getElementById('tabGamesBtn');
  const tabSettingsBtn = document.getElementById('tabSettingsBtn');
  const tabAnalyticsBtn = document.getElementById('tabAnalyticsBtn');

  const adminSectionGames = document.getElementById('adminSectionGames');
  const adminSectionSettings = document.getElementById('adminSectionSettings');
  const adminSectionAnalytics = document.getElementById('adminSectionAnalytics');

  tabGamesBtn?.addEventListener('click', () => {
    switchTab(tabGamesBtn, adminSectionGames);
  });
  tabSettingsBtn?.addEventListener('click', () => {
    switchTab(tabSettingsBtn, adminSectionSettings);
  });
  tabAnalyticsBtn?.addEventListener('click', () => {
    switchTab(tabAnalyticsBtn, adminSectionAnalytics);
    loadAnalyticsData();
  });

  function switchTab(activeBtn, activeSection) {
    [tabGamesBtn, tabSettingsBtn, tabAnalyticsBtn].forEach(b => {
      b?.classList.remove('text-green-400', 'border-b-2', 'border-green-500');
      b?.classList.add('text-slate-400');
    });
    [adminSectionGames, adminSectionSettings, adminSectionAnalytics].forEach(s => s?.classList.add('hidden'));

    activeBtn?.classList.add('text-green-400', 'border-b-2', 'border-green-500');
    activeBtn?.classList.remove('text-slate-400');
    activeSection?.classList.remove('hidden');
  }

  // Formulario Ajustes App
  document.getElementById('appSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleVal = document.getElementById('settingTitle').value.trim();
    const subVal = document.getElementById('settingSubtitle').value.trim();

    if (titleVal) document.getElementById('appHeaderTitle').textContent = titleVal;
    if (subVal) document.getElementById('appHeaderSubtitle').textContent = subVal;

    if (db) {
      await db.collection("settings").doc("header").set({ title: titleVal, subtitle: subVal });
    }
    alert("¡Ajustes de encabezado guardados!");
  });

  // Login
  adminLoginBtn?.addEventListener('click', () => {
    adminPassInput.value = '';
    authErrorMsg.classList.add('hidden');
    adminAuthModal.classList.remove('opacity-0', 'pointer-events-none');
  });

  closeAuthModalBtn?.addEventListener('click', () => {
    adminAuthModal.classList.add('opacity-0', 'pointer-events-none');
  });

  adminAuthForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (adminPassInput.value === ADMIN_PASSWORD) {
      adminAuthModal.classList.add('opacity-0', 'pointer-events-none');
      openAdminPanel();
    } else {
      authErrorMsg.classList.remove('hidden');
    }
  });

  closeAdminPanelBtn?.addEventListener('click', () => {
    adminPanelModal.classList.add('opacity-0', 'pointer-events-none');
  });

  document.getElementById('gameForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveGameFromForm();
  });

  document.getElementById('resetFormBtn')?.addEventListener('click', resetGameForm);
}

async function loadAppSettings() {
  if (db) {
    try {
      const doc = await db.collection("settings").doc("header").get();
      if (doc.exists) {
        const data = doc.data();
        if (data.title) {
          document.getElementById('appHeaderTitle').textContent = data.title;
          document.getElementById('settingTitle').value = data.title;
        }
        if (data.subtitle) {
          document.getElementById('appHeaderSubtitle').textContent = data.subtitle;
          document.getElementById('settingSubtitle').value = data.subtitle;
        }
      }

      const stepDoc = await db.collection("settings").doc("stepConfig").get();
      if (stepDoc.exists) {
        const stepData = stepDoc.data();
        if (stepData.stepUrl) stepConfig.stepUrl = stepData.stepUrl;
        stepConfig.finalDownloadUrl = stepData.finalDownloadUrl || '';
        if (stepData.stepImageUrl) stepConfig.stepImageUrl = stepData.stepImageUrl;
      }
    } catch (e) {
      console.warn("Error cargando ajustes del header y paso:", e);
    }
  }
}

async function loadAnalyticsData() {
  const logList = document.getElementById('analyticsLogList');
  const totalCountEl = document.getElementById('totalDownloadsCount');
  const topCountryEl = document.getElementById('topCountryStat');

  if (!db) {
    logList.innerHTML = '<p class="text-slate-500">Conecta Firebase para ver analíticas en vivo.</p>';
    return;
  }

  try {
    const snapshot = await db.collection("downloads").orderBy("timestamp", "desc").limit(50).get();
    const logs = [];
    const countryCounts = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push(data);
      countryCounts[data.country] = (countryCounts[data.country] || 0) + 1;
    });

    totalCountEl.textContent = logs.length;

    // Calcular país top
    let topCountry = "-";
    let maxCount = 0;
    Object.keys(countryCounts).forEach(c => {
      if (countryCounts[c] > maxCount) {
        maxCount = countryCounts[c];
        topCountry = `${c} (${maxCount})`;
      }
    });
    topCountryEl.textContent = topCountry;

    if (logs.length === 0) {
      logList.innerHTML = '<p class="text-slate-500">Aún no se han registrado descargas.</p>';
      return;
    }

    logList.innerHTML = logs.map(l => `
      <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="font-bold text-slate-200 truncate">${l.gameTitle}</p>
          <p class="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            ${l.countryFlag && l.countryFlag.startsWith('http') ? `<img src="${l.countryFlag}" class="w-4 h-3 inline">` : '🌐'} ${l.country}
          </p>
        </div>
        <span class="text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">
          ${l.timeFormatted} - ${l.dateFormatted}
        </span>
      </div>
    `).join('');
  } catch (e) {
    console.warn("Error al cargar analíticas:", e);
    logList.innerHTML = '<p class="text-red-400">Error al cargar historial de analíticas.</p>';
  }
}

function openAdminPanel() {
  const adminPanelModal = document.getElementById('adminPanelModal');
  resetGameForm();
  renderAdminGamesList();
  adminPanelModal.classList.remove('opacity-0', 'pointer-events-none');
}

function resetGameForm() {
  document.getElementById('formGameId').value = '';
  document.getElementById('formTitle').value = '';
  document.getElementById('formCategory').value = '';
  document.getElementById('formSize').value = '';
  document.getElementById('formVersion').value = '';
  document.getElementById('formReq').value = 'Android 5.0+';
  document.getElementById('formIcon').value = '';
  document.getElementById('formDownloadUrl').value = '';
  document.getElementById('formDesc').value = '';
  document.getElementById('saveGameBtn').textContent = 'Guardar Juego';
}

async function saveGameFromForm() {
  const docIdVal = document.getElementById('formGameId').value;
  const gameData = {
    id: docIdVal ? parseInt(docIdVal) : Date.now(),
    title: document.getElementById('formTitle').value.trim(),
    category: document.getElementById('formCategory').value.trim(),
    size: document.getElementById('formSize').value.trim(),
    version: document.getElementById('formVersion').value.trim(),
    rating: document.getElementById('formRating').value || '5.0',
    androidReq: document.getElementById('formReq').value.trim() || 'Android 5.0+',
    icon: document.getElementById('formIcon').value.trim(),
    downloadUrl: document.getElementById('formDownloadUrl').value.trim(),
    description: document.getElementById('formDesc').value.trim(),
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      if (docIdVal) {
        const existingGame = games.find(g => g.id === parseInt(docIdVal) || g.docId === docIdVal);
        if (existingGame && existingGame.docId) {
          await db.collection("games").doc(existingGame.docId).update(gameData);
        } else {
          await db.collection("games").add(gameData);
        }
      } else {
        await db.collection("games").add(gameData);
      }
      alert('¡Juego guardado en Firebase exitosamente!');
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      alert("Error al guardar en Firebase: " + err.message);
    }
  } else {
    if (docIdVal) {
      const index = games.findIndex(g => g.id === parseInt(docIdVal));
      if (index !== -1) games[index] = gameData;
    } else {
      games.unshift(gameData);
    }
    renderCategories();
    renderGames();
    renderAdminGamesList();
    alert('¡Juego guardado localmente!');
  }

  resetGameForm();
}

function editGame(gameId) {
  const game = games.find(g => g.id === gameId);
  if (!game) return;

  document.getElementById('formGameId').value = game.id;
  document.getElementById('formTitle').value = game.title;
  document.getElementById('formCategory').value = game.category;
  document.getElementById('formSize').value = game.size;
  document.getElementById('formVersion').value = game.version;
  document.getElementById('formRating').value = game.rating || '5.0';
  document.getElementById('formReq').value = game.androidReq || 'Android 5.0+';
  document.getElementById('formIcon').value = game.icon;
  document.getElementById('formDownloadUrl').value = game.downloadUrl;
  document.getElementById('formDesc').value = game.description;

  document.getElementById('saveGameBtn').textContent = 'Actualizar Juego';
}

async function deleteGame(gameId) {
  if (confirm('¿Estás seguro de que deseas eliminar este juego del catálogo?')) {
    if (db) {
      const targetGame = games.find(g => g.id === gameId || g.docId === gameId);
      if (targetGame && targetGame.docId) {
        try {
          await db.collection("games").doc(targetGame.docId).delete();
          alert('Juego eliminado de Firebase');
        } catch (e) {
          console.error("Error al eliminar de Firebase:", e);
        }
      }
    } else {
      games = games.filter(g => g.id !== gameId);
      renderCategories();
      renderGames();
      renderAdminGamesList();
    }
  }
}

function renderAdminGamesList() {
  const container = document.getElementById('adminGamesList');
  if (games.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500">No hay juegos en la lista.</p>';
    return;
  }

  container.innerHTML = games.map(game => `
    <div class="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs">
      <div class="flex items-center gap-2 min-w-0">
        <img src="${game.icon}" class="w-8 h-8 rounded-lg object-cover">
        <span class="font-bold text-slate-200 truncate">${game.title}</span>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="editGame(${game.id})" class="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteGame(${game.id})" class="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
