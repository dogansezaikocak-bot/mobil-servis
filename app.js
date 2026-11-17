const STORAGE_KEY = "ekzen-servis-takip-v1";
const COUNTER_SETTINGS_LOCAL_KEY = "ekzen-counter-settings-v1";
function loadLocalCounterSettings() {
  try {
    const saved=JSON.parse(localStorage.getItem(COUNTER_SETTINGS_LOCAL_KEY)||"null");
    return saved && typeof saved==="object" ? saved : null;
  } catch (_) { return null; }
}
function persistLocalCounterSettings() {
  try {
    localStorage.setItem(COUNTER_SETTINGS_LOCAL_KEY,JSON.stringify({
      cashSlotSettings:state.settings.cashSlotSettings||[],
      customCashCounters:state.settings.customCashCounters||[],
      savedAt:new Date().toISOString()
    }));
    return true;
  } catch (_) { return false; }
}
function restoreLocalCounterSettings() {
  const saved=loadLocalCounterSettings();
  if(!saved||!state?.settings)return;
  if(Array.isArray(saved.cashSlotSettings))state.settings.cashSlotSettings=saved.cashSlotSettings;
  if(Array.isArray(saved.customCashCounters))state.settings.customCashCounters=saved.customCashCounters;
}

const CLOUD_STATE_PATH = "servis_takip_v2/state";
const AUTH_EMAIL = "ekzen-giris@ekzen-teknik.app";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyArRO3GilYemYHX8sJdzNqv-uG7V6LsskQ",
  authDomain: "ekzen-teknik.firebaseapp.com",
  databaseURL: "https://ekzen-teknik-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ekzen-teknik",
  storageBucket: "ekzen-teknik.firebasestorage.app",
  messagingSenderId: "199852526862",
  appId: "1:199852526862:web:5b2efb44f0a26ca76f5b5f",
};

const brands = ["Alarko", "Altus", "Arçelik", "Ariston", "Beko", "Bosch", "Demirdöküm", "Lg", "Miele", "Profilo", "Protherm", "Regal", "Samsung", "Seg", "Siemens", "Vaillant", "Vestel"];
const devices = ["Aspiratör", "Bulaşık Makinası", "Buzdolabı", "Çamaşır Makinası", "Davlumbaz", "Derin Dondurucu", "Fırın", "Kazan", "Klima", "Kombi", "Kurutma Makinası", "Mikrodalga", "Ocak", "Su Sebili", "Süpürge", "Şofben", "Televizyon", "Termosifon", "Vrf"];
const statuses = ["Yeni Kayıt", "İşlemde", "Ödeme Bekliyor", "İşlem Tamam", "Geri Dönen İş", "İptal", "Atölyede Tamir Ediliyor", "Atölyeye Aldır (Nakliye Gönder)", "Atölyeye Alındı", "Beklemede", "Cihaz Tamir Edilemiyor", "Cihaz Teslim Edildi", "Farklı Teknisyen Yönlendirildi", "Fiyatta Anlaşılamadı", "Haber Verecek", "Hesap Kapatıldı", "Müşteri Cihazı Atölyeye Getirdi", "Müşteri İptal Etti", "Müşteriye Ulaşılamadı", "Nakliyede", "Parça Bekleniyor", "Parçası Atölyeye Alındı", "Servis Sonlandırıldı", "Teknisyen Yönlendirildi", "Teslimata Hazır (Tamamlandı)", "Ürün Garantili Çıktı", "Yerinde Bakım Yapıldı"];
const sources = ["Korkmaz Teknik", "Sedef Teknik", "Kendi İşim", "Diğer", "İnternet Reklamı", "İsa Tuncay", "Servis Pazarı"];
const cities = ["Ankara", "İstanbul", "Adana", "Antalya", "Bursa", "İzmir", "Kocaeli", "Konya", "Samsun"];
const dashboardCounters = ["Bugün", "Yarın", "Açık Fişler", "Ödeme Bekliyor", "İşlemde", "Yeni Kayıt", "İşlem Tamam", "Geri Dönen İş", "Toplam Servis"];
const cashCounters = [
  { key: "income", label: "Toplam Gelir" },
  { key: "expense", label: "Yapılan Ödeme" },
  { key: "commission", label: "Komisyon" },
  { key: "material", label: "Malzeme" },
  { key: "balance", label: "Kalan Ödeme" },
];
const defaultSettings = { brands, devices, statuses, sources, cities, dashboardCounters, cashCounters };
const settingsLabels = {
  sources: "Servis Kaynakları",
  statuses: "Servis Durumları",
  dashboardCounters: "Ana Sayfa Sayaçları",
  cashCounters: "Kasa Sayaçları",
  brands: "Markalar",
  devices: "Cihaz Türleri",
  cities: "İller",
};

const today = new Date();
const isoToday = toIsoDate(today);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const sourcePortalParam = new URLSearchParams(window.location.search).get("kaynak")?.trim() || "";

let state = migrateState(loadState());
let currentView = "dashboard";
let activeDetailId = null;
let activeDashboardStat = "";
let activeDashboardSource = "";
let cashListMode = "service";
let cloudRef = null;
let cloudReady = false;
let cloudApplyingState = false;
let lastLocalCloudWriteAt = "";
let cloudInitialHandled = false;
let cloudWriteBlocked = false;
let cloudSyncStarted = false;
let cloudSyncStarting = false;
let cloudSeedQueued = false;
let cloudListenGeneration = 0;
let authEpoch = 0;

const views = {
  dashboard: document.querySelector("#dashboardView"),
  services: document.querySelector("#servicesView"),
  customers: document.querySelector("#customersView"),
  sources: document.querySelector("#sourcesView"),
  cash: document.querySelector("#cashView"),
  ekzenCash: document.querySelector("#ekzenCashView"),
  settings: document.querySelector("#settingsView"),
};

const filterForm = document.querySelector("#filterForm");
const serviceForm = document.querySelector("#serviceForm");
const serviceDialog = document.querySelector("#serviceDialog");
const detailDialog = document.querySelector("#detailDialog");
const detailBody = document.querySelector("#detailBody");
const cashForm = document.querySelector("#cashForm");
const cashDialog = document.querySelector("#cashDialog");
const completeForm = document.querySelector("#completeForm");
const completeDialog = document.querySelector("#completeDialog");
const statusForm = document.querySelector("#statusForm");
const statusDialog = document.querySelector("#statusDialog");
const noteForm = document.querySelector("#noteForm");
const noteDialog = document.querySelector("#noteDialog");
const sourceForm = document.querySelector("#sourceForm");
const sourceDialog = document.querySelector("#sourceDialog");
const photoForm = document.querySelector("#photoForm");
const photoDialog = document.querySelector("#photoDialog");
const sortSelect = document.querySelector("#sortSelect");
const topSourceFilter = document.querySelector("#topSourceFilter");
const topStatusFilter = document.querySelector("#topStatusFilter");
const cashSourceFilter = document.querySelector("#cashSourceFilter");
const cashStartDate = document.querySelector("#cashStartDate");
const cashEndDate = document.querySelector("#cashEndDate");
const dashboardStartDate = document.querySelector("#dashboardStartDate");
const dashboardEndDate = document.querySelector("#dashboardEndDate");
const dashboardDateRangeDialog = document.querySelector("#dashboardDateRangeDialog");
const dashboardDateRangeLabel = document.querySelector("#dashboardDateRangeLabel");
const dashboardRangeStartPicker = document.querySelector("#dashboardRangeStartPicker");
const dashboardRangeEndPicker = document.querySelector("#dashboardRangeEndPicker");
const dashboardDateRangePreview = document.querySelector("#dashboardDateRangePreview");
const backupFileInput = document.querySelector("#backupFileInput");

init();

function init() {
  bindEvents();
  startPinAuth();
}

function loadState() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.warn("Yerel kayıt okunamadı; bulut verisi bekleniyor.", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return {
    company: {
      companyName: "Ekzen Teknik",
      ownerName: "Doğan Sezai Koçak",
      phone: "",
      email: "",
      address: "Ankara",
    },
    settings: cloneSettings(defaultSettings),
    cash: [
      { id: uid(), date: isoToday, type: "income", title: "Servis tahsilatı", amount: 2500, serviceId: "" },
      { id: uid(), date: isoToday, type: "expense", title: "Parça alımı", amount: 900, serviceId: "" },
    ],
    services: [
      demoService(665160, "Müşteri A", "0500 000 0001", "Çankaya", "Örnek Mahalle 1/4", "Arçelik", "Çamaşır Makinası", "Sigorta attırıyor", "Teknisyen Yönlendirildi", isoToday, 1750),
      demoService(665152, "Müşteri B", "0500 000 0002", "Altındağ", "Örnek Cadde 38/9", "Demirdöküm", "Kombi", "Aden", "Yeni Kayıt", isoToday, 0),
      demoService(664983, "Müşteri C", "0500 000 0003", "Mamak", "Kurucu Sokak 22/13", "Demirdöküm", "Kombi", "F05 veriyor", "Hesap Kapatıldı", toIsoDate(yesterday), 2500),
    ],
  };
}

function migrateState(oldState) {
  const sourceNames = uniqueValues(oldState.settings?.sources || oldState.sources || sources)
    .filter((name) => !["Doğan Sezai Koçak", "İsa Abi"].includes(name));
  const currentCounters = uniqueValues(uniqueValues(oldState.settings?.dashboardCounters || dashboardCounters)
    .map((name) => isStatus(name, "İptal") ? "Toplam Servis" : name));
  const dashboardCountersVersion = Number(oldState.settings?.dashboardCountersVersion) || 0;
  // V5.3.11: Silinen kaynaklar ayrı listede tutulur; zorunlu/varsayılan kaynaklar onları geri eklemez.
  const hiddenSources = uniqueValues(Array.isArray(oldState.settings?.hiddenSources) ? oldState.settings.hiddenSources : Object.values(oldState.settings?.hiddenSources || {}));
  const migrated = {
    company: oldState.company || {},
    settings: {
      brands: uniqueValues(oldState.settings?.brands || brands),
      devices: uniqueValues(oldState.settings?.devices || devices),
      statuses: ensureValues(uniqueValues(oldState.settings?.statuses || statuses), ["Yeni Kayıt", "İşlemde", "Ödeme Bekliyor", "İşlem Tamam", "Geri Dönen İş", "İptal"]),
      dashboardCounters: dashboardCountersVersion < 3 ? ensureValues(currentCounters, ["Açık Fişler", "Toplam Servis"]) : currentCounters,
      dashboardCountersVersion: 3,
      dashboardCounterCopies: Array.isArray(oldState.settings?.dashboardCounterCopies) ? oldState.settings.dashboardCounterCopies.filter(c=>c && typeof c.name==="string" && typeof c.base==="string").slice(0,40) : [],
      hiddenDashboardCounters: Array.isArray(oldState.settings?.hiddenDashboardCounters) ? oldState.settings.hiddenDashboardCounters : [],
      cashCounters: normalizeCashCounters(oldState.settings?.cashCounters),
      customCashCounters: Array.isArray(oldState.settings?.customCashCounters) ? oldState.settings.customCashCounters.filter(x=>x && typeof x==="object").slice(0,30) : [],
      aiReportTemplates: Array.isArray(oldState.settings?.aiReportTemplates) ? oldState.settings.aiReportTemplates.filter(x => x && typeof x === "object" && typeof x.diagnosis === "string" && typeof x.work === "string").slice(0,300) : [],
      cashSlotSettings: Array.isArray(oldState.settings?.cashSlotSettings) ? oldState.settings.cashSlotSettings : [],
      mobileLayoutCustom: oldState.settings?.mobileLayoutCustom && typeof oldState.settings.mobileLayoutCustom==="object" ? oldState.settings.mobileLayoutCustom : {},
      homeLayout: {desktop:Array.isArray(oldState.settings?.homeLayout?.desktop)?oldState.settings.homeLayout.desktop:[],mobile:Array.isArray(oldState.settings?.homeLayout?.mobile)?oldState.settings.homeLayout.mobile:[]},
      sources: withoutHiddenSources(ensureValues(sourceNames.length ? sourceNames : [...sources], ["Korkmaz Teknik", "Sedef Teknik", "Kendi İşim"]), hiddenSources),
      hiddenSources,
      cities: uniqueValues(oldState.settings?.cities || cities),
      sourcePhones: { ...(oldState.settings?.sourcePhones || {}) },
      sourceCommissionRates: { ...(oldState.settings?.sourceCommissionRates || {}) },
      sourceSpecialSettings: oldState.settings?.sourceSpecialSettings && typeof oldState.settings.sourceSpecialSettings==="object" ? oldState.settings.sourceSpecialSettings : {},
    },
    cash: oldState.cash || [],
    services: oldState.services || [],
  };

  migrated.services = migrated.services.map((service, index) => ({
    ...service,
    status: service.status || "Yeni Kayıt",
    sortOrder: Number.isFinite(Number(service.sortOrder)) ? Number(service.sortOrder) : 0,
    technician: service.technician || "",
    notes: normalizeNotes(service.notes),
    photos: normalizePhotos(service.photos),
    statusHistory: normalizeStatusHistory(service),
    history: service.history || [],
  }));

  migrated.cash = migrated.cash.map((item) => ({
    ...item,
    id: item.id || uid(),
    serviceId: item.serviceId || "",
    source: item.source || "",
    materialCost: Number(item.materialCost) || 0,
    otherExpense: Number(item.otherExpense) || 0,
    commission50: Boolean(item.commission50),
    commissionRate: item.commissionRate !== undefined ? Number(item.commissionRate) : (item.commission50 ? 50 : 0),
    parentCashId: item.parentCashId || "",
    amount: Number(item.amount) || 0,
  }));

  return migrated;
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((note) => typeof note === "string"
    ? { id: uid(), text: note, createdAt: new Date().toISOString(), updatedAt: "" }
    : { id: note.id || uid(), text: note.text || "", createdAt: note.createdAt || new Date().toISOString(), updatedAt: note.updatedAt || "" });
}

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.map((photo) => ({
    id: photo.id || uid(),
    caption: photo.caption || "",
    dataUrl: photo.dataUrl || photo.url || "",
    createdAt: photo.createdAt || new Date().toISOString(),
  })).filter((photo) => photo.dataUrl);
}

function normalizeCashCounters(counters) {
  const defaultsByKey = new Map(cashCounters.map((counter) => [counter.key, counter]));
  const defaultsByLabel = new Map(cashCounters.map((counter) => [norm(counter.label), counter]));
  const normalized = [];
  if (Array.isArray(counters)) {
    counters.forEach((counter) => {
      const defaultCounter = typeof counter === "string" ? defaultsByLabel.get(norm(counter)) : defaultsByKey.get(counter?.key);
      if (!defaultCounter || normalized.some((item) => item.key === defaultCounter.key)) return;
      normalized.push({ key: defaultCounter.key, label: String(counter?.label || defaultCounter.label) });
    });
  }
  cashCounters.forEach((counter) => {
    if (!normalized.some((item) => item.key === counter.key)) normalized.push({ ...counter });
  });
  return normalized;
}

function safeDateIso(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  try { return toIsoDate(parsed); } catch (error) { return ""; }
}

function normalizeStatusHistory(service) {
  const rawHistory = service?.statusHistory;
  const history = Array.isArray(rawHistory)
    ? rawHistory
    : (rawHistory && typeof rawHistory === "object" ? Object.values(rawHistory) : []);
  const normalized = history.filter((item) => item && typeof item === "object").map((item) => ({
    id: item.id || uid(),
    date: safeDateIso(item.date) || safeDateIso(item.at) || safeDateIso(item.createdAt) || safeDateIso(service?.createdAt) || isoToday,
    status: item.status || service?.status || "Yeni Kayıt",
    technician: item.technician || service?.technician || "",
    description: item.description || item.text || "",
    createdAt: item.createdAt || item.at || new Date().toISOString(),
  }));
  if (normalized.length) return normalized;

  return [{
    id: uid(),
    date: safeDateIso(service?.createdAt) || isoToday,
    status: service?.status || "Yeni Kayıt",
    sortOrder: Number.isFinite(Number(service?.sortOrder)) ? Number(service.sortOrder) : 0,
    technician: service?.technician || "",
    description: "İlk kayıt",
    createdAt: service?.createdAt || new Date().toISOString(),
  }];
}

function demoService(id, customerName, phone, district, address, brand, device, fault, status, date, price) {
  return {
    id: String(id),
    createdAt: `${date}T11:53:00`,
    customerName,
    phone,
    city: "Ankara",
    district,
    address,
    brand,
    device,
    model: "",
    fault,
    warrantyEnd: "2027-06-20",
    source: "Ali Korkmaz",
    status,
    technician: status === "Teknisyen Yönlendirildi" ? "Doğan Sezai Koçak" : "",
    visitDate: date,
    availableDate: date,
    availableTime: "08:00 ile 22:00 arası",
    price,
    paymentStatus: status === "Hesap Kapatıldı" ? "Ödendi" : "Bekliyor",
    operatorNote: "",
    notes: [],
    photos: [],
    history: [],
    statusHistory: [{
      id: uid(),
      date,
      status,
      technician: status === "Teknisyen Yönlendirildi" ? "Doğan Sezai Koçak" : "",
      description: "İlk kayıt",
      createdAt: `${date}T11:55:00`,
    }],
  };
}

function buildLightLocalState(sourceState) {
  const copy = JSON.parse(JSON.stringify(sourceState || {}));
  if (Array.isArray(copy.services)) {
    copy.services = copy.services.map((service) => ({
      ...service,
      photos: Array.isArray(service.photos)
        ? service.photos.map((photo) => ({
            id: photo.id || uid(),
            caption: photo.caption || "",
            createdAt: photo.createdAt || "",
            dataUrl: "",
          }))
        : [],
    }));
  }
  return copy;
}

function saveLocalState() {
  // iPhone Safari kotası dolu olsa bile uygulamanın çalışmasını durdurma.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildLightLocalState(state)));
    return true;
  } catch (error) {
    console.warn("Yerel önbellek yazılamadı; uygulama bulut verisiyle devam ediyor.", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    return false;
  }
}

function saveState() {
  saveLocalState();
  if (!canSyncCloud()) return;
  lastLocalCloudWriteAt = new Date().toISOString();
  cloudRef.set({
    updatedAt: lastLocalCloudWriteAt,
    state,
  }).catch((error) => {
    if (isPermissionDenied(error)) {
      denyCloudWrite();
      return;
    }
    console.warn("Firebase kaydı yapılamadı, yerel kayıt korundu.");
  });
}

function canSyncCloud() {
  if (cloudWriteBlocked || !cloudRef || !cloudReady || cloudApplyingState) return false;
  try {
    return Boolean(window.firebase?.auth && firebase.auth().currentUser);
  } catch (error) {
    return false;
  }
}

function isPermissionDenied(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "PERMISSION_DENIED" || code === "permission-denied" || /permission/i.test(code) || /permission/i.test(message);
}

function denyCloudWrite() {
  cloudReady = false;
  cloudWriteBlocked = true;
  showCloudAuthMessage("Bulut verisine erişim izni yok. Kayıt gönderilmedi.");
}

function showCloudAuthMessage(text) {
  const el = document.querySelector("#cloudAuthMessage");
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
}

function hideCloudAuthMessage() {
  const el = document.querySelector("#cloudAuthMessage");
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

function applyCloudData(data) {
  const openDetailId = detailDialog.open ? activeDetailId : null;
  cloudApplyingState = true;
  state = migrateState(data.state);
  // Firebase is authoritative after a successful cloud snapshot.
  // Do not overlay stale per-device counter settings onto synced settings.
  try { localStorage.removeItem(COUNTER_SETTINGS_LOCAL_KEY); } catch (_) {}
  activeDetailId = openDetailId && state.services.some((service) => service.id === openDetailId) ? openDetailId : null;
  activeDashboardStat = "";
  activeDashboardSource = "";
  saveLocalState();
  cloudApplyingState = false;
  render();
}

function initCloudSync() {
  if (!window.firebase?.database || !window.firebase?.auth) return;
  if (!firebase.auth().currentUser) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    hideCloudAuthMessage();
    cloudWriteBlocked = false;
    cloudReady = false;
    cloudInitialHandled = false;
    cloudSeedQueued = false;
    cloudListenGeneration += 1;
    const generation = cloudListenGeneration;
    cloudRef = firebase.database().ref(CLOUD_STATE_PATH);
    cloudRef.on("value", (snapshot) => {
      if (generation !== cloudListenGeneration || cloudWriteBlocked) return;
      if (!firebase.auth().currentUser) return;
      const data = snapshot.val();
      cloudReady = true;

      if (data?.state) {
        if (lastLocalCloudWriteAt && data.updatedAt === lastLocalCloudWriteAt) {
          cloudInitialHandled = true;
          return;
        }
        try {
          applyCloudData(data);
        } catch (error) {
          console.warn("Bulut verisi uygulanamadı.", error);
        }
        cloudInitialHandled = true;
        return;
      }

      // İzin hatası boş kayıt gibi görünürse yerel durum buluta yazılmasın.
      if (!cloudInitialHandled && !cloudSeedQueued) {
        cloudSeedQueued = true;
        queueMicrotask(() => {
          cloudSeedQueued = false;
          if (generation !== cloudListenGeneration || cloudWriteBlocked || cloudInitialHandled) return;
          if (!canSyncCloud()) return;
          saveState();
          cloudInitialHandled = true;
        });
      }
    }, (error) => {
      if (generation !== cloudListenGeneration) return;
      cloudReady = false;
      cloudWriteBlocked = true;
      cloudSeedQueued = false;
      if (isPermissionDenied(error)) {
        showCloudAuthMessage("Bulut verisine erişim izni yok. Kayıt gönderilmedi.");
        return;
      }
      const offline = isOfflineAuthError(error) || !navigator.onLine;
      if (offline) showCloudAuthMessage("İnternet bağlantısı yok");
      else console.warn("Firebase bağlantısı kurulamadı, yerel kayıtla devam ediliyor.");
    });
  } catch (error) {
    cloudReady = false;
    console.warn("Firebase başlatılamadı, yerel kayıtla devam ediliyor.");
  }
}

function stopCloudSync() {
  cloudListenGeneration += 1;
  cloudReady = false;
  cloudWriteBlocked = false;
  cloudInitialHandled = false;
  cloudSeedQueued = false;
  cloudSyncStarted = false;
  cloudSyncStarting = false;
  if (cloudRef) {
    try { cloudRef.off(); } catch (error) {}
    cloudRef = null;
  }
}

function pinPassword(pin) {
  return "ekzen-pin-" + pin;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isFourDigitPin(pin) {
  return /^\d{4}$/.test(pin);
}

function isOfflineAuthError(error) {
  const code = String(error?.code || "");
  return code === "auth/network-request-failed" || code === "auth/timeout" || code === "auth/network-error" || code === "UNAVAILABLE" || code === "unavailable";
}

function authErrorMessage(error) {
  const code = String(error?.code || "");
  if (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-email" ||
    code === "auth/user-mismatch"
  ) return "Şifre yanlış";
  if (code === "auth/too-many-requests") return "Çok fazla deneme, biraz bekleyin";
  if (isOfflineAuthError(error) || !navigator.onLine) return "İnternet bağlantısı yok";
  if (code === "auth/weak-password") return "PIN güncellenemedi.";
  if (code === "auth/requires-recent-login") return "Tekrar giriş yapıp yeniden deneyin.";
  return "Giriş yapılamadı.";
}

function setPinError(text) {
  const el = document.querySelector("#pinError");
  if (el) el.textContent = text || "";
}

function setPinChangeError(text) {
  const el = document.querySelector("#pinChangeError");
  if (el) el.textContent = text || "";
}

function currentPinValue() {
  return onlyDigits(document.querySelector("#pinInput")?.value).slice(0, 4);
}

function updatePinBoxes() {
  const value = currentPinValue();
  const input = document.querySelector("#pinInput");
  if (input && input.value !== value) input.value = value;
  document.querySelectorAll("[data-pin-box]").forEach((box, index) => {
    box.classList.toggle("is-filled", index < value.length);
    box.classList.toggle("is-active", index === value.length);
  });
}

function clearPinEntry() {
  const input = document.querySelector("#pinInput");
  if (input) input.value = "";
  updatePinBoxes();
}

function revealApp() {
  restoreLocalCounterSettings();
  document.body.classList.remove("auth-checking");
  const wasLocked = !document.body.classList.contains("is-unlocked");
  document.body.classList.add("is-unlocked");
  clearPinEntry();
  setPinError("");
  if (!wasLocked) return;
  try {
    fillSelects();
    applySourcePortalMode();
    setDefaultDates();
    saveLocalState();
    render();
  } catch (error) {
    console.warn("Ekran çizilemedi.", error);
  }
}

function isMobilePinLayout() {
  return Boolean(window.matchMedia?.("(max-width: 820px)").matches);
}

function configurePinInputs() {
  const input = document.querySelector("#pinInput");
  if (input) {
    input.readOnly = true;
    input.setAttribute("readonly", "");
    input.setAttribute("inputmode", "none");
    input.setAttribute("autocomplete", "off");
    input.blur();
  }
  const mobile = isMobilePinLayout();
  document.querySelectorAll("#pinChangeForm input").forEach((field) => {
    field.readOnly = mobile;
    if (mobile) {
      field.setAttribute("readonly", "");
      field.setAttribute("inputmode", "none");
      field.blur();
    } else {
      field.readOnly = false;
      field.removeAttribute("readonly");
      field.setAttribute("inputmode", "numeric");
    }
  });
  const keypad = document.querySelector("#pinChangeKeypad");
  if (keypad) keypad.hidden = !mobile;
}

function setPinChangeTarget(input) {
  document.querySelectorAll("#pinChangeForm input").forEach((field) => field.classList.remove("is-pin-target"));
  input?.classList.add("is-pin-target");
}

function activePinChangeInput() {
  return document.querySelector("#pinChangeForm input.is-pin-target") || document.querySelector("#pinChangeForm [name='currentPin']");
}

function applyPinChangeKey(key) {
  const input = activePinChangeInput();
  if (!input) return;
  const digits = onlyDigits(input.value).slice(0, 4);
  input.value = key === "back" ? digits.slice(0, -1) : (digits.length >= 4 ? digits : digits + key);
  setPinChangeTarget(input);
}

function lockApp() {
  document.body.classList.remove("is-unlocked", "auth-checking");
  clearPinEntry();
  setPinError("");
  hideCloudAuthMessage();
  configurePinInputs();
}

function ensureFirebaseApp() {
  if (!window.firebase?.initializeApp) return false;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  return true;
}

function startPinAuth() {
  lockApp();
  document.body.classList.add("auth-checking");
  if (!window.firebase?.auth || !window.firebase?.initializeApp) {
    document.body.classList.remove("auth-checking");
    setPinError("İnternet bağlantısı yok");
    return;
  }
  try {
    ensureFirebaseApp();
    const auth = firebase.auth();
    const persistence = firebase.auth.Auth?.Persistence?.LOCAL || "local";
    Promise.resolve(auth.setPersistence(persistence)).then(watchAuthState, watchAuthState);
  } catch (error) {
    document.body.classList.remove("auth-checking");
    setPinError("İnternet bağlantısı yok");
  }
}

function watchAuthState() {
  if (!window.firebase?.auth) {
    document.body.classList.remove("auth-checking");
    setPinError("İnternet bağlantısı yok");
    return;
  }
  firebase.auth().onAuthStateChanged(handleAuthState);
}

function handleAuthState(user) {
  const epoch = ++authEpoch;
  if (!user) {
    stopCloudSync();
    lockApp();
    return;
  }
  revealApp();
  if (cloudSyncStarted || cloudSyncStarting) return;
  cloudSyncStarting = true;
  const tokenReady = typeof user.getIdToken === "function" ? user.getIdToken() : Promise.resolve();
  Promise.resolve(tokenReady).then(() => {
    cloudSyncStarting = false;
    if (epoch !== authEpoch || !firebase.auth().currentUser || cloudSyncStarted) return;
    cloudSyncStarted = true;
    initCloudSync();
  }).catch((error) => {
    cloudSyncStarting = false;
    if (epoch !== authEpoch) return;
    showCloudAuthMessage(isOfflineAuthError(error) || !navigator.onLine
      ? "İnternet bağlantısı yok"
      : "Oturum doğrulanamadı. Kayıt gönderilmedi.");
  });
}

async function submitPinLogin(event) {
  event?.preventDefault();
  const pin = currentPinValue();
  if (!isFourDigitPin(pin)) {
    setPinError("4 haneli şifre girin.");
    return;
  }
  if (!window.firebase?.auth || !navigator.onLine) {
    setPinError("İnternet bağlantısı yok");
    clearPinEntry();
    return;
  }
  const button = document.querySelector("#pinSubmit");
  if (button) button.disabled = true;
  setPinError("");
  try {
    await firebase.auth().signInWithEmailAndPassword(AUTH_EMAIL, pinPassword(pin));
    clearPinEntry();
  } catch (error) {
    setPinError(authErrorMessage(error));
    clearPinEntry();
  } finally {
    if (button) button.disabled = false;
  }
}

function signOutApp() {
  if (!confirm("Çıkış yapılsın mı?")) return;
  const auth = window.firebase?.auth?.();
  stopCloudSync();
  if (!auth?.signOut) {
    lockApp();
    return;
  }
  auth.signOut().catch(() => {
    alert("Çıkış yapılamadı.");
    if (auth.currentUser) handleAuthState(auth.currentUser);
  });
}

function openPinChange() {
  const dialog = document.querySelector("#pinChangeDialog");
  const form = document.querySelector("#pinChangeForm");
  if (!dialog || !form) return;
  form.reset();
  setPinChangeError("");
  configurePinInputs();
  setPinChangeTarget(form.elements.currentPin);
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  if (!isMobilePinLayout()) form.elements.currentPin?.focus();
}

function closePinChange() {
  const dialog = document.querySelector("#pinChangeDialog");
  const form = document.querySelector("#pinChangeForm");
  form?.reset();
  setPinChangeError("");
  if (dialog?.open) dialog.close();
}

async function submitPinChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const currentPin = onlyDigits(form.elements.currentPin.value);
  const newPin = onlyDigits(form.elements.newPin.value);
  const confirmPin = onlyDigits(form.elements.confirmPin.value);
  if (!isFourDigitPin(currentPin) || !isFourDigitPin(newPin)) {
    setPinChangeError("PIN 4 haneli olmalı.");
    return;
  }
  if (newPin !== confirmPin) {
    setPinChangeError("Yeni PIN eşleşmiyor.");
    return;
  }
  const user = window.firebase?.auth?.().currentUser;
  if (!user || !navigator.onLine) {
    setPinChangeError(navigator.onLine ? "Oturum bulunamadı." : "İnternet bağlantısı yok");
    return;
  }
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  setPinChangeError("");
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(AUTH_EMAIL, pinPassword(currentPin));
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(pinPassword(newPin));
    form.reset();
    closePinChange();
    alert("PIN güncellendi.");
  } catch (error) {
    setPinChangeError(authErrorMessage(error));
    form.reset();
  } finally {
    if (button) button.disabled = false;
  }
}

function exportBackup() {
  const payload = {
    app: "ekzen-servis-takip",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ekzen-servis-yedek-${isoToday}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!confirm("Yedek geri yüklensin mi? Mevcut kayıtlar bu yedekle değiştirilecek.")) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const backupState = parsed.state || parsed;
      state = migrateState(backupState);
      activeDetailId = null;
      activeDashboardStat = "";
      activeDashboardSource = "";
      saveState();
      render();
      switchView("dashboard");
      alert("Yedek başarıyla yüklendi.");
    } catch (error) {
      alert("Yedek dosyası okunamadı. Lütfen doğru JSON yedek dosyasını seç.");
    }
  });
  reader.readAsText(file);
}

// Home counter cards do not have data-action; handle them before the general action dispatcher.
document.addEventListener("click",event=>{
 const card=event.target.closest("#desktopHomeCashCards [data-home-cash-slot]");
 if(!card)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 const slot=card.dataset.homeCashSlot;
 try{
  if(slot.startsWith("status-")){openHomeServiceList(slot);return;}
  if(slot==="payment"||slot==="income"){openHomeServiceList(slot);return;}
  if(slot==="expense"){
   const source = activeDashboardSource || cashSourceFilter?.value || "";
   if (source && !isOwnWorkSource(source)) mobileOpenSourcePayment(source);
   else {
     if(cashSourceFilter)cashSourceFilter.value=source;
     switchView("cash");
     openCashCurrentDetail("balance");
   }
   return;
  }
  openHomeCashMovements(slot);
 }catch(error){
  console.error("Ana sayfa sayaç detayı açılamadı",slot,error);
  alert("Sayaç ayrıntısı açılamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
 }
},true);

function bindEvents() {
  setupPhotoViewerGestures();
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    const action = button?.dataset.action;
    const view = event.target.closest("[data-view]")?.dataset.view;
    const jump = event.target.closest("[data-view-jump]")?.dataset.viewJump;
    const serviceRow = event.target.closest("[data-service-id]");

    if (view) {
      if (view === "dashboard") resetDashboardDateToToday();
      if (view === "services") prepareServiceListFromCurrentDate();
      switchView(view);
    }
    if (jump) switchView(jump);

    // Mobil teknisyen ekranında servis kartına basınca sadece alttan açılan
    // mobil detay paneli açılsın. Masaüstü detay penceresi ayrıca açılmasın.
    const isMobileTechClick = Boolean(event.target.closest("#mobileTechApp"));
    if (!isMobileTechClick && serviceRow && !event.target.closest("button, a") && !event.target.matches("input")) openDetail(serviceRow.dataset.serviceId);
    if (action === "toggle-source-menu") toggleTopSourceMenu();
    if (action === "quick-source-filter") applyTopSourceFilter(button.dataset.source);
    if (action === "clear-top-source-filter") applyTopSourceFilter("");
    if (!action) return;
    if (action === "duplicate-dashboard-counter") { duplicateDashboardCounter(button.dataset.label); return; }
    if (action === "toggle-dashboard-counter") { toggleDashboardCounter(button.dataset.label); return; }
    if (action === "rename-dashboard-copy") { renameDashboardCopy(button.dataset.label); return; }
    if (action === "color-dashboard-copy") { colorDashboardCopy(button.dataset.label); return; }
    if (action === "delete-dashboard-copy") { deleteDashboardCopy(button.dataset.label); return; }
    if (action === "move-dashboard-counter") { moveDashboardCounter(button.dataset.label,Number(button.dataset.direction)); return; }
    if (action === "duplicate-cash-counter") { duplicateCashCounter(button.dataset.slot, button.dataset.index); return; }
    if (action === "factory-reset-customizations") { resetEkzenCustomizations(); return; }
    if (action === "sign-out") {
      signOutApp();
      return;
    }
    if(action==="move-cash-slot"){
      if(isSourcePortal())return;
      const ordered=cashSlotSettings();
      const index=ordered.findIndex(c=>c.id===button.dataset.slot);
      const next=index+Number(button.dataset.direction);
      if(index<0||next<0||next>=ordered.length)return;
      [ordered[index],ordered[next]]=[ordered[next],ordered[index]];
      state.settings.cashSlotSettings=ordered.map((c,i)=>({...c,order:i,visible:c.visible!==false}));
      persistLocalCounterSettings();
      saveLocalState();
      renderCustomCashCounterSettings();
      mobileRenderDailyCash();
      if(canSyncCloud()){
        cloudRef.update({"state/settings/cashSlotSettings":state.settings.cashSlotSettings,updatedAt:new Date().toISOString()})
          .catch(error=>{console.warn("Sayaç sırası eşitlenemedi:",error);alert("Sıralama bu cihazda kaydedildi ancak buluta aktarılamadı.");});
      }else alert("Sıralama bu cihazda kaydedildi ancak bulut eşitlemesi kullanılamıyor.");
      return;
    }
    if(action==="source-counter-move"){
      const root=document.querySelector("#sourceSpecialSettings");
      if(!root)return;
      const source=selectedSourceSettingsName,config=sourceSpecialConfig(source);
      const existing=Array.isArray(config.counterOrderByDevice?.[activeSourceCounterDeviceTab])?config.counterOrderByDevice[activeSourceCounterDeviceTab].slice():allHomeCashSlots().map(c=>c.id);
      const i=existing.indexOf(button.dataset.slot),next=i+Number(button.dataset.direction);
      if(i<0||next<0||next>=existing.length)return;
      [existing[i],existing[next]]=[existing[next],existing[i]];
      state.settings.sourceSpecialSettings={...(state.settings.sourceSpecialSettings||{}),[source]:{...config,counterOrderByDevice:{...(config.counterOrderByDevice||{}),[activeSourceCounterDeviceTab]:existing}}};
      saveLocalState();renderSourceSpecialSettings();
      if(canSyncCloud())cloudRef.update({"state/settings/sourceSpecialSettings":state.settings.sourceSpecialSettings,updatedAt:new Date().toISOString()}).catch(error=>console.warn("Kaynak sayaç sırası eşitlenemedi",error));
      return;
    }
    if(action==="home-layout-toggle"||action==="home-layout-move"){
      if(isSourcePortal())return;
      const device=button.dataset.device;
      if(device!=="desktop"&&device!=="mobile")return;
      const id=button.dataset.slot;
      const ids=homeLayout(device);
      const index=ids.indexOf(id);
      if(action==="home-layout-toggle"){
        if(index>=0)ids.splice(index,1);else if(allHomeCashSlots().some(x=>x.id===id))ids.push(id);
      }else{
        const next=index+Number(button.dataset.direction);
        if(index<0||next<0||next>=ids.length)return;
        [ids[index],ids[next]]=[ids[next],ids[index]];
      }
      if(!state.settings.homeLayout)state.settings.homeLayout={desktop:[],mobile:[]};
      state.settings.homeLayout[device]=ids;
      saveLocalState();
      renderHomeLayoutSettings();
      renderDashboard();
      if(typeof mobileRenderDailyCash==="function")mobileRenderDailyCash();
      if(canSyncCloud())cloudRef.update({"state/settings/homeLayout":state.settings.homeLayout,updatedAt:new Date().toISOString()})
        .catch(error=>{console.warn("Ana sayfa düzeni eşitlenemedi",error);alert("Düzen bu cihazda kaydedildi ancak buluta aktarılamadı.");});
      else alert("Düzen bu cihazda kaydedildi ancak bulut eşitlemesi kullanılamıyor.");
      return;
    }
    if(action==="edit-cash-slot"){editCashSlot(button.dataset.slot);return;}
    if(action==="toggle-cash-slot"){if(isSourcePortal())return;const id=button.dataset.slot;const old=cashSlotSettings().find(c=>c.id===id);if(!old)return;state.settings.cashSlotSettings=state.settings.cashSlotSettings||[];const i=state.settings.cashSlotSettings.findIndex(c=>c.id===id);const updated={...old,visible:old.visible===false};if(i<0)state.settings.cashSlotSettings.push(updated);else state.settings.cashSlotSettings[i]=updated;persistLocalCounterSettings();saveLocalState();renderCustomCashCounterSettings();mobileRenderDailyCash();if(canSyncCloud()){lastLocalCloudWriteAt=new Date().toISOString();cloudRef.update({"state/settings/cashSlotSettings":state.settings.cashSlotSettings,updatedAt:lastLocalCloudWriteAt}).catch(error=>console.warn("Sayaç görünürlüğü eşitlenemedi:",error));}return;}
    if (action === "edit-custom-counter") { editCustomCounter(Number(button.dataset.index)); return; }
    if (action === "clear-custom-counter-form") { renderCustomCashCounterSettings(); return; }
    if (action === "toggle-custom-counter" || action === "delete-custom-counter") {
      if (isSourcePortal()) return;
      const list=customCashCounters(); const index=Number(button.dataset.index);
      if (!Number.isInteger(index)||index<0||index>=list.length)return;
      if(action==="delete-custom-counter") { if(!confirm("Bu sayaç silinsin mi? Kasa kayıtları silinmez."))return;list.splice(index,1); }
      else list[index].visible=list[index].visible===false;
      persistLocalCounterSettings();saveLocalState();renderCustomCashCounterSettings();mobileRenderDailyCash();
      if(canSyncCloud()){lastLocalCloudWriteAt=new Date().toISOString();cloudRef.update({"state/settings/customCashCounters":state.settings.customCashCounters||[],updatedAt:lastLocalCloudWriteAt}).catch(error=>console.warn("Özel sayaç görünürlüğü eşitlenemedi:",error));}return;
    }
    if (action === "change-pin") {
      openPinChange();
      return;
    }
    if (action === "close-pin-change") {
      closePinChange();
      return;
    }
    if (isSourcePortal() && [
      "add-source", "edit-source", "delete-source", "add-setting-item", "edit-setting-item", "delete-setting-item", "move-setting-item", "export-backup", "choose-backup",
      "delete-service", "add-cash", "edit-cash", "delete-cash", "change-status", "add-note", "edit-note", "delete-note", "add-photo", "edit-photo", "delete-photo",
    ].includes(action)) return;

    if (action === "open-dashboard-date-range") openDashboardDateRangeDialog();
    if (action === "close-dashboard-date-range") closeDashboardDateRangeDialog();
    if (action === "dashboard-date-preset") applyDashboardDatePreset(button.dataset.range, true);
    if (action === "apply-dashboard-date-range") applyDashboardCustomDateRange();
    if (action === "toggle-nav") document.body.classList.toggle("nav-open");
    if (action === "open-service-modal") {
      if (isMobileTechViewport() && isMobileTechClick) openMobileNewServiceWizard();
      else openServiceForm();
    }
    if (action === "open-service-detail") openDetail(button.dataset.serviceId);
    if (action === "move-service-order") moveServiceOrder(button.dataset.serviceId, button.dataset.direction);
    if (action === "open-related-service") openRelatedServiceForm(button.dataset.serviceId);
    if (action === "close-service-modal") serviceDialog.close();
    if (action === "close-detail-modal") detailDialog.close();
    if (action === "close-cash-modal") cashDialog.close();
    if (action === "close-complete-modal") completeDialog.close();
    if (action === "close-status-modal") statusDialog.close();
    if (action === "close-note-modal") noteDialog.close();
    if (action === "close-source-modal") sourceDialog.close();
    if (action === "close-photo-modal") photoDialog.close();
    if (action === "open-photo-viewer") openPhotoViewer(button.dataset.serviceId, button.dataset.photoId);
    if (action === "close-photo-viewer") closePhotoViewer();
    if (action === "photo-viewer-prev") movePhotoViewer(-1);
    if (action === "photo-viewer-next") movePhotoViewer(1);
    if (action === "photo-viewer-zoom-in") zoomPhotoViewer(0.25);
    if (action === "photo-viewer-zoom-out") zoomPhotoViewer(-0.25);
    if (action === "photo-viewer-reset") resetPhotoViewer();
    if (action === "delete-service") deleteCurrentService();
    if (action === "delete-service-direct") deleteServiceById(button.dataset.serviceId);
    if (action === "print" || action === "print-list") printServiceReport(action === "print-list");
    if (action === "print-cash") printCash();
    if (action === "set-cash-list-mode") setCashListMode(button.dataset.mode);
    if (action === "open-cash-current-detail") openCashCurrentDetail(button.dataset.detailType || "balance");
    if (action === "close-cash-current-detail") closeCashCurrentDetail();
    if (action === "open-ekzen-cash-detail") openEkzenCashDetail(button.dataset.detailType || "turnover");
    if (action === "close-ekzen-cash-detail") closeEkzenCashDetail();
    if (action === "dashboard-stat") applyDashboardStatFilter(button.dataset.stat);
    if (action === "dashboard-source") applyDashboardSourceFilter(button.dataset.source);
    if (action === "show-open-services") showOpenServicesFromTopbar();
    if (action === "show-all-records") showAllRecords();
    if (action === "service-status-filter") {
      topStatusFilter.value = "";
      serviceQuickStatSelection = button.dataset.status || "";
      activeDashboardStat = "";
      renderServices();
    }
    if (action === "accounting-check") openAccountingCheck();
    if (action === "close-accounting-check") closeAccountingCheck();
    if (action === "print-accounting-check") window.print();
    if (action === "clear-selected") clearServiceSelection();
    if (action === "add-cash") openCashForm(button.dataset.serviceId ? { serviceId: button.dataset.serviceId } : {});
    if (action === "edit-cash") openCashForm({ id: button.dataset.cashId });
    if (action === "delete-cash") deleteCash(button.dataset.cashId);
    if (action === "change-status") openStatusForm(button.dataset.serviceId);
    if (action === "complete-service") openCompleteForm(button.dataset.serviceId);
    if (action === "add-note") openNoteForm(button.dataset.serviceId);
    if (action === "edit-note") openNoteForm(button.dataset.serviceId, button.dataset.noteId);
    if (action === "delete-note") deleteNote(button.dataset.serviceId, button.dataset.noteId);
    if (action === "add-photo") openPhotoForm(button.dataset.serviceId);
    if (action === "delete-photo") deletePhoto(button.dataset.serviceId, button.dataset.photoId);
    if (action === "edit-photo") editPhoto(button.dataset.serviceId, button.dataset.photoId);
    if (action === "add-source") openSourceForm();
    if (action === "edit-source") openSourceForm(button.dataset.sourceName);
    if (action === "delete-source") deleteSource(button.dataset.sourceName);
    if (action === "add-setting-item") addSettingItem(button.dataset.list);
    if (action === "edit-setting-item") editSettingItem(button.dataset.list, button.dataset.value);
    if (action === "delete-setting-item") deleteSettingItem(button.dataset.list, button.dataset.value);
    if (action === "move-setting-item") moveSettingItem(button.dataset.list, button.dataset.value, button.dataset.direction);
    if (action === "export-backup") exportBackup();
    if (action === "choose-backup") backupFileInput.click();
  });

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    // V4.0.0: Servis listesinde arama yapılınca kaynak/tarih filtresi bozulmasın.
    activeDashboardStat = "";
    serviceQuickStatSelection = null;
    activeDashboardSource = isSourcePortal() ? portalSourceName() : (topSourceFilter?.value || activeDashboardSource || "");
    renderServices();
  });
  filterForm.elements.query.addEventListener("input", () => {
    // V4.0.0: Arama sadece sayaç filtresini temizler; kaynak ve tarih korunur.
    activeDashboardStat = "";
    activeDashboardSource = isSourcePortal() ? portalSourceName() : (topSourceFilter?.value || activeDashboardSource || "");
    renderServices();
  });

  sortSelect?.addEventListener("change", renderServices);
  topSourceFilter.addEventListener("change", () => {
    activeDashboardStat = "";
    activeDashboardSource = topSourceFilter.value || "";
    renderTopSourceMenu();
    renderDashboard();
    renderServices();
    renderCash();
  });
  topStatusFilter.addEventListener("change", () => {
    // V4.0.0: Durum filtresi seçilince mevcut kaynak filtresi korunur.
    activeDashboardStat = "";
    activeDashboardSource = isSourcePortal() ? portalSourceName() : (topSourceFilter?.value || activeDashboardSource || "");
    renderServices();
  });
  document.querySelector("#serviceDateFilter")?.addEventListener("change", () => {
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });
  cashSourceFilter.addEventListener("change", renderCash);
  cashStartDate?.addEventListener("change", renderCash);
  cashEndDate?.addEventListener("change", renderCash);
  dashboardRangeStartPicker?.addEventListener("change", updateDashboardDateRangePreview);
  dashboardRangeEndPicker?.addEventListener("change", applyDashboardCustomDateRange);
  backupFileInput.addEventListener("change", importBackup);

  serviceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveService(new FormData(serviceForm));
  });

  cashForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCash(new FormData(cashForm));
  });

  completeForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    completeServiceFromForm(new FormData(completeForm));
  });

  statusForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveStatus(new FormData(statusForm));
  });

  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveNote(new FormData(noteForm));
  });

  sourceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSource(new FormData(sourceForm));
  });

  photoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    savePhoto();
  });

  document.querySelector("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.company = Object.fromEntries(new FormData(event.currentTarget));
    saveState();
    render();
    switchView("dashboard");
  });

  document.querySelector("#pinForm")?.addEventListener("submit", submitPinLogin);
  document.querySelector("#pinInput")?.addEventListener("input", updatePinBoxes);
  document.querySelector("#pinScreen")?.addEventListener("pointerdown", (event) => {
    if (event.target.closest("#pinInput, .pin-boxes")) event.preventDefault();
  });
  document.querySelector("#pinKeypad")?.addEventListener("click", (event) => {
    const key = event.target.closest("[data-pin-key]")?.dataset.pinKey;
    if (!key) return;
    const input = document.querySelector("#pinInput");
    if (!input) return;
    const digits = currentPinValue();
    input.value = key === "back" ? digits.slice(0, -1) : (digits.length >= 4 ? digits : digits + key);
    updatePinBoxes();
  });
  document.querySelector("#pinChangeForm")?.addEventListener("submit", submitPinChange);
  document.querySelector("#pinChangeDialog")?.addEventListener("pointerdown", (event) => {
    if (!isMobilePinLayout()) return;
    const label = event.target.closest("#pinChangeForm label");
    const input = event.target.closest("#pinChangeForm input") || label?.querySelector("input");
    if (!input) return;
    event.preventDefault();
    setPinChangeTarget(input);
  });
  document.querySelector("#pinChangeKeypad")?.addEventListener("click", (event) => {
    const key = event.target.closest("[data-pin-key]")?.dataset.pinKey;
    if (!key) return;
    event.preventDefault();
    applyPinChangeKey(key);
  });
  document.addEventListener("keydown", (event) => {
    if (document.body.classList.contains("is-unlocked")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const input = document.querySelector("#pinInput");
    if (!input) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      input.value = currentPinValue().slice(0, -1);
      updatePinBoxes();
      return;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      const digits = currentPinValue();
      input.value = digits.length >= 4 ? digits : digits + event.key;
      updatePinBoxes();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      document.querySelector("#pinForm")?.requestSubmit();
    }
  });
  configurePinInputs();
  window.addEventListener("resize", configurePinInputs);
  completeForm?.elements?.source?.addEventListener("change", syncCompleteCommissionField);
}

function fillSelects() {
  fillSelect(topSourceFilter, ["Tüm Kaynaklar", ...settingsList("sources")]);
  fillSelect(topStatusFilter, ["Tüm Durumlar", ...settingsList("statuses")]);
  fillSelect(cashSourceFilter, ["Tüm Kaynaklar", ...settingsList("sources")]);
  fillSelect(serviceForm.elements.brand, ["Marka", ...settingsList("brands")]);
  fillSelect(serviceForm.elements.device, ["Cihaz Türü", ...settingsList("devices")]);
  fillSelect(serviceForm.elements.source, settingsList("sources"));
  fillSelect(serviceForm.elements.status, settingsList("statuses"));
  fillSelect(cashForm.elements.source, ["Servis Kaynağı", ...settingsList("sources")]);
  fillSelect(completeForm?.elements.source, ["Servis Kaynağı", ...settingsList("sources")]);
  fillSelect(statusForm.elements.status, settingsList("statuses"));
}

function applySourcePortalMode() {
  if (!isSourcePortal()) return;
  document.body.classList.add("source-portal");
  document.querySelectorAll('[data-view="services"], [data-view="customers"], [data-view="sources"], [data-view="settings"]').forEach((item) => {
    item.hidden = true;
    item.style.display = "none";
  });
  lockSelectToSource(topSourceFilter);
  lockSelectToSource(cashSourceFilter);
  lockSelectToSource(serviceForm.elements.source, false);
  lockSelectToSource(cashForm.elements.source, false);
  topSourceFilter.hidden = true;
  cashSourceFilter.hidden = true;
  document.querySelector('[data-action="add-cash"]')?.setAttribute("hidden", "");
  serviceForm.elements.source.closest("label").hidden = true;
  cashForm.elements.source.closest("label").hidden = true;
}

function lockSelectToSource(select, disabled = true) {
  if (!select || !isSourcePortal()) return;
  const source = portalSourceName();
  if (![...select.options].some((option) => option.value === source)) {
    select.add(new Option(source, source));
  }
  select.value = source;
  select.disabled = disabled;
}

function fillSelect(select, options) {
  if (!select) return;
  const previous = select.value;
  const keptPrevious = select.selectedOptions?.[0]?.dataset?.keep === "1" ? previous : "";
  select.innerHTML = "";
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = ["Marka", "Cihaz Türü", "Servis Durumu", "Servis Kaynağı", "Tüm İller", "Tüm Kaynaklar", "Tüm Durumlar"].includes(option) ? "" : option;
    item.textContent = option;
    select.append(item);
  });
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  else if (keptPrevious) keepSelectValue(select, keptPrevious);
}

function setDefaultDates() {
  if (cashStartDate) cashStartDate.value = isoToday;
  if (cashEndDate) cashEndDate.value = isoToday;
  const week = dashboardPresetRange("thisWeek");
  if (dashboardStartDate && !dashboardStartDate.value) dashboardStartDate.value = week.start;
  if (dashboardEndDate && !dashboardEndDate.value) dashboardEndDate.value = week.end;
  syncDashboardDateRangeControls();
}

function resetDashboardDateToToday() {
  // Returning home always starts with the current-week range, for all sources.
  const week = dashboardPresetRange("thisWeek");
  if (dashboardStartDate) dashboardStartDate.value = week.start;
  if (dashboardEndDate) dashboardEndDate.value = week.end;
  if (dashboardRangeStartPicker) dashboardRangeStartPicker.value = week.start;
  if (dashboardRangeEndPicker) dashboardRangeEndPicker.value = week.end;
  activeDashboardStat = "";
  syncDashboardDateRangeControls();
  updateDashboardDateRangeLabel();
}

function prepareServiceListFromCurrentDate() {
  // V4.2.1: Üst bardaki Servisler butonu listeyi günlük filtreye bağlamaz.
  // Amaç: tüm zamanlardaki açık servisleri (Yeni Kayıt + İşlemde) tek tıkla görmek.
  activeDashboardStat = "Kalan İşler";
  activeDashboardSource = isSourcePortal() ? portalSourceName() : "";
  filterForm?.reset();
  if (topSourceFilter) topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  if (topStatusFilter) topStatusFilter.value = "";
  if (dashboardStartDate) dashboardStartDate.value = "";
  if (dashboardEndDate) dashboardEndDate.value = "";
  syncDashboardDateRangeControls();
  updateDashboardDateRangeLabel();
}

function showOpenServicesFromTopbar() {
  activeDashboardStat = "Kalan İşler";
  activeDashboardSource = "";
  filterForm?.reset();
  if (topSourceFilter) topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  if (topStatusFilter) topStatusFilter.value = "";
  switchView("services");
  renderServices();
}

function switchView(view) {
  if (view === "ekzenCash") view = "cash";
  if(view === "dashboard" && currentView !== "dashboard") resetDashboardDateToToday();
  homeServiceDrilldown=null;
  if (isSourcePortal() && !["dashboard", "cash", "services"].includes(view)) view = "dashboard";
  if (view === "services" && currentView !== "services") { serviceQuickStatSelection = "Yeni Kayıt"; if(topStatusFilter)topStatusFilter.value=""; }
  currentView = view;
  Object.entries(views).forEach(([key, element]) => {
    const visible = key === view;
    element.classList.toggle("is-visible", visible);
    element.hidden = !visible;
    element.style.display = visible ? "block" : "none";
  });
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  const subtitles = {
    dashboard: "Servis takip paneli",
    services: "Servis listesi ve kayıt yönetimi",
    customers: "Müşteri kayıtları",
    sources: "Servis kaynağı yönetimi",
    cash: "Kasa hareketleri",
    ekzenCash: "Ekzen özel kasa",
    settings: "Modül ve firma ayarları",
  };
  document.querySelector("#pageSubtitle").textContent = subtitles[view];
  render();
}

function render() {
  document.title = `${portalTitle()} - Servis Takip`;
  document.querySelector("#companyTitle").textContent = portalTitle();
  fillSelects();
  applySourcePortalMode();
  renderDashboard();
  renderTopSourceMenu();
  renderServices();
  renderCustomers();
  renderSources();
  renderCash();
  renderEkzenCash();
  renderSettings();
  if (detailDialog.open && activeDetailId) renderDetail(activeDetailId);
}

function renderDashboard() {
  const services = filteredDashboardServices();
  const cashItems = filteredDashboardCash();
  document.querySelector("#dashboardTitle").textContent = portalTitle();
  document.querySelector("#dashboardOwnerLine").hidden = isSourcePortal();
  renderSourceMetrics(services, cashItems);
  renderDashboardEkzenCashStatus();
  renderDailyCashSummary(cashItems);
  renderDashboardCounters(services);
  renderHomeCashCards("desktop",cashItems);

  const plans = [...services]
    .filter((service) => isActiveDashboardDateStatus(service.status))
    .sort((a, b) => (a.availableDate || "").localeCompare(b.availableDate || ""))
    .slice(0, 5);
  document.querySelector("#planList").innerHTML = plans.length ? plans.map((service) => `
    <button class="compact-row" type="button" data-action="open-service-detail" data-service-id="${service.id}">
      <span><b>${escapeHtml(service.customerName)}</b><br>${escapeHtml(service.brand)} - ${escapeHtml(service.device)}</span>
      <span class="compact-meta">
        <strong>${formatDate(service.availableDate)}</strong>
        <span class="status-pill ${statusClass(service.status)}">${escapeHtml(service.status)}</span>
      </span>
    </button>
  `).join("") : `<p class="empty">Plan bulunamadı.</p>`;
}

function renderSourceMetrics(services, cashItems) {
  const totals = cashBreakdown(cashItems);
  const isSourceFiltered = Boolean(activeDashboardSource);

  if (isSourceFiltered) {
    // Kaynak seçiliyken kazanç/malzeme/hakediş seçili tarih filtresine uyar.
    // Kalan Ödeme ise cari bakiye olduğu için tüm zamanları baz alır.
    // Kendi İşim kaynağında komisyon/cari hesap yoktur; kalan miktar sadece hasılat - malzemedir.
    const datedSourceTotals = serviceSourceCounterBreakdown(cashItems);
    const allTimeSourceItems = (state.cash || []).filter((item) => cashIsPosted(item)
      && matchesPortalSource(cashItemSource(item))
      && sourceMatches(cashItemSource(item), activeDashboardSource));
    const allTimeSourceTotals = serviceSourceCounterBreakdown(allTimeSourceItems);

    if (isOwnWorkSource(activeDashboardSource)) {
      const remainingAmount = datedSourceTotals.customerMoney - datedSourceTotals.material;
      document.querySelector("#sourceMetrics").innerHTML = `
        <article class="metric-card finance-card income-card">
          <span>Toplam Kazanç</span>
          <b>${money(datedSourceTotals.customerMoney)}</b>
        </article>
        <article class="metric-card finance-card material-card">
          <span>Toplam Malzeme</span>
          <b>${money(datedSourceTotals.material)}</b>
        </article>
        <article class="metric-card finance-card cash-status-card">
          <span>Kalan Miktar</span>
          <b>${money(remainingAmount)}</b>
        </article>
      `;
      return;
    }

    document.querySelector("#sourceMetrics").innerHTML = `
      <article class="metric-card finance-card income-card">
        <span>Toplam Kazanç</span>
        <b>${money(datedSourceTotals.customerMoney)}</b>
      </article>
      <article class="metric-card finance-card material-card">
        <span>Toplam Malzeme</span>
        <b>${money(datedSourceTotals.material)}</b>
      </article>
      <article class="metric-card finance-card commission-card">
        <span>Hakediş</span>
        <b>${money(datedSourceTotals.hakedis)}</b>
      </article>
      <article class="metric-card finance-card income-card">
        <span>Ekzen Teknik</span>
        <b>${money(datedSourceTotals.ekzenTechnical)}</b>
      </article>
      <article class="metric-card finance-card expense-card">
        <span>Yapılan Ödeme</span>
        <b>${money(Math.max(0, datedSourceTotals.hakedis - datedSourceTotals.remainingPayment))}</b>
      </article>
      <article class="metric-card finance-card cash-status-card">
        <span>Kalan Ödeme</span>
        <b>${money(allTimeSourceTotals.remainingPayment)}</b>
      </article>
    `;
    return;
  }

  const allSourceTotals = serviceSourceCounterBreakdown(cashItems);
  const serviceProfit = dashboardServiceProfit(cashItems);

  document.querySelector("#sourceMetrics").innerHTML = `
    <article class="metric-card finance-card income-card">
      <span>Toplam Hasılat</span>
      <b>${money(allSourceTotals.customerMoney)}</b>
    </article>
    <article class="metric-card finance-card commission-card">
      <span>Komisyon</span>
      <b>${money(totals.commission)}</b>
    </article>
    <article class="metric-card finance-card material-card">
      <span>Malzeme</span>
      <b>${money(totals.material)}</b>
    </article>
    <article class="metric-card finance-card cash-status-card">
      <span>Kazanç</span>
      <b>${money(serviceProfit)}</b>
    </article>
  `;
}



function renderDashboardEkzenCashStatus() {
  const target = document.querySelector("#dashboardEkzenCashStatus");
  if (!target) return;
  const totals = ekzenSpecialCashTotals(state.cash || []);
  target.textContent = money(totals.cashBalance);
}

function renderDailyCashSummary(cashItems) {
  const container = document.querySelector("#dailyCashList");
  if (!container) return;
  const postedItems = postedCashItems(cashItems || []);
  const days = new Map();
  postedItems.forEach((item) => {
    const date = item.date || isoToday;
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(item);
  });
  const start = dashboardStartDate?.value || isoToday;
  const end = dashboardEndDate?.value || start;
  if (!days.size && start === end) days.set(start, []);
  const rows = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => {
    const totals = cashBreakdown(items);
    const serviceTotals = serviceOnlyCashBreakdown(items);
    const profit = serviceTotals.income - serviceTotals.commission - serviceTotals.material;
    return `
      <article class="daily-cash-card">
        <div class="daily-cash-date">
          <span>Gün</span>
          <b>${escapeHtml(formatDate(date))}</b>
        </div>
        <div><span>Toplam Hasılat</span><b>${money(totals.income)}</b></div>
        <div><span>Komisyon</span><b class="cash-negative">-${money(totals.commission)}</b></div>
        <div><span>Malzeme</span><b class="cash-negative">-${money(totals.material)}</b></div>
        <div><span>Diğer Gider</span><b class="cash-negative">-${money(totals.manualExpense)}</b></div>
        <div class="daily-cash-profit"><span>Kazanç</span><b>${money(profit)}</b></div>
      </article>
    `;
  });
  container.innerHTML = rows.length ? rows.join("") : `<p class="empty">Bu tarih için kasa hareketi yok.</p>`;
}

function renderTopSourceMenu() {
  const list = document.querySelector("#topSourceMenuList");
  const panel = document.querySelector("#topSourceMenu");
  const menuButton = document.querySelector(".source-menu-button");
  if (!list || !panel) return;
  if (isSourcePortal()) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if (menuButton) {
    menuButton.textContent = activeDashboardSource || "Kaynaklar";
    menuButton.classList.toggle("is-filtered", Boolean(activeDashboardSource));
  }
  const sourceList = settingsList("sources");
  const rows = sourceList.map((source) => {
    const phone = sourcePhone(source);
    return `
      <button class="source-menu-row" type="button" data-action="quick-source-filter" data-source="${escapeAttr(source)}">
        <span>
          <b>${escapeHtml(source)}</b>
          ${phone ? `<small>${escapeHtml(phone)}</small>` : ""}
        </span>
      </button>
    `;
  }).join("");
  list.innerHTML = `
    ${rows || `<p class="empty">Servis kaynağı yok.</p>`}
    <button class="source-menu-row source-menu-all" type="button" data-action="clear-top-source-filter" data-source="">
      <span><b>Tüm Kaynaklar</b></span>
    </button>
  `;
}

function toggleTopSourceMenu() {
  const panel = document.querySelector("#topSourceMenuPanel");
  if (!panel) return;
  panel.hidden = !panel.hidden;
}

function applyTopSourceFilter(source) {
  activeDashboardSource = source || "";
  activeDashboardStat = "";
  if (topSourceFilter) topSourceFilter.value = source || "";
  if (cashSourceFilter) cashSourceFilter.value = source || "";
  renderTopSourceMenu();
  renderDashboard();
  renderServices();
  renderCash();
  const panel = document.querySelector("#topSourceMenuPanel");
  if (panel) panel.hidden = true;
}

function renderDashboardCounters(services) {
  const counters = dashboardVisibleCounters();
  document.querySelector("#dashboardCounters").innerHTML = counters.length ? counters.map((label) => `
    <article class="stat-box is-clickable ${dashboardCounterClass(label)}" style="${dashboardCounterCopies().find(c=>c.name===label)?.color ? `border-color:${dashboardCounterCopies().find(c=>c.name===label).color};--stat-accent:${dashboardCounterCopies().find(c=>c.name===label).color}` : ""}" data-action="dashboard-stat" data-stat="${escapeAttr(label)}">
      <span>${escapeHtml(dashboardCounterDisplayName(label))}</span>
      <b>${dashboardCounterCount(label, services)}</b>
    </article>
  `).join("") : `<p class="empty">Sayaç bulunamadı.</p>`;
}

function dashboardCounterClass(label) {
  label = dashboardCounterBase(label);
  if (isStatus(label, "Bugün")) return "stat-today";
  if (isStatus(label, "Yarın")) return "stat-tomorrow";
  if (isStatus(label, "Açık Fişler")) return "stat-open";
  if (isStatus(label, "İşlem Tamam")) return "stat-complete";
  if (isStatus(label, "Yeni Kayıt")) return "stat-new";
  if (isStatus(label, "İşlemde")) return "stat-process";
  return "stat-neutral";
}

function dashboardCounterBaseServices(label, services) {
  label = dashboardCounterBase(label);
  // V3.6.1: Yarın ve Açık Fişler sayaçları ana sayfa tarih aralığına takılmasın.
  // Yarın her zaman bugünden yarının açık fişlerini, Açık Fişler ise tüm açık fişleri sayar.
  if (isStatus(label, "Yarın") || isStatus(label, "Açık Fişler") || (settingsList("statuses").some(status => isStatus(status, label)) && !isStatus(label, "Bugün") && !isStatus(label, "İşlem Tamam"))) {
    return (state.services || []).filter((service) => matchesPortalSource(service.source)
      && (!activeDashboardSource || sourceMatches(service.source, activeDashboardSource)));
  }
  return services || [];
}

function dashboardCounterCount(label, services) {
  if (isStatus(dashboardCounterBase(label), "İşlem Tamam")) {
    return homeStatusServices("İşlem Tamam", activeDashboardSource, "desktop").length;
  }
  return dashboardCounterBaseServices(label, services).filter((service) => matchesDashboardCounter(service, label)).length;
}

let serviceQuickStatSelection = "Yeni Kayıt";
let homeServiceDrilldown=null;
function renderServices() {
  // Counts use the active date/source/search filters, never the selected status card.
  const allMatching = sortServices(homeServiceDrilldown ? (state.services||[]).filter(service=>homeServiceDrilldown.ids.has(String(service.id))&&matchesPortalSource(service.source)) : filteredServices({ ignoreStatus: true }));
  const selectedStatus = topStatusFilter?.value || "";
  const shown = homeServiceDrilldown ? allMatching : selectedStatus
    ? allMatching.filter(s => s.status === selectedStatus)
    : serviceQuickStatSelection === null
      ? allMatching
      : allMatching.filter(s => serviceQuickStatSelection === "" || isStatus(s.status, serviceQuickStatSelection));
  const list = document.querySelector("#serviceList");
  if (list) list.innerHTML = shown.length
    ? shown.map(serviceRow).join("")
    : `<p class="empty v420-empty">Servis kaydı bulunamadı.</p>`;
  const resultCount = document.querySelector("#resultCount");
  if (resultCount) resultCount.textContent = shown.length;
  renderServiceQuickStats(allMatching);
}

function renderServiceQuickStats(services) {
  const holder = document.querySelector("#serviceQuickStats");
  if (!holder) return;
  const stats = [
    { label: "Toplam Servis", key: "", count: services.length, cls: "total" },
    { label: "Yeni Kayıt", key: "Yeni Kayıt", count: services.filter((s) => isStatus(s.status, "Yeni Kayıt")).length, cls: "new" },
    { label: "İşlemde", key: "İşlemde", count: services.filter((s) => isStatus(s.status, "İşlemde")).length, cls: "process" },
    { label: "Ödeme Bekliyor", key: "Ödeme Bekliyor", count: services.filter((s) => isStatus(s.status, "Ödeme Bekliyor")).length, cls: "payment" },
    { label: "Tamamlandı", key: "İşlem Tamam", count: services.filter((s) => isStatus(s.status, "İşlem Tamam")).length, cls: "complete" },
    { label: "İptal Edildi", key: "İptal", count: services.filter((s) => isStatus(s.status, "İptal")).length, cls: "danger" },
  ];
  holder.innerHTML = stats.map((item) => `
    <button class="v420-stat-card v420-stat-${item.cls}" type="button" data-action="service-status-filter" data-status="${escapeAttr(item.key)}">
      <span>${escapeHtml(item.label)}</span>
      <b>${item.count}</b>
    </button>
  `).join("");
}

function filteredServices({ ignoreStatus = false } = {}) {
  const form = filterForm.elements;
  const query = norm(form.query.value);
  return state.services.filter((service) => {
    const queryText = norm([
      service.id,
      service.createdAt,
      service.customerName,
      service.phone,
      service.city,
      service.district,
      service.address,
      service.locationUrl,
      service.brand,
      service.device,
      service.model,
      service.fault,
      service.source,
      service.status,
      service.paymentStatus,
      service.operatorNote,
      service.availableTime,
      service.notes?.map((note) => note.text).join(" "),
    ].join(" "));
    const sourceFilter = topSourceFilter.value;
    const statusFilter = topStatusFilter.value;
    const range = serviceDateRangeForCurrentFilter();
    return matchesPortalSource(service.source)
      && (!query || query.split(" ").every((word) => queryText.includes(word)))
      && (ignoreStatus || !statusFilter || service.status === statusFilter)
      && dateInRange(serviceMainDate(service), range.start, range.end)
      && (!sourceFilter || sourceMatches(service.source, sourceFilter))
      && (!activeDashboardSource || sourceMatches(service.source, activeDashboardSource))
      && matchesDashboardStat(service);
  });
}

function applyDashboardStatFilter(stat) {
  if (isStatus(dashboardCounterBase(stat), "İşlem Tamam")) {
    const source=activeDashboardSource || (isSourcePortal()?portalSourceName():"");
    const ids=homeStatusServices("İşlem Tamam",source,"desktop").map(service=>String(service.id));
    switchView("services");
    homeServiceDrilldown={slot:"status-"+encodeURIComponent("İşlem Tamam"),ids:new Set(ids)};
    activeDashboardStat="";
    serviceQuickStatSelection=null;
    if(topStatusFilter)topStatusFilter.value="";
    renderServices();
    return;
  }
  const selectedSource = isSourcePortal() ? portalSourceName() : (activeDashboardSource || topSourceFilter?.value || "");
  activeDashboardStat = stat || "";
  activeDashboardSource = selectedSource;
  filterForm.reset();
  topSourceFilter.value = selectedSource || "";
  topStatusFilter.value = "";
  const range = dashboardCounterClickRange(stat);
  if (range) {
    if (dashboardStartDate) dashboardStartDate.value = range.start;
    if (dashboardEndDate) dashboardEndDate.value = range.end;
    syncDashboardDateRangeControls();
  }
  switchView("services");
  serviceQuickStatSelection = null;
  renderServices();
}

function showAllRecords() {
  activeDashboardStat = "";
  activeDashboardSource = "";
  filterForm?.reset();
  if (topSourceFilter) topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  if (topStatusFilter) topStatusFilter.value = "";
  if (dashboardStartDate) dashboardStartDate.value = "";
  if (dashboardEndDate) dashboardEndDate.value = "";
  syncDashboardDateRangeControls();
  switchView("services");
  serviceQuickStatSelection = null;
  renderDashboard();
  renderServices();
  renderCash();
}

function applyDashboardSourceFilter(source) {
  activeDashboardSource = isSourcePortal() ? portalSourceName() : (source || "");
  activeDashboardStat = "";
  filterForm.reset();
  topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  topStatusFilter.value = "";
  switchView("services");
  serviceQuickStatSelection = null;
  renderServices();
}

function clearServiceSelection() {
  activeDashboardStat = "";
  activeDashboardSource = "";
  filterForm.reset();
  topSourceFilter.value = "";
  topStatusFilter.value = "";
  updateDashboardDateRangeLabel();
  document.querySelectorAll(".service-check").forEach((input) => { input.checked = false; });
  renderServices();
}

function serviceDateRangeForCurrentFilter() {
  const statBase = dashboardCounterBase(activeDashboardStat);
  if (isStatus(statBase, "Yarın")) {
    const value = toIsoDate(tomorrow);
    return { start: value, end: value };
  }
  if (isStatus(statBase, "Açık Fişler") || (settingsList("statuses").some(status => isStatus(status, statBase)) && !isStatus(statBase, "İşlem Tamam"))) return { start: "", end: "" };
  return { start: dashboardStartDate?.value || "", end: dashboardEndDate?.value || (dashboardStartDate?.value || "") };
}

function dashboardCounterClickRange(stat) {
  stat = dashboardCounterBase(stat);
  if (isStatus(stat, "Yarın")) {
    const value = toIsoDate(tomorrow);
    return { start: value, end: value };
  }
  if (isStatus(stat, "Bugün")) return { start: isoToday, end: isoToday };
  if (isStatus(stat, "Açık Fişler") || (settingsList("statuses").some(status => isStatus(status, stat)) && !isStatus(stat, "İşlem Tamam"))) return { start: "", end: "" };
  return null;
}

function matchesDashboardStat(service) {
  if (!activeDashboardStat) return true;
  return matchesDashboardCounter(service, activeDashboardStat);
}

function matchesDashboardCounter(service, label) {
  label = dashboardCounterBase(label);
  if (isStatus(label, "Bugün")) return serviceHasDate(service, isoToday) && isActiveDashboardDateStatus(service.status);
  if (isStatus(label, "Yarın")) return serviceHasDate(service, toIsoDate(tomorrow)) && isActiveDashboardDateStatus(service.status);
  if (isStatus(label, "Açık Fişler")) return !isStatus(service.status, "İşlem Tamam") && !isStatus(service.status, "İptal");
  if (isStatus(label, "Kalan İşler")) return isStatus(service.status, "Yeni Kayıt") || isStatus(service.status, "İşlemde");
  if (isStatus(label, "Toplam Servis")) return true;
  return isStatus(service.status, label);
}

function isActiveDashboardDateStatus(status) {
  return isStatus(status, "Yeni Kayıt") || isStatus(status, "İşlemde") || isStatus(status, "Geri Dönen İş");
}

function isOpenDashboardSourceStatus(status) {
  return !isStatus(status, "İşlem Tamam") && !isStatus(status, "İptal");
}

function sortServices(services) {
  return [...services].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999999;
    const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function normalizeServiceOrder() {
  const sorted = sortServices(state.services);
  sorted.forEach((service, index) => { service.sortOrder = index; });
}

function moveServiceOrder(serviceId, direction) {
  const visible = sortServices(filteredServices());
  const currentIndex = visible.findIndex((service) => service.id === serviceId);
  if (currentIndex < 0) return;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= visible.length) return;
  normalizeServiceOrder();
  const current = state.services.find((service) => service.id === visible[currentIndex].id);
  const target = state.services.find((service) => service.id === visible[targetIndex].id);
  if (!current || !target) return;
  const oldOrder = current.sortOrder;
  current.sortOrder = target.sortOrder;
  target.sortOrder = oldOrder;
  saveState();
  renderServices();
}

function serviceCardFinancials(service) {
  const linkedCash = state.cash.filter((item) => item.serviceId === service.id);
  const income = linkedCash.filter((item) => item.type === "income").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const expense = linkedCash.filter((item) => item.type === "expense").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  return { income, expense, balance: income - expense };
}

function serviceRow(service) {
  const dateValue = service.availableDate || service.visitDate || service.createdAt?.slice(0, 10) || "";
  const timeValue = service.availableTime || service.createdAt?.slice(11, 16) || "Saat yok";
  const phoneClean = String(service.phone || "").replace(/\D/g, "");
  const phoneHref = phoneClean ? `tel:${phoneClean}` : "#";
  const paymentModeLabel = servicePaymentModeLabel(service);
  const finance = serviceCardFinancials(service);
  const detailLine = [service.device, service.brand].filter(Boolean).join(" · ");
  const statusText = service.status || "Durum yok";
  return `
    <article class="service-row v420-service-card v420-card-${serviceCardTheme(service.status)}" data-service-id="${escapeAttr(service.id)}">
      <div class="v420-card-date">
        <b>${escapeHtml(formatServiceCardDate(dateValue))}</b>
        <strong>${escapeHtml(timeValue)}</strong>
        <span>${escapeHtml(formatServiceCardDay(dateValue))}</span>
        <em class="status-pill ${statusClass(service.status)}">${escapeHtml(statusText)}</em>
      </div>
      <div class="v420-card-body">
        <div class="v420-card-title-row">
          <h3>${escapeHtml(service.address || service.customerName || "Servis Kaydı")}</h3>
          <span>${escapeHtml(service.source || "Kendi İşim")}</span>
        </div>
        <a class="v420-phone" href="${phoneHref}">${escapeHtml(service.phone || "Telefon yok")}</a>
        <p>${escapeHtml(detailLine || "Cihaz bilgisi yok")} ${detailLine ? "·" : ""} ${escapeHtml(service.fault || "Şikayet yazılmadı")}</p>
        ${paymentModeLabel ? `<small class="v420-payment-mode">${escapeHtml(paymentModeLabel)}</small>` : ""}
      </div>
      <div class="v420-card-money">
        <span>Alınan Tutar</span>
        <b>${money(finance.income)}</b>
        <span>Kalan (Ekzen Teknik)</span>
        <strong>${money(finance.balance)}</strong>
      </div>
      <div class="service-order-controls v420-order-controls" aria-label="Sıralama">
        <button class="service-order-button" type="button" data-action="move-service-order" data-service-id="${escapeAttr(service.id)}" data-direction="up" title="Yukarı taşı">↑</button>
        <button class="service-order-button" type="button" data-action="move-service-order" data-service-id="${escapeAttr(service.id)}" data-direction="down" title="Aşağı taşı">↓</button>
      </div>
    </article>
  `;
}

function renderCustomers() {
  const customers = uniqueCustomers();
  document.querySelector("#customerList").innerHTML = customers.map((customer) => `
    <div class="data-row">
      <strong>${escapeHtml(customer.customerName)}</strong>
      <span>${escapeHtml(customer.phone)}</span>
      <span>${escapeHtml(customer.city)}</span>
      <button class="ghost-button" type="button" data-service-id="${customer.latestServiceId}">Son Servis</button>
    </div>
  `).join("") || `<p class="empty">Müşteri bulunamadı.</p>`;
}

function uniqueCustomers() {
  const map = new Map();
  state.services.filter((service) => matchesPortalSource(service.source)).forEach((service) => {
    const key = `${norm(service.customerName)}-${norm(service.phone)}`;
    if (!map.has(key)) map.set(key, { ...service, latestServiceId: service.id });
  });
  return [...map.values()];
}

function renderSources() {
  document.querySelector("#sourceList").innerHTML = [...new Set(["Kendi İşim", ...settingsList("sources")])].map((source) => `
    <div class="data-row">
      <strong>${escapeHtml(source)}</strong>
      <span>Komisyon: %${sourceCommissionShare(source)}</span>
      <span>${state.services.filter((service) => sourceMatches(service.source, source)).length} servis</span>
      <span>${state.cash.filter((item) => sourceMatches(cashItemSource(item), source)).length} kasa hareketi</span>
      <div class="row-actions">
        <button class="mini-button" type="button" data-action="edit-source" data-source-name="${escapeAttr(source)}" title="Düzenle">✎</button>
        <button class="mini-button danger" type="button" data-action="delete-source" data-source-name="${escapeAttr(source)}" title="Sil">×</button>
      </div>
    </div>
  `).join("") || `<p class="empty">Servis kaynağı bulunamadı.</p>`;
}

function renderCash() {
  const items = filteredCash();
  const totals = cashTotals(items);
  const breakdown = cashBreakdown(items);
  renderCashSummary(items, totals, breakdown);
  const list = document.querySelector("#cashList");
  if (list) list.innerHTML = renderCashGroups(items, cashListMode);
  document.querySelectorAll("[data-action=\"set-cash-list-mode\"]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === cashListMode);
  });
}

function setCashListMode(mode) {
  cashListMode = mode === "cash" ? "cash" : "service";
  renderCash();
}

function renderEkzenCash() {
  const items = filteredEkzenCashItems();
  const totals = ekzenSpecialCashTotals(items);
  const allTimeTotals = ekzenSpecialCashTotals(state.cash || []);
  const summary = document.querySelector("#ekzenCashSummary");
  if (summary) {
    const cards = [
      { key: "turnover", label: "Toplam Ciro", value: totals.turnover, note: "Servis tahsilatları + manuel tahsilatlar" },
      { key: "serviceExpenses", label: "Servis Giderleri", value: totals.serviceExpenses, note: "Komisyon + malzeme giderleri", negative: true },
      { key: "companyExpenses", label: "Şirket Giderleri", value: totals.manualExpense, note: "Kaynaksız manuel giderler", negative: true },
      { key: "balance", label: "Kasa Durumu", value: allTimeTotals.cashBalance, note: "Tüm zamanlar" },
    ];
    summary.innerHTML = cards.map((card) => `
      <article class="ekzen-cash-card is-clickable" data-action="open-ekzen-cash-detail" data-detail-type="${card.key}">
        <span>${escapeHtml(card.label)}</span>
        <b class="${card.negative ? "cash-negative" : ""}">${card.negative ? "-" : ""}${money(card.value)}</b>
        <small>${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  }
  const list = document.querySelector("#ekzenCashManualList");
  if (list) {
    const rows = ekzenManualCashItems(items).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    list.innerHTML = rows.length ? rows.map(cashRow).join("") : `<p class="empty">Bu tarih aralığında Ekzen manuel tahsilat/gider yok.</p>`;
  }
}

function filteredEkzenCashItems() {
  const start = dashboardStartDate?.value || "";
  const end = dashboardEndDate?.value || start;
  return (state.cash || []).filter((item) => cashIsPosted(item) && dateInRange(cashFilterDate(item), start, end));
}

function ekzenSpecialCashTotals(items = filteredEkzenCashItems()) {
  const postedItems = postedCashItems(items || []);
  const primaryIncome = postedItems.filter(isServicePrimaryIncome);
  const manualIncomeItems = ekzenManualIncomeItems(postedItems);
  const manualExpenseItems = ekzenManualExpenseItems(postedItems);
  const ownWorkIncome = primaryIncome.filter((item) => isOwnWorkSource(cashItemSource(item)));
  const sourceIncome = primaryIncome.filter((item) => !isOwnWorkSource(cashItemSource(item)));
  const turnover = primaryIncome.reduce((t, item) => t + (Number(item.amount) || 0), 0)
    + manualIncomeItems.reduce((t, item) => t + (Number(item.amount) || 0), 0);
  const ekzenTechnical = ownWorkIncome.reduce((t, item) => t + (Number(item.amount) || 0), 0)
    + manualIncomeItems.reduce((t, item) => t + (Number(item.amount) || 0), 0);
  const sourceRevenue = sourceIncome.reduce((t, item) => t + (Number(item.amount) || 0), 0);
  const commission = sourceIncome.reduce((t, item) => t + sourcePayAmountForCashItem(item), 0);
  const material = postedItems.filter((item) => Boolean(item.serviceId) && item.autoMaterialExpense)
    .reduce((t, item) => t + (Number(item.amount) || 0), 0);
  const manualExpense = manualExpenseItems.reduce((t, item) => t + (Number(item.amount) || 0), 0);
  const serviceExpenses = commission + material;
  const cashBalance = turnover - serviceExpenses - manualExpense;
  return { turnover, ekzenTechnical, sourceRevenue, commission, material, serviceExpenses, manualExpense, cashBalance };
}

function ekzenManualIncomeItems(items = filteredEkzenCashItems()) {
  return postedCashItems(items || []).filter(isEkzenUnassignedManualIncome);
}

function ekzenManualCashItems(items = filteredEkzenCashItems()) {
  return postedCashItems(items || []).filter((item) => isEkzenUnassignedManualIncome(item) || isEkzenUnassignedManualExpense(item));
}

function ekzenManualExpenseItems(items = filteredEkzenCashItems()) {
  return postedCashItems(items || []).filter(isEkzenUnassignedManualExpense);
}

function isEkzenUnassignedManualIncome(item) {
  return item?.type === "income"
    && !item.serviceId
    && !item.parentCashId
    && !item.autoMaterialExpense
    && !item.autoCommissionExpense
    && !item.autoOtherExpense
    && !cashItemSource(item);
}

function isEkzenUnassignedManualExpense(item) {
  return item?.type === "expense"
    && !item.serviceId
    && !item.parentCashId
    && !item.autoMaterialExpense
    && !item.autoCommissionExpense
    && !item.autoOtherExpense
    && !cashItemSource(item);
}

function isEkzenManualCashOnlyItem(item) {
  return isEkzenUnassignedManualIncome(item) || isEkzenUnassignedManualExpense(item);
}

function openEkzenCashDetail(detailType = "turnover") {
  const dialog = document.querySelector("#ekzenCashDetailDialog");
  const content = document.querySelector("#ekzenCashDetailContent");
  const title = document.querySelector("#ekzenCashDetailTitle");
  if (!dialog || !content || !title) return;
  const labels = {
    turnover: "Toplam Ciro Detayı",
    serviceExpenses: "Servis Giderleri Detayı",
    companyExpenses: "Şirket Giderleri Detayı",
    balance: "Kasa Durumu Sağlama",
  };
  title.textContent = labels[detailType] || "Ekzen Kasa Detay";
  content.innerHTML = renderEkzenCashDetail(detailType);
  dialog.showModal();
}

function closeEkzenCashDetail() {
  document.querySelector("#ekzenCashDetailDialog")?.close();
}

function renderEkzenCashDetail(detailType = "turnover") {
  const items = filteredEkzenCashItems();
  const totals = detailType === "balance" ? ekzenSpecialCashTotals(state.cash || []) : ekzenSpecialCashTotals(items);
  if (detailType === "balance") {
    return `
      <section class="cash-current-section">
        <h3>Kasa durumu sağlaması</h3>
        <div class="cash-current-formula">
          <div><span>Toplam Ciro</span><b>${money(totals.turnover)}</b></div>
          <div><span>Servis Giderleri <small>(komisyon + malzeme)</small></span><b class="cash-negative">-${money(totals.serviceExpenses)}</b></div>
          <div><span>Şirket Giderleri <small>(kaynaksız manuel)</small></span><b class="cash-negative">-${money(totals.manualExpense)}</b></div>
          <div class="cash-current-total"><span>Kasa Durumu</span><b>${money(totals.cashBalance)}</b></div>
        </div>
      </section>
    `;
  }
  const rows = ekzenCashDetailRows(items, detailType);
  return `
    <section class="cash-current-section">
      <h3>${escapeHtml(ekzenDetailHeading(detailType))}</h3>
      ${rows.length ? rows.map(ekzenCashDetailRow).join("") : `<p class="empty">Bu başlıkta hareket yok.</p>`}
    </section>
  `;
}

function ekzenDetailHeading(detailType) {
  const headings = {
    turnover: "Tüm servis tahsilatları ve manuel tahsilatlar",
    serviceExpenses: "Komisyon ve malzeme giderleri",
    companyExpenses: "Kaynak seçmeden girilen manuel giderler",
  };
  return headings[detailType] || "Detay";
}

function ekzenCashDetailRows(items, detailType) {
  const postedItems = postedCashItems(items || []);
  if (detailType === "turnover") return [
    ...postedItems.filter(isServicePrimaryIncome).map((item) => ({ item, amount: Number(item.amount) || 0, sign: "+", note: item.serviceId ? "Servis tahsilatı" : "Tahsilat" })),
    ...ekzenManualIncomeItems(postedItems).map((item) => ({ item, amount: Number(item.amount) || 0, sign: "+", note: "Manuel tahsilat" })),
  ];
  if (detailType === "serviceExpenses") {
    const commissionRows = postedItems
      .filter((item) => isServicePrimaryIncome(item) && !isOwnWorkSource(cashItemSource(item)))
      .map((item) => ({ item, amount: sourcePayAmountForCashItem(item), sign: "-", note: "Komisyon" }));
    const materialRows = postedItems
      .filter((item) => Boolean(item.serviceId) && item.autoMaterialExpense)
      .map((item) => ({ item, amount: Number(item.amount) || 0, sign: "-", note: "Malzeme" }));
    return [...commissionRows, ...materialRows].sort((a, b) => (cashFilterDate(b.item) || "").localeCompare(cashFilterDate(a.item) || ""));
  }
  if (detailType === "companyExpenses") return ekzenManualExpenseItems(postedItems)
    .map((item) => ({ item, amount: Number(item.amount) || 0, sign: "-", note: item.description || "Şirket gideri" }));
  return [];
}

function ekzenCashDetailRows(items, detailType) {
  const postedItems = postedCashItems(items || []);
  if (detailType === "turnover") return [
    ...postedItems.filter(isServicePrimaryIncome),
    ...ekzenManualIncomeItems(postedItems),
  ].map((item) => ({ item, amount: Number(item.amount) || 0, sign: "+", note: item.serviceId ? "Servis tahsilatı" : "Manuel tahsilat" }));
  if (detailType === "ekzen") return [
    ...postedItems.filter((item) => isServicePrimaryIncome(item) && isOwnWorkSource(cashItemSource(item))),
    ...ekzenManualIncomeItems(postedItems),
  ].map((item) => ({ item, amount: Number(item.amount) || 0, sign: "+", note: item.serviceId ? "Kendi işim" : "Manuel tahsilat" }));
  if (detailType === "sources") return postedItems
    .filter((item) => isServicePrimaryIncome(item) && !isOwnWorkSource(cashItemSource(item)))
    .map((item) => ({ item, amount: Number(item.amount) || 0, sign: "+", note: cashItemSource(item) || "Servis kaynağı" }));
  if (detailType === "commission") return postedItems
    .filter((item) => isServicePrimaryIncome(item) && !isOwnWorkSource(cashItemSource(item)))
    .map((item) => ({ item, amount: sourcePayAmountForCashItem(item), sign: "-", note: "Kaynak payı / komisyon" }));
  if (detailType === "material") return postedItems
    .filter((item) => Boolean(item.serviceId) && item.autoMaterialExpense)
    .map((item) => ({ item, amount: Number(item.amount) || 0, sign: "-", note: cashItemSource(item) || "Malzeme" }));
  if (detailType === "expenses") return ekzenManualExpenseItems(postedItems)
    .map((item) => ({ item, amount: Number(item.amount) || 0, sign: "-", note: item.description || "Manuel gider" }));
  return [];
}

function ekzenCashDetailRow(row) {
  const item = row.item;
  const service = item.serviceId ? state.services.find((entry) => entry.id === item.serviceId) : null;
  const title = service ? `${service.customerName || "Servis"} · ${service.address || item.serviceId}` : visibleCashTitle(item);
  const sub = service ? `${cashItemSource(item) || "Kaynak yok"} · ${service.brand || ""} ${service.device || ""}`.trim() : (item.description || row.note || "");
  return `
    <div class="cash-current-row ${row.sign === "-" ? "is-expense" : ""}">
      <div><b>${escapeHtml(title || row.note || "Hareket")}</b><small>${escapeHtml(sub || row.note || "")}</small></div>
      <span>${escapeHtml(formatDate(cashFilterDate(item)))}</span>
      <strong>${row.sign}${money(row.amount)}</strong>
    </div>
  `;
}

function renderCashSummary(items, totals, breakdown) {
  const selectedSource = isSourcePortal() ? portalSourceName() : cashSourceFilter.value;
  if (selectedSource) {
    const sourceTotals = serviceSourceCounterBreakdown(items);
    const allTimeSourceItems = (state.cash || []).filter((item) => cashIsPosted(item)
      && !isEkzenManualCashOnlyItem(item)
      && matchesPortalSource(cashItemSource(item))
      && sourceMatches(cashItemSource(item), selectedSource));
    const allTimeSourceTotals = serviceSourceCounterBreakdown(allTimeSourceItems);
    if (isOwnWorkSource(selectedSource)) {
      const remainingAmount = sourceTotals.customerMoney - sourceTotals.material;
      document.querySelector("#cashSummary").innerHTML = `
        <article><span>Toplam Kazanç</span><b>${money(sourceTotals.customerMoney)}</b></article>
        <article><span>Toplam Malzeme</span><b class="cash-negative">-${money(sourceTotals.material)}</b></article>
        <article><span>Kalan Miktar</span><b>${money(remainingAmount)}</b></article>
      `;
      return;
    }
    document.querySelector("#cashSummary").innerHTML = `
      <article><span>Toplam Kazanç</span><b>${money(sourceTotals.customerMoney)}</b></article>
      <article><span>Toplam Malzeme</span><b class="cash-negative">-${money(sourceTotals.material)}</b></article>
      <article><span>Hakediş</span><b>${money(sourceTotals.hakedis)}</b></article>
      <article><span>Ekzen Teknik</span><b>${money(sourceTotals.ekzenTechnical)}</b></article>
      <article class="is-clickable cash-detail-counter" data-action="open-cash-current-detail" data-detail-type="payment"><span>Yapılan Ödeme</span><b>${money(Math.max(0, sourceTotals.hakedis - sourceTotals.remainingPayment))}</b><small>Geçmiş</small></article>
      <article class="is-clickable cash-detail-counter" data-action="open-cash-current-detail" data-detail-type="balance"><span>Kalan Ödeme</span><b>${money(allTimeSourceTotals.remainingPayment)}</b><small>Tüm zamanlar</small></article>
    `;
    return;
  }

  const allSourceTotals = serviceSourceCounterBreakdown(items);
  const values = {
    income: money(allSourceTotals.customerMoney),
    expense: `-${money(breakdown.manualExpense)}`,
    commission: `-${money(breakdown.commission)}`,
    material: `-${money(breakdown.material)}`,
    balance: money(breakdown.balance),
  };
  const visibleCounters = cashCounterList().filter((counter) => !["expense", "balance"].includes(counter.key));
  document.querySelector("#cashSummary").innerHTML = visibleCounters.map((counter) => `
    <article>
      <span>${escapeHtml(counter.label)}</span>
      <b class="${["expense", "commission", "material"].includes(counter.key) ? "cash-negative" : ""}">${values[counter.key] || money(0)}</b>
    </article>
  `).join("");
}

function renderCashGroups(items, mode = "service") {
  const serviceGroups = [];
  const serviceMap = new Map();
  const manualItems = [];

  items.forEach((item) => {
    if (!item.serviceId) {
      manualItems.push(item);
      return;
    }
    if (!serviceMap.has(item.serviceId)) {
      const group = { serviceId: item.serviceId, items: [] };
      serviceMap.set(item.serviceId, group);
      serviceGroups.push(group);
    }
    serviceMap.get(item.serviceId).items.push(item);
  });

  if (mode === "cash") {
    return manualItems.length ? `
      <section class="cash-group manual-cash-group">
        <header>
          <div>
            <b>Kasa hareketleri</b>
            <span>Servise bağlı olmayan manuel giriş/çıkışlar</span>
          </div>
          ${cashGroupSummary(manualItems)}
        </header>
        <div>${manualItems.map(cashRow).join("")}</div>
      </section>
    ` : `<p class="empty">Bu filtrede manuel kasa hareketi yok.</p>`;
  }

  return serviceGroups.length
    ? serviceGroups.map(cashServiceGroup).join("")
    : `<p class="empty">Bu filtrede servis hareketi yok.</p>`;
}

function cashServiceGroup(group) {
  const service = state.services.find((item) => item.id === group.serviceId);
  const sortedItems = sortCashGroupItems(group.items);
  const primaryItems = sortedItems.filter(isServicePrimaryIncome);
  const income = primaryItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const material = sortedItems.filter((item) => item.autoMaterialExpense || norm(item.title).includes("malzeme")).reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const otherExpense = sortedItems.filter((item) => item.autoOtherExpense || norm(item.title).includes("diger gider") || norm(item.title).includes("diğer gider")).reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const hakedis = primaryItems.reduce((total, item) => total + sourcePayAmountForCashItem(item), 0);
  const ekzenTechnical = primaryItems.reduce((total, item) => total + ownerPayAmountForCashItem(item), 0);
  const firstPrimary = primaryItems[0];
  const collectedLabel = firstPrimary
    ? (cashItemCollectedBy(firstPrimary) === "source" ? "Servis Kaynağı Aldı" : "Ben Aldım")
    : "Tahsilat bilgisi yok";
  const paymentModeLabel = service ? servicePaymentModeLabel(service) : "";
  const sourceName = service?.source || cashItemSource(group.items[0]) || "-";
  const serviceInfo = [service?.brand, service?.device].filter(Boolean).join(" ") || "Bağlı servis";
  const netBase = Math.max(income - material - otherExpense, 0);
  const detailsRows = sortedItems.map((item) => {
    const title = visibleCashTitle(item) || (item.autoMaterialExpense ? "Malzeme" : item.autoCommissionExpense ? "Hakediş" : item.autoOtherExpense ? "Diğer Gider" : "Tahsilat");
    return `
      <div class="cash-service-detail-row ${item.type === "expense" ? "is-expense" : ""}">
        <span>${escapeHtml(title)}</span>
        <small>${escapeHtml(formatDate(item.date))}</small>
        <b>${item.type === "expense" ? "-" : "+"}${money(item.amount)}</b>
      </div>
    `;
  }).join("");
  return `
    <section class="cash-service-card">
      <header class="cash-service-card-head">
        <div>
          <b>Servis ${escapeHtml(group.serviceId)} · ${escapeHtml(service?.customerName || "Servis kaydı")}</b>
          <span>${escapeHtml(serviceInfo)} · ${escapeHtml(sourceName)}</span>
        </div>
        <div class="cash-service-status">
          ${paymentModeLabel ? `<strong>${escapeHtml(paymentModeLabel)}</strong>` : ""}
          <small>${escapeHtml(collectedLabel)}</small>
        </div>
      </header>
      <div class="cash-service-card-grid">
        <div><span>Alınan Tutar</span><b>${money(income)}</b></div>
        <div><span>Toplam Malzeme</span><b class="cash-negative">-${money(material)}</b></div>
        <div><span>Komisyona Esas</span><b>${money(netBase)}</b></div>
        <div><span>Ekzen Teknik</span><b>${money(ekzenTechnical)}</b></div>
        <div><span>Hakediş</span><b>${money(hakedis)}</b></div>
        ${otherExpense ? `<div><span>Diğer Gider</span><b class="cash-negative">-${money(otherExpense)}</b></div>` : ""}
      </div>
      <details class="cash-service-details">
        <summary>Hareket detayları</summary>
        <div>${detailsRows}</div>
      </details>
    </section>
  `;
}

function sortCashGroupItems(items) {
  const order = (item) => {
    if (item.type === "income") return 0;
    if (item.autoMaterialExpense) return 1;
    if (item.autoCommissionExpense) return 2;
    return 3;
  };
  return [...items].sort((a, b) => order(a) - order(b) || (b.date || "").localeCompare(a.date || ""));
}

function cashServiceSummary(items) {
  const income = items.filter((item) => item.type === "income").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const material = items.filter((item) => item.autoMaterialExpense || norm(item.title).includes("malzeme")).reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const commission = items.filter((item) => item.autoCommissionExpense || norm(item.title).includes("komisyon")).reduce((total, item) => total + (Number(item.amount) || 0), 0);
  return `
    <div class="cash-service-summary">
      <strong>Toplam alınan tutar ${money(income)}</strong>
      <span>Malzeme gideri ${money(material)}</span>
      <span>Komisyon ${money(commission)}</span>
    </div>
  `;
}

function cashGroupSummary(items) {
  const totals = cashTotals(items);
  return `
    <div class="cash-group-summary">
      <span>Gelir ${money(totals.income)}</span>
      <span>Gider ${money(totals.expense)}</span>
      <strong>Bakiye ${money(totals.balance)}</strong>
    </div>
  `;
}

function cashRow(item) {
  const source = cashItemSource(item);
  const badge = item.autoMaterialExpense ? "Malzeme" : item.autoCommissionExpense ? "Komisyon" : item.autoServiceIncome ? "Otomatik" : item.parentCashId ? "Bağlı" : "";
  const title = visibleCashTitle(item);
  const description = (item.description || "").trim();
  return `
    <div class="data-row cash-row ${item.type === "expense" ? "is-expense" : ""}">
      <strong class="cash-row-title">${escapeHtml(title)}${badge ? `<small>${badge}</small>` : ""}${description ? `<em>${escapeHtml(description)}</em>` : ""}</strong>
      <span>${formatDate(item.date)}</span>
      <span>${item.type === "expense" ? "Gider" : "Tahsilat"}${item.serviceId ? ` · ${escapeHtml(item.serviceId)}` : ""}</span>
      <span>${escapeHtml(source || "-")}</span>
      <strong class="cash-row-amount">${item.type === "expense" ? "-" : "+"}${money(item.amount)}</strong>
      ${canEditPortalRecords() ? `<div class="row-actions">
        <button class="mini-button" type="button" data-action="edit-cash" data-cash-id="${item.id}" title="Düzenle">✎</button>
        <button class="mini-button danger" type="button" data-action="delete-cash" data-cash-id="${item.id}" title="Sil">×</button>
      </div>` : ""}
    </div>
  `;
}

function filteredCash() {
  const source = isSourcePortal() ? portalSourceName() : cashSourceFilter.value;
  const start = dashboardStartDate?.value || cashStartDate?.value || "";
  const end = dashboardEndDate?.value || cashEndDate?.value || start;
  return state.cash.filter((item) => {
    const date = cashFilterDate(item);
    return cashIsPosted(item)
      && !isEkzenManualCashOnlyItem(item)
      && (!source || sourceMatches(cashItemSource(item), source))
      && dateInRange(date, start, end);
  });
}

function cashTotals(items = state.cash) {
  return postedCashItems(items).reduce((totals, item) => {
    if (item.type === "income") totals.income += Number(item.amount) || 0;
    if (item.type === "expense") totals.expense += Number(item.amount) || 0;
    totals.balance = totals.income - totals.expense;
    return totals;
  }, { income: 0, expense: 0, balance: 0 });
}

function cashRemainingBalance(items = state.cash) {
  return cashTotals(items.filter((item) => !isOwnWorkSource(cashItemSource(item)))).balance;
}

function filteredDashboardServices() {
  const start = dashboardStartDate.value;
  const end = dashboardEndDate.value;
  return state.services.filter((service) => matchesPortalSource(service.source)
    && (!activeDashboardSource || sourceMatches(service.source, activeDashboardSource))
    && dateInRange(serviceMainDate(service), start, end));
}

function filteredDashboardCash() {
  const start = dashboardStartDate.value;
  const end = dashboardEndDate.value;
  return state.cash.filter((item) => cashIsPosted(item)
    && matchesPortalSource(cashItemSource(item))
    && (!activeDashboardSource || sourceMatches(cashItemSource(item), activeDashboardSource))
    && dateInRange(cashFilterDate(item), start, end));
}

function filteredDashboardCashForBalance() {
  if (activeDashboardSource || isSourcePortal()) {
    const source = isSourcePortal() ? portalSourceName() : activeDashboardSource;
    return state.cash.filter((item) => cashIsPosted(item)
      && matchesPortalSource(cashItemSource(item))
      && (!source || sourceMatches(cashItemSource(item), source)));
  }
  return filteredDashboardCash();
}

function cashFilterDate(item) {
  if (item?.serviceId) {
    const service = state.services.find((entry) => entry.id === item.serviceId);
    if (service) return serviceMainDate(service) || item.date || "";
  }
  return item?.date || "";
}

function currentWeekRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function dateInRange(date, start, end) {
  const value = normalizeIsoDateValue(date);
  const rangeStart = normalizeIsoDateValue(start);
  const rangeEnd = normalizeIsoDateValue(end);
  return (!rangeStart || value >= rangeStart) && (!rangeEnd || value <= rangeEnd);
}

function normalizeIsoDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) return toIsoDate(value);
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return text.slice(0, 10);
}

function openDashboardDateRangeDialog() {
  syncDashboardDateRangeControls();
  dashboardDateRangeDialog?.showModal();
}

function closeDashboardDateRangeDialog() {
  dashboardDateRangeDialog?.close();
}

function syncDashboardDateRangeControls() {
  if (dashboardRangeStartPicker) dashboardRangeStartPicker.value = dashboardStartDate?.value || "";
  if (dashboardRangeEndPicker) dashboardRangeEndPicker.value = dashboardEndDate?.value || "";
  updateDashboardDateRangePreview();
  updateDashboardDateRangeLabel();
  markActiveDashboardPreset();
}

function updateDashboardDateRangePreview() {
  if (!dashboardDateRangePreview) return;
  const start = dashboardRangeStartPicker?.value ?? dashboardStartDate?.value ?? "";
  const end = dashboardRangeEndPicker?.value ?? dashboardEndDate?.value ?? start;
  dashboardDateRangePreview.textContent = dashboardRangeText(start, end);
}

function updateDashboardDateRangeLabel() {
  if (!dashboardDateRangeLabel) return;
  const start = dashboardStartDate?.value || "";
  const end = dashboardEndDate?.value || start;
  const text = dashboardRangeText(start, end);
  dashboardDateRangeLabel.textContent = text;
  document.querySelectorAll("[data-date-range-label]").forEach((item) => { item.textContent = text; });
}

function dashboardRangeText(start, end) {
  if (!start && !end) return "Tüm zamanlar";
  if (start && !end) return `${formatDate(start)} sonrası`;
  if (!start && end) return `${formatDate(end)} öncesi`;
  if (start === end) {
    if (start === isoToday) return "Bugün";
    if (start === addDaysIso(isoToday, -1)) return "Dün";
    if (start === toIsoDate(tomorrow)) return "Yarın";
    return formatDate(start);
  }
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function applyDashboardDatePreset(rangeKey, closeAfterApply = true) {
  const range = dashboardPresetRange(rangeKey);
  if (!range) return;
  if (dashboardRangeStartPicker) dashboardRangeStartPicker.value = range.start;
  if (dashboardRangeEndPicker) dashboardRangeEndPicker.value = range.end;
  if (dashboardStartDate) dashboardStartDate.value = range.start;
  if (dashboardEndDate) dashboardEndDate.value = range.end;
  updateDashboardDateRangePreview();
  updateDashboardDateRangeLabel();
  markActiveDashboardPreset(rangeKey);
  renderDashboard();
  renderServices();
  renderCash();
  renderEkzenCash();
  if (closeAfterApply) closeDashboardDateRangeDialog();
}

function applyDashboardCustomDateRange() {
  let start = dashboardRangeStartPicker?.value || "";
  let end = dashboardRangeEndPicker?.value || start;
  if (start && end && start > end) [start, end] = [end, start];
  if (dashboardStartDate) dashboardStartDate.value = start;
  if (dashboardEndDate) dashboardEndDate.value = end;
  updateDashboardDateRangeLabel();
  markActiveDashboardPreset();
  closeDashboardDateRangeDialog();
  renderDashboard();
  renderServices();
  renderCash();
  renderEkzenCash();
}

function markActiveDashboardPreset() {
  const start = dashboardRangeStartPicker?.value ?? dashboardStartDate?.value ?? "";
  const end = dashboardRangeEndPicker?.value ?? dashboardEndDate?.value ?? start;
  document.querySelectorAll('[data-action="dashboard-date-preset"]').forEach((button) => {
    const range = dashboardPresetRange(button.dataset.range);
    button.classList.toggle("is-active", Boolean(range && range.start === start && range.end === end));
  });
}

function dashboardPresetRange(key) {
  const todayDate = parseIsoDate(isoToday);
  const day = todayDate.getDay() || 7;
  const startOfThisWeek = addDaysDate(todayDate, 1 - day);
  const startOfLastWeek = addDaysDate(startOfThisWeek, -7);
  const startOfThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const startOfLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
  const endOfLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
  const ranges = {
    today: { start: isoToday, end: isoToday },
    yesterday: { start: addDaysIso(isoToday, -1), end: addDaysIso(isoToday, -1) },
    tomorrow: { start: toIsoDate(tomorrow), end: toIsoDate(tomorrow) },
    thisWeek: { start: toIsoDate(startOfThisWeek), end: isoToday },
    last7: { start: addDaysIso(isoToday, -6), end: isoToday },
    lastWeek: { start: toIsoDate(startOfLastWeek), end: toIsoDate(addDaysDate(startOfLastWeek, 6)) },
    last14: { start: addDaysIso(isoToday, -13), end: isoToday },
    thisMonth: { start: toIsoDate(startOfThisMonth), end: isoToday },
    allTime: { start: "", end: "" },
    last30: { start: addDaysIso(isoToday, -29), end: isoToday },
    lastMonth: { start: toIsoDate(startOfLastMonth), end: toIsoDate(endOfLastMonth) },
  };
  return ranges[key];
}

function addDaysIso(value, amount) {
  return toIsoDate(addDaysDate(parseIsoDate(value), amount));
}

function addDaysDate(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function parseIsoDate(value) {
  const [year, month, day] = String(value || isoToday).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function cashBreakdown(items = state.cash) {
  return postedCashItems(items).reduce((totals, item) => {
    if (!affectsRealCash(item)) return totals;
    const amount = Number(item.amount) || 0;
    if (item.type === "income") totals.income += amount;
    else if (item.autoCommissionExpense) totals.commission += amount;
    else if (item.autoMaterialExpense) totals.material += amount;
    else totals.manualExpense += amount;
    totals.balance = totals.income - totals.manualExpense - totals.commission - totals.material;
    return totals;
  }, { income: 0, manualExpense: 0, commission: 0, material: 0, balance: 0 });
}

function isServicePrimaryIncome(item) {
  return Boolean(item?.serviceId)
    && item.type === "income"
    && !item.parentCashId
    && !item.autoMaterialExpense
    && !item.autoCommissionExpense
    && !item.autoOtherExpense;
}

function isServiceSettlementExpense(item) {
  return Boolean(item?.serviceId) && (item.autoMaterialExpense || item.autoCommissionExpense);
}

function cashItemCollectedBy(item) {
  return item?.collectedBy === "source" ? "source" : "me";
}

function isSourceCollectedPrimaryIncome(item) {
  return isServicePrimaryIncome(item) && cashItemCollectedBy(item) === "source";
}

function parentCashItem(item) {
  if (!item?.parentCashId) return null;
  return (state.cash || []).find((candidate) => candidate.id === item.parentCashId) || null;
}

function affectsRealCash(item) {
  if (isSourceCollectedPrimaryIncome(item)) return false;
  const parent = parentCashItem(item);
  if (parent && isSourceCollectedPrimaryIncome(parent)) return false;
  return true;
}

function serviceOnlyCashBreakdown(items = state.cash) {
  return cashBreakdown((items || []).filter((item) => isServicePrimaryIncome(item) || isServiceSettlementExpense(item)));
}

function serviceSourceCounterBreakdown(items = state.cash) {
  const postedItems = postedCashItems(items || []);
  const primaryIncomeItems = postedItems.filter(isServicePrimaryIncome);
  const customerMoney = primaryIncomeItems
    .reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const material = postedItems
    .filter((item) => Boolean(item?.serviceId) && item.autoMaterialExpense)
    .reduce((total, item) => total + (Number(item.amount) || 0), 0);

  // Servis kaynaklarında fişte seçilen yüzde bize kalan orandır.
  // Hakediş toplamı tahsilat yapan kişiden bağımsızdır; sayaçta her zaman toplam kaynak payı görünür.
  // Tahsilat yapan kişi sadece Kalan Ödeme yönünü belirler:
  // - Ben aldıysam kaynak payı Kalan Ödeme'yi artırır.
  // - Servis kaynağı aldıysa benim hakedişim Kalan Ödeme'den düşer; gerekirse bakiye eksiye iner.
  const hakedis = primaryIncomeItems
    .reduce((total, item) => total + sourcePayAmountForCashItem(item), 0);
  const sourceCollectedReceivable = primaryIncomeItems
    .filter((item) => cashItemCollectedBy(item) === "source")
    .reduce((total, item) => total + ownerPayAmountForCashItem(item), 0);

  const ekzenTechnical = primaryIncomeItems
    .reduce((total, item) => total + ownerPayAmountForCashItem(item), 0);

  const manualExpense = postedItems
    .filter((item) => item.type === "expense" && !item.serviceId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense)
    .reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const manualIncome = postedItems
    .filter((item) => item.type === "income" && !item.serviceId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense)
    .reduce((total, item) => total + (Number(item.amount) || 0), 0);
  return {
    customerMoney,
    material,
    hakedis,
    ekzenTechnical,
    sourceCollectedReceivable,
    manualExpense,
    manualIncome,
    remainingPayment: hakedis - sourceCollectedReceivable - postedItems.filter(item => item.type === "expense" && !item.serviceId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense && (item.cashPurpose === "source-offset" || (!item.cashPurpose && !isOwnWorkSource(cashItemSource(item)) && Boolean(cashItemSource(item))))).reduce((sum,item)=>sum+(Number(item.amount)||0),0) + postedItems.filter(item => item.type === "income" && !item.serviceId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense && (item.cashPurpose === "source-offset" || (!item.cashPurpose && !isOwnWorkSource(cashItemSource(item)) && Boolean(cashItemSource(item))))).reduce((sum,item)=>sum+(Number(item.amount)||0),0),
  };
}

function sourcePayAmountForCashItem(item) {
  if (!item || !isServicePrimaryIncome(item)) return 0;
  const receivedAmount = Number(item.amount) || 0;
  const materialCost = Number(item.materialCost) || 0;
  const otherExpense = Number(item.otherExpense) || 0;
  const base = Math.max(receivedAmount - materialCost - otherExpense, 0);
  const rate = Number(item.commissionRate !== undefined ? item.commissionRate : (item.commission50 ? 50 : 0)) || 0;
  if (isOwnWorkSource(cashItemSource(item))) {
    return base * rate / 100;
  }
  return base * Math.max(100 - rate, 0) / 100;
}

function ownerPayAmountForCashItem(item) {
  if (!item || !isServicePrimaryIncome(item)) return 0;
  const receivedAmount = Number(item.amount) || 0;
  const materialCost = Number(item.materialCost) || 0;
  const otherExpense = Number(item.otherExpense) || 0;
  const base = Math.max(receivedAmount - materialCost - otherExpense, 0);
  const rate = Number(item.commissionRate !== undefined ? item.commissionRate : (item.commission50 ? 50 : 0)) || 0;
  if (isOwnWorkSource(cashItemSource(item))) {
    return base * Math.max(100 - rate, 0) / 100;
  }
  return base * rate / 100;
}

function dashboardServiceProfit(items = state.cash) {
  const totals = serviceOnlyCashBreakdown(items);
  return totals.income - totals.commission - totals.material;
}



function openAccountingCheck() {
  const dialog = document.querySelector("#accountingCheckDialog");
  const content = document.querySelector("#accountingCheckContent");
  if (!dialog || !content) return;
  content.innerHTML = renderAccountingCheckReport();
  dialog.showModal();
}

function closeAccountingCheck() {
  document.querySelector("#accountingCheckDialog")?.close();
}


function openHomeServiceList(slot){
 const source=activeDashboardSource||(isSourcePortal()?portalSourceName():"");
 const items=filteredDashboardCash();
 const pending=(state.services||[]).filter(service=>matchesPortalSource(service.source)&&(!source||sourceMatches(service.source,source))&&(isStatus(service.status,"Ödeme Bekliyor")||["Havale Bekleniyor","Sonra Tahsil Edilecek"].includes(String(service.paymentStatus||""))));
 const statusName=slot.startsWith("status-")?decodeURIComponent(slot.slice(7)):null;
 const ids=statusName?homeStatusServices(statusName,source,"desktop").map(service=>String(service.id)):slot==="payment"?pending.map(service=>String(service.id)):items.filter(isServicePrimaryIncome).map(item=>String(item.serviceId));
 switchView("services");
 homeServiceDrilldown={slot,ids:new Set(ids)};
 serviceQuickStatSelection=null;
 if(topStatusFilter)topStatusFilter.value="";
 renderServices();
 const result=document.querySelector("#serviceList");
 result?.scrollIntoView({behavior:"smooth",block:"start"});
}
function openHomeCashMovements(slot){
 const dialog=document.querySelector("#cashCurrentDetailDialog");
 const content=document.querySelector("#cashCurrentDetailContent");
 const title=document.querySelector("#cashCurrentDetailTitle");
 if(!dialog||!content||!title)return;
 const source=activeDashboardSource||(isSourcePortal()?portalSourceName():"");
 const items=filteredDashboardCash();
 const context=homeCashCounterContext(items,source);
 const counter=allHomeCashSlots().find(c=>c.id===slot);
 const value=counter?homeCashCounterValue(counter,context):0;
 const labels={profit:"Net Kazanç",commission:"Ödenen Komisyon",material:"Malzeme"};
 const matching=items.filter(item=>{
   if(slot==="commission")return Boolean(item.autoCommissionExpense);
   if(slot==="material")return Boolean(item.autoMaterialExpense);
   return isServicePrimaryIncome(item)||Boolean(item.autoCommissionExpense)||Boolean(item.autoMaterialExpense)||Boolean(item.autoOtherExpense)||(!item.serviceId&&(item.type==="income"||item.type==="expense"));
 });
 const totals=cashBreakdown(items);
 const service=serviceOnlyCashBreakdown(items);
 const sourceTotals=serviceSourceCounterBreakdown(items);
 const summary=slot==="profit"?(context.isExternal?
   [['Tahsilat',sourceTotals.customerMoney],['Malzeme',-sourceTotals.material],['Hakediş',sourceTotals.hakedis],['Ekzen Payı',sourceTotals.ekzenTechnical]]:
   [['Servis Hasılatı',service.income],['Komisyon',-service.commission],['Malzeme',-service.material],['Diğer Gider',-totals.manualExpense]]):
   [[slot==="material"?"Malzeme Gideri":"Komisyon Gideri",value]];
 title.textContent=(labels[slot]||counter?.name||"Kasa Özeti")+" · "+(source||"Tüm Kaynaklar");
 content.innerHTML='<div class="cash-current-summary">'+summary.map(([label,amount])=>'<article><span>'+escapeHtml(label)+'</span><b>'+money(amount)+'</b></article>').join("")+
 '<article><span>Sayaç Toplamı</span><b>'+money(value)+'</b></article></div>'+
 '<h3>Bu tutarı oluşturan kasa hareketleri</h3>'+
 (matching.length?((matching.some(item=>Boolean(item.serviceId))?renderCashGroups(matching.filter(item=>Boolean(item.serviceId)),"service"):"")+(matching.some(item=>!item.serviceId)?renderCashGroups(matching.filter(item=>!item.serviceId),"cash"):"")):'<p>Bu tarih aralığında kasa hareketi yok.</p>');
 dialog.showModal();
}
function openHomePendingPayments(){
 const dialog=document.querySelector("#cashCurrentDetailDialog");
 const content=document.querySelector("#cashCurrentDetailContent");
 const title=document.querySelector("#cashCurrentDetailTitle");
 if(!dialog||!content||!title)return;
 const source=activeDashboardSource||(isSourcePortal()?portalSourceName():"");
 const pending=(state.services||[]).filter(service=>matchesPortalSource(service.source)&&(!source||sourceMatches(service.source,source))&&(isStatus(service.status,"Ödeme Bekliyor")||["Havale Bekleniyor","Sonra Tahsil Edilecek"].includes(String(service.paymentStatus||""))));
 title.textContent="Ödeme Bekleyen Fişler · "+(source||"Tüm Kaynaklar");
 content.innerHTML=pending.length?pending.map(service=>'<div class="cash-current-summary"><article><span>'+escapeHtml(service.customerName||service.id||"Fiş")+'</span><b>'+money(Number(primaryCashForService(service.id)?.amount??service.price??0)||0)+'</b></article></div>').join(""):'<p>Ödeme bekleyen fiş yok.</p>';
 dialog.showModal();
}
function openCashCurrentDetail(detailType = "balance") {
  const dialog = document.querySelector("#cashCurrentDetailDialog");
  const content = document.querySelector("#cashCurrentDetailContent");
  const title = document.querySelector("#cashCurrentDetailTitle");
  if (!dialog || !content || !title) return;
  const selectedSource = isSourcePortal() ? portalSourceName() : cashSourceFilter.value;
  const sourceLabel = selectedSource || "Tüm Kaynaklar";
  title.textContent = detailType === "payment" ? `Yapılan Ödeme Geçmişi · ${sourceLabel}` : `Cari Detay · ${sourceLabel}`;
  content.innerHTML = renderCashCurrentDetail(detailType, selectedSource);
  dialog.showModal();
}

function closeCashCurrentDetail() {
  document.querySelector("#cashCurrentDetailDialog")?.close();
}

function renderCashCurrentDetail(detailType = "balance", selectedSource = "") {
  const items = filteredCash();
  const allTimeItems = (state.cash || []).filter((item) => cashIsPosted(item)
    && !isEkzenManualCashOnlyItem(item)
    && matchesPortalSource(cashItemSource(item))
    && (!selectedSource || sourceMatches(cashItemSource(item), selectedSource)));
  const sourceItems = detailType === "balance"
    ? allTimeItems
    : (selectedSource ? items.filter((item) => sourceMatches(cashItemSource(item), selectedSource)) : items);
  const totals = serviceSourceCounterBreakdown(sourceItems);
  const paymentAmount = Math.max(0, totals.hakedis - totals.remainingPayment);
  const manualPayments = postedCashItems(sourceItems).filter((item) =>
    !item.serviceId
    && !item.autoMaterialExpense
    && !item.autoCommissionExpense
    && !item.autoOtherExpense
    && (item.type === "expense" || item.type === "income")
  );
  const sourceCollectedJobs = postedCashItems(sourceItems).filter((item) => isServicePrimaryIncome(item) && cashItemCollectedBy(item) === "source");
  const periodLabel = detailType === "balance"
    ? "Tüm zamanlar"
    : (dashboardStartDate?.value && dashboardEndDate?.value
      ? `${formatDate(dashboardStartDate.value)} - ${formatDate(dashboardEndDate.value)}`
      : "Seçili tarih");
  const summary = `
    <div class="cash-current-summary">
      <article><span>Dönem</span><b>${escapeHtml(periodLabel)}</b></article>
      <article><span>Hakediş</span><b>${money(totals.hakedis)}</b></article>
      <article><span>Yapılan Ödeme</span><b>${money(paymentAmount)}</b></article>
      <article><span>Kalan Ödeme</span><b class="${totals.remainingPayment < 0 ? "cash-negative" : ""}">${money(totals.remainingPayment)}</b></article>
    </div>
  `;
  const cariFormula = `
    <section class="cash-current-section">
      <h3>Cari sağlama</h3>
      <div class="cash-current-formula">
        <div><span>Hakediş</span><b>${money(totals.hakedis)}</b></div>
        <div><span>Kaynağın aldığı işlerde Ekzen Teknik alacağı</span><b class="cash-negative">-${money(totals.sourceCollectedReceivable)}</b></div>
        <div><span>Kaynak alacağından mahsup</span><b class="cash-negative">-${money(Math.max(0, totals.hakedis - totals.sourceCollectedReceivable - totals.remainingPayment))}</b></div>
        <div><span>İşletme giderleri kaynak bakiyesini değiştirmez</span><b>—</b></div>
        <div class="cash-current-total"><span>Kalan Ödeme</span><b>${money(totals.remainingPayment)}</b></div>
      </div>
    </section>
  `;
  const manualRows = manualPayments.length ? manualPayments
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((item) => `
      <div class="cash-current-row ${item.type === "expense" ? "is-expense" : ""}">
        <div><b>${escapeHtml(visibleCashTitle(item))}</b><small>${escapeHtml(item.description || "Açıklama yok")}</small></div>
        <span>${escapeHtml(formatDate(item.date))}</span>
        <strong>${item.type === "expense" ? "-" : "+"}${money(item.amount)}</strong>
      </div>
    `).join("") : `<p class="empty">Bu tarih aralığında manuel ödeme hareketi yok.</p>`;
  const collectedRows = sourceCollectedJobs.length ? sourceCollectedJobs
    .sort((a, b) => (cashFilterDate(b) || "").localeCompare(cashFilterDate(a) || ""))
    .map((item) => {
      const service = state.services.find((serviceItem) => serviceItem.id === item.serviceId);
      const ownerPay = ownerPayAmountForCashItem(item);
      return `
        <div class="cash-current-row is-expense">
          <div><b>Servis ${escapeHtml(item.serviceId)} · ${escapeHtml(service?.customerName || "Servis")}</b><small>Parayı servis kaynağı aldı; Ekzen Teknik alacağı bakiyeden düşer.</small></div>
          <span>${escapeHtml(formatDate(cashFilterDate(item)))}</span>
          <strong>-${money(ownerPay)}</strong>
        </div>
      `;
    }).join("") : `<p class="empty">Bu tarih aralığında servis kaynağının tahsil ettiği iş yok.</p>`;
  const history = `
    <section class="cash-current-section">
      <h3>Manuel ödeme hareketleri</h3>
      ${manualRows}
    </section>
    <section class="cash-current-section">
      <h3>Servis kaynağının aldığı işler</h3>
      ${collectedRows}
    </section>
  `;
  if (detailType === "payment") return `${summary}${history}`;
  return `${summary}${cariFormula}${history}`;
}

function renderAccountingCheckReport() {
  const postedItems = postedCashItems(state.cash || []);
  const primaryItems = postedItems.filter(isServicePrimaryIncome);
  const allSources = uniqueValues([
    ...settingsList("sources"),
    ...primaryItems.map((item) => cashItemSource(item) || "Kendi İşim"),
  ]);
  const allTotals = serviceSourceCounterBreakdown(postedItems);
  const perSourceTotals = allSources.reduce((totals, source) => {
    const sourceItems = postedItems.filter((item) => sourceMatches(cashItemSource(item), source));
    const sourceTotals = serviceSourceCounterBreakdown(sourceItems);
    totals.customerMoney += sourceTotals.customerMoney;
    totals.material += sourceTotals.material;
    totals.hakedis += sourceTotals.hakedis;
    totals.ekzenTechnical = (totals.ekzenTechnical || 0) + (sourceTotals.ekzenTechnical || 0);
    totals.sourceCollectedReceivable += sourceTotals.sourceCollectedReceivable;
    totals.manualExpense += sourceTotals.manualExpense;
    totals.manualIncome += sourceTotals.manualIncome;
    totals.remainingPayment += sourceTotals.remainingPayment;
    return totals;
  }, { customerMoney: 0, material: 0, hakedis: 0, ekzenTechnical: 0, sourceCollectedReceivable: 0, manualExpense: 0, manualIncome: 0, remainingPayment: 0 });

  const equation = primaryItems.reduce((totals, item) => {
    const amount = Number(item.amount) || 0;
    const material = Number(item.materialCost) || 0;
    const other = Number(item.otherExpense) || 0;
    const owner = ownerPayAmountForCashItem(item);
    const source = sourcePayAmountForCashItem(item);
    totals.customerMoney += amount;
    totals.material += material;
    totals.other += other;
    totals.owner += owner;
    totals.source += source;
    const diff = amount - material - other - owner - source;
    if (Math.abs(diff) >= 1) {
      totals.errors.push({
        serviceId: item.serviceId || item.id,
        title: serviceLabelForAccounting(item),
        diff,
        amount,
        material,
        other,
        owner,
        source,
      });
    }
    return totals;
  }, { customerMoney: 0, material: 0, other: 0, owner: 0, source: 0, errors: [] });
  equation.diff = equation.customerMoney - equation.material - equation.other - equation.owner - equation.source;

  const duplicateServiceIncome = [...groupBy(primaryItems, (item) => item.serviceId || item.id).entries()]
    .filter(([serviceId, items]) => serviceId && items.length > 1)
    .map(([serviceId, items]) => ({ serviceId, count: items.length, amount: sumBy(items, (item) => Number(item.amount) || 0) }));

  const orphanCashItems = postedItems
    .filter((item) => item.serviceId && !state.services.some((service) => service.id === item.serviceId))
    .map((item) => ({ id: item.id, serviceId: item.serviceId, title: item.title || visibleCashTitle(item) || "Kasa hareketi", amount: Number(item.amount) || 0 }));

  const sourceDiffs = {
    customerMoney: allTotals.customerMoney - perSourceTotals.customerMoney,
    material: allTotals.material - perSourceTotals.material,
    hakedis: allTotals.hakedis - perSourceTotals.hakedis,
    remainingPayment: allTotals.remainingPayment - perSourceTotals.remainingPayment,
  };

  const currentDashboardTotals = serviceSourceCounterBreakdown(filteredDashboardCash());
  const currentCashTotals = serviceSourceCounterBreakdown(filteredCash());
  const currentDiff = {
    customerMoney: currentDashboardTotals.customerMoney - currentCashTotals.customerMoney,
    material: currentDashboardTotals.material - currentCashTotals.material,
    hakedis: currentDashboardTotals.hakedis - currentCashTotals.hakedis,
  };

  const failures = [];
  if (Math.abs(equation.diff) >= 1) failures.push(`Genel denklemde ${money(equation.diff)} fark var.`);
  Object.entries(sourceDiffs).forEach(([key, value]) => { if (Math.abs(value) >= 1) failures.push(`Tüm Kaynaklar toplamında ${accountingLabel(key)} farkı: ${money(value)}.`); });
  Object.entries(currentDiff).forEach(([key, value]) => { if (Math.abs(value) >= 1) failures.push(`Ana sayfa / kasa mevcut filtre ${accountingLabel(key)} farkı: ${money(value)}.`); });
  if (duplicateServiceIncome.length) failures.push(`${duplicateServiceIncome.length} serviste birden fazla ana tahsilat satırı var.`);
  if (orphanCashItems.length) failures.push(`${orphanCashItems.length} kasa hareketi silinmiş/bulunamayan servise bağlı.`);
  if (equation.errors.length) failures.push(`${equation.errors.length} servis denkleminde 1 TL üstü fark var.`);

  const statusClass = failures.length ? "accounting-bad" : "accounting-ok";
  const statusText = failures.length ? "Dikkat: fark var" : "Sağlam: fark yok";

  return `
    <section class="accounting-status ${statusClass}">
      <strong>${statusText}</strong>
      <span>${failures.length ? "Ödeme yapmadan önce aşağıdaki kırmızı satırları kontrol et." : "Tüm ana para kontrolleri birbirini tutuyor."}</span>
    </section>

    <div class="accounting-grid">
      <article><span>Servis ana tahsilat</span><b>${primaryItems.length}</b></article>
      <article><span>Toplam Hasılat</span><b>${money(equation.customerMoney)}</b></article>
      <article><span>Toplam Malzeme</span><b>${money(equation.material)}</b></article>
      <article><span>Senin Hakedişin</span><b>${money(equation.owner)}</b></article>
      <article><span>Kaynak Payı</span><b>${money(equation.source)}</b></article>
      <article><span>Denklem Farkı</span><b class="${Math.abs(equation.diff) >= 1 ? "cash-negative" : ""}">${money(equation.diff)}</b></article>
    </div>

    <section class="accounting-section">
      <h3>Genel denklem</h3>
      ${accountingCheckRow("Hasılat = Malzeme + Diğer Gider + Senin Hakedişin + Kaynak Payı", equation.customerMoney, equation.material + equation.other + equation.owner + equation.source)}
    </section>

    <section class="accounting-section">
      <h3>Tüm Kaynaklar sağlaması</h3>
      ${accountingCheckRow("Toplam Hasılat", allTotals.customerMoney, perSourceTotals.customerMoney)}
      ${accountingCheckRow("Toplam Malzeme", allTotals.material, perSourceTotals.material)}
      ${accountingCheckRow("Hakediş", allTotals.hakedis, perSourceTotals.hakedis)}
      ${accountingCheckRow("Kalan Ödeme", allTotals.remainingPayment, perSourceTotals.remainingPayment)}
    </section>

    <section class="accounting-section">
      <h3>Mevcut filtre: Ana sayfa / Kasa</h3>
      <p class="accounting-help">Bu bölüm, ekranda seçili tarih ve kaynak filtrelerine göre iki sayfanın aynı hasılat hesabını kullanıp kullanmadığını kontrol eder.</p>
      ${accountingCheckRow("Toplam Hasılat", currentDashboardTotals.customerMoney, currentCashTotals.customerMoney)}
      ${accountingCheckRow("Toplam Malzeme", currentDashboardTotals.material, currentCashTotals.material)}
      ${accountingCheckRow("Hakediş", currentDashboardTotals.hakedis, currentCashTotals.hakedis)}
    </section>

    ${failures.length ? `<section class="accounting-section accounting-errors"><h3>Bulunan sorunlar</h3>${failures.map((text) => `<div class="accounting-error-row">${escapeHtml(text)}</div>`).join("")}</section>` : ""}

    ${duplicateServiceIncome.length ? `<section class="accounting-section accounting-errors"><h3>Çift tahsilat ihtimali</h3>${duplicateServiceIncome.slice(0, 20).map((item) => `<div class="accounting-error-row">Servis ${escapeHtml(item.serviceId)} · ${item.count} tahsilat satırı · ${money(item.amount)}</div>`).join("")}</section>` : ""}

    ${orphanCashItems.length ? `<section class="accounting-section accounting-errors"><h3>Servis bağlantısı bulunamayan kasa hareketleri</h3>${orphanCashItems.slice(0, 20).map((item) => `<div class="accounting-error-row">Servis ${escapeHtml(item.serviceId)} · ${escapeHtml(item.title)} · ${money(item.amount)}</div>`).join("")}</section>` : ""}

    ${equation.errors.length ? `<section class="accounting-section accounting-errors"><h3>Denklem farkı olan servisler</h3>${equation.errors.slice(0, 20).map((item) => `<div class="accounting-error-row">Servis ${escapeHtml(item.serviceId)} · Fark ${money(item.diff)} · ${escapeHtml(item.title)}</div>`).join("")}</section>` : ""}
  `;
}

function accountingCheckRow(label, left, right) {
  const diff = (Number(left) || 0) - (Number(right) || 0);
  const ok = Math.abs(diff) < 1;
  return `
    <div class="accounting-check-row ${ok ? "is-ok" : "is-bad"}">
      <span>${escapeHtml(label)}</span>
      <b>${money(left)}</b>
      <b>${money(right)}</b>
      <strong>${ok ? "✓" : `Fark ${money(diff)}`}</strong>
    </div>
  `;
}

function accountingLabel(key) {
  return ({ customerMoney: "hasılat", material: "malzeme", hakedis: "hakediş", remainingPayment: "kalan ödeme" })[key] || key;
}

function serviceLabelForAccounting(item) {
  const service = state.services.find((entry) => entry.id === item.serviceId);
  return service ? `${service.customerName || "Servis"} · ${service.source || "Kaynak yok"}` : (item.title || "Servis hareketi");
}

function groupBy(items, getKey) {
  const map = new Map();
  (items || []).forEach((item) => {
    const key = getKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function sumBy(items, getValue) {
  return (items || []).reduce((total, item) => total + (Number(getValue(item)) || 0), 0);
}

function dashboardOwnerCashStatus(items = state.cash) {
  return postedCashItems(items).reduce((total, item) => {
    const amount = Number(item.amount) || 0;
    const source = cashItemSource(item);
    if (item.type === "income" && isOwnWorkSource(source)) return total + amount;
    if (item.autoCommissionExpense && !isOwnWorkSource(source)) return total + amount;
    return total;
  }, 0);
}

function customerCashBalance(items = state.cash) {
  const serviceItems = items.filter((item) => item.serviceId);
  const totals = cashBreakdown(serviceItems);
  const ownWorkManualItems = items.filter((item) => !item.serviceId && isOwnWorkSource(cashItemSource(item)));
  const ownWorkManualTotals = cashTotals(ownWorkManualItems);
  return totals.income - totals.material - totals.commission + ownWorkManualTotals.balance;
}

let activeSettingsTab="settingsCounters";
let activeSourceSettingsTab="counters";
let activeHomeDeviceTab="mobile";
let activeSourceHomeDeviceTab="mobile";
let activeSourceCounterDeviceTab="mobile";
function showSettingsTab(tab){
 const sections=["settingsCompany","settingsHome","settingsCounters","settingsSources","settingsListsPanel","settingsSecurity"];
 if(!sections.includes(tab))return;
 activeSettingsTab=tab;
 const group=["settingsHome","settingsCounters","settingsSources"].includes(tab)?"settingsCounters":tab;
 document.querySelectorAll("#settingsView .settings-tabs [data-settings-tab]").forEach(b=>{
   const active=b.dataset.settingsTab===group;
   b.classList.toggle("is-active",active);
   b.setAttribute("aria-pressed",String(active));
 });
 const subnav=document.querySelector("#settingsSubTabs");
 if(subnav)subnav.hidden=group!=="settingsCounters";
 document.querySelectorAll("#settingsSubTabs [data-settings-subtab]").forEach(b=>{
   const active=b.dataset.settingsSubtab===tab;
   b.classList.toggle("is-active",active);
   b.setAttribute("aria-pressed",String(active));
 });
 sections.forEach(id=>{const node=document.getElementById(id);if(node)node.hidden=id!==tab;});
}
function showSourceSettingsTab(tab){
 if(!["counters","home","finance"].includes(tab))return;
 activeSourceSettingsTab=tab;
 document.querySelectorAll("#sourceSpecialSettings [data-source-settings-tab]").forEach(b=>{
   const active=b.dataset.sourceSettingsTab===tab;
   b.classList.toggle("is-active",active);
   b.setAttribute("aria-pressed",String(active));
 });
 document.querySelectorAll("#sourceSpecialSettings [data-source-settings-panel]").forEach(panel=>{
   panel.hidden=panel.dataset.sourceSettingsPanel!==tab;
 });
}
document.addEventListener("click",event=>{
 const moveHome=event.target.closest("#sourceSpecialSettings [data-source-home-move]");
 if(moveHome){
   event.preventDefault();
   const row=moveHome.closest(".source-home-order-row");
   const list=row?.parentElement;
   const direction=Number(moveHome.dataset.sourceHomeMove);
   if(row&&list){
     if(direction<0&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
     else if(direction>0&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
   }
   return;
 }
 const homeDevice=event.target.closest("#homeLayoutSettings [data-home-device-tab]");
 if(homeDevice){activeHomeDeviceTab=homeDevice.dataset.homeDeviceTab;renderHomeLayoutSettings();return;}
 const counterDevice=event.target.closest("#sourceSpecialSettings [data-source-counter-device-tab]");
 if(counterDevice){activeSourceCounterDeviceTab=counterDevice.dataset.sourceCounterDeviceTab;renderSourceSpecialSettings();return;}
 const sourceDevice=event.target.closest("#sourceSpecialSettings [data-source-home-device-tab]");
 if(sourceDevice){activeSourceHomeDeviceTab=sourceDevice.dataset.sourceHomeDeviceTab;document.querySelectorAll("#sourceSpecialSettings [data-source-home-device-tab]").forEach(b=>b.classList.toggle("is-active",b.dataset.sourceHomeDeviceTab===activeSourceHomeDeviceTab));document.querySelectorAll("#sourceSpecialSettings [data-source-device-panel]").forEach(p=>p.hidden=p.dataset.sourceDevicePanel!==activeSourceHomeDeviceTab);const note=document.querySelector("#sourceSpecialSettings .device-settings-notice strong");if(note)note.textContent=activeSourceHomeDeviceTab==="mobile"?"📱 Telefon":"💻 Mac / Masaüstü";return;}
 const settingsSub=event.target.closest("#settingsView [data-settings-subtab]");
 if(settingsSub){showSettingsTab(settingsSub.dataset.settingsSubtab);return;}
 const tab=event.target.closest("#settingsView [data-settings-tab]");
 if(tab){showSettingsTab(tab.dataset.settingsTab);return;}
 const sub=event.target.closest("#sourceSpecialSettings [data-source-settings-tab]");
 if(sub){showSourceSettingsTab(sub.dataset.sourceSettingsTab);return;}
});

document.addEventListener("click",event=>{const button=event.target.closest("#saveSpecialSourceSettings");if(!button)return;event.preventDefault();event.stopPropagation();if(!button.disabled)saveSourceSpecialSettings();},true);

function renderSettings() {
  const form = document.querySelector("#settingsForm");
  Object.entries(state.company).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || "";
  });
  renderSettingsLists();
  renderDashboardCounterDesigner();
  renderCustomCashCounterSettings();
  renderHomeLayoutSettings();
  renderSourceSpecialSettings();
  showSettingsTab(activeSettingsTab);
}

function renderSettingsLists() {
  const container = document.querySelector("#settingsLists");
  container.innerHTML = Object.entries(settingsLabels).filter(([key])=>key!=="dashboardCounters" && key!=="cashCounters").map(([key, label]) => `
    <section class="settings-list">
      <header>
        <h3>${escapeHtml(label)}</h3>
        ${key === "cashCounters" ? "" : `<button class="mini-button" type="button" data-action="add-setting-item" data-list="${key}" title="Ekle">+</button>`}
      </header>
      <div>
        ${settingsItemsForList(key).map((item) => `
          <div class="setting-chip">
            <span>${escapeHtml(item.label)}</span>
            <div class="row-actions">
              ${["sources", "statuses", "dashboardCounters", "cashCounters"].includes(key) ? `<button class="mini-button" type="button" data-action="move-setting-item" data-list="${key}" data-value="${escapeAttr(item.value)}" data-direction="up" title="Yukarı">↑</button>
              <button class="mini-button" type="button" data-action="move-setting-item" data-list="${key}" data-value="${escapeAttr(item.value)}" data-direction="down" title="Aşağı">↓</button>` : ""}
              <button class="mini-button" type="button" data-action="edit-setting-item" data-list="${key}" data-value="${escapeAttr(item.value)}" title="Düzenle">✎</button>
              ${key === "cashCounters" ? "" : `<button class="mini-button danger" type="button" data-action="delete-setting-item" data-list="${key}" data-value="${escapeAttr(item.value)}" title="Sil">×</button>`}
            </div>
          </div>
        `).join("") || `<p class="empty">Kayıt yok.</p>`}
      </div>
    </section>
  `).join("");
}

function settingsItemsForList(key) {
  if (key === "cashCounters") return cashCounterList().map((counter) => ({ value: counter.key, label: counter.label }));
  return settingsList(key).map((value) => ({ value, label: value }));
}

function desktopPopulateDistricts() {
 const select=serviceForm?.elements?.district;
 if(!select)return;
 select.innerHTML='<option value="">İlçe seçin</option>'+ANKARA_DISTRICTS.map(([name])=>'<option value="'+escapeAttr(name)+'">'+escapeHtml(name)+'</option>').join('');
}
async function desktopPopulateNeighborhoods(district,selected="") {
 const select=serviceForm?.elements?.neighborhood;
 if(!select)return;
 const expected=district;
 select.innerHTML='<option value="">Mahalleler yükleniyor...</option>';
 try {
  const names=await loadAnkaraNeighborhoods(district);
  if(serviceForm.elements.district.value!==expected)return;
  select.innerHTML='<option value="">Mahalle seçin</option>'+names.map(name=>'<option value="'+escapeAttr(name)+'">'+escapeHtml(name)+'</option>').join('');
  if(selected && !names.includes(selected))select.add(new Option(selected,selected));
  select.value=selected||"";
 }catch(error) {
  select.innerHTML='<option value="">Mahalle listesi alınamadı</option>';
  if(selected) {select.add(new Option(selected,selected));select.value=selected;}
 }
}
serviceForm?.elements?.district?.addEventListener("change",()=>{
 desktopPopulateNeighborhoods(serviceForm.elements.district.value);
});
function openServiceForm(service) {
  if (isSourcePortal() && service) return;
  serviceForm.reset();
  desktopPopulateDistricts();
  serviceForm.elements.city.value = "Ankara";
  serviceForm.elements.id.value = "";
  serviceForm.elements.status.value = "Yeni Kayıt";
  serviceForm.elements.source.value = isSourcePortal() ? portalSourceName() : "Kendi İşim";
  serviceForm.elements.availableDate.value = isoToday;
  serviceForm.elements.warrantyEnd.value = addYear(isoToday);
  document.querySelector("#serviceDialogTitle").textContent = "Yeni Servis";
  serviceDialog.querySelector("[data-action='delete-service']").style.visibility = "hidden";

  if (service) {
    if (!matchesPortalSource(service.source)) return;
    Object.entries(service).forEach(([key, value]) => {
      if (serviceForm.elements[key]) serviceForm.elements[key].value = value || "";
    });
    if(service.neighborhood) serviceForm.elements.address.value=removeSelectedNeighborhoodPrefix(service.address,service.neighborhood);
    keepSelectValue(serviceForm.elements.source, service.source);
    if(service.district) {serviceForm.elements.district.value=service.district;desktopPopulateNeighborhoods(service.district,service.neighborhood||"");}
    serviceForm.elements.district.required=false;
    serviceForm.elements.neighborhood.required=false;
    document.querySelector("#serviceDialogTitle").textContent = `Servisi Güncelle (${service.id})`;
    serviceDialog.querySelector("[data-action='delete-service']").style.visibility = "visible";
  }
  serviceDialog.showModal();
}

function openRelatedServiceForm(serviceId) {
  const original = state.services.find((service) => service.id === serviceId);
  if (!original || !matchesPortalSource(original.source)) return;
  detailDialog.close();
  openServiceForm();
  serviceForm.elements.customerName.value = original.customerName || "";
  serviceForm.elements.phone.value = original.phone || "";
  serviceForm.elements.address.value = original.address || "";
  serviceForm.elements.availableTime.value = original.availableTime || "";
  serviceForm.elements.source.value = isSourcePortal() ? portalSourceName() : (original.source || serviceForm.elements.source.value);
  if (!isSourcePortal()) keepSelectValue(serviceForm.elements.source, original.source);
  serviceForm.elements.brand.value = "";
  serviceForm.elements.device.value = "";
  serviceForm.elements.model.value = "";
  serviceForm.elements.fault.value = "";
  serviceForm.elements.operatorNote.value = "";
  document.querySelector("#serviceDialogTitle").textContent = `Yeni Servis (${original.customerName || original.phone || "Müşteri"})`;
}

function saveService(formData) {
  const data = Object.fromEntries(formData);
  const isUpdate = Boolean(data.id);
  if (isSourcePortal() && isUpdate) return;
  const previous = state.services.find((service) => service.id === data.id);
  if (isSourcePortal() && previous && !matchesPortalSource(previous.source)) return;
  if (isSourcePortal()) data.source = portalSourceName();
  data.city = "Ankara";
  if(data.neighborhood) data.address = removeSelectedNeighborhoodPrefix(data.address,data.neighborhood);
  const status = isUpdate ? data.status : "Yeni Kayıt";
  const service = {
    ...(previous || {}),
    ...data,
    id: data.id || nextServiceId(),
    createdAt: previous?.createdAt || new Date().toISOString(),
    status,
    price: previous?.price || 0,
    sortOrder: previous?.sortOrder ?? (state.services.reduce((min, item) => Math.min(min, Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0), 0) - 1),
    notes: previous?.notes || [],
    photos: previous?.photos || [],
    statusHistory: previous?.statusHistory || [{
      id: uid(),
      date: toIsoDate(new Date()),
      status: "Yeni Kayıt",
      description: "Yeni servis kaydı alındı",
      createdAt: new Date().toISOString(),
    }],
    history: previous?.history || [],
  };

  if (isUpdate) state.services = state.services.map((item) => item.id === service.id ? service : item);
  else state.services.unshift(service);
  saveState();
  serviceDialog.close();
  render();
  if (!isMobileTechViewport()) switchView("services");
}

function deleteCurrentService() {
  const id = serviceForm.elements.id.value;
  if (!id) return;
  const service = state.services.find((item) => item.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  if (!confirm(`${id} numaralı servis silinsin mi?`)) return;
  removeServiceAndLinkedCash(id);
}

function removeServiceAndLinkedCash(id) {
  const before = state.services.length;
  state.services = state.services.filter((entry) => entry.id !== id);
  if (state.services.length === before) return;
  state.cash = state.cash.filter((entry) => entry.serviceId !== id);
  activeDetailId = "";
  if (serviceDialog.open) serviceDialog.close();
  if (detailDialog.open) detailDialog.close();
  mobileCloseDetail();
  saveState();
  render();
  refreshMobileServiceViews();
}

function deleteServiceById(id) {
  if (isSourcePortal()) return;
  const service = state.services.find((entry) => entry.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  if (!confirm(`${service.customerName || id} — ${id} numaralı servis ve bağlı kasa hareketleri kalıcı olarak silinsin mi?`)) return;
  removeServiceAndLinkedCash(id);
}

function openDetail(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  activeDetailId = id;
  renderDetail(id);
  detailDialog.showModal();
}

function printSingleServiceCard(serviceId) {
 const service=state.services.find(item=>String(item.id)===String(serviceId));
 if(!service)return;
 const safe=(value)=>escapeHtml(String(value??"").trim()||"—");
 const address=mobileFullAddress(service)||"—";
 const fields=[
  ["Müşteri",service.customerName],["Telefon",service.phone],
  ["Adres",address],["Kayıt Tarihi",formatDisplayDate(service.createdAt?.slice(0,10)||service.availableDate||"")],
  ["Servis Tarihi",formatDisplayDate(service.visitDate||service.availableDate||"")],
  ["Cihaz",[service.brand,service.device].filter(Boolean).join(" ")],
  ["Model",service.model],["Şikâyet",service.fault]
 ];
 const closed=mobileIsDoneService(service);
 const settlement=primaryCashForService(service.id);
 const received=Number(settlement?.amount??service.price??0)||0;
 const material=Number(settlement?.materialCost??0)||0;
 const sourceName=String(settlement?.source||service.source||"").trim();
 const ownSource=isOwnWorkSource(sourceName);
 const sourceShare=settlement?(ownSource?ownerPayAmountForCashItem(settlement):sourcePayAmountForCashItem(settlement)):null;
 const money=(value)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(value);
 // Bu kısa servis kartı iç hesap dökümüdür; müşteriye gönderilen A4 servis fişi ayrıdır.
 const financial=closed ? '<section class="financial">'+
 '<div><strong>Alınan Tutar</strong><b>'+safe(money(received))+'</b></div>'+
 (material>0?'<div><strong>Malzeme Gideri</strong><b>'+safe(money(material))+'</b></div>':'')+
 (sourceName?'<div><strong>İş Kaynağı</strong><b>'+safe(sourceName)+'</b></div>':'')+
 (sourceShare!==null&&sourceName?'<div class="grand"><strong>'+safe(ownSource?"Kendi İşim Payı":"Kaynak Hakedişi")+'</strong><b>'+safe(money(sourceShare))+'</b></div>':'')+
 '</section>' : '';
 const rows=fields.map(([label,value])=>'<div class="line"><strong>'+safe(label)+'</strong><span>'+safe(value)+'</span></div>').join("");
 const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Servis Kartı '+safe(service.id)+'</title><style>'+
 '@page{size:A5 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#142638;margin:0;background:#fff}'+
 '.sheet{border:2px solid #c6d7df;border-radius:14px;padding:20px;break-inside:avoid;page-break-inside:avoid}'+
 '.heading{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #148d82;padding-bottom:13px;margin-bottom:14px}'+
 'h1{font-size:21px;margin:0;color:#117c74}.number{font-size:13px;font-weight:bold}'+
 '.financial{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:16px;padding-top:13px;border-top:2px solid #148d82}.financial>div{padding:10px 6px;background:#f2f7fa;border:1px solid #d9e5ed;border-radius:8px;text-align:center;min-width:0}.financial strong{display:block;font-size:10px;margin-bottom:8px;color:#52647b}.financial b{font-size:14px;overflow-wrap:anywhere}.financial .grand{background:#e5f4f0;border-color:#83bcb1}'+
 '.line{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid #e2e8ef;font-size:14px;line-height:1.45;overflow-wrap:anywhere}'+
 '.line:last-child{border-bottom:0}.line strong{color:#41566d}.toolbar{margin:18px auto;text-align:center}.toolbar button{background:#138b80;color:white;border:0;border-radius:8px;padding:12px 24px;font-weight:bold;cursor:pointer}'+
 '@media print{.toolbar{display:none!important}body{margin:0}.sheet{border-color:#aabdc9}}'+
 '</style></head><body><div class="toolbar"><button onclick="window.print()">Yazdır / PDF olarak kaydet</button></div>'+
 '<main class="sheet"><div class="heading"><h1>SERVİS KARTI</h1><div class="number">Fiş No: '+safe(service.id)+'</div></div>'+rows+financial+'</main></body></html>';
 const win=window.open("","_blank");
 if(!win){alert("PDF penceresi engellendi. Tarayıcıdan açılır pencerelere izin verin.");return;}
 win.document.open();win.document.write(html);win.document.close();
 win.focus();
}
function renderDetail(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  document.querySelector("#detailTitle").textContent = ``;
  const linkedCash = state.cash.filter((item) => item.serviceId === service.id);
  const cleanPhone = digits(service.phone);
  const addressText = [service.city, service.district, service.address].filter(Boolean).join(" ");
  const mapUrl = safeServiceLocationUrl(service.locationUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
  const whatsappUrl = cleanPhone ? `https://wa.me/9${cleanPhone}` : "#";
  const serviceTotal = linkedCash.filter((item) => item.type === "income").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const serviceExpense = linkedCash.filter((item) => item.type === "expense").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const serviceBalance = serviceTotal - serviceExpense;
  const primaryIncomeItems = linkedCash.filter(isServicePrimaryIncome);
  const receivedTotal = primaryIncomeItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const materialTotal = linkedCash.filter((item) => item.autoMaterialExpense).reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const hakedisTotal = primaryIncomeItems.reduce((total, item) => total + sourcePayAmountForCashItem(item), 0);
  const ekzenTotal = primaryIncomeItems.reduce((total, item) => total + ownerPayAmountForCashItem(item), 0);
  const financeLabel = isOwnWorkSource(service.source) ? "Kalan Miktar" : "Ekzen Teknik";

  detailBody.innerHTML = `
    <button type="button" class="desktop-delete-service-btn" data-action="delete-service-direct" data-service-id="${escapeAttr(service.id)}">Fişi Sil</button>
    <div class="v412-detail">
      <div class="v412-grid v412-top-grid">
        <section class="v412-card">
          <h3><span class="v412-section-icon">●</span> Müşteri Bilgileri</h3>
          <dl>
            <dt>İsim Soyisim</dt><dd>${escapeHtml(service.customerName || "-")}</dd>
            <dt>Telefon</dt><dd>${escapeHtml(service.phone || "-")} ${cleanPhone ? `<a class="v412-inline-phone" href="tel:${cleanPhone}" title="Ara">☎</a>` : ""}</dd>
            <dt>Adres</dt><dd>${escapeHtml(addressText || service.address || "-")}</dd>
            ${safeServiceLocationUrl(service.locationUrl) ? `<dt>WhatsApp Konumu</dt><dd><a href="${escapeAttr(mapUrl)}" target="_blank" rel="noopener noreferrer">Konumu Aç</a></dd>` : ""}
            <dt>Kayıt Tarihi</dt><dd>${formatDate(service.date || service.availableDate)} ${escapeHtml(service.time || "")}</dd>
            <dt>Durum</dt><dd><span class="status-pill ${statusClass(service.status)}">${escapeHtml(service.status)}</span></dd>
          </dl>
        </section>

        <section class="v412-card">
          <h3><span class="v412-section-icon">▣</span> Cihaz Bilgileri</h3>
          <dl>
            <dt>Cihaz</dt><dd>${escapeHtml(service.device || "-")}</dd>
            <dt>Marka</dt><dd>${escapeHtml(service.brand || "-")}</dd>
            ${service.model ? `<dt>Model</dt><dd>${escapeHtml(service.model)}</dd>` : ""}
            ${service.warrantyEnd ? `<dt>Garanti Bitiş</dt><dd>${formatDate(service.warrantyEnd)}</dd>` : ""}
            <dt>Şikayet</dt><dd class="v412-fault">${escapeHtml(service.fault || "-")}</dd>
          </dl>
        </section>
      </div>

      <section class="v412-card v412-wide">
        <h3><span class="v412-section-icon">▣</span> Finans Bilgileri</h3>
        <div class="v412-money-grid">
          <article><span>Alınan Tutar</span><b class="money-green">${money(receivedTotal || serviceTotal)}</b></article>
          <article><span>Malzeme</span><b class="money-orange">${money(materialTotal)}</b></article>
          <article><span>Hakediş (Komisyon)</span><b>${money(hakedisTotal)}</b><small>%${Number(primaryIncomeItems[0]?.commissionRate || 0)}</small></article>
          <article><span>${isOwnWorkSource(service.source) ? "Kalan Miktar" : "Ekzen Teknik (Kalan)"}</span><b class="money-green">${money(ekzenTotal || serviceBalance)}</b></article>
        </div>
      </section>

      <div class="v412-grid">
        <section class="v412-card">
          <h3><span class="v412-section-icon">▤</span> Açıklamalar</h3>
          <div class="v412-note-box">
            ${service.notes.length ? service.notes.map((note) => `
              <div class="v412-note-item">
                <b>${formatDateTime(note.createdAt)}</b>
                <p>${escapeHtml(note.text)}</p>
                ${canEditPortalRecords() ? `<div class="row-actions">
                  <button class="mini-button" type="button" data-action="edit-note" data-service-id="${service.id}" data-note-id="${note.id}">✎</button>
                  <button class="mini-button danger" type="button" data-action="delete-note" data-service-id="${service.id}" data-note-id="${note.id}">×</button>
                </div>` : ""}
              </div>
            `).join("") : `<p class="empty">Not veya açıklama bulunmuyor.</p>`}
          </div>
        </section>

        <section class="v412-card">
          <h3><span class="v412-section-icon">▣</span> Fotoğraflar</h3>
          ${service.photos.length ? `<div class="v412-photo-grid">${service.photos.map((photo) => `
            <article class="photo-card">
              <img src="${photo.dataUrl}" alt="${escapeHtml(photo.caption || "Servis fotoğrafı")}" data-action="open-photo-viewer" data-service-id="${escapeAttr(service.id)}" data-photo-id="${escapeAttr(photo.id)}" title="Büyüt">
              <footer>
                <b>${escapeHtml(photo.caption || "Fotoğraf")}</b>
                ${canEditPortalRecords() ? `<div class="row-actions">
                  <button class="mini-button" type="button" data-action="edit-photo" data-service-id="${service.id}" data-photo-id="${photo.id}">✎</button>
                  <button class="mini-button danger" type="button" data-action="delete-photo" data-service-id="${service.id}" data-photo-id="${photo.id}">×</button>
                </div>` : ""}
              </footer>
            </article>
          `).join("")}</div>` : `<div class="v412-empty-photo"><span>▣</span><p>Fotoğraf bulunmuyor.</p></div>`}
        </section>
      </div>

      <section class="v412-card v412-wide v412-actions-card">
        <h3><span class="v412-section-icon">⚡</span> Hızlı İşlemler</h3>
        <div class="v412-actions">
          <a class="v412-action" href="tel:${cleanPhone}"><span>☎</span><b>Ara</b></a>
          <a class="v412-action" href="${whatsappUrl}" target="_blank" rel="noopener"><span>☘</span><b>WhatsApp</b></a>
          <a class="v412-action" href="${mapUrl}" target="_blank" rel="noopener"><span>⌖</span><b>Yol Tarifi</b></a>
          ${canEditPortalRecords() ? `<button class="v412-action" type="button" data-action="change-status" data-service-id="${service.id}"><span>↔</span><b>Durum Değiştir</b></button>` : ""}
          ${canEditPortalRecords() ? `<button class="v412-action" type="button" data-action="add-cash" data-service-id="${service.id}"><span>▰</span><b>Tahsilat / Gider</b></button>` : ""}
          ${canEditPortalRecords() ? `<button class="v412-action" type="button" data-action="add-note" data-service-id="${service.id}"><span>▤</span><b>Not Ekle</b></button>` : ""}
          ${canEditPortalRecords() ? `<button class="v412-action" type="button" data-action="add-photo" data-service-id="${service.id}"><span>▣</span><b>Fotoğraf Ekle</b></button>` : ""}
          ${canEditPortalRecords() ? `<button class="v412-action v412-primary" type="button" data-action="complete-service" data-service-id="${service.id}"><span>✓</span><b>İşlem Tamamla</b></button>` : ""}
          ${canEditPortalRecords() ? `<button class="v412-action" type="button" data-edit-service="${service.id}"><span>✎</span><b>Güncelle</b></button>` : ""}
          <button class="v412-action" type="button" data-action="open-related-service" data-service-id="${service.id}"><span>↻</span><b>Tekrar Aç</b></button>
          <button class="v412-action" type="button" data-print-service><span>⎙</span><b>Yazdır</b></button>
        </div>
      </section>
    </div>
  `;

  detailBody.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => {
      detailDialog.close();
      openServiceForm(service);
    }, { once: true });
  });
  detailBody.querySelector("[data-print-service]")?.addEventListener("click", () => printSingleServiceCard(service.id), { once: true });
}

function openStatusForm(serviceId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  statusForm.reset();
  statusForm.elements.serviceId.value = serviceId;
  statusForm.elements.status.value = service.status;
  statusForm.elements.date.value = service.availableDate || isoToday;
  statusForm.elements.description.value = "";
  statusDialog.showModal();
}

function saveStatus(formData) {
  if (isSourcePortal()) return;
  const data = Object.fromEntries(formData);
  const service = state.services.find((item) => item.id === data.serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  service.status = data.status;
  service.availableDate = data.date || service.availableDate;
  if (!Array.isArray(service.statusHistory)) service.statusHistory = [];
  service.statusHistory.unshift({
    id: uid(),
    date: data.date,
    status: data.status,
    description: data.description,
    createdAt: new Date().toISOString(),
  });
  saveState();
  statusDialog.close();
  render();
}

function openCompleteForm(serviceId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  completeForm.reset();
  completeForm.elements.serviceId.value = serviceId;
  completeForm.elements.type.value = "income";
  completeForm.elements.amount.value = service.price && Number(service.price) > 0 ? String(service.price) : "";
  completeForm.elements.materialCost.value = "";
  if (completeForm.elements.otherExpense) completeForm.elements.otherExpense.value = "";
  completeForm.elements.commissionRate.value = String(sourceCommissionRate(service.source));
  if (completeForm.elements.collectedBy) completeForm.elements.collectedBy.value = "me";
  completeForm.elements.source.value = service.source || "";
  keepSelectValue(completeForm.elements.source, service.source);
  completeForm.elements.workNote.value = "";
  completeDialog.showModal();
}


function normalizePaymentMode(value) {
  const mode = String(value || "Tahsilat Yapıldı").trim() || "Tahsilat Yapıldı";
  if (mode === "Sonra Tahsil Edilecek") return "Havale Bekleniyor";
  return mode;
}

function paymentModeForcesZero(mode) {
  return mode === "Ücretsiz İşlem" || mode === "Garanti Kapsamında";
}

function serviceStatusForPaymentMode(mode) {
  return mode === "Havale Bekleniyor" ? "Ödeme Bekliyor" : "İşlem Tamam";
}

function servicePaymentModeLabel(service) {
  const cash = primaryCashForService(service?.id);
  const statusMode = normalizePaymentMode(service?.paymentStatus || "");
  const cashMode = normalizePaymentMode(cash?.title || "");
  const amount = Number(cash?.amount ?? service?.price ?? 0) || 0;

  // Ücret alındıysa satırda Tahsilat Yapıldı görünsün.
  if (statusMode === "Ödendi" || (cashMode === "Tahsilat Yapıldı" && amount > 0)) return "Tahsilat Yapıldı";

  // Ücretsiz / garanti / havale bekleyen işlemlerde kendi kapanış tipi görünsün.
  const mode = ["Havale Bekleniyor", "Ücretsiz İşlem", "Garanti Kapsamında"].includes(statusMode) ? statusMode : cashMode;
  if (["Havale Bekleniyor", "Ücretsiz İşlem", "Garanti Kapsamında"].includes(mode)) return mode;

  // Tutar yoksa yanlışlıkla Tahsilat Yapıldı yazdırma.
  return "";
}

function completeServiceFromForm(formData) {
  if (isSourcePortal()) return;
  const data = Object.fromEntries(formData);
  const service = state.services.find((item) => item.id === data.serviceId);
  if (!service || !matchesPortalSource(service.source)) return;

  const workNote = String(data.workNote || "").trim();
  const amountRaw = String(data.amount ?? "").trim();
  if (!workNote) {
    alert("Fişi kapatmak için yapılan işlemler alanı zorunludur.");
    return;
  }
  if (amountRaw === "") {
    alert("Fişi kapatmak için para bilgisi zorunludur. Ücretsiz işlemse 0 yaz.");
    return;
  }

  const paymentMode = normalizePaymentMode(data.paymentMode);
  const rawAmount = Number(data.amount) || 0;
  const amount = paymentModeForcesZero(paymentMode) ? 0 : rawAmount;
  const materialCost = Number(data.materialCost) || 0;
  const otherExpense = Number(data.otherExpense) || 0;
  const commissionRate = sourceCommissionRate(data.source || service.source);
  const cashType = "income";
  const closeDate = isoToday;

  const cashItem = {
    id: uid(),
    date: closeDate,
    type: cashType,
    title: paymentMode,
    amount,
    materialCost,
    otherExpense,
    commission50: commissionRate > 0,
    commissionRate,
    collectedBy: data.collectedBy === "source" ? "source" : "me",
    source: data.source || service.source || "",
    serviceId: service.id,
  };
  state.cash.unshift(cashItem);

  service.status = serviceStatusForPaymentMode(paymentMode);
  service.paymentStatus = paymentMode === "Tahsilat Yapıldı" && amount > 0 ? "Ödendi" : paymentMode;
  service.price = amount;
  service.notes.unshift({
    id: uid(),
    text: workNote,
    createdAt: new Date().toISOString(),
    updatedAt: "",
  });
  service.statusHistory.unshift({
    id: uid(),
    date: closeDate,
    status: serviceStatusForPaymentMode(paymentMode),
    description: `Fiş kapatıldı (${paymentMode}) - ${workNote}`,
    createdAt: new Date().toISOString(),
  });

  syncSettlementCash(cashItem);
  saveState();
  completeDialog.close();
  render();
}

function openCashForm(options = {}) {
  if (isSourcePortal()) return;
  cashForm.reset();
  cashForm.elements.id.value = "";
  cashForm.elements.date.value = isoToday;
  cashForm.elements.type.value = "income";
  if (cashForm.elements.cashPurpose) cashForm.elements.cashPurpose.value = "operating";
  cashForm.elements.serviceId.value = options.serviceId || "";
  cashForm.elements.source.value = serviceSource(options.serviceId) || (isSourcePortal() ? portalSourceName() : cashSourceFilter.value) || "";
  const deleteButton = cashDialog.querySelector("[data-action='delete-cash']");
  delete deleteButton.dataset.cashId;
  deleteButton.style.visibility = "hidden";
  document.querySelector("#cashDialogTitle").textContent = "Para Hareketi";

  if (options.id) {
    const item = state.cash.find((cashItem) => cashItem.id === options.id);
    if (!item || !matchesPortalSource(cashItemSource(item))) return;
    Object.entries(item).forEach(([key, value]) => {
      if (key === "commission50") return;
      if (cashForm.elements[key]) cashForm.elements[key].value = value || "";
    });
    keepSelectValue(cashForm.elements.source, item.source);
    if (cashForm.elements.cashPurpose) cashForm.elements.cashPurpose.value = item.cashPurpose || (item.type === "expense" && item.source && !isOwnWorkSource(item.source) ? "source-offset" : "operating");
    if (cashForm.elements.commissionRate) cashForm.elements.commissionRate.value = String(item.commissionRate !== undefined ? Number(item.commissionRate) : (item.commission50 ? 50 : 0));
    deleteButton.dataset.cashId = options.id;
    deleteButton.style.visibility = "visible";
    document.querySelector("#cashDialogTitle").textContent = "Para Hareketini Düzenle";
  }
  cashDialog.showModal();
}

function saveCash(formData) {
  if (isSourcePortal()) return;
  const data = Object.fromEntries(formData);
  const previous = state.cash.find((item) => item.id === data.id);
  const serviceId = data.serviceId.trim();
  if (isSourcePortal() && previous && !matchesPortalSource(cashItemSource(previous))) return;
  if (isSourcePortal() && serviceId && !matchesPortalSource(serviceSource(serviceId))) return;
  const materialCost = Number(data.materialCost) || 0;
  const otherExpense = Number(data.otherExpense) || 0;
  const commissionRate = Number(data.commissionRate) || 0;
  const cashType = data.type === "expense" ? "expense" : "income";
  const cashItem = {
    ...(previous || {}),
    id: data.id || uid(),
    date: data.date || isoToday,
    type: cashType,
    title: (data.title || "").trim() || (cashType === "income" ? "Tahsilat" : "Gider"),
    amount: Number(data.amount) || 0,
    description: (data.description || "").trim(),
    cashPurpose: cashType === "expense" ? (data.cashPurpose === "source-offset" ? "source-offset" : "operating") : (previous?.cashPurpose || ""),
    materialCost,
    otherExpense,
    commission50: commissionRate > 0,
    commissionRate,
    source: isSourcePortal() ? portalSourceName() : (data.source || serviceSource(serviceId) || ""),
    serviceId,
  };
  if (data.id) state.cash = state.cash.map((item) => item.id === data.id ? cashItem : item);
  else state.cash.unshift(cashItem);
  syncSettlementCash(cashItem);
  saveState();
  cashDialog.close();
  render();
}

function deleteCash(id) {
  if (isSourcePortal()) return;
  const item = state.cash.find((cashItem) => cashItem.id === id);
  if (!item || !matchesPortalSource(cashItemSource(item)) || !confirm(`${visibleCashTitle(item) || "Para hareketi"} silinsin mi?`)) return;
  state.cash = state.cash.filter((cashItem) => cashItem.id !== id && cashItem.parentCashId !== id);
  saveState();
  if (cashDialog.open) cashDialog.close();
  render();
}

function openNoteForm(serviceId, noteId = "") {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  const note = service.notes.find((item) => item.id === noteId);
  noteForm.reset();
  noteForm.elements.serviceId.value = serviceId;
  noteForm.elements.noteId.value = noteId;
  noteForm.elements.text.value = note?.text || "";
  noteDialog.querySelector("[data-action='delete-note']").style.visibility = note ? "visible" : "hidden";
  document.querySelector("#noteDialogTitle").textContent = note ? "Notu Düzenle" : "Not Ekle";
  noteDialog.showModal();
}

function saveNote(formData) {
  if (isSourcePortal()) return;
  const data = Object.fromEntries(formData);
  const service = state.services.find((item) => item.id === data.serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  if (data.noteId) {
    service.notes = service.notes.map((note) => note.id === data.noteId ? { ...note, text: data.text, updatedAt: new Date().toISOString() } : note);
  } else {
    service.notes.unshift({ id: uid(), text: data.text, createdAt: new Date().toISOString(), updatedAt: "" });
  }
  saveState();
  noteDialog.close();
  render();
}

function deleteNote(serviceId, noteId) {
  if (isSourcePortal()) return;
  serviceId = serviceId || noteForm.elements.serviceId.value;
  noteId = noteId || noteForm.elements.noteId.value;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source) || !noteId || !confirm("Not silinsin mi?")) return;
  service.notes = service.notes.filter((note) => note.id !== noteId);
  saveState();
  if (noteDialog.open) noteDialog.close();
  render();
}

function openPhotoForm(serviceId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  photoForm.reset();
  photoForm.elements.serviceId.value = serviceId;
  photoDialog.showModal();
}

async function savePhoto() {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === photoForm.elements.serviceId.value);
  if (!service || !matchesPortalSource(service.source)) return;
  const file = photoForm.elements.photo.files[0] || photoForm.elements.camera.files[0];
  if (!file) {
    alert("Fotoğraf seçmeniz gerekiyor.");
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  service.photos.unshift({
    id: uid(),
    caption: photoForm.elements.caption.value,
    dataUrl,
    createdAt: new Date().toISOString(),
  });
  saveState();
  photoDialog.close();
  render();
}

function editPhoto(serviceId, photoId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  const photo = service?.photos.find((item) => item.id === photoId);
  if (!photo) return;
  const caption = prompt("Fotoğraf açıklaması", photo.caption || "");
  if (caption === null) return;
  photo.caption = caption;
  saveState();
  render();
}

function deletePhoto(serviceId, photoId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source) || !confirm("Fotoğraf silinsin mi?")) return;
  service.photos = service.photos.filter((photo) => photo.id !== photoId);
  saveState();
  render();
}

function openSourceForm(name = "") {
  sourceForm.reset();
  sourceForm.elements.oldName.value = "";
  if (sourceForm.elements.commissionRate) sourceForm.elements.commissionRate.value = "50";
  sourceDialog.querySelector("[data-action='delete-source']").style.visibility = "hidden";
  document.querySelector("#sourceDialogTitle").textContent = "Kaynak Ekle";
  if (name) {
    sourceForm.elements.oldName.value = name;
    sourceForm.elements.name.value = name;
    if (sourceForm.elements.phone) sourceForm.elements.phone.value = sourcePhone(name);
    if (sourceForm.elements.commissionRate) sourceForm.elements.commissionRate.value = String(sourceCommissionShare(name));
    sourceDialog.querySelector("[data-action='delete-source']").dataset.sourceName = name;
    sourceDialog.querySelector("[data-action='delete-source']").style.visibility = "visible";
    document.querySelector("#sourceDialogTitle").textContent = "Kaynak Düzenle";
  }
  if (!name && sourceForm.elements.commissionRate) {
    sourceForm.elements.commissionRate.value = "50";
  }
  sourceDialog.showModal();
}

function saveSource(formData) {
  const data = Object.fromEntries(formData);
  const name = data.name.trim();
  if (!name) return;
  if (data.commissionRate === "" || !Number.isFinite(Number(data.commissionRate)) || Number(data.commissionRate) < 0 || Number(data.commissionRate) > 100) {
    alert("Komisyon oranı 0 ile 100 arasında olmalı.");
    return;
  }
  if (!state.settings.sourcePhones) state.settings.sourcePhones = {};
  if (!state.settings.sourceCommissionRates) state.settings.sourceCommissionRates = {};
  const oldRate = data.oldName ? sourceCommissionShare(data.oldName) : 50;
  if (data.oldName) {
    updateSettingItem("sources", data.oldName, name);
    if (data.oldName !== name) {
      delete state.settings.sourcePhones[data.oldName];
      delete state.settings.sourceCommissionRates[data.oldName];
    }
  } else addSettingValue("sources", name);
  const phone = (data.phone || "").trim();
  state.settings.sourceCommissionRates[name] = Math.min(100, Math.max(0, Number(data.commissionRate ?? oldRate) || 0));
  if (phone) state.settings.sourcePhones[name] = phone;
  else delete state.settings.sourcePhones[name];
  saveState();
  sourceDialog.close();
  render();
}

function deleteSource(name) {
  const sourceName = name || sourceForm.elements.oldName.value;
  if (!sourceName || !confirm(`${sourceName} kaynak listesinden silinsin mi?\n\nEski servis ve kasa kayıtları silinmez; bu kayıtlarda "${sourceName}" yazısı ve toplamlar aynen kalır.`)) return;
  hideSource(sourceName);
  saveState();
  if (sourceDialog.open) sourceDialog.close();
  render();
}

function addSettingItem(listKey) {
  if (listKey === "dashboardCounters") { alert("Yeni sayaç için Ayarlar → Sayaçlar → Çoğalt seçeneğini kullanın."); return; }
  if (listKey === "sources") return openSourceForm();
  if (listKey === "cashCounters") return;
  const label = settingsLabels[listKey] || "Ayar";
  const value = prompt(`${label} için yeni kayıt`);
  if (value === null) return;
  addSettingValue(listKey, value.trim());
  saveState();
  render();
}

function editSettingItem(listKey, oldValue) {
  if (listKey === "dashboardCounters") { alert("Ana sayfa sayaçlarını Ayarlar → Sayaçlar bölümünden yönetin."); return; }
  if (listKey === "sources") return openSourceForm(oldValue);
  if (listKey === "cashCounters") {
    const counter = cashCounterList().find((item) => item.key === oldValue);
    if (!counter) return;
    const value = prompt("Kasa sayacı adını düzenle", counter.label);
    if (value === null || !value.trim()) return;
    state.settings.cashCounters = cashCounterList().map((item) => item.key === oldValue ? { ...item, label: value.trim() } : item);
    saveState();
    render();
    return;
  }
  const value = prompt(`${settingsLabels[listKey] || "Ayar"} düzenle`, oldValue);
  if (value === null) return;
  updateSettingItem(listKey, oldValue, value.trim());
  saveState();
  render();
}

function deleteSettingItem(listKey, value) {
  if (listKey === "dashboardCounters") { alert("Ana sayfa sayaçlarını Ayarlar → Sayaçlar bölümünden yönetin."); return; }
  if (listKey === "cashCounters") return;
  if (listKey === "sources") return deleteSource(value);
  if (listKey === "statuses") {
    if (!confirm(`${value} servis durumu ve ona bağlı ana sayfa sayaçları kaldırılsın mı? Geçmiş servis kayıtları korunacak.`)) return;
    state.settings.statuses = settingsList("statuses").filter(item => item !== value);
    const copies = dashboardCounterCopies();
    const removedNames = new Set([value, ...copies.filter(c => c.base === value).map(c => c.name)]);
    state.settings.dashboardCounters = settingsList("dashboardCounters").filter(item => !removedNames.has(item));
    state.settings.dashboardCounterCopies = copies.filter(c => !removedNames.has(c.name));
    state.settings.hiddenDashboardCounters = (state.settings.hiddenDashboardCounters || []).filter(item => !removedNames.has(item));
    saveState(); render(); return;
  }
  if (!confirm(`${value} silinsin mi?`)) return;
  removeSettingValue(listKey, value);
  saveState();
  render();
}

function addSettingValue(listKey, value) {
  if (!value) return;
  if (listKey === "sources") unhideSource(value);
  const list = settingsList(listKey);
  if (!list.includes(value)) {
    state.settings[listKey] = [...list, value];
    if (listKey === "statuses" && !settingsList("dashboardCounters").includes(value)) {
      state.settings.dashboardCounters = [...settingsList("dashboardCounters"), value];
    }
  }
}

function updateSettingItem(listKey, oldValue, newValue) {
  if (!newValue) return;
  if (listKey === "sources") unhideSource(newValue);
  state.settings[listKey] = settingsList(listKey).map((item) => item === oldValue ? newValue : item);
  state.settings[listKey] = uniqueValues(state.settings[listKey]);
  updateExistingRecords(listKey, oldValue, newValue);
}

function removeSettingValue(listKey, value) {
  state.settings[listKey] = settingsList(listKey).filter((item) => item !== value);
  updateExistingRecords(listKey, value, "");
}

// V5.3.11: Kaynak silme yalnızca listeden gizler. Servis ve kasa kayıtlarına dokunulmaz.
function hiddenSourceList() {
  if (!state.settings) state.settings = cloneSettings(defaultSettings);
  if (!Array.isArray(state.settings.hiddenSources)) state.settings.hiddenSources = uniqueValues(Object.values(state.settings.hiddenSources || {}));
  return state.settings.hiddenSources;
}

function isHiddenSource(source) {
  const key = norm(source);
  return Boolean(key) && hiddenSourceList().some((item) => norm(item) === key);
}

function withoutHiddenSources(values, hidden) {
  const hiddenKeys = new Set((hidden || []).map(norm));
  return (values || []).filter((value) => !hiddenKeys.has(norm(value)));
}

function hideSource(sourceName) {
  const key = norm(sourceName);
  if (!key) return;
  state.settings.sources = settingsList("sources").filter((item) => norm(item) !== key);
  if (!isHiddenSource(sourceName)) state.settings.hiddenSources = [...hiddenSourceList(), String(sourceName).trim()];
  if (state.settings.sourcePhones) {
    Object.keys(state.settings.sourcePhones).forEach((phoneKey) => {
      if (norm(phoneKey) === key) delete state.settings.sourcePhones[phoneKey];
    });
  }
}

function unhideSource(sourceName) {
  const key = norm(sourceName);
  state.settings.hiddenSources = hiddenSourceList().filter((item) => norm(item) !== key);
}

// Eski kayıt düzenlenirken listede olmayan (silinmiş) kaynak kaybolmasın.
function keepSelectValue(select, value) {
  if (!select || !value) return;
  if (![...select.options].some((option) => option.value === value)) {
    const option = new Option(value, value);
    option.dataset.keep = "1";
    select.add(option);
  }
  select.value = value;
}

function moveSettingItem(listKey, value, direction) {
  const list = listKey === "cashCounters" ? cashCounterList() : settingsList(listKey);
  const index = listKey === "cashCounters" ? list.findIndex((item) => item.key === value) : list.indexOf(value);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  state.settings[listKey] = listKey === "cashCounters" ? list.map((item) => ({ ...item })) : [...list];
  saveState();
  render();
}

function updateExistingRecords(listKey, oldValue, newValue) {
  const serviceField = { sources: "source", statuses: "status", brands: "brand", devices: "device", cities: "city" }[listKey];
  if (serviceField) {
    state.services.forEach((service) => {
      if (service[serviceField] === oldValue) service[serviceField] = newValue;
      if (listKey === "statuses" && Array.isArray(service.statusHistory)) {
        service.statusHistory.forEach((item) => {
          if (item && item.status === oldValue) item.status = newValue;
        });
      }
    });
  }
  if (listKey === "statuses") {
    state.settings.dashboardCounters = settingsList("dashboardCounters")
      .map((item) => item === oldValue ? newValue : item)
      .filter(Boolean);
    dashboardCounterCopies().forEach(c => { if (c.base === oldValue) c.base = newValue; });
    state.settings.hiddenDashboardCounters = (state.settings.hiddenDashboardCounters || []).map(item => item === oldValue ? newValue : item);
  }
  if (listKey === "sources") {
    state.cash.forEach((item) => {
      if (item.source === oldValue) item.source = newValue;
    });
  }
}


/* Ortak A4 rapor tasarımı: kasa ve servis çıktıları aynı PDF düzenini kullanır. */
function reportMoney(value){
 return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
}
function reportDateRange(){
 const start=dashboardStartDate?.value||"";
 const end=dashboardEndDate?.value||start;
 return start ? formatDate(start)+(end&&end!==start?" – "+formatDate(end):"") : "Tüm zamanlar";
}
function reportShell(title,source,cards,headers,rows){
 const report=window.open("","_blank","width=960,height=780");
 if(!report){alert("PDF raporunu açmak için açılır pencerelere izin verin.");return;}
 const safe=escapeHtml;
 const cardHtml=cards.map(c=>'<div class="metric '+(c.tone||"")+'"><span>'+safe(c.label)+'</span><b>'+safe(String(c.value))+'</b></div>').join("");
 const rowHtml=rows.length?rows.join(""):'<tr><td colspan="'+headers.length+'" class="empty">Bu aralıkta kayıt bulunamadı.</td></tr>';
 const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe(title)+'</title><style>'+
 '@page{size:A4;margin:13mm 14mm}*{box-sizing:border-box}body{margin:0;padding:20px;font:12px Arial,Helvetica,sans-serif;color:#273c38;background:white}'+
 'h1{font-size:23px;color:#115b4c;margin:0 0 10px;font-weight:800}.meta{color:#4c625d;line-height:1.7;margin-bottom:13px}'+
 '.rule{height:4px;background:#11745e;margin-bottom:18px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px}'+
 '.metric{border:1px solid #d7e4df;border-radius:7px;padding:12px;min-height:63px;break-inside:avoid}.metric span{display:block;color:#60716b;font-size:11px;margin-bottom:7px}.metric b{font-size:16px;color:#263c35}.metric.good{background:#e7f3ed}.metric.bad{background:#fbecec;border-color:#edc8c8}.metric.bad b{color:#b52b36}'+
 'h2{font-size:17px;color:#115b4c;margin:16px 0 10px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#e7f3ed;text-align:left;font-size:10px;padding:10px 7px}td{border-bottom:1px solid #dce6e2;padding:10px 7px;font-size:10px;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}td.num,th.num{text-align:right;white-space:nowrap}td.red{color:#b52b36;font-weight:bold}.sub{display:block;color:#75857e;font-size:9px;margin-top:4px}.empty{text-align:center;color:#75857e}.footer{border-top:1px solid #dce6e2;color:#72817b;font-size:10px;padding-top:10px;margin-top:22px}'+
 '.toolbar{position:sticky;top:0;background:#f0f7f4;padding:12px;margin:-20px -20px 20px;text-align:right}.toolbar button{background:#11745e;color:white;border:0;border-radius:6px;padding:10px 18px;cursor:pointer;font-weight:bold}'+
 '@media print{body{padding:0}.toolbar{display:none!important}thead{display:table-header-group}.metrics{break-inside:avoid}print-color-adjust:exact;-webkit-print-color-adjust:exact}'+
 '</style></head><body><div class="toolbar"><button onclick="window.print()">Yazdır / PDF olarak kaydet</button></div><h1>'+safe(title)+'</h1><div class="meta"><b>Kaynak:</b> '+safe(source||"Tüm kaynaklar")+' &nbsp; | &nbsp; <b>Dönem:</b> '+safe(reportDateRange())+' &nbsp; | &nbsp; <b>Rapor tarihi:</b> '+safe(formatDate(isoToday))+'</div><div class="rule"></div><section class="metrics">'+cardHtml+'</section><h2>İşlem Detayları ('+rows.length+')</h2><table><thead><tr>'+headers.map((h,i)=>'<th'+(i===headers.length-1?' class="num"':'')+'>'+safe(h)+'</th>').join("")+'</tr></thead><tbody>'+rowHtml+'</tbody></table><div class="footer">Ekzen Servis Takip · '+safe(title)+'</div></body></html>';
 report.document.open();report.document.write(html);report.document.close();
}
function printCashReport(){
 const source=isSourcePortal()?portalSourceName():(cashSourceFilter?.value||activeDashboardSource||"");
 const items=filteredCash();
 const totals=cashTotals(items),b=cashBreakdown(items),shares=serviceSourceCounterBreakdown(items);
 const cards=[
  {label:"Toplam Ciro",value:reportMoney(totals.income)},
  {label:"Malzeme",value:reportMoney(b.material)},
  {label:"Diğer Giderler",value:reportMoney(b.manualExpense),tone:"bad"},
  {label:"Net Kasa",value:reportMoney(b.balance),tone:"good"},
  {label:"Hakediş (Kaynak Payı)",value:reportMoney(shares.hakedis),tone:"good"},
  {label:"Ekzen Teknik Payı",value:reportMoney(shares.ekzenTechnical)},
  {label:"Kaynağa Kalan Ödeme",value:reportMoney(shares.remainingPayment),tone:shares.remainingPayment<0?"bad":"good"}
 ];
 const rows=items.slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))).map(item=>{
  const income=item.type==="income",primary=isServicePrimaryIncome(item);
  const material=primary?Number(item.materialCost)||0:0;
  const sourcePay=primary?sourcePayAmountForCashItem(item):0;
  return '<tr><td>'+escapeHtml(formatDate(item.date||""))+'</td><td>'+escapeHtml(visibleCashTitle(item)||"-")+'<span class="sub">'+(income?"Gelir":"Gider")+'</span></td><td>'+escapeHtml(cashItemSource(item)||"-")+'</td><td class="num '+(income?"":"red")+'">'+(income?"":"−")+escapeHtml(reportMoney(item.amount))+'</td><td class="num">'+(material?escapeHtml(reportMoney(material)):"—")+'</td><td class="num">'+(primary?escapeHtml(reportMoney(sourcePay)):"—")+'</td></tr>';
 });
 reportShell("EKZEN · KASA HESAP ÖZETİ",source||"Tüm kaynaklar",cards,["Tarih","Açıklama / Tür","Kaynak","Tutar","Malzeme","Kaynak Payı"],rows);
}
function printServiceReport(fromList=false){
 const items=fromList?sortServices(homeServiceDrilldown?(state.services||[]).filter(s=>homeServiceDrilldown.ids.has(String(s.id))&&matchesPortalSource(s.source)):filteredServices({ignoreStatus:false})):sortServices(filteredDashboardServices());
 const ids=new Set(items.map(s=>String(s.id)));
 const cash=(state.cash||[]).filter(c=>ids.has(String(c.serviceId||""))&&cashIsPosted(c));
 const totals=cashTotals(cash),b=cashBreakdown(cash),shares=serviceSourceCounterBreakdown(cash);
 const pending=items.filter(s=>isStatus(s.status,"Ödeme Bekliyor"));
 const pendingAmount=pending.reduce((sum,s)=>sum+Math.max(0,Number(primaryCashForService(s.id)?.amount??s.price??0)||0),0);
 const cards=[
  {label:"Toplam Servis",value:String(items.length)},
  {label:"Toplam Ciro (Tahsilat)",value:reportMoney(totals.income)},
  {label:"Malzeme Gideri",value:reportMoney(b.material)},
  {label:"Hakediş (Kaynak Payı)",value:reportMoney(shares.hakedis)},
  {label:"Ödeme Bekleyen",value:pending.length+" Servis · "+reportMoney(pendingAmount),tone:"bad"},
  {label:"Tamamlanan Servis",value:String(items.filter(s=>isStatus(s.status,"İşlem Tamam")).length)}
 ];
 const rows=items.map(s=>{
  const f=serviceCardFinancials(s),primary=primaryCashForService(s.id);
  const paid=primary&&cashIsPosted(primary)?Number(primary.amount)||0:0;
  const material=primary&&cashIsPosted(primary)?Number(primary.materialCost)||0:0;
  const sourcePay=primary&&cashIsPosted(primary)?sourcePayAmountForCashItem(primary):0;
  return '<tr><td>'+escapeHtml(formatDate(serviceMainDate(s)||""))+'</td><td>'+escapeHtml(s.customerName||s.address||"-")+'<span class="sub">'+escapeHtml([s.device,s.brand].filter(Boolean).join(" / "))+'</span></td><td>'+escapeHtml(s.source||"-")+'<span class="sub">'+escapeHtml(s.status||"-")+'</span></td><td class="num">'+escapeHtml(reportMoney(paid))+'</td><td class="num">'+escapeHtml(reportMoney(material))+'</td><td class="num">'+escapeHtml(reportMoney(sourcePay))+'</td></tr>';
 });
 reportShell("EKZEN · SERVİS VE KASA RAPORU",activeDashboardSource||(isSourcePortal()?portalSourceName():"Tüm kaynaklar"),cards,["Tarih","Servis / Cihaz","Kaynak / Durum","Tahsilat","Malzeme","Kaynak Payı"],rows);
}

function printCash() { printCashReport(); }

function shareCashWhatsApp() {
  const items = filteredCash();
  const totals = cashTotals(items);
  const breakdown = cashBreakdown(items);
  const source = cashSourceFilter.value || "Tüm kaynaklar";
  openCashReportWindow(items);
  const lines = [
    `Kasa Özeti - ${source}`,
    `Toplam Gelir: ${money(totals.income)}`,
    `Yapılan Ödeme: ${money(breakdown.manualExpense)}`,
    `Komisyon: ${money(breakdown.commission)}`,
    `Malzeme: ${money(breakdown.material)}`,
    `Kalan Ödeme: ${money(totals.balance)}`,
    "",
    ...items.slice(0, 20).map((item) => `${formatDate(item.date)} | ${item.type === "expense" ? "Gider" : "Tahsilat"} | ${cashItemSource(item) || "-"} | ${visibleCashTitle(item)} | ${money(item.amount)}`),
  ];
  if (items.length > 20) lines.push(`+${items.length - 20} hareket daha`);
  const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener");
}

function openCashReportWindow(items) {
  const totals = cashTotals(items);
  const breakdown = cashBreakdown(items);
  const report = window.open("", "_blank", "noopener,width=900,height=700");
  if (!report) {
    window.print();
    return;
  }
  report.document.write(`
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <title>Kasa Raporu</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1e2530; margin: 24px; }
        h1 { margin: 0 0 6px; }
        .meta { color: #667383; margin-bottom: 18px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 18px; }
        .summary div { border: 1px solid #d9e0e8; padding: 10px; border-radius: 6px; }
        .summary span { display: block; color: #667383; font-size: 12px; }
        .summary b { display: block; margin-top: 6px; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #d9e0e8; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #f3f7fb; }
        .expense { color: #c7443e; font-weight: 700; }
        @media print { body { margin: 12mm; } }
      </style>
    </head>
    <body>
      <h1>Kasa Raporu</h1>
      <div class="meta">${escapeHtml(formatDate(new Date()))} · ${escapeHtml(cashSourceFilter.value || "Tüm kaynaklar")}</div>
      <section class="summary">
        <div><span>Toplam Gelir</span><b>${money(totals.income)}</b></div>
        <div><span>Yapılan Ödeme</span><b class="expense">-${money(breakdown.manualExpense)}</b></div>
        <div><span>Komisyon</span><b class="expense">-${money(breakdown.commission)}</b></div>
        <div><span>Malzeme</span><b class="expense">-${money(breakdown.material)}</b></div>
        <div><span>Kalan Ödeme</span><b>${money(totals.balance)}</b></div>
      </section>
      <table>
        <thead><tr><th>Tarih</th><th>Tip</th><th>Kaynak</th><th>Açıklama</th><th>Tutar</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr>
            <td>${escapeHtml(formatDate(item.date))}</td>
            <td>${item.type === "expense" ? "Gider" : "Tahsilat"}</td>
            <td>${escapeHtml(cashItemSource(item) || "-")}</td>
            <td>${escapeHtml(visibleCashTitle(item) || (item.autoMaterialExpense ? "Malzeme" : item.autoCommissionExpense ? "Komisyon" : ""))}</td>
            <td class="${item.type === "expense" ? "expense" : ""}">${item.type === "expense" ? "-" : "+"}${money(item.amount)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
    </body>
    </html>
  `);
  report.document.close();
}

function syncSettlementCash(cashItem) {
  if (cashItem.parentCashId || cashItem.autoMaterialExpense || cashItem.autoCommissionExpense) return;
  state.cash = state.cash.filter((item) => item.parentCashId !== cashItem.id);
  if (cashItem.type !== "income") return;

  const materialCost = Number(cashItem.materialCost) || 0;
  const otherExpense = Number(cashItem.otherExpense) || 0;
  const receivedAmount = Number(cashItem.amount) || 0;
  const commissionBase = Math.max(receivedAmount - materialCost - otherExpense, 0);
  const relatedItems = [];

  if (materialCost > 0) {
    relatedItems.push({
      id: uid(),
      parentCashId: cashItem.id,
      serviceId: cashItem.serviceId,
      source: cashItem.source,
      autoMaterialExpense: true,
      date: cashItem.date,
      type: "expense",
      title: "Malzeme Gideri",
      amount: materialCost,
      materialCost: 0,
      commission50: false,
      commissionRate: 0,
    });
  }

  if (otherExpense > 0) {
    relatedItems.push({
      id: uid(),
      parentCashId: cashItem.id,
      serviceId: cashItem.serviceId,
      source: cashItem.source,
      autoOtherExpense: true,
      date: cashItem.date,
      type: "expense",
      title: "Diğer Gider",
      amount: otherExpense,
      materialCost: 0,
      commission50: false,
      commissionRate: 0,
    });
  }

  const commissionRate = Number(cashItem.commissionRate !== undefined ? cashItem.commissionRate : (cashItem.commission50 ? 50 : 0)) || 0;

  if (commissionRate > 0 && commissionBase > 0) {
    relatedItems.push({
      id: uid(),
      parentCashId: cashItem.id,
      serviceId: cashItem.serviceId,
      source: cashItem.source,
      autoCommissionExpense: true,
      date: cashItem.date,
      type: "expense",
      title: "",
      amount: isOwnWorkSource(cashItemSource(cashItem))
        ? commissionBase * commissionRate / 100
        : commissionBase * Math.max(100 - commissionRate, 0) / 100,
      materialCost: 0,
      commission50: false,
      commissionRate: 0,
      commissionRate: 0,
    });
  }

  state.cash = [...relatedItems, ...state.cash];
}

function syncServiceCash(service) {
  const existing = state.cash.find((item) => item.serviceId === service.id && (item.autoServiceIncome || item.title === `Servis tahsilatı ${service.id}`));
  const shouldHaveIncome = service.paymentStatus === "Ödendi" && service.price > 0;
  if (!shouldHaveIncome && existing) {
    state.cash = state.cash.filter((item) => item.id !== existing.id);
    return;
  }
  if (shouldHaveIncome && existing) {
    existing.date = serviceMainDate(service) || existing.date || isoToday;
    existing.type = "income";
    existing.title = `Servis tahsilatı ${service.id}`;
    existing.amount = service.price;
    existing.source = service.source || "";
    existing.autoServiceIncome = true;
    existing.collectedBy = existing.collectedBy || "me";
    return;
  }
  if (shouldHaveIncome && !existing) {
    state.cash.unshift({ id: uid(), serviceId: service.id, source: service.source || "", autoServiceIncome: true, collectedBy: "me", date: serviceMainDate(service) || isoToday, type: "income", title: `Servis tahsilatı ${service.id}`, amount: service.price });
  }
}

function settingsList(key) {
  if (!state.settings) state.settings = cloneSettings(defaultSettings);
  if (!Array.isArray(state.settings[key])) state.settings[key] = cloneSettingValue(defaultSettings[key] || []);
  return state.settings[key];
}

function cashCounterList() {
  if (!state.settings) state.settings = cloneSettings(defaultSettings);
  state.settings.cashCounters = normalizeCashCounters(state.settings.cashCounters);
  return state.settings.cashCounters;
}

function cloneSettings(settings) {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, cloneSettingValue(value)]));
}

function cloneSettingValue(value) {
  return Array.isArray(value) ? value.map((item) => typeof item === "object" && item ? { ...item } : item) : value;
}

function uniqueValues(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function isStatus(status, expected) {
  return norm(status) === norm(expected);
}

function serviceHasDate(service, isoDate) {
  return serviceDateCandidates(service).includes(isoDate);
}

function serviceDateCandidates(service) {
  // V5.3.9: Ertelenen servis yalnızca güncel planlama tarihinde görünür.
  // availableDate/visitDate varsa eski kayıt tarihi artık aday tarih değildir.
  const plannedDate = service?.availableDate || service?.visitDate || service?.date;
  if (plannedDate) return [String(plannedDate).slice(0, 10)];
  const created = safeDateIso(service?.createdAt);
  return created ? [created] : [];
}

function serviceMainDate(service) {
  // V3.5.1: Eski ve yeni kayıtların hepsini aynı tarih filtresinde yakala.
  return service.availableDate || service.visitDate || service.date || (service.createdAt ? toIsoDate(new Date(service.createdAt)) : "");
}

function ensureValues(values, requiredValues) {
  const list = [...values];
  requiredValues.forEach((value) => {
    if (!list.includes(value)) list.push(value);
  });
  return list;
}

function serviceSource(serviceId) {
  const service = state.services.find((item) => item.id === String(serviceId || "").trim());
  return service?.source || "";
}

function sourceCommissionShare(source) {
  const rates = state.settings?.sourceCommissionRates || {};
  const match = Object.keys(rates).find((name) => sourceMatches(name, source));
  const fallback = isOwnWorkSource(source) ? 0 : 50;
  const share = match ? Number(rates[match]) : fallback;
  return Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : fallback;
}

function sourceCommissionRate(source) {
  const share = sourceCommissionShare(source);
  // Eski kasa hesaplama mantığı: dış kaynakta oran bize kalan pay,
  // kendi işimde ise kaynak payıdır.
  return isOwnWorkSource(source) ? share : 100 - share;
}

function sourcePhone(source) {
  return state.settings?.sourcePhones?.[source] || "";
}

function cashItemSource(item) {
  return serviceSource(item.serviceId) || item.source || "";
}

function cashIsPosted(item) {
  if (!item?.serviceId) return true;
  const service = state.services.find((serviceItem) => serviceItem.id === item.serviceId);
  return service ? isStatus(service.status, "İşlem Tamam") : false;
}

function postedCashItems(items = state.cash) {
  return items.filter(cashIsPosted);
}

function isSourcePortal() {
  return Boolean(sourcePortalParam);
}

function portalSourceName() {
  if (!sourcePortalParam) return "";
  return settingsList("sources").find((source) => norm(source) === norm(sourcePortalParam)) || sourcePortalParam;
}

function matchesPortalSource(source) {
  return !isSourcePortal() || norm(source) === norm(portalSourceName());
}

function portalTitle() {
  return isSourcePortal() ? portalSourceName() : (state.company.companyName || "Servis Takip");
}

function canEditPortalRecords() {
  return !isSourcePortal();
}

function foldTr(value) {
  return norm(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

function sourceKey(source) {
  const value = norm(source);
  const folded = foldTr(source);
  // Eski kayıtlarda kaynak boş, farklı büyük/küçük harfli veya "kendi iş" gibi kaydedilmiş olabilir.
  // Noktalı/noktasız yazımlar da Kendi İşim ile aynı kaynaktır.
  if (!folded || folded === "kendi isim" || folded === "kendi is" || folded === "kendim") return "kendi-isim";
  return value;
}

function sourceMatches(actual, expected) {
  return !expected || sourceKey(actual) === sourceKey(expected);
}

function isOwnWorkSource(source) {
  return sourceKey(source) === "kendi-isim";
}

function syncCompleteCommissionField() {
  const select = completeForm?.elements?.commissionRate;
  const field = select?.closest("label");
  if (!select || !field) return;
  const own = isOwnWorkSource(completeForm.elements.source?.value || "");
  field.classList.toggle("is-own-work-commission", own);
  field.hidden = true;
  select.value = String(sourceCommissionRate(completeForm.elements.source?.value || ""));
}

function visibleCashTitle(item) {
  const title = item.title || "";
  if (item.autoMaterialExpense && norm(title).startsWith("malzeme gideri")) return "";
  if (item.autoCommissionExpense && norm(title).includes("komisyon")) return "";
  return title;
}

function nextServiceId() {
  const max = state.services.reduce((num, service) => Math.max(num, Number(service.id) || 0), 665000);
  return String(max + 1);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function toIsoDate(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addYear(iso) {
  const date = new Date(iso);
  date.setFullYear(date.getFullYear() + 1);
  return toIsoDate(date);
}

function formatServiceCardDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  } catch (error) {
    return "-";
  }
}

function formatServiceCardDay(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(date);
  } catch (error) {
    return "-";
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateTimeWithDay(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value) || 0);
}

let photoViewerState = { serviceId: "", index: 0, scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0, pinchDistance: 0, pinchScale: 1 };

function getPhotoViewerElements() {
  return {
    overlay: document.querySelector("#photoViewer"),
    img: document.querySelector("#photoViewerImg"),
    caption: document.querySelector("#photoViewerCaption"),
    count: document.querySelector("#photoViewerCount"),
    prev: document.querySelector("#photoViewerPrev"),
    next: document.querySelector("#photoViewerNext"),
  };
}

function openPhotoViewer(serviceId, photoId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !service.photos?.length) return;
  const index = Math.max(0, service.photos.findIndex((photo) => photo.id === photoId));
  photoViewerState = { ...photoViewerState, serviceId, index, scale: 1, x: 0, y: 0 };
  const { overlay } = getPhotoViewerElements();
  if (!overlay) return;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("photo-viewer-open");
  renderPhotoViewer();
}

function closePhotoViewer() {
  const { overlay } = getPhotoViewerElements();
  if (!overlay) return;
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("photo-viewer-open");
}

function renderPhotoViewer() {
  const service = state.services.find((item) => item.id === photoViewerState.serviceId);
  const photo = service?.photos?.[photoViewerState.index];
  const { img, caption, count, prev, next } = getPhotoViewerElements();
  if (!photo || !img) return;
  img.src = photo.dataUrl;
  img.alt = photo.caption || "Servis fotoğrafı";
  img.style.transform = `translate(${photoViewerState.x}px, ${photoViewerState.y}px) scale(${photoViewerState.scale})`;
  if (caption) caption.textContent = photo.caption || "Fotoğraf";
  if (count) count.textContent = `${photoViewerState.index + 1} / ${service.photos.length}`;
  if (prev) prev.disabled = service.photos.length < 2;
  if (next) next.disabled = service.photos.length < 2;
}

function movePhotoViewer(direction) {
  const service = state.services.find((item) => item.id === photoViewerState.serviceId);
  const count = service?.photos?.length || 0;
  if (!count) return;
  photoViewerState.index = (photoViewerState.index + direction + count) % count;
  resetPhotoViewer(false);
  renderPhotoViewer();
}

function zoomPhotoViewer(delta) {
  photoViewerState.scale = Math.min(5, Math.max(1, photoViewerState.scale + delta));
  if (photoViewerState.scale === 1) {
    photoViewerState.x = 0;
    photoViewerState.y = 0;
  }
  renderPhotoViewer();
}

function resetPhotoViewer(shouldRender = true) {
  photoViewerState.scale = 1;
  photoViewerState.x = 0;
  photoViewerState.y = 0;
  if (shouldRender) renderPhotoViewer();
}

function setupPhotoViewerGestures() {
  const { overlay, img } = getPhotoViewerElements();
  if (!overlay || !img) return;
  img.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomPhotoViewer(event.deltaY < 0 ? 0.2 : -0.2);
  }, { passive: false });
  img.addEventListener("dblclick", () => {
    if (photoViewerState.scale > 1) resetPhotoViewer();
    else { photoViewerState.scale = 2; renderPhotoViewer(); }
  });
  img.addEventListener("pointerdown", (event) => {
    if (photoViewerState.scale <= 1) return;
    photoViewerState.dragging = true;
    photoViewerState.startX = event.clientX;
    photoViewerState.startY = event.clientY;
    photoViewerState.baseX = photoViewerState.x;
    photoViewerState.baseY = photoViewerState.y;
    img.setPointerCapture?.(event.pointerId);
  });
  img.addEventListener("pointermove", (event) => {
    if (!photoViewerState.dragging) return;
    photoViewerState.x = photoViewerState.baseX + (event.clientX - photoViewerState.startX);
    photoViewerState.y = photoViewerState.baseY + (event.clientY - photoViewerState.startY);
    renderPhotoViewer();
  });
  img.addEventListener("pointerup", () => { photoViewerState.dragging = false; });
  img.addEventListener("pointercancel", () => { photoViewerState.dragging = false; });
  overlay.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;
      photoViewerState.pinchDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      photoViewerState.pinchScale = photoViewerState.scale;
    }
  }, { passive: true });
  overlay.addEventListener("touchmove", (event) => {
    if (event.touches.length === 2 && photoViewerState.pinchDistance) {
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      photoViewerState.scale = Math.min(5, Math.max(1, photoViewerState.pinchScale * (distance / photoViewerState.pinchDistance)));
      renderPhotoViewer();
    }
  }, { passive: false });
}

document.addEventListener("keydown", (event) => {
  const { overlay } = getPhotoViewerElements();
  if (!overlay?.classList.contains("is-open")) return;
  if (event.key === "Escape") closePhotoViewer();
  if (event.key === "ArrowLeft") movePhotoViewer(-1);
  if (event.key === "ArrowRight") movePhotoViewer(1);
});

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function norm(value) {
  return String(value || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

function digits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function isClosed(status) {
  return ["İşlem Tamam", "Hesap Kapatıldı", "Servis Sonlandırıldı", "Cihaz Teslim Edildi", "Müşteri İptal Etti"].includes(status);
}

function statusGroup(status) {
  const value = norm(status);
  if (value === norm("Yeni Kayıt")) return "new";
  if (value === norm("İşlem Tamam")) return "complete";
  if ([
    "İptal",
    "Müşteri İptal Etti",
    "Cihaz Tamir Edilemiyor",
    "Fiyatta Anlaşılamadı",
    "Tamir Edilemedi",
    "Servis Sonlandırıldı",
  ].some((item) => value === norm(item))) return "danger";
  return "process";
}

function serviceCardTheme(status) {
  return statusGroup(status);
}

function statusClass(status) {
  return statusGroup(status);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/* V3.4.0 - Mobile mimari devam: yeni fiş sihirbazı, harita ve kapanış ücret ekranı */
let mobileTechFilter = "remaining";
let mobileActiveServiceId = "";
let mobileSelectedDate = isoToday;
let mobileSelectedSource = "";
let mobileCashModeOpen = false;

function isMobileTechViewport() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

function mobileFullAddress(service) {
  const address=String(service.address||"");
  const neighborhood=service.neighborhood ? cleanNeighborhoodName(service.neighborhood)+" Mahallesi" : "";
  const street=removeSelectedNeighborhoodPrefix(address,service.neighborhood);
  return [service.city || "Ankara",service.district,neighborhood,street].filter(Boolean).join(", ").trim();
}

function safeServiceLocationUrl(value) {
  const raw=String(value||"").trim();
  if(!raw)return "";
  try {
    const u=new URL(raw);
    if(u.protocol!=="https:"&&u.protocol!=="http:")return "";
    const host=u.hostname.toLowerCase();
    if(!["google.com","www.google.com","maps.google.com","maps.app.goo.gl","goo.gl","maps.apple.com"].includes(host))return "";
    return u.href;
  } catch {return "";}
}

function mobileMapUrl(service) {
  const shared=safeServiceLocationUrl(service.locationUrl);
  if(shared)return shared;
  const destination = mobileFullAddress(service);
  if (!destination) return "";
  // Google Haritalar mobilde ve iPhone Safari'de en sorunsuz çalışan arama bağlantısı.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

function openMobileMap(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  const url = service ? mobileMapUrl(service) : "";
  if (!url) {
    alert("Harita için adres girilmemiş.");
    return;
  }
  window.location.href = url;
}

function mobileStatusBucket(status) {
  const group = statusGroup(status || "");
  if (group === "new") return "new";
  if (group === "complete") return "complete";
  if (group === "danger") return "danger";
  return "process";
}

function mobileIsDoneService(service) {
  // Kapalı fişleri hem servis durumu hem kapanıştaki ödeme türünden tanı.
  // Bazı eski kayıtlarda durum güncellenmemiş olsa da ödeme bekleme alanı doludur.
  if (isStatus(service.status, "Ödeme Bekliyor") || isClosed(service.status)) return true;
  const payment = String(service.paymentStatus || "").trim();
  if (payment === "Havale Bekleniyor" || payment === "Sonra Tahsil Edilecek") return true;
  const lastClosure = (Array.isArray(service.statusHistory) ? service.statusHistory : [])
    .find((entry) => String(entry?.description || "").includes("Fiş kapatıldı"));
  return Boolean(lastClosure && (
    isStatus(lastClosure.status, "Ödeme Bekliyor") ||
    isStatus(lastClosure.status, "İşlem Tamam")
  ) && !["Yeni Kayıt", "İşlemde", "Geri Dönen İş"].some((status) => isStatus(service.status, status)));
}

function mobileIsRemainingService(service) {
  return !mobileIsDoneService(service) && statusGroup(service.status) !== "danger";
}

let mobileAllDates = false;
// Mobile home always starts on today; desktop retains its This Week default.
let mobileRangeStart = isoToday;
let mobileRangeEnd = isoToday;
let mobileServiceQuery = "";

function mobileDateWithinRange(date) {
  return Boolean(date) && date >= mobileRangeStart && date <= mobileRangeEnd;
}

function mobileDateFilterMatch(service, date, bucket) {
  if (mobileAllDates) return true;
  if (!mobileRangeStart || !mobileRangeEnd) return mobileServiceVisibleOnDate(service, date, bucket);
  const planned = mobilePlanningDate(service);
  if (mobileDateWithinRange(planned)) return true;
  const carries = bucket !== "closed" && bucket !== "done";
  return carries && planned && planned < mobileRangeStart && mobileIsRemainingService(service);
}

function mobileDateRangeLabel() {
  if (mobileAllDates) return "Tüm zamanlar";
  const readable = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", {day:"numeric",month:"long",year:"numeric"}).format(date);
  };
  if (mobileRangeStart && mobileRangeEnd) return mobileRangeStart === mobileRangeEnd
    ? readable(mobileRangeStart) : readable(mobileRangeStart) + " – " + readable(mobileRangeEnd);
  return "";
}

function mobileSetDateRange(start, end, allTime = false) {
  mobileAllDates = allTime;
  mobileRangeStart = allTime ? "" : start;
  mobileRangeEnd = allTime ? "" : end;
  const picker = document.querySelector("#mobileDatePicker");
  if (picker && start) picker.value = start;
  if (start) mobileSelectedDate = start;
  refreshMobileServiceViews();
  window.ekzenMobileOpenClosedV511?.(false);
  window.ekzenUpdateWelcome?.();
}

function mobileDatePresetRange(preset) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d) => toIsoDate(d);
  const shift = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d); };
  if (preset === "allTime") return { allTime: true, start: "", end: "" };
  if (preset === "yesterday") return { start: shift(-1), end: shift(-1) };
  if (preset === "tomorrow") return { start: shift(1), end: shift(1) };
  if (preset === "thisWeek") return { start: shift(-((base.getDay()+6)%7)), end: shift(6-((base.getDay()+6)%7)) };
  if (preset === "lastWeek") return { start: shift(-((base.getDay()+6)%7)-7), end: shift(-((base.getDay()+6)%7)-1) };
  if (preset === "thisMonth") return { start: iso(new Date(base.getFullYear(),base.getMonth(),1)), end: iso(new Date(base.getFullYear(),base.getMonth()+1,0)) };
  return { start: iso(base), end: iso(base) };
}
document.addEventListener("click", (event) => {
  const dateCard = event.target.closest("#mobileWelcomePage .mobile-welcome-date-card");
  if (dateCard) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const dialog = document.querySelector("#mobileWelcomeDateDialog");
    if (dialog && !dialog.open) dialog.showModal();
    return;
  }
  if (event.target.closest("[data-mobile-date-close]")) {
    document.querySelector("#mobileWelcomeDateDialog")?.close();
    return;
  }
  const preset = event.target.closest("[data-mobile-date-preset]");
  if (preset) {
    const range = mobileDatePresetRange(preset.dataset.mobileDatePreset);
    mobileSetDateRange(range.start,range.end,Boolean(range.allTime));
    document.querySelector("#mobileWelcomeDateDialog")?.close();
    return;
  }
  if (event.target.closest("[data-mobile-date-apply]")) {
    const start = document.querySelector("#mobileWelcomeDateStart")?.value;
    const end = document.querySelector("#mobileWelcomeDateEnd")?.value;
    if (!start || !end || start > end) { alert("Geçerli başlangıç ve bitiş tarihi seç."); return; }
    mobileSetDateRange(start,end);
    document.querySelector("#mobileWelcomeDateDialog")?.close();
  }
}, true);


function mobilePlanningDate(service) {
  return serviceDateCandidates(service)[0] || "";
}

function mobileServiceVisibleOnDate(service, date, bucket) {
  if (mobileAllDates || !date) return true;
  if (mobileRangeStart && mobileRangeEnd) return mobileDateFilterMatch(service, date, bucket);
  const serviceDate = mobilePlanningDate(service);
  const carries = bucket !== "closed" && bucket !== "done";
  if (!serviceDate) return carries;
  if (serviceDate === date) return true;
  return carries && serviceDate < date && mobileIsRemainingService(service);
}

function mobileSourceVisible(service, source) {
  // Kaynak seçilmemişken boş, gizli veya silinmiş kaynaklı servisler de görünür.
  if (!String(source || "").trim()) return true;
  return sourceMatches(service?.source, source);
}

function mobileMatchesServiceQuery(service, query) {
  const text = norm(query);
  if (!text) return true;
  const phoneQuery = digits(query);
  const name = norm(service?.customerName);
  const phone = digits(service?.phone);
  return name.includes(text) || norm(service?.phone).includes(text) || (phoneQuery && phone.includes(phoneQuery));
}

function syncMobileDateTools() {
  document.querySelectorAll("[data-mobile-all-dates]").forEach((button) => {
    button.classList.toggle("is-active", mobileAllDates);
    button.setAttribute("aria-pressed", mobileAllDates ? "true" : "false");
  });
}

function refreshMobileServiceViews() {
  syncMobileDateTools();
  const root = document.querySelector("#mobileTechApp");
  const cashOpen = root?.classList.contains("is-cash-mode");
  const listOpen = root?.classList.contains("is-list-mode");
  const welcomeOpen = root?.classList.contains("is-welcome-mode");
  if (!cashOpen && (listOpen || !welcomeOpen)) {
    try { window.ekzenMobileOpenClosedV511?.(false); } catch (error) { console.warn("Mobil liste yenilenemedi.", error); }
    try { window.ekzenMobileStableRender?.(); } catch (error) { console.warn("Mobil kalan listesi yenilenemedi.", error); }
  }
  try { window.ekzenUpdateWelcome?.(); } catch (error) { console.warn("Mobil özet yenilenemedi.", error); }
}

function mobileFilteredServices() {
  let services = sortServices(state.services || []).filter((service) => serviceHasDate(service, mobileSelectedDate || isoToday));
  if (mobileTechFilter === "new") services = services.filter((service) => isStatus(service.status, "Yeni Kayıt"));
  if (mobileTechFilter === "done") services = services.filter(mobileIsDoneService);
  if (mobileTechFilter === "remaining") services = services.filter(mobileIsRemainingService);
  return services;
}


function mobileOpenMainDatePanel() {
  const picker = document.querySelector("#mobileDatePicker");
  if (!picker) return;
  picker.value = mobileSelectedDate || isoToday;
  picker.focus({ preventScroll: true });
  try { if (typeof picker.showPicker === "function") picker.showPicker(); } catch (error) {}
}

function mobileCloseMainDatePanel() {
  // V3.5.1: Ana tarih için ayrı panel yok; gerçek date input kullanılır.
}

function mobileSetCashMode(isCash) {
  mobileCashModeOpen = Boolean(isCash);
  const root = document.querySelector("#mobileTechApp");
  const list = document.querySelector("#mobileServiceList");
  const newButton = document.querySelector(".mobile-new-service-bar");
  const page = document.querySelector("#mobileDailyCashPage");
  root?.classList.toggle("is-cash-mode", mobileCashModeOpen);
  if (list) {
    list.hidden = mobileCashModeOpen;
    list.style.display = mobileCashModeOpen ? "none" : "grid";
  }
  if (newButton) {
    newButton.hidden = mobileCashModeOpen;
    newButton.style.display = mobileCashModeOpen ? "none" : "block";
  }
  if (page) {
    page.hidden = !mobileCashModeOpen;
    page.style.display = mobileCashModeOpen ? "block" : "none";
    page.classList.toggle("is-open", mobileCashModeOpen);
  }
}

function mobileApplyMainDate(value) {
  mobileSelectedDate = value || isoToday;
  mobileSetCashMode(false);
  mobileRenderTechPanel();
}

function mobileServiceCounts() {
  const services = (state.services || []).filter((service) => serviceHasDate(service, mobileSelectedDate || isoToday));
  return {
    remaining: services.filter(mobileIsRemainingService).length,
    new: services.filter((service) => isStatus(service.status, "Yeni Kayıt")).length,
    done: services.filter(mobileIsDoneService).length,
  };
}

function mobileRenderTechPanel() {
  try {
    mobileRenderTechPanelNow();
  } catch (error) {
    console.warn("Mobil panel çizilemedi.", error);
  }
}

function mobileRenderTechPanelNow() {
  const root = document.querySelector("#mobileTechApp");
  if (!root) return;
  const counts = mobileServiceCounts();
  const currentCount = counts[mobileTechFilter] ?? counts.remaining;
  const filterLabel = mobileTechFilter === "new" ? "Yeni" : mobileTechFilter === "done" ? "Biten" : "Kalan";

  const summary = document.querySelector("#mobileTechSummary");
  if (summary) summary.textContent = `${filterLabel} · ${currentCount} servis`;
  const remainingCounter = document.querySelector("#mobileCountRemaining");
  if (remainingCounter) remainingCounter.textContent = counts.remaining;
  const newCounter = document.querySelector("#mobileCountNew");
  if (newCounter) newCounter.textContent = counts.new;
  const doneCounter = document.querySelector("#mobileCountDone");
  if (doneCounter) doneCounter.textContent = counts.done;
  mobileRenderDailyCash();
  const activeMobileDate = mobileSelectedDate || isoToday;
  const pickerEl = document.querySelector("#mobileDatePicker");
  if (pickerEl && pickerEl.value !== activeMobileDate) pickerEl.value = activeMobileDate;
  const titleEl = document.querySelector("#mobileListTitle");
  if (titleEl) titleEl.textContent = activeMobileDate === isoToday ? (mobileTechFilter === "done" ? "Bugünkü Biten Servisler" : "Bugünkü Servisler") : (mobileTechFilter === "done" ? "Seçili Tarihte Bitenler" : "Seçili Tarihte Servisler");
  document.querySelectorAll("[data-mobile-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mobileFilter === mobileTechFilter);
  });

  const list = document.querySelector("#mobileServiceList");
  const services = mobileFilteredServices();
  if (list) {
    list.innerHTML = services.length ? services.map(mobileServiceCard).join("") : `<div class="mobile-empty">Bu bölümde servis yok.</div>`;
    if (!mobileCashModeOpen) {
      list.hidden = false;
      list.style.display = "grid";
    }
  }
  mobileSetCashMode(mobileCashModeOpen);

  if (mobileActiveServiceId) mobileRenderDetail(mobileActiveServiceId);
}


let mobileCashRangeStart = "";
let mobileCashRangeEnd = "";
let mobileCashSource = "";
let mobileCashRangeMode = "today";
let mobileCashRangeInitialized = false;
let mobileCashDetailFilter = "all";
function mobileCashMovementCategory(item) {
  if (item.autoCommissionExpense) return "commission";
  if (item.autoMaterialExpense) return "material";
  if (item.type === "income") return "income";
  return "expense";
}


function mobileCashDefaultToday() {
  mobileCashRangeStart = mobileSelectedDate || isoToday;
  mobileCashRangeEnd = mobileSelectedDate || isoToday;
  mobileCashRangeMode = "today";
  mobileCashRangeInitialized = true;
}

function mobileCashPopulateSources() {
  const select = document.querySelector("#mobileCashSourcePicker");
  if (!select) return;
  const current = mobileCashSource || "";
  const values = [...new Set([
    ...settingsList("sources"),
    ...(state.services || []).map((item) => item.source),
    ...(state.cash || []).map((item) => cashItemSource(item))
  ].filter((value) => value && (!isHiddenSource(value) || value === current)))].sort((a,b) => String(a).localeCompare(String(b), "tr"));
  select.innerHTML = `<option value="">Tüm Kaynaklar</option>` + values.map((v) =>
    `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join("");
  select.value = current;
}


/* V5.3.25 — Kullanıcı tanımlı, veri kaynaklarına bağlı kasa hesaplama motoru */
const CUSTOM_CASH_TERMS = [
  ["income","Toplam Hasılat"],["commission","Ödenen Komisyon"],
  ["material","Malzeme"],["expense","Diğer Gider"],["serviceIncome","Servis Hasılatı"],
  ["pendingAmount","Ödeme Bekleyen Tutar"],["pendingCount","Ödeme Bekleyen Fiş Adedi"],["ekzenShare","Ekzen Payı"],["remainingPayment","Kalan Ödeme"]
];
function customCashCounters() {
  if (!Array.isArray(state.settings.customCashCounters)) state.settings.customCashCounters = [];
  return state.settings.customCashCounters;
}
function customCashContext(items) {
  const totals = cashBreakdown(items);
  const serviceTotals = serviceOnlyCashBreakdown(items);
  const sourceTotals = serviceSourceCounterBreakdown(items);
  const pending = (state.services || []).filter(s =>
    matchesPortalSource(s.source) &&
    (!mobileCashSource || sourceMatches(s.source,mobileCashSource)) &&
    (isStatus(s.status,"Ödeme Bekliyor") || ["Havale Bekleniyor","Sonra Tahsil Edilecek"].includes(String(s.paymentStatus||"")))
  );
  return {
    income:totals.income,commission:totals.commission,material:totals.material,
    expense:totals.manualExpense,serviceIncome:serviceTotals.income,
    ekzenShare:sourceTotals.ekzenTechnical,remainingPayment:sourceTotals.remainingPayment,
    pendingCount:pending.length,
    pendingAmount:pending.reduce((sum,s)=>{
      const value=Number(primaryCashForService(s.id)?.amount ?? s.price ?? 0);
      return sum+(Number.isFinite(value)?Math.max(0,value):0);
    },0)
  };
}
function customCashValue(counter,context) {
  return (Array.isArray(counter.terms)?counter.terms:[]).reduce((sum,term)=>{
    if (!CUSTOM_CASH_TERMS.some(x=>x[0]===term.key)) return sum;
    const sign=term.sign===-1?-1:1;
    return sum+sign*(Number(context[term.key])||0);
  },0);
}

const CASH_SLOT_DEFAULTS=[
 {id:"profit",name:"Net Kazanç",color:"#0f766e",unit:"money",terms:[{key:"serviceIncome",sign:1},{key:"commission",sign:-1},{key:"material",sign:-1},{key:"expense",sign:-1}]},
 {id:"payment",name:"Ödeme Bekliyor",color:"#d97706",unit:"count",terms:[{key:"pendingCount",sign:1}]},
 {id:"income",name:"Toplam Hasılat",color:"#15803d",unit:"money",terms:[{key:"income",sign:1}]},
 {id:"commission",name:"Ödenen Komisyon",color:"#b91c1c",unit:"money",terms:[{key:"commission",sign:1}]},
 {id:"material",name:"Malzeme",color:"#2563eb",unit:"money",terms:[{key:"material",sign:1}]},
 {id:"expense",name:"Kalan Ödeme",color:"#2563eb",unit:"money",terms:[{key:"remainingPayment",sign:1}]}
];
function cashSlotSettings(){
 if(!Array.isArray(state.settings.cashSlotSettings))state.settings.cashSlotSettings=[];
 return CASH_SLOT_DEFAULTS.map((def,index)=>{const saved=state.settings.cashSlotSettings.find(c=>c?.id===def.id)||{};return {...def,...saved,visible:saved.visible!==false,order:Number.isInteger(saved.order)?saved.order:index};}).sort((a,b)=>a.order-b.order);
}
function renderSharedCashSlots(items){
 const grid=document.querySelector("#mobileCashProfitCounter")?.parentElement;
 if(!grid)return;
 const context=customCashContext(items);
 const selectedSource=isSourcePortal()?portalSourceName():mobileCashSource;
 const isExternalSource=Boolean(selectedSource)&&!isOwnWorkSource(selectedSource);
 const datedSource=isExternalSource?serviceSourceCounterBreakdown(items):null;
 const allTimeSource=isExternalSource?serviceSourceCounterBreakdown((state.cash||[]).filter(item=>cashIsPosted(item)&&matchesPortalSource(cashItemSource(item))&&sourceMatches(cashItemSource(item),selectedSource))):null;
 const selectors={profit:"#mobileCashProfitCounter",payment:"#mobileCashPaymentCounter",
 income:"#mobileDailyPageIncome",commission:"#mobileDailyPageCommission",
 material:"#mobileDailyPageMaterial",expense:"#mobileDailyPageExpense"};
 const special=selectedSource?sourceSpecialConfig(selectedSource):{};
 const ordered=allHomeCashSlots().slice().sort((a,b)=>{const ids=special.counterOrderByDevice?.mobile||special.counterOrder||[];const ai=ids.indexOf(a.id),bi=ids.indexOf(b.id);return (ai<0?100+a.order:ai)-(bi<0?100+b.order:bi);});
 ordered.forEach((base,index)=>{
   const override=special.countersByDevice?.mobile?.[base.id]||special.counters?.[base.id]||{};
   const c={...base,...override,name:String(override.name||"").trim()||String(base.name||"").trim()||base.id};
   const node=document.querySelector(selectors[c.id]);
   const card=c.id==="profit"||c.id==="payment"?node:node?.closest(".mobile-daily-counter");
   if(!card)return;
   card.style.order=String(index);
   // Visibility is controlled by the saved counter settings, not forced by the selected source.
   const shouldHide=base.visible===false || override.visible===false;
   card.hidden=shouldHide;
   card.style.setProperty("display",shouldHide?"none":"","important");
   const chosenColor=/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb";
    card.style.setProperty("background",chosenColor,"important");
    card.style.setProperty("background-color",chosenColor,"important");
   card.style.color="#fff";
   const heading=card.querySelector(":scope > span");
   if(heading){
     heading.textContent=c.name;
     heading.style.setProperty("display","block","important");
     heading.style.setProperty("visibility","visible","important");
     heading.style.setProperty("opacity","1","important");
   }
   let value=customCashValue(c,context);
   if(isExternalSource){
     if(c.id==="profit")value=datedSource.hakedis;
     if(c.id==="commission")value=datedSource.ekzenTechnical;
     if(c.id==="income")value=datedSource.customerMoney;
     if(c.id==="material")value=datedSource.material;
     if(c.id==="expense")value=allTimeSource.remainingPayment;
   } else if(c.id==="expense") {
     value=serviceSourceCounterBreakdown((state.cash||[]).filter(item=>cashIsPosted(item)&&matchesPortalSource(cashItemSource(item))&&(!selectedSource||sourceMatches(cashItemSource(item),selectedSource)))).remainingPayment;
   }
   if(c.id==="payment"){
     const summary=card.querySelector("b");
     if(summary)summary.innerHTML=c.unit==="count"?'<span id="mobileCashPaymentCount">'+String(value)+'</span> fiş':escapeHtml(money(value));
     const amount=card.querySelector("#mobileCashPaymentAmount");
     if(amount)amount.textContent=money(context.pendingAmount);
   }else if(c.id==="profit"){const val=card.querySelector("#mobileDailyPageProfit");if(val)val.textContent=c.unit==="count"?String(value):money(value);}
   else if(node)node.textContent=c.unit==="count"?String(value):money(value);
 });
}


const HOME_LAYOUT_DEFAULTS={desktop:[],mobile:[]};
function allHomeCashSlots(){
 const financial=[...cashSlotSettings(),...customCashCounters().map((c,i)=>({...c,id:"custom-"+i,order:100+i}))];
 const statuses=settingsList("statuses");
 const serviceCounters=statuses.map((name,i)=>({id:"status-"+encodeURIComponent(name),name,color:"#0f766e",unit:"count",kind:"service-status",statusName:name,order:200+i,visible:true}));
 return [...financial,...serviceCounters];
}
function homeLayout(device){
  const raw=state.settings?.homeLayout?.[device];
  const valid=new Set(allHomeCashSlots().map(x=>x.id));
  return Array.isArray(raw)?[...new Set(raw.filter(id=>valid.has(id)))]:[];
}

let selectedSourceSettingsName="";
function sourceSpecialConfig(source){
  return state.settings?.sourceSpecialSettings?.[source]||{};
}
function renderSourceSpecialSettings(){
  const root=document.querySelector("#sourceSpecialSettings");if(!root)return;
  const names=[...new Set([...settingsList("sources"),...(state.services||[]).map(s=>s.source).filter(Boolean)])];
  if(!names.includes(selectedSourceSettingsName))selectedSourceSettingsName=names[0]||"";
  const source=selectedSourceSettingsName;
  const config=sourceSpecialConfig(source);
  const overrides=config.countersByDevice?.[activeSourceCounterDeviceTab]||config.counters||{};
  const counterOrder=Array.isArray(config.counterOrderByDevice?.[activeSourceCounterDeviceTab])?config.counterOrderByDevice[activeSourceCounterDeviceTab]:(Array.isArray(config.counterOrder)?config.counterOrder:[]);
  const ordered=allHomeCashSlots().slice().sort((a,b)=>{
    const ai=counterOrder.indexOf(a.id),bi=counterOrder.indexOf(b.id);
    return (ai<0?100+a.order:ai)-(bi<0?100+b.order:bi);
  });
  root.innerHTML='<h3>Kaynağa Özel Ayarlar</h3><p>Bir kaynak seçin. Buradaki değişiklikler diğer kaynakları etkilemez. Mevcut fişlerin geçmiş hesapları değiştirilmez.</p>'+
    '<label class="source-settings-picker">Servis kaynağı<select id="specialSourcePicker">'+names.map(n=>'<option value="'+escapeAttr(n)+'" '+(n===source?"selected":"")+'>'+escapeHtml(n)+'</option>').join("")+'</select></label>'+
    (!source?'<p>Önce bir servis kaynağı ekleyin.</p>':
    '<nav class="source-settings-tabs" aria-label="Kaynağa özel ayar türü"><button type="button" data-source-settings-tab="counters">◉ Sayaçlar</button><button type="button" data-source-settings-tab="home">▦ Ana Sayfa</button><button type="button" data-source-settings-tab="finance">₺ Komisyon ve Ödeme</button></nav><div class="source-settings-columns"><div data-source-settings-panel="counters"><h4>Kaynağa Özel Sayaçlar</h4><p>İsim, renk, görünürlük ve sıralama yalnızca seçilen kaynakta geçerlidir.</p>'+
    ordered.map((c,i)=>{
      const o=overrides[c.id]||{};
      return '<div class="source-settings-counter" data-special-counter="'+c.id+'"><div class="source-settings-counter-title"><strong>'+escapeHtml(c.name)+'</strong><span><button type="button" data-action="source-counter-move" data-slot="'+c.id+'" data-direction="-1" '+(i===0?"disabled":"")+'>↑</button><button type="button" data-action="source-counter-move" data-slot="'+c.id+'" data-direction="1" '+(i===ordered.length-1?"disabled":"")+'>↓</button></span></div>'+
      '<label>Özel ad<input data-special-name value="'+escapeAttr(o.name||"")+'" placeholder="'+escapeAttr(c.name)+'"></label>'+
      '<label>Renk<input data-special-color type="color" value="'+(/^#[0-9a-fA-F]{6}$/.test(o.color)?o.color:c.color)+'"></label>'+
      '<label class="source-settings-checkbox"><input data-special-visible type="checkbox" '+(o.visible!==false?"checked":"")+'> Göster</label></div>';
    }).join("")+'</div></div><div data-source-settings-panel="home"><h4>Mac ve Telefon Ana Sayfası</h4><p>Bu kaynak seçildiğinde görünecek sayaçları belirleyin.</p>'+
    '<nav class="device-settings-tabs"><button type="button" data-source-home-device-tab="mobile" class="'+(activeSourceHomeDeviceTab==='mobile'?'is-active':'')+'">📱 Telefon</button><button type="button" data-source-home-device-tab="desktop" class="'+(activeSourceHomeDeviceTab==='desktop'?'is-active':'')+'">💻 Mac / Masaüstü</button></nav><p class="device-settings-notice">Şu anda: <strong>'+(activeSourceHomeDeviceTab==='mobile'?'📱 Telefon':'💻 Mac / Masaüstü')+'</strong></p>'+ 
    ["desktop","mobile"].map(device=>{
      const chosen=Array.isArray(config.homeLayout?.[device])?config.homeLayout[device]:homeLayout(device);
      return '<div class="source-settings-device" data-source-device-panel="'+device+'" '+(device!==activeSourceHomeDeviceTab?'hidden':'')+'><strong>'+(device==="desktop"?"💻 Mac / Masaüstü":"📱 Telefon")+'</strong>'+
      '<p class="source-home-order-hint">İşaretlediğiniz sayaçları ↑ ↓ düğmeleriyle sıralayın. Sıralama yalnızca bu kaynak ve cihaz için geçerlidir.</p><div class="source-home-order-list" data-source-home-order="'+device+'">'+
      [...ordered].sort((a,b)=>{const ai=chosen.indexOf(a.id),bi=chosen.indexOf(b.id);return (ai<0?1000+a.order:ai)-(bi<0?1000+b.order:bi);}).map(c=>
        '<div class="source-home-order-row"><input class="source-home-checkbox" type="checkbox" data-special-home="'+device+'" value="'+escapeAttr(c.id)+'" '+(chosen.includes(c.id)?"checked":"")+' aria-label="'+escapeAttr(overrides[c.id]?.name||c.name)+'"><label class="source-home-name-field"><span class="source-home-counter-name">'+escapeHtml(c.name)+'</span><input class="source-home-name-input" type="text" maxlength="45" data-source-home-name="'+device+'" data-slot="'+escapeAttr(c.id)+'" value="'+escapeAttr((config.countersByDevice?.[device]?.[c.id]?.name)||config.counters?.[c.id]?.name||"")+'" placeholder="Özel sayaç adı" aria-label="'+escapeAttr(c.name)+' özel adı"></label>'+
        '<span class="source-home-order-buttons"><button type="button" data-source-home-move="-1" aria-label="Yukarı taşı">↑</button><button type="button" data-source-home-move="1" aria-label="Aşağı taşı">↓</button></span></div>'
      ).join("")+'</div></div>';
    }).join("")+
    '</div><div data-source-settings-panel="finance"><h4>Komisyon ve Hakediş</h4><label>'+(isOwnWorkSource(source)?'Kaynağa ayrılan pay (%)':'Bize kalan pay (%)')+'<input id="specialSourceRate" type="number" min="0" max="100" step="0.01" value="'+sourceCommissionShare(source)+'"></label>'+
    '<p>Bu oran yeni fişlerde varsayılan pay olarak kullanılır. Eski fişlerin kaydedilmiş oranları korunur.</p>'+
    '<label>Hakediş açıklaması<input id="specialSourceHakedis" maxlength="120" value="'+escapeAttr(config.hakedisNote||"")+'" placeholder="Örn. Ay sonunda hesaplaşma"></label>'+
    '<label>Ödeme vadesi (gün)<input id="specialSourcePaymentDays" type="number" min="0" max="365" value="'+(Number.isInteger(config.paymentDays)?config.paymentDays:0)+'"></label>'+
    '<label>Ödeme kuralı<select id="specialSourcePaymentRule"><option value="manual" '+(config.paymentRule!=="on-close"?"selected":"")+'>Manuel hesaplaşma</option><option value="on-close" '+(config.paymentRule==="on-close"?"selected":"")+'>Fiş kapanınca hakediş</option></select></label>'+
    '<p>Ödeme vadesi ve kuralı şimdilik kaynak profilinde saklanır; mevcut tahsilatları veya kasa bakiyesini otomatik değiştirmez.</p></div></div>'+
    '<button type="button" class="primary-button" id="saveSpecialSourceSettings">✓ Kaynağın Ayarlarını Kaydet</button><span id="specialSourceSaveStatus" role="status"></span>');
  showSourceSettingsTab(activeSourceSettingsTab);
  root.querySelector("#specialSourcePicker")?.addEventListener("change",e=>{selectedSourceSettingsName=e.target.value;renderSourceSpecialSettings();});
  // The save action is handled by a capturing listener to avoid mobile navigation click interception.
}
async function saveSourceSpecialSettings(){
  const source=selectedSourceSettingsName;
  const root=document.querySelector("#sourceSpecialSettings");
  if(!source||!root)return;
  const saveButton=root.querySelector("#saveSpecialSourceSettings");
  const statusBefore=root.querySelector("#specialSourceSaveStatus");
  if(saveButton){saveButton.disabled=true;saveButton.textContent="Kaydediliyor…";}
  if(statusBefore)statusBefore.textContent=" Kaydediliyor…";
  const rate=Number(root.querySelector("#specialSourceRate").value);
  const days=Number(root.querySelector("#specialSourcePaymentDays").value);
  if(!Number.isFinite(rate)||rate<0||rate>100||!Number.isInteger(days)||days<0||days>365){alert("Pay 0–100, ödeme vadesi 0–365 arasında olmalı.");if(saveButton){saveButton.disabled=false;saveButton.textContent="✓ Kaynağın Ayarlarını Kaydet";}return;}
  const old=sourceSpecialConfig(source);
  const counters={};
  root.querySelectorAll("[data-special-counter]").forEach(row=>{
    const id=row.dataset.specialCounter;
    counters[id]={name:row.querySelector("[data-special-name]").value.trim().slice(0,45),
      color:row.querySelector("[data-special-color]").value,
      visible:row.querySelector("[data-special-visible]").checked};
  });
  // Save names independently for Mac and phone without overwriting the other device.
  const perDeviceCounters={...(old.countersByDevice||{}),[activeSourceCounterDeviceTab]:counters};
  const nameDevice=activeSourceHomeDeviceTab;
  const deviceCounters={...(perDeviceCounters[nameDevice]||{})};
  root.querySelectorAll('[data-source-home-name="'+nameDevice+'"]').forEach(input=>{
    const id=input.dataset.slot;
    deviceCounters[id]={...(deviceCounters[id]||{}),name:input.value.trim().slice(0,45)};
  });
  perDeviceCounters[nameDevice]=deviceCounters;
  const homeLayoutConfig={...(old.homeLayout||{})};
  const activeDevice=activeSourceHomeDeviceTab;
  homeLayoutConfig[activeDevice]=[...root.querySelectorAll('[data-special-home="'+activeDevice+'"]:checked')].map(el=>el.value);
  const config={...old,countersByDevice:perDeviceCounters,homeLayout:homeLayoutConfig,
    hakedisNote:root.querySelector("#specialSourceHakedis").value.trim().slice(0,120),
    paymentDays:days,paymentRule:root.querySelector("#specialSourcePaymentRule").value};
  state.settings.sourceSpecialSettings={...(state.settings.sourceSpecialSettings||{}),[source]:config};
  state.settings.sourceCommissionRates={...(state.settings.sourceCommissionRates||{}),[source]:rate};
  const savedLocally=saveLocalState();
  renderSourceSpecialSettings();
  try{renderDashboard();mobileRenderDailyCash();}catch(renderError){console.warn("Kaynak ayarı sonrası ekran yenileme hatası",renderError);}
  const status=document.querySelector("#specialSourceSaveStatus");
  if(status)status.textContent=savedLocally?" ✓ Bu cihaza kaydedildi.":" Yerel kayıt yapılamadı.";
  if(!canSyncCloud()){if(status)status.textContent=savedLocally?" ✓ Bu cihaza kaydedildi; bulut bağlantısı yok.":" ⚠ Kayıt doğrulanamadı; bulut bağlantısı yok.";return;}
  try{
    await cloudRef.update({"state/settings/sourceSpecialSettings":state.settings.sourceSpecialSettings,
      "state/settings/sourceCommissionRates":state.settings.sourceCommissionRates,updatedAt:new Date().toISOString()});
    if(status)status.textContent=" ✓ Kaydedildi ve eşitlendi.";
  }catch(error){console.warn("Kaynak ayarları kaydedilemedi",error);if(status)status.textContent=savedLocally?" ⚠ Cihaza kaydedildi, buluta aktarılamadı.":" ⚠ Kaydetme başarısız; buluta aktarılamadı.";}
}

function renderHomeLayoutSettings(){
  const root=document.querySelector("#homeLayoutSettings");if(!root)return;
  root.innerHTML='<h3>Ana Sayfa Düzeni</h3><p>Önce hangi cihazı düzenleyeceğinizi seçin. Değişiklik yalnızca seçtiğiniz cihazın ana sayfasına uygulanır.</p><nav class="device-settings-tabs"><button type="button" data-home-device-tab="mobile" class="'+(activeHomeDeviceTab==='mobile'?'is-active':'')+'">📱 Telefon</button><button type="button" data-home-device-tab="desktop" class="'+(activeHomeDeviceTab==='desktop'?'is-active':'')+'">💻 Mac / Masaüstü</button></nav><p class="device-settings-notice">Şu anda: <strong>'+(activeHomeDeviceTab==='mobile'?'📱 Telefon ana sayfası':'💻 Mac ana sayfası')+'</strong></p>'+
    [activeHomeDeviceTab].map(device=>{
      const ids=homeLayout(device);
      const available=allHomeCashSlots();
      return '<h4>'+(device==="desktop"?"Mac ana sayfası":"Telefon ana sayfası")+'</h4><div class="custom-counter-list">'+
        available.map(c=>{
          const i=ids.indexOf(c.id),selected=i>=0;
          return '<div class="custom-counter-row"><strong>'+escapeHtml(c.name)+'</strong>'+
            '<button type="button" data-action="home-layout-toggle" data-device="'+device+'" data-slot="'+c.id+'">'+(selected?"Ana sayfadan kaldır":"Ana sayfaya ekle")+'</button>'+
            (selected?'<button type="button" data-action="home-layout-move" data-device="'+device+'" data-slot="'+c.id+'" data-direction="-1" '+(i===0?"disabled":"")+'>↑</button><button type="button" data-action="home-layout-move" data-device="'+device+'" data-slot="'+c.id+'" data-direction="1" '+(i===ids.length-1?"disabled":"")+'>↓</button>':"")+
          '</div>';
        }).join("")+'</div>';
    }).join("");
}
function homeCashCounterContext(items,selectedSource){
 const dated=customCashContext(items);
 const source=selectedSource||(isSourcePortal()?portalSourceName():"");
 const allTime=(state.cash||[]).filter(item=>cashIsPosted(item)&&matchesPortalSource(cashItemSource(item))&&(!source||sourceMatches(cashItemSource(item),source)));
 const current=serviceSourceCounterBreakdown(allTime);
 const sourceDated=serviceSourceCounterBreakdown(items);
 const isExternal=Boolean(source)&&!isOwnWorkSource(source);
 const pending=(state.services||[]).filter(service=>matchesPortalSource(service.source)&&(!source||sourceMatches(service.source,source))&&(isStatus(service.status,"Ödeme Bekliyor")||["Havale Bekleniyor","Sonra Tahsil Edilecek"].includes(String(service.paymentStatus||""))));
 return {
  ...dated,
  remainingPayment:current.remainingPayment,
  pendingCount:pending.length,
  pendingAmount:pending.reduce((total,service)=>{const amount=Number(primaryCashForService(service.id)?.amount??service.price??0);return total+(Number.isFinite(amount)?Math.max(0,amount):0);},0),
  sourceDated,
  isExternal
 };
}
function homeCashCounterValue(counter,context){
 if(counter.kind==="service-status")return 0;
 if(context.isExternal){
  if(counter.id==="profit")return context.sourceDated.hakedis;
  if(counter.id==="commission")return context.sourceDated.ekzenTechnical;
  if(counter.id==="income")return context.sourceDated.customerMoney;
  if(counter.id==="material")return context.sourceDated.material;
 }
 if(counter.id==="expense")return context.remainingPayment;
 return customCashValue(counter,context);
}
function homeStatusServices(statusName,source,device="desktop"){
 const all=(state.services||[]).filter(service=>matchesPortalSource(service.source)&&(!source||sourceMatches(service.source,source))&&isStatus(service.status,statusName));
 if(!isStatus(statusName,"İşlem Tamam"))return all;
 if(device==="mobile"){
   if(mobileAllDates)return all;
   const start=mobileRangeStart||mobileSelectedDate||isoToday;
   const end=mobileRangeEnd||mobileSelectedDate||isoToday;
   return all.filter(service=>dateInRange(serviceMainDate(service),start,end));
 }
 return all.filter(service=>dateInRange(serviceMainDate(service),dashboardStartDate?.value||"",dashboardEndDate?.value||""));
}
/* Shared presentation for current and future home counters. */
function homeCounterDisplayValue(counter,id,value,device){
 const isService=counter.kind==="service-status"||id==="payment";
 const isCount=isService||counter.unit==="count";
 if(isCount){
  const unit=isService?"Servis":String(counter.unitLabel||"Adet");
  return escapeHtml(String(value))+'<small class="home-counter-unit">'+escapeHtml(unit)+'</small>';
 }
 return escapeHtml(device==="mobile"?"₺"+new Intl.NumberFormat("tr-TR",{maximumFractionDigits:0}).format(value):money(value));
}
function renderHomeCashCards(device,items){
  const selectedSource=device==="desktop"?activeDashboardSource:(document.querySelector("#mobileSourcePicker")?.value||"");
  const special=selectedSource?sourceSpecialConfig(selectedSource):{};
  const root=document.querySelector(device==="desktop"?"#desktopHomeCashCards":"#mobileHomeCashCards");
  if(!root)return;
  const ids=Array.isArray(special.homeLayout?.[device])?special.homeLayout[device]:homeLayout(device);
  const slots=allHomeCashSlots();
  const context=homeCashCounterContext(items,selectedSource);
  root.hidden=!ids.length;
  root.innerHTML=ids.map(id=>{
    const c=slots.find(x=>x.id===id);
    if(!c)return "";
    const override=special.countersByDevice?.[device]?.[id]||special.counters?.[id]||{};
    if(override.visible===false)return "";
    const defaultNames={profit:"Net Kazanç",income:"Toplam Hasılat",commission:"Ödenen Komisyon",material:"Malzeme",expense:"Diğer Gider",payment:"Ödeme Bekliyor"};
    const displayName=[c.name,defaultNames[id],id].map(v=>String(v??"").trim()).find(Boolean)||id;
    const color=/^#[0-9a-fA-F]{6}$/.test(override.color)?override.color:(/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb");
    const statusServices=c.kind==="service-status"?homeStatusServices(c.statusName,selectedSource,device):null;
    const value=statusServices?statusServices.filter(service=>isStatus(service.status,c.statusName)).length:homeCashCounterValue(c,context);
    const pendingDetail=id==="payment" ? '<small class="home-pending-amount">₺'+escapeHtml(new Intl.NumberFormat("tr-TR",{maximumFractionDigits:0}).format(context.pendingAmount||0))+'</small>' : '<small class="ekzen-counter-description">'+escapeHtml(c.kind==="service-status"?"Bu durumdaki servisleri görüntüle":id==="profit"?"Hasılat - komisyon - malzeme - gider":id==="income"?"Toplam tahsilat":id==="commission"?"Ödenen komisyonlar":id==="material"?"Malzeme giderleri":id==="expense"?"Diğer giderler":"Ayrıntıları görüntüle")+'</small>';
    const displayValue=homeCounterDisplayValue(c,id,value,device);
    return '<button type="button" class="mobile-daily-counter home-cash-action" data-home-cash-slot="'+escapeAttr(id)+'" data-counter-title="'+escapeAttr(displayName)+'" aria-label="'+escapeAttr(displayName)+' ayrıntılarını aç" style="'+(device==='mobile'?'background:'+color+' !important;color:#fff !important;border-radius:16px;padding:15px;':'')+'min-width:0;box-sizing:border-box"><span class="ekzen-home-counter-title" style="color:#fff">'+escapeHtml(displayName)+'</span><b style="color:#fff">'+displayValue+'</b>'+pendingDetail+'</button>';
  }).join("");
  renderWorkflowCounters(device==="desktop"?"home-desktop":"home-mobile",selectedSource);
}


/* Yapılandırılabilir iş akışı sayaçları — mevcut sayaçları değiştirmez. */
function workflowCounters(){
  if(!Array.isArray(state.settings.workflowCounters))state.settings.workflowCounters=[];
  return state.settings.workflowCounters;
}
function workflowMatches(counter,source,rangeStart="",rangeEnd=""){
  return (state.services||[]).filter(s=>{
    if(!matchesPortalSource(s.source)|| (source&&!sourceMatches(s.source,source)))return false;
    if(rangeStart&&String(serviceMainDate(s)||"").slice(0,10)<rangeStart)return false;
    if(rangeEnd&&String(serviceMainDate(s)||"").slice(0,10)>rangeEnd)return false;
    if(counter.metric==="status")return isStatus(s.status,counter.status);
    if(counter.metric==="count")return true;
    return false;
  });
}
function workflowCounterValue(counter,source,start="",end=""){
  if(counter.metric==="status"||counter.metric==="count")return workflowMatches(counter,source,start,end).length;
  const items=(state.cash||[]).filter(item=>cashIsPosted(item)&&matchesPortalSource(cashItemSource(item))&&(!source||sourceMatches(cashItemSource(item),source)));
  const totals=serviceSourceCounterBreakdown(items);
  return counter.metric==="money"?totals.remainingPayment:customCashValue(counter,customCashContext(items));
}
function workflowCounterMarkup(counter,source,start="",end=""){
  const value=workflowCounterValue(counter,source,start,end);
  const color=/^#[0-9a-fA-F]{6}$/.test(counter.color)?counter.color:"#2563eb";
  return '<button type="button" class="mobile-daily-counter workflow-counter" data-workflow-id="'+escapeAttr(counter.id)+'" style="background:'+color+';color:#fff;border-radius:16px;padding:15px"><span>'+escapeHtml(counter.name)+'</span><b>'+escapeHtml(counter.metric==="status"||counter.metric==="count"?String(value)+" fiş":money(value))+'</b></button>';
}
function renderWorkflowCounters(place,source,start="",end=""){
  const root=document.querySelector(place==="home-mobile"?"#mobileWorkflowCounters":place==="home-desktop"?"#desktopWorkflowCounters":"#cashWorkflowCounters");
  if(!root)return;
  const counters=workflowCounters().filter(c=>c.visible!==false&&(place==="cash"?c.place==="cash"||c.place==="both":c.place==="home"||c.place==="both"));
  root.hidden=!counters.length;
  root.innerHTML=counters.map(c=>workflowCounterMarkup(c,source,start,end)).join("");
}
function workflowCounterList(counter,source){
  const services=workflowMatches(counter,source);
  let dialog=document.querySelector("#workflowCounterDetail");
  if(!dialog){dialog=document.createElement("dialog");dialog.id="workflowCounterDetail";document.body.appendChild(dialog);}
  dialog.innerHTML='<div style="padding:18px;min-width:min(80vw,320px);max-height:75vh;overflow:auto"><button type="button" data-workflow-close style="float:right">Kapat ×</button><h3>'+escapeHtml(counter.name)+'</h3><p>'+services.length+' servis</p>'+services.map(s=>'<button type="button" data-workflow-service="'+escapeAttr(s.id)+'" style="display:block;width:100%;text-align:left;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:8px">'+escapeHtml(s.customerName||s.id)+' · '+escapeHtml(s.status||"")+'</button>').join("")+'</div>';
  dialog.showModal();
}
function renderWorkflowSettings(){
  const root=document.querySelector("#workflowCounterSettings");if(!root)return;
  root.innerHTML='<h3>Yeni Nesil Sayaç Oluştur</h3><p>Sayaç adını, konumunu, hesaplamasını ve tıklama davranışını belirleyin.</p>'+
    '<div class="custom-counter-list">'+workflowCounters().map(c=>'<div class="custom-counter-row"><strong>'+escapeHtml(c.name)+'</strong><span>'+escapeHtml(c.place==="both"?"Ana Sayfa + Kasa":c.place==="cash"?"Kasa":"Ana Sayfa")+'</span><button type="button" data-workflow-edit="'+escapeAttr(c.id)+'">Düzenle</button><button type="button" data-workflow-toggle="'+escapeAttr(c.id)+'">'+(c.visible===false?"Göster":"Gizle")+'</button><button type="button" data-workflow-delete="'+escapeAttr(c.id)+'">Sil</button></div>').join("")+'</div>'+
    '<form id="workflowCounterForm" class="custom-counter-form"><input type="hidden" name="id">'+
    '<label>Sayaç adı<input name="name" maxlength="45" required placeholder="Atölyedeki Cihazlar"></label>'+
    '<label>Konum<select name="place"><option value="both">Ana Sayfa ve Kasa</option><option value="home">Ana Sayfa</option><option value="cash">Kasa</option></select></label>'+
    '<label>Hesaplama<select name="metric"><option value="status">Servis durumuna göre fiş adedi</option><option value="count">Toplam servis fişi adedi</option><option value="money">Kaynağın kalan alacağı</option><option value="formula">Özel hesaplama</option></select></label>'+
    '<label>Servis durumu<select name="status">'+settingsList("statuses").map(x=>'<option value="'+escapeAttr(x)+'">'+escapeHtml(x)+'</option>').join("")+'</select></label>'+
    '<label>Tıklama davranışı<select name="action"><option value="list">Servisleri listele</option><option value="transactions">Para hareketlerini göster</option><option value="payment">Kaynağa ödeme gir</option><option value="detail">Hesap dökümünü aç</option></select></label>'+
    '<label>Renk<input type="color" name="color" value="#2563eb"></label>'+
    '<button type="submit" class="primary-button">Sayacı Kaydet</button><button type="button" data-workflow-reset>Yeni Sayaç</button></form>';
}
function workflowPersist(){
  saveState();
  renderWorkflowSettings();
  renderDashboard();
  if(typeof mobileRenderDailyCash==="function")mobileRenderDailyCash();
}
document.addEventListener("submit",e=>{
  if(e.target.id!=="workflowCounterForm")return;
  e.preventDefault();
  if(isSourcePortal())return;
  const f=e.target,old=workflowCounters().find(c=>c.id===f.elements.id.value);
  const c={id:old?.id||uid(),name:f.elements.name.value.trim(),place:f.elements.place.value,
    metric:f.elements.metric.value,status:f.elements.status.value,action:f.elements.action.value,
    color:f.elements.color.value,visible:old?.visible!==false};
  if(!c.name)return;
  if(!old&&workflowCounters().length>=30){alert("En fazla 30 sayaç eklenebilir.");return;}
  if(old)Object.assign(old,c);else workflowCounters().push(c);
  workflowPersist();
  alert("Sayaç kaydedildi.");
});
document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-workflow-edit]"),del=e.target.closest("[data-workflow-delete]"),toggle=e.target.closest("[data-workflow-toggle]");
  if(edit||del||toggle){
    const id=(edit||del||toggle).dataset.workflowEdit||(edit||del||toggle).dataset.workflowDelete||(edit||del||toggle).dataset.workflowToggle;
    const c=workflowCounters().find(x=>x.id===id);if(!c)return;
    if(del){if(confirm("Sayaç silinsin mi?")){state.settings.workflowCounters=workflowCounters().filter(x=>x.id!==id);workflowPersist();}return;}
    if(toggle){c.visible=c.visible===false;workflowPersist();return;}
    const f=document.querySelector("#workflowCounterForm");if(!f)return;
    for(const key of ["id","name","place","metric","status","action","color"])if(f.elements[key])f.elements[key].value=c[key]||"";
    f.scrollIntoView({behavior:"smooth",block:"center"});return;
  }
  if(e.target.closest("[data-workflow-reset]")){document.querySelector("#workflowCounterForm")?.reset();document.querySelector('#workflowCounterForm [name="id"]').value="";return;}
  if(e.target.closest("[data-workflow-close]")){document.querySelector("#workflowCounterDetail")?.close();return;}
  const service=e.target.closest("[data-workflow-service]");
  if(service){document.querySelector("#workflowCounterDetail")?.close();mobileOpenDetail(service.dataset.workflowService);return;}
  const button=e.target.closest("[data-workflow-id]");if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  const c=workflowCounters().find(x=>x.id===button.dataset.workflowId);if(!c)return;
  const isCash=Boolean(button.closest("#mobileDailyCashPage"));
  const source=isCash?mobileCashSource:(button.closest("#desktopWorkflowCounters")?activeDashboardSource:document.querySelector("#mobileSourcePicker")?.value||"");
  if(c.action==="payment"){mobileOpenSourcePayment(source);return;}
  if(c.action==="list"){workflowCounterList(c,source);return;}
  if(c.action==="transactions"){if(typeof openHomeCashMovements==="function")openHomeCashMovements("expense");return;}
  if(c.action==="detail"){if(typeof openCashCurrentDetail==="function")openCashCurrentDetail("balance");return;}
},true);

function renderCustomCashCounterSettings() {
  const root=document.querySelector("#customCashCounterSettings");
  if (!root) return;
  root.innerHTML=`
    <h3>Ortak Sayaç ve Hesaplama Yönetimi</h3>
    <p>Sayaç ayarları ortak kaydedilir. Mobil sayaçların sırasını Yukarı / Aşağı düğmeleriyle değiştirebilirsiniz. Değişiklikler telefona eşitlenir.</p>\n    <h4>Mevcut mobil kasa sayaçları</h4>\n    <div class="custom-counter-list">${cashSlotSettings().map((c,i,all)=>`<div class="custom-counter-row"><span class="custom-counter-dot" style="background:${/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb"}"></span><strong>${escapeHtml(c.name)}</strong><button type="button" data-action="move-cash-slot" data-slot="${c.id}" data-direction="-1" ${i===0?"disabled":""}>↑ Yukarı</button><button type="button" data-action="move-cash-slot" data-slot="${c.id}" data-direction="1" ${i===all.length-1?"disabled":""}>↓ Aşağı</button><button type="button" data-action="edit-cash-slot" data-slot="${c.id}">Düzenle</button><button type="button" data-action="duplicate-cash-counter" data-slot="${c.id}">Çoğalt</button><button type="button" data-action="toggle-cash-slot" data-slot="${c.id}">${c.visible===false?"Göster":"Gizle"}</button></div>`).join("")}</div>\n    <h4>Ek sayaçlar</h4>
    <div class="custom-counter-list">${customCashCounters().map((c,i)=>`
      <div class="custom-counter-row">
        <span class="custom-counter-dot" style="background:${/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb"}"></span>
        <strong>${escapeHtml(c.name||"Sayaç")}</strong>
        <span>${(c.terms||[]).map(t=>(t.sign===-1?"−":"+")+" "+(CUSTOM_CASH_TERMS.find(x=>x[0]===t.key)?.[1]||"")).join(" ")}</span>
        <button type="button" data-action="edit-custom-counter" data-index="${i}">Düzenle</button><button type="button" data-action="duplicate-cash-counter" data-index="${i}">Çoğalt</button>
        <button type="button" data-action="toggle-custom-counter" data-index="${i}">${c.visible===false?"Göster":"Gizle"}</button>
        <button type="button" data-action="delete-custom-counter" data-index="${i}">Sil</button>
      </div>`).join("")}
    </div>
    <form id="customCounterForm" class="custom-counter-form">
      <input type="hidden" name="index" value="-1">\n      <input type="hidden" name="slot" value="">
      <label>Sayaç adı<input name="name" maxlength="45" required placeholder="Örn. Gerçek Kâr"></label>
      <label>Renk<input name="color" type="color" value="#2563eb"></label>
      <label>Gösterim<select name="unit"><option value="money">Para (₺)</option><option value="count">Adet</option></select></label>
      <div class="custom-counter-terms"><strong>Hesaplama kalemleri</strong>
        ${CUSTOM_CASH_TERMS.map(([key,label])=>`<label><select data-sign="${key}"><option value="0">Dahil etme</option><option value="1">+ Ekle</option><option value="-1">− Çıkar</option></select> ${label}</label>`).join("")}
      </div>
      <button id="customCounterSaveButton" class="primary-button" type="button">Sayacı Kaydet</button>\n      <span id="customCounterSaveStatus" role="status" aria-live="polite"></span>
      <button class="secondary-button" type="button" data-action="clear-custom-counter-form">Yeni Sayaç</button>
    </form>`;
  const saveButton=root.querySelector("#customCounterSaveButton");
  if(saveButton)saveButton.onclick=(event)=>{event.preventDefault();event.stopPropagation();saveCustomCounterForm(saveButton.closest("form"));};
  renderWorkflowSettings();
}
function editCustomCounter(index) {
  const c=customCashCounters()[index];if(!c)return;
  const form=document.querySelector("#customCounterForm");if(!form)return;
  form.elements.index.value=String(index);
  form.elements.slot.value="";
  form.elements.name.value=c.name||"";
  form.elements.color.value=/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb";
  form.elements.unit.value=c.unit==="count"?"count":"money";
  form.querySelectorAll("[data-sign]").forEach(el=>{
    const term=(c.terms||[]).find(t=>t.key===el.dataset.sign);
    el.value=term?String(term.sign===-1?-1:1):"0";
  });
  form.scrollIntoView({behavior:"smooth",block:"center"});
}
function editCashSlot(id){
 const c=cashSlotSettings().find(x=>x.id===id);if(!c)return;
 const form=document.querySelector("#customCounterForm");if(!form)return;
 form.elements.slot.value=id;form.elements.index.value="-1";form.elements.name.value=c.name;form.elements.color.value=c.color;form.elements.unit.value=c.unit;
 form.querySelectorAll("[data-sign]").forEach(el=>{const t=(c.terms||[]).find(t=>t.key===el.dataset.sign);el.value=t?String(t.sign===-1?-1:1):"0";});
 form.scrollIntoView({behavior:"smooth",block:"center"});
}
function renderCustomCashCounters(items) {
  const root=document.querySelector("#mobileCustomCashCounters");if(!root)return;
  renderSharedCashSlots(items);
  renderWorkflowCounters("cash",mobileCashSource,mobileCashRangeStart||"",mobileCashRangeEnd||"");
  const counters=customCashCounters().filter(c=>c.visible!==false);
  if (!counters.length){root.hidden=true;root.innerHTML="";return;}
  root.hidden=false;
  const context=customCashContext(items);
  root.innerHTML=counters.map(c=>{
    const color=/^#[0-9a-fA-F]{6}$/.test(c.color)?c.color:"#2563eb";
    const value=customCashValue(c,context);
    return `<div class="mobile-daily-counter custom-cash-counter" style="background:${color};color:#fff">
      <span>${escapeHtml(c.name||"Sayaç")}</span>
      <b>${escapeHtml(c.unit==="count"?String(value):money(value))}</b>
    </div>`;
  }).join("");
}

function mobileRenderDailyCash() {
  if (!mobileCashRangeInitialized) mobileCashDefaultToday();
  const startDate = mobileCashRangeStart || "";
  const endDate = mobileCashRangeEnd || "";
  const items = (state.cash || []).filter((item) => {
    if (!cashIsPosted(item) || !matchesPortalSource(cashItemSource(item))) return false;
    const d = String(cashFilterDate(item) || "").slice(0,10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    if (mobileCashSource && !sourceMatches(cashItemSource(item), mobileCashSource)) return false;
    return true;
  });
  const totals = cashBreakdown(items);
  const serviceTotals = serviceOnlyCashBreakdown(items);
  const profit = serviceTotals.income - serviceTotals.commission - serviceTotals.material - Number(totals.manualExpense || 0);
  const setText = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
  setText("#mobileDailyPageIncome", money(totals.income));
  setText("#mobileDailyPageCommission", money(totals.commission));
  setText("#mobileDailyPageMaterial", money(totals.material));
  setText("#mobileDailyPageExpense", money(totals.manualExpense));
  setText("#mobileDailyPageProfit", money(profit));
  const pendingCount = (state.services || []).filter((service) =>
    matchesPortalSource(service.source) &&
    (!mobileCashSource || sourceMatches(service.source, mobileCashSource)) &&
    (isStatus(service.status, "Ödeme Bekliyor") ||
      ["Havale Bekleniyor", "Sonra Tahsil Edilecek"].includes(String(service.paymentStatus || "")))
  ).length;
  // Bekleyen ödemeler tarih aralığından bağımsızdır.
  setText("#mobileCashPaymentCount", String(pendingCount));
  const pendingServices = (state.services || []).filter((service) =>
    matchesPortalSource(service.source) &&
    (!mobileCashSource || sourceMatches(service.source, mobileCashSource)) &&
    (isStatus(service.status, "Ödeme Bekliyor") ||
      ["Havale Bekleniyor", "Sonra Tahsil Edilecek"].includes(String(service.paymentStatus || "")))
  );
  const pendingAmount = pendingServices.reduce((total, service) => {
    const primary = primaryCashForService(service.id);
    const amount = Number(primary?.amount ?? service.price ?? 0);
    return total + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
  }, 0);
  setText("#mobileCashPaymentAmount", money(pendingAmount));
  renderCustomCashCounters(items);

  const label = startDate && endDate && startDate === endDate
    ? (startDate === isoToday ? `Bugün · ${formatDisplayDate(startDate)}` : formatDisplayDate(startDate))
    : `${startDate ? formatDisplayDate(startDate) : "Başlangıç"} – ${endDate ? formatDisplayDate(endDate) : "Bugün"}`;
  setText("#mobileDailyCashPageDate", label);

  const startInput = document.querySelector("#mobileCashStartDate");
  const endInput = document.querySelector("#mobileCashEndDate");
  if (startInput) startInput.value = startDate;
  if (endInput) endInput.value = endDate;
  mobileCashPopulateSources();

  const movementList = document.querySelector("#mobileDailyCashMovementList");
  const movementCount = document.querySelector("#mobileDailyCashMovementCount");
  const visibleItems = mobileCashDetailFilter === "all"
    ? items
    : items.filter((item) => mobileCashMovementCategory(item) === mobileCashDetailFilter && affectsRealCash(item));
  if (movementCount) movementCount.textContent = `${visibleItems.length} işlem`;
  const movementHeading = document.querySelector("#mobileCashMovementHeading");
  const detailNames = {all:"Para Hareketleri",income:"Hasılat Hareketleri",commission:"Komisyon Giderleri",material:"Malzeme Giderleri",expense:"Diğer Giderler"};
  if (movementHeading) movementHeading.textContent = detailNames[mobileCashDetailFilter] || "Para Hareketleri";
  const resetButton = document.querySelector("#mobileCashDetailReset");
  if (resetButton) resetButton.hidden = mobileCashDetailFilter === "all";
  if (movementList) {
    const rows = [...visibleItems].sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const groups = new Map();
    rows.forEach((item) => {
      const service = item.serviceId ? (state.services || []).find(s => String(s.id) === String(item.serviceId)) : null;
      const key = service ? `service:${service.id}` : `manual:${item.id || rows.indexOf(item)}`;
      if (!groups.has(key)) groups.set(key, {service, items:[]});
      groups.get(key).items.push(item);
    });
    movementList.innerHTML = rows.length ? [...groups.values()].map(({service,items:groupItems}) => {
      const name = service?.customerName || groupItems[0].description || groupItems[0].title || "Manuel Kasa Hareketi";
      const source = cashItemSource(groupItems[0]) || "Kasa";
      const lines = groupItems.map(item => {
        const amount = Number(item.amount || item.total || item.value || 0);
        const isOut = mobileCashMovementCategory(item) !== "income" || amount < 0;
        const kind = item.autoMaterialExpense ? "Malzeme Gideri" : item.autoCommissionExpense ? "Komisyon Gideri" : item.autoOtherExpense ? "Diğer Gider" : item.type === "income" ? "Tahsilat" : "Gider";
        const note = String(item.description || item.note || item.title || "").trim();
        const detail = note && !["tahsilat","malzeme gideri","komisyon gideri","gider"].includes(norm(note)) ? ` · ${note}` : "";
        const date = String(item.date || "").slice(0,10);
        return `<div class="mobile-cash-movement-line"><span>${escapeHtml(kind + detail)}<small>${escapeHtml(date ? formatDisplayDate(date) : "")}</small></span><b>${isOut ? "−" : "+"}${escapeHtml(money(Math.abs(amount)))}</b></div>`;
      }).join("");
      const clickable = Boolean(service);
      return `<article class="mobile-cash-service-group${clickable ? " is-clickable" : ""}" ${clickable ? `data-mobile-cash-service-id="${escapeAttr(service.id)}" role="button" tabindex="0" aria-label="${escapeAttr(name)} servis detayını aç"` : ""}>
        <div class="mobile-cash-service-group-head"><strong>${escapeHtml(name)}</strong>${clickable ? "<span>Servise Git ›</span>" : ""}</div>
        <div class="mobile-cash-service-group-source">${escapeHtml(source)} · ${groupItems.length} hareket</div>
        ${lines}
      </article>`;
    }).join("") : `<div class="mobile-cash-empty">Seçilen dönemde kasa hareketi yok.</div>`;
  }
}
function mobileOpenDailyCashPage() {
  const now = new Date();
  mobileCashRangeStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  mobileCashRangeEnd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  mobileCashRangeMode = "month";
  mobileCashRangeInitialized = true;
  document.querySelectorAll("[data-mobile-cash-range]").forEach(button => button.classList.toggle("is-active", button.dataset.mobileCashRange === "month"));
  mobileCashSource = "";
  mobileRenderDailyCash();
  mobileSetCashMode(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mobileCloseDailyCashPage() {
  mobileSetCashMode(false);
  mobileRenderTechPanel();
}

function mobileServiceCard(service) {
  const dateValue = mobilePlanningDate(service);
  const timeValue = String(service.availableTime || service.createdAt?.slice(11, 16) || "").replace("Saat yok", "");
  const overdue = !mobileAllDates && dateValue && dateValue < (mobileSelectedDate || isoToday) && mobileIsRemainingService(service);
  const phoneClean = digits(service.phone);
  const phoneHref = phoneClean ? `tel:${phoneClean}` : "#";
  const whatsappHref = phoneClean ? `https://wa.me/90${phoneClean.replace(/^0/, "")}` : "#";
  const mapHref = mobileMapUrl(service);
  const bucket = mobileStatusBucket(service.status);
  const deviceTitle = [service.brand, service.device].filter(Boolean).join(" ") || "Cihaz bilgisi yok";
  const paymentModeLabel = servicePaymentModeLabel(service);
  const receivedTotal = (state.cash || []).filter(item => item.serviceId === service.id && item.type === "income" && !item.parentCashId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense && (normalizePaymentMode(service.paymentStatus || "") === "Ödendi" || normalizePaymentMode(item.title || "") === "Tahsilat Yapıldı")).reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  return `
    <article class="mobile-service-card mobile-status-${bucket}" data-mobile-service-id="${escapeAttr(service.id)}">
      <div class="mobile-card-top" data-mobile-action="open-detail" data-service-id="${escapeAttr(service.id)}">
        <div class="mobile-date">
          <b>${escapeHtml(formatDisplayDate(dateValue))}</b>
          <span>${escapeHtml(timeValue || formatServiceCardDay(dateValue))}</span>
          ${overdue ? `<em class="mobile-overdue-tag">Gecikmiş</em>` : ""}
        </div>
        <span class="mobile-status-pill">${escapeHtml(service.status || "Durum yok")}${paymentModeLabel ? ` · ${escapeHtml(paymentModeLabel)}` : ""}</span>
      </div>
      <div data-mobile-action="open-detail" data-service-id="${escapeAttr(service.id)}">
        <div class="mobile-device">${escapeHtml(deviceTitle)}</div>
        <div class="mobile-service-summary-row">
          <div class="mobile-service-summary-left">
            <div class="mobile-customer">${escapeHtml(service.customerName || "İsimsiz Müşteri")}</div>
            <div class="mobile-address">${escapeHtml(service.address || "Adres girilmedi")}</div>
          </div>
          <div class="mobile-service-summary-right">
            <span class="mobile-service-summary-status">${escapeHtml(service.status || "Durum yok")}</span>
            <strong class="mobile-service-summary-amount">Alınan: ${escapeHtml(receivedTotal.toLocaleString("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}))}</strong>
          </div>
        </div>
        <div class="mobile-fault">${escapeHtml(service.fault || "Şikayet yazılmadı")}</div>
      </div>
      <div class="mobile-card-actions">
        <a href="${phoneHref}" onclick="event.stopPropagation()">Ara</a>
        <a href="${whatsappHref}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>
        <a href="${mapHref || '#'}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Yol Tarifi</a>
      </div>
    </article>
  `;
}

function mobileOpenDetail(serviceId) {
  mobileActiveServiceId = serviceId;
  mobileRenderDetail(serviceId);

  const sheet = document.querySelector("#mobileDetailSheet");
  if (!sheet) return;

  // Detayı her durumda aktif görünümün önüne getir.
  sheet.removeAttribute("hidden");
  sheet.style.display = "flex";
  sheet.style.visibility = "visible";
  sheet.style.opacity = "1";
  sheet.style.pointerEvents = "auto";
  sheet.style.zIndex = "10050";

  // Native-navigation katmanlarından bağımsız olarak servis detayı önde kalsın.
  document.body.classList.add("mobile-detail-open");

  // Mobilde tarayıcının geri hareketi/tuşu önce servis detayını kapatsın.
  if (!history.state?.ekzenMobileDetail) {
    history.pushState({ ...(history.state || {}), ekzenMobileDetail: true, serviceId }, "");
  }
}

function mobileHideDetailSheet() {
  mobileActiveServiceId = "";
  const sheet = document.querySelector("#mobileDetailSheet");
  if (sheet) {
    sheet.setAttribute("hidden", "");
    sheet.style.removeProperty("display");
    sheet.style.removeProperty("visibility");
    sheet.style.removeProperty("opacity");
    sheet.style.removeProperty("pointer-events");
    sheet.style.removeProperty("z-index");
  }
  document.body.classList.remove("mobile-detail-open");
}

function mobileCloseDetail() {
  const sheet = document.querySelector("#mobileDetailSheet");
  const wasOpen = Boolean(sheet && !sheet.hasAttribute("hidden"));
  mobileHideDetailSheet();
  if (wasOpen && history.state?.ekzenMobileDetail) {
    const next = { ...(history.state || {}) };
    delete next.ekzenMobileDetail;
    delete next.serviceId;
    history.replaceState(next, "");
  }
}

window.addEventListener("popstate", () => {
  const sheet = document.querySelector("#mobileDetailSheet");
  if (sheet && !sheet.hasAttribute("hidden")) mobileHideDetailSheet();
});

function mobileRenderDetail(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  const body = document.querySelector("#mobileDetailBody");
  if (!service || !body) return;
  const phoneClean = digits(service.phone);
  const phoneHref = phoneClean ? `tel:${phoneClean}` : "#";
  const whatsappHref = phoneClean ? `https://wa.me/90${phoneClean.replace(/^0/, "")}` : "#";
  const addressText = mobileFullAddress(service);
  const mapHref = mobileMapUrl(service);
  const noteText = service.notes?.map((note) => note.text).filter(Boolean).join("\n") || "";
  const linkedCash = state.cash.filter((item) => item.serviceId === service.id);
  const incomeTotal = linkedCash.filter((item) => item.type === "income").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const expenseTotal = linkedCash.filter((item) => item.type === "expense").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const balanceTotal = incomeTotal - expenseTotal;
  const serviceDate = service.availableDate || service.visitDate || service.createdAt?.slice(0, 10) || isoToday;
  const serviceTime = service.availableTime || service.createdAt?.slice(11, 16) || "Saat yok";
  body.innerHTML = `
    <div class="mobile-detail-head">
      <span class="mobile-detail-no">Fiş No ${escapeHtml(service.id || "-")}</span>
      <h2 class="mobile-detail-title">${escapeHtml(service.customerName || "Servis Detayı")}</h2>
      <p class="mobile-detail-meta">${escapeHtml([service.brand, service.device, service.model].filter(Boolean).join(" · ") || "Cihaz bilgisi yok")}</p>
    </div>

    <div class="mobile-detail-actions mobile-detail-actions-three">
      <button type="button" data-mobile-action="add-note" data-service-id="${escapeAttr(service.id)}">📝<b>Not</b></button>
      <button type="button" data-mobile-action="add-photo" data-service-id="${escapeAttr(service.id)}">📷<b>Fotoğraf</b></button>
      <button type="button" data-mobile-action="edit-service" data-service-id="${escapeAttr(service.id)}">✎<b>Düzenle</b></button>
    </div>

    <div class="mobile-detail-info-grid">
      <div class="mobile-detail-box"><h3>Telefon</h3><p>${escapeHtml(service.phone || "Telefon yok")}</p></div>
      <div class="mobile-detail-box"><h3>Tarih / Saat</h3><p>${escapeHtml(formatDate(serviceDate))} · ${escapeHtml(serviceTime)}</p></div>
      <div class="mobile-detail-box"><h3>Kaynak</h3><p>${escapeHtml(service.source || "Kendi İşim")}</p></div>
      <button type="button" class="mobile-detail-box mobile-money-edit-box" data-mobile-action="edit-payment" data-service-id="${escapeAttr(service.id)}"><h3>Alınan Tutar</h3><p>${escapeHtml(money(incomeTotal || service.price || 0))}</p><small>Düzenle</small></button>
    </div>

    <div class="mobile-detail-box"><h3>Adres</h3><p>${escapeHtml(addressText || "Adres girilmedi")}</p></div>
    <div class="mobile-detail-box mobile-fault-box"><h3>Şikayet</h3><p>${escapeHtml(service.fault || "Şikayet yazılmadı")}</p></div>

    <div class="mobile-detail-box">
      <h3>Servis Durumu</h3>
      <select class="mobile-detail-status" data-mobile-status-service="${escapeAttr(service.id)}">
        ${settingsList("statuses").map((status) => `<option value="${escapeAttr(status)}" ${status === service.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
      </select>
    </div>

    <div class="mobile-detail-box">
      <h3>Yapılan İşlemler / Not</h3>
      <textarea class="mobile-done-textarea" data-mobile-work-note="${escapeAttr(service.id)}" placeholder="Yapılan işlemi yaz...">${escapeHtml(noteText)}</textarea>
    </div>

    ${service.photos?.length ? `<div class="mobile-photo-strip">${service.photos.slice(0, 4).map((photo) => `<img src="${escapeAttr(photo.dataUrl)}" alt="Servis fotoğrafı" data-action="open-photo-viewer" data-service-id="${escapeAttr(service.id)}" data-photo-id="${escapeAttr(photo.id)}">`).join("")}</div>` : ""}

    ${mobileIsDoneService(service) ? `
    <section class="mobile-detail-box" style="margin-top:12px">
      <h3>Servis Fişi İşlemleri</h3>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px">
        <button type="button" data-ai-service-report="${escapeAttr(service.id)}" style="min-height:52px;background:#0f766e;color:#fff;border:0;border-radius:10px;font-size:14px;font-weight:700">📄 PDF / WhatsApp</button>
        <button type="button" data-print-service-card="${escapeAttr(service.id)}" style="min-height:52px;background:#eaf0f6;color:#173454;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:700">⎙ Yazdır</button>
      </div>
      <small style="display:block;margin-top:7px;color:#64748b">PDF / WhatsApp: teknik açıklamalar, A4 PDF ve WhatsApp paylaşımı</small>
    </section>` : ""}

    <footer class="mobile-sheet-footer">
      <button class="mobile-delay-btn" type="button" data-mobile-action="delay-service" data-service-id="${escapeAttr(service.id)}">Ertele</button>
      <button class="mobile-close-btn" type="button" data-mobile-action="finish-service" data-service-id="${escapeAttr(service.id)}">Fişi Kapat</button>
      <button class="mobile-delete-service-btn" type="button" data-mobile-action="delete-service" data-service-id="${escapeAttr(service.id)}">Fişi Sil</button>
      <button class="mobile-repeat-service-btn" type="button" data-mobile-action="repeat-service" data-service-id="${escapeAttr(service.id)}">↻ Tekrar Kayıt Aç</button>
    </footer>
  `;
}
function mobileSaveWorkNote(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  const textarea = document.querySelector(`[data-mobile-work-note="${CSS.escape(serviceId)}"]`);
  if (!service || !textarea) return "";
  const text = textarea.value.trim();
  service.notes = Array.isArray(service.notes) ? service.notes : [];
  if (text) {
    const existing = service.notes[0];
    if (existing) {
      existing.text = text;
      existing.updatedAt = new Date().toISOString();
    } else {
      service.notes.unshift({ id: uid(), text, createdAt: new Date().toISOString(), updatedAt: "" });
    }
  }
  return text;
}

function mobileFinishService(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  const note = mobileSaveWorkNote(serviceId);
  mobileCloseDetail();
  openCompleteForm(serviceId);
  if (note && completeForm?.elements?.workNote) completeForm.elements.workNote.value = note;
  // Mobil klavye kapanış formunu örtmesin: alanı kullanıcı seçtiğinde odakla.
}

function mobileDelayService(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  const currentDate = service.availableDate || service.visitDate || isoToday;
  const existing = document.querySelector("#mobileDelayPanel");
  if (existing) existing.remove();

  const footer = document.querySelector(".mobile-sheet-footer");
  const panel = document.createElement("div");
  panel.id = "mobileDelayPanel";
  panel.className = "mobile-delay-panel";
  panel.innerHTML = `
    <div class="mobile-delay-panel-head">
      <strong>Servisi Ertele</strong>
      <small>Yeni tarihi takvimden seç</small>
    </div>
    <label class="mobile-delay-date-label">
      <span>Yeni Tarih</span>
      <input id="mobileDelayDateInput" type="date" value="${escapeAttr(currentDate)}" min="2000-01-01" max="2100-12-31">
    </label>
    <div class="mobile-delay-panel-actions">
      <button type="button" class="mobile-delay-cancel" data-mobile-action="cancel-delay">Vazgeç</button>
      <button type="button" class="mobile-delay-save" data-mobile-action="save-delay" data-service-id="${escapeAttr(service.id)}">Kaydet</button>
    </div>
  `;

  if (footer) footer.before(panel);
  else document.querySelector("#mobileDetailBody")?.appendChild(panel);

  const input = panel.querySelector("#mobileDelayDateInput");
  input?.focus({ preventScroll: true });
  try {
    if (typeof input?.showPicker === "function") input.showPicker();
  } catch (error) {
    // Bazı mobil tarayıcılar showPicker desteklemez; görünür date input yine çalışır.
  }
}

function mobileSaveDelayDate(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  const input = document.querySelector("#mobileDelayDateInput");
  if (!service || !input) return;
  const nextDate = input.value || isoToday;
  service.availableDate = nextDate;
  service.visitDate = nextDate;
  service.date = nextDate;
  // Liste tarihi yerinde kalsın: ertelenen fiş mevcut günden hemen çıkar.
  mobileSaveWorkNote(serviceId);
  saveState();
  mobileCloseDetail();
  render();
}


const mobileNewServiceSteps = [
  { key: "source", label: "Servis Kaynağı", type: "select", optionsKey: "sources", required: true },
  { key: "customerName", label: "İsim Soyisim", type: "text", placeholder: "Müşteri adı soyadı", required: false },
  { key: "phone", label: "Telefon", type: "tel", placeholder: "05xx xxx xx xx", required: false },
  { key: "district", label: "İlçe", type: "district", required: true },
  { key: "neighborhood", label: "Mahalle", type: "neighborhood", required: true },
  { key: "address", label: "Sokak / Bina / Daire", type: "textarea", placeholder: "Cadde, sokak, bina no, daire no", required: false },
  { key: "locationUrl", label: "WhatsApp Konumu", type: "url", placeholder: "WhatsApp konum bağlantısını yapıştır (isteğe bağlı)", required: false },
  { key: "fault", label: "Şikayet", type: "textarea", placeholder: "Örn: çalışmıyor, su akıtıyor", required: false },
  { key: "device", label: "Cihaz Türü", type: "select", optionsKey: "devices", required: false },
  { key: "brand", label: "Marka", type: "select", optionsKey: "brands", required: false },
  { key: "model", label: "Model", type: "text", placeholder: "Varsa model yaz", required: false },
];
const ANKARA_DISTRICTS = [
 ["Akyurt","akyurt"],["Altındağ","altindag"],["Ayaş","ayas"],["Bala","bala"],["Beypazarı","beypazari"],["Çamlıdere","camlidere"],["Çankaya","cankaya"],["Çubuk","cubuk"],["Elmadağ","elmadag"],["Etimesgut","etimesgut"],["Evren","evren"],["Gölbaşı","golbasi"],["Güdül","gudul"],["Haymana","haymana"],["Kahramankazan","kahramankazan"],["Kalecik","kalecik"],["Keçiören","kecioren"],["Kızılcahamam","kizilcahamam"],["Mamak","mamak"],["Nallıhan","nallihan"],["Polatlı","polatli"],["Pursaklar","pursaklar"],["Sincan","sincan"],["Şereflikoçhisar","sereflikochisar"],["Yenimahalle","yenimahalle"]
];
const ankaraNeighborhoodCache = new Map();
async function loadAnkaraNeighborhoods(district) {
 const slug=ANKARA_DISTRICTS.find(([name])=>name===district)?.[1];
 if(!slug)return [];
 if(ankaraNeighborhoodCache.has(slug))return ankaraNeighborhoodCache.get(slug);
 const url="https://raw.githubusercontent.com/cyaxaress/turkiye-il-ilce-mah/main/PTT/iller/ankara/"+slug+"/mahalleler.json";
 const response=await fetch(url,{cache:"force-cache"});
 if(!response.ok)throw new Error("Mahalle listesi yüklenemedi");
 const data=await response.json();
 const names=[...new Set(data.map(x=>typeof x==="string"?x:x.mahalle_adi).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
 ankaraNeighborhoodCache.set(slug,names);
 return names;
}
function cleanNeighborhoodName(value) {
 return String(value||"").trim().replace(/\s+(?:mahallesi|mah\.?|mah)$/iu,"").trim();
}
function removeSelectedNeighborhoodPrefix(address, neighborhood) {
 const name=cleanNeighborhoodName(neighborhood);
 let value=String(address||"").trim();
 if(!name)return value;
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const prefix=new RegExp("^"+escaped+"(?:\\s+(?:mahallesi|mah\\.?))?(?:\\s*,\\s*|\\s+|$)","iu");
 return value.replace(prefix,"").trim();
}
function mobileStructuredAddress(data) {
 return [data.neighborhood ? cleanNeighborhoodName(data.neighborhood)+" Mahallesi" : "",removeSelectedNeighborhoodPrefix(data.address,data.neighborhood)].filter(Boolean).join(", ");
}
let mobileNewServiceData = {};
let mobileNewServiceIndex = 0;

function openMobileNewServiceWizard() {
  mobileNewServiceData = { availableDate: mobileSelectedDate || isoToday, source: isSourcePortal() ? portalSourceName() : (document.querySelector("#mobileSourcePicker")?.value || "") };
  mobileNewServiceIndex = 0;
  let overlay = document.querySelector("#mobileNewServiceWizard");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mobileNewServiceWizard";
    overlay.className = "mobile-wizard";
    document.body.appendChild(overlay);
  }
  overlay.removeAttribute("hidden");
  renderMobileNewServiceStep();
}

function mobileRepeatService(serviceId) {
  const original = state.services.find((item) => item.id === serviceId);
  if (!original) return;
  mobileCloseDetail();
  openMobileNewServiceWizard();
  mobileNewServiceData = {
    availableDate: isoToday,
    source: isSourcePortal() ? portalSourceName() : (original.source || "Kendi İşim"),
    customerName: original.customerName || "",
    phone: original.phone || "",
    address: removeSelectedNeighborhoodPrefix(original.address,original.neighborhood),
    district: original.district || "",
    neighborhood: original.neighborhood || "",
    locationUrl: original.locationUrl || "",
    fault: "",
    device: "",
    brand: "",
    model: ""
  };
  // Müşteri bilgileri hazır; kullanıcı yeni cihaz ve arıza bilgilerini girsin.
  mobileNewServiceIndex = mobileNewServiceSteps.findIndex((step) => step.key === "fault");
  renderMobileNewServiceStep();
}

function closeMobileNewServiceWizard() {
  document.querySelector("#mobileNewServiceWizard")?.setAttribute("hidden", "");
}

function renderMobileNewServiceStep() {
  const overlay = document.querySelector("#mobileNewServiceWizard");
  if (!overlay) return;
  const step = mobileNewServiceSteps[mobileNewServiceIndex];
  if (step.key === "source" && isSourcePortal()) mobileNewServiceData.source = portalSourceName();
  const progress = `${mobileNewServiceIndex + 1}/${mobileNewServiceSteps.length}`;
  const value = mobileNewServiceData[step.key] || "";
  let field = "";
  if (step.type === "district") {
    field='<select id="mobileWizardField"><option value="">İlçe seçin</option>'+ANKARA_DISTRICTS.map(([name])=>'<option value="'+escapeAttr(name)+'" '+(name===value?'selected':'')+'>'+escapeHtml(name)+'</option>').join('')+'</select><small>İl: Ankara (sabit)</small>';
  } else if (step.type === "neighborhood") {
    field='<select id="mobileWizardField"><option value="">Mahalleler yükleniyor...</option></select><small>Yalnızca seçilen ilçenin mahalleleri gösterilir.</small>';
    loadAnkaraNeighborhoods(mobileNewServiceData.district).then((names)=>{
      if(document.querySelector("#mobileNewServiceWizard")?.hasAttribute("hidden") || mobileNewServiceSteps[mobileNewServiceIndex]?.key!=="neighborhood")return;
      const select=document.querySelector("#mobileWizardField");if(!select)return;
      select.innerHTML='<option value="">Mahalle seçin</option>'+names.map(name=>'<option value="'+escapeAttr(name)+'" '+(name===value?'selected':'')+'>'+escapeHtml(name)+'</option>').join('');
    }).catch(()=>{
      const select=document.querySelector("#mobileWizardField");
      if(select)select.innerHTML='<option value="">Mahalle listesi alınamadı, geri dönüp yeniden deneyin</option>';
    });
  } else if (step.type === "textarea") {
    field = `<textarea id="mobileWizardField" rows="5" placeholder="${escapeAttr(step.placeholder || "")}" ${step.required ? "required" : ""}>${escapeHtml(value)}</textarea>`;
  } else if (step.type === "select") {
    const options = settingsList(step.optionsKey).filter(Boolean);
    field = `<select id="mobileWizardField" ${step.required ? "required" : ""}>
      <option value="">Seç</option>
      ${options.map((item) => `<option value="${escapeAttr(item)}" ${item === value ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
    </select>`;
  } else {
    field = `<input id="mobileWizardField" type="${escapeAttr(step.type)}" value="${escapeAttr(value)}" placeholder="${escapeAttr(step.placeholder || "")}" ${step.required ? "required" : ""}>`;
  }
  overlay.innerHTML = `
    <div class="mobile-wizard-backdrop" data-mobile-wizard="close"></div>
    <section class="mobile-wizard-card" role="dialog" aria-modal="true" aria-label="Yeni fiş aç">
      <header>
        <div><small>Yeni Fiş Aç · ${progress}</small><h2>${escapeHtml(step.label)}</h2></div>
        <button type="button" data-mobile-wizard="close">×</button>
      </header>
      <div class="mobile-wizard-body">
        <label>${escapeHtml(step.label)}${field}</label>
      </div>
      <footer>
        <button type="button" class="secondary" data-mobile-wizard="back" ${mobileNewServiceIndex === 0 ? "disabled" : ""}>Geri</button>
        <button type="button" class="primary" data-mobile-wizard="next">${mobileNewServiceIndex === mobileNewServiceSteps.length - 1 ? "Servisi Aç" : "Devam"}</button>
      </footer>
    </section>
  `;
  setTimeout(() => document.querySelector("#mobileWizardField")?.focus({ preventScroll: true }), 50);
}

function mobileWizardCurrentValue() {
  const field = document.querySelector("#mobileWizardField");
  return field ? String(field.value || "").trim() : "";
}

function mobileWizardNext() {
  const step = mobileNewServiceSteps[mobileNewServiceIndex];
  const value = mobileWizardCurrentValue();
  if (step.key === "locationUrl" && value && !safeServiceLocationUrl(value)) {
    alert("Google Haritalar veya Apple Haritalar bağlantısı yapıştırın ya da boş geçin.");
    return;
  }
  if (step.required && !value) { alert(step.label+" seçin."); return; }
  if (step.key === "district" && value !== mobileNewServiceData.district) mobileNewServiceData.neighborhood = "";
  mobileNewServiceData[step.key] = value;
  if (mobileNewServiceIndex < mobileNewServiceSteps.length - 1) {
    mobileNewServiceIndex += 1;
    renderMobileNewServiceStep();
    return;
  }
  saveMobileWizardService();
}

function saveMobileWizardService() {
  const service = {
    id: nextServiceId(),
    customerName: mobileNewServiceData.customerName || "",
    phone: mobileNewServiceData.phone || "",
    city: "Ankara",
    district: mobileNewServiceData.district || "",
    neighborhood: mobileNewServiceData.neighborhood || "",
    address: mobileStructuredAddress(mobileNewServiceData),
    locationUrl: safeServiceLocationUrl(mobileNewServiceData.locationUrl),
    fault: mobileNewServiceData.fault || "",
    device: mobileNewServiceData.device || "",
    brand: mobileNewServiceData.brand || "",
    model: mobileNewServiceData.model || "",
    source: isSourcePortal() ? portalSourceName() : mobileNewServiceData.source,
    status: "Yeni Kayıt",
    availableDate: mobileNewServiceData.availableDate || isoToday,
    visitDate: mobileNewServiceData.availableDate || isoToday,
    availableTime: "",
    warrantyEnd: addYear(isoToday),
    operatorNote: "",
    createdAt: new Date().toISOString(),
    price: 0,
    sortOrder: state.services.reduce((min, item) => Math.min(min, Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0), 0) - 1,
    notes: [],
    photos: [],
    statusHistory: [{ id: uid(), date: isoToday, status: "Yeni Kayıt", description: "Mobil sihirbazdan yeni fiş açıldı", createdAt: new Date().toISOString() }],
    history: [],
  };
  state.services.unshift(service);
  saveState();
  closeMobileNewServiceWizard();
  mobileSelectedDate = service.availableDate || isoToday;
  mobileTechFilter = "new";
  render();
  mobileOpenDetail(service.id);
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-mobile-wizard]")?.dataset.mobileWizard;
  if (!action) return;
  if (action === "close") closeMobileNewServiceWizard();
  if (action === "back" && mobileNewServiceIndex > 0) { mobileNewServiceData[mobileNewServiceSteps[mobileNewServiceIndex].key] = mobileWizardCurrentValue(); mobileNewServiceIndex -= 1; renderMobileNewServiceStep(); }
  if (action === "next") mobileWizardNext();
});

document.addEventListener("keydown", (event) => {
  if (document.querySelector("#mobileNewServiceWizard")?.hasAttribute("hidden")) return;
  if (event.key === "Enter" && !event.shiftKey && event.target?.id === "mobileWizardField" && event.target.tagName !== "TEXTAREA") {
    event.preventDefault();
    mobileWizardNext();
  }
});

(function setupMobileTechPanel(){
  const previousRender = render;
  render = function patchedRender() {
    previousRender();
    mobileRenderTechPanel();
  };

  document.addEventListener("click", (event) => {
    const dateButton = event.target.closest("#mobileDateButton");
    if (dateButton) {
      mobileOpenMainDatePanel();
      return;
    }
    const filterButton = event.target.closest("[data-mobile-filter]");
    if (filterButton) {
      event.preventDefault();
      mobileTechFilter = filterButton.dataset.mobileFilter || "remaining";
      mobileSetCashMode(false);
      mobileRenderTechPanel();
      return;
    }
    const mobileAction = event.target.closest("[data-mobile-action]");
    if (!mobileAction) return;
    const action = mobileAction.dataset.mobileAction;
    const serviceId = mobileAction.dataset.serviceId;
    if (action === "open-new-service") {
      event.preventDefault();
      openMobileNewServiceWizard();
      return;
    }
    if (action === "open-daily-cash") {
      event.preventDefault();
      mobileOpenDailyCashPage();
      return;
    }
    if (action === "close-daily-cash") {
      mobileCloseDailyCashPage();
      return;
    }
    if (action === "today-date") {
      const picker = document.querySelector("#mobileDatePicker");
      if (picker) picker.value = isoToday;
      mobileApplyMainDate(isoToday);
      return;
    }
    if (action === "close-main-date") {
      mobileCloseMainDatePanel();
      return;
    }
    if (action === "save-main-date") {
      const picker = document.querySelector("#mobileDatePicker");
      mobileApplyMainDate(picker?.value || isoToday);
      return;
    }
    if (action === "open-map" && serviceId) { openMobileMap(serviceId); return; }
    if (action === "open-detail" && serviceId) mobileOpenDetail(serviceId);
    if (action === "close-detail") mobileCloseDetail();
    if (action === "finish-service" && serviceId) mobileFinishService(serviceId);
    if (action === "repeat-service" && serviceId) { event.preventDefault(); mobileRepeatService(serviceId); }
    if (action === "delete-service" && serviceId) { event.preventDefault(); deleteServiceById(serviceId); }
    if (action === "delay-service" && serviceId) mobileDelayService(serviceId);
    if (action === "save-delay" && serviceId) mobileSaveDelayDate(serviceId);
    if (action === "cancel-delay") document.querySelector("#mobileDelayPanel")?.remove();
    if (action === "add-note" && serviceId) { mobileSaveWorkNote(serviceId); openNoteForm(serviceId); }
    if (action === "add-photo" && serviceId) { mobileSaveWorkNote(serviceId); openPhotoForm(serviceId); }
    if (action === "edit-service" && serviceId) {
      const service = state.services.find((item) => item.id === serviceId);
      if (service) { mobileSaveWorkNote(serviceId); openServiceForm(service); }
    }
  });

  document.addEventListener("change", (event) => {
    const datePicker = event.target.closest("#mobileDatePicker");
    if (datePicker) {
      mobileApplyMainDate(datePicker.value || isoToday);
      return;
    }
    const select = event.target.closest("[data-mobile-status-service]");
    if (!select) return;
    const service = state.services.find((item) => item.id === select.dataset.mobileStatusService);
    if (!service) return;
    service.status = select.value;
    service.statusHistory = Array.isArray(service.statusHistory) ? service.statusHistory : [];
    service.statusHistory.push({ id: uid(), date: isoToday, status: select.value, technician: service.technician || "", description: "Mobil panelden durum değiştirildi", createdAt: new Date().toISOString() });
    saveState();
    try { render(); } catch (error) { console.warn("Ekran yenilenemedi.", error); }
    refreshMobileServiceViews();
  });

  window.addEventListener("resize", () => { if (isMobileTechViewport()) mobileRenderTechPanel(); });
  setTimeout(mobileRenderTechPanel, 0);
})();


/* V3.5.2 - Mobil servis listesi ve günlük kasa kilitli düzeltme
   Görsel yerleşime dokunmadan yalnızca iki aksiyonu garantiye alır:
   1) Kalan/Biten sayaçları servis listesini kesin gösterir.
   2) Günlük Kasa butonu sayaç panelini kesin gösterir.
*/
(function setupMobileStableListAndCashV352(){
  const VERSION = "V5.3.13";
  let mode = "services";

  function selectedDate() {
    const picker = document.querySelector("#mobileDatePicker");
    return (picker && picker.value) || mobileSelectedDate || isoToday;
  }

  function serviceMatchesDateSafe(service, date) {
    if (!date) return true;
    const candidates = [];
    [service.availableDate, service.visitDate, service.date].forEach((value) => { if (value) candidates.push(String(value).slice(0,10)); });
    if (!candidates.length && service.createdAt) {
      try { candidates.push(toIsoDate(new Date(service.createdAt))); } catch (e) {}
    }
    return candidates.includes(date);
  }

  function selectedSource() {
    const picker = document.querySelector("#mobileSourcePicker");
    return (picker && picker.value) || mobileSelectedSource || "";
  }

  function serviceMatchesSourceSafe(service, source) {
    return mobileSourceVisible(service, source);
  }

  function fillMobileSourcePickerSafe() {
    const picker = document.querySelector("#mobileSourcePicker");
    if (!picker) return;
    const previous = mobileSelectedSource || picker.value || "";
    const names = settingsList("sources").filter(Boolean);
    picker.innerHTML = `<option value="">Tüm Kaynaklar</option>${names.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("")}`;
    picker.value = names.includes(previous) ? previous : "";
    mobileSelectedSource = picker.value;
    const homePicker=document.querySelector("#mobileWelcomeSourcePicker");
    if(homePicker){
      homePicker.innerHTML=picker.innerHTML;
      homePicker.value=picker.value;
    }
  }

  function isDoneSafe(service) {
    return isStatus(service.status, "İşlem Tamam") || isClosed(service.status);
  }

  function isRemainingSafe(service) {
    return !isDoneSafe(service) && statusGroup(service.status) !== "danger";
  }

  function servicesForMobile(filter, date) {
    const source = selectedSource();
    const bucket = filter === "done" ? "done" : "open";
    let list = sortServices(state.services || []).filter((service) => mobileServiceVisibleOnDate(service, date, bucket) && serviceMatchesSourceSafe(service, source) && mobileMatchesServiceQuery(service, mobileServiceQuery));
    if (filter === "done") list = list.filter((service) => !mobileIsRemainingService(service));
    else if (filter === "new") list = list.filter((service) => isStatus(service.status, "Yeni Kayıt") && mobileIsRemainingService(service));
    else list = list.filter(mobileIsRemainingService);
    return list;
  }

  function countsForMobile(date) {
    return {
      remaining: servicesForMobile("remaining", date).length,
      done: servicesForMobile("done", date).length,
      new: servicesForMobile("new", date).length,
    };
  }

  function forceShow(el, display) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.style.setProperty("display", display, "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("opacity", "1", "important");
  }

  function forceHide(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.style.setProperty("display", "none", "important");
  }

  function renderMobileServicesStable() {
    mode = "services";
    mobileCashModeOpen = false;
    const date = selectedDate();
    mobileSelectedDate = date;
    const picker = document.querySelector("#mobileDatePicker");
    if (picker && picker.value !== date) picker.value = date;

    fillMobileSourcePickerSafe();
    const counts = countsForMobile(date);
    const remainingEl = document.querySelector("#mobileCountRemaining");
    const doneEl = document.querySelector("#mobileCountDone");
    if (remainingEl) remainingEl.textContent = counts.remaining;
    if (doneEl) doneEl.textContent = counts.done;

    document.querySelectorAll("[data-mobile-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mobileFilter === mobileTechFilter);
    });

    const page = document.querySelector("#mobileDailyCashPage");
    const list = document.querySelector("#mobileServiceList");
    const newButton = document.querySelector(".mobile-new-service-bar");
    forceHide(page);
    forceShow(list, "grid");
    forceShow(newButton, "block");

    syncMobileDateTools();
    const services = servicesForMobile(mobileTechFilter || "remaining", date);
    const emptyLabel = mobileServiceQuery
      ? "Aramaya uygun servis yok."
      : (mobileAllDates
        ? `Tüm tarihlerde ${mobileTechFilter === "done" ? "kapanan" : "kalan"} servis yok.`
        : `Bu listede ${mobileTechFilter === "done" ? "kapanan" : "kalan"} servis yok.`);
    if (list) {
      list.innerHTML = services.length
        ? services.map(mobileServiceCard).join("")
        : `<div class="mobile-empty">${emptyLabel}</div>`;
    }
  }

  function renderMobileCashStable() {
    mode = "cash";
    mobileCashModeOpen = true;
    const date = selectedDate();
    mobileSelectedDate = date;
    const picker = document.querySelector("#mobileDatePicker");
    if (picker && picker.value !== date) picker.value = date;

    const list = document.querySelector("#mobileServiceList");
    const newButton = document.querySelector(".mobile-new-service-bar");
    const page = document.querySelector("#mobileDailyCashPage");
    forceHide(list);
    forceHide(newButton);
    forceShow(page, "block");
    page?.classList.add("is-open");

    fillMobileSourcePickerSafe();
    const source = selectedSource();
    const items = (state.cash || []).filter((item) => {
      const itemDate = String(item.date || "").slice(0,10);
      const itemSource = cashItemSource(item);
      return cashIsPosted(item) && matchesPortalSource(itemSource) && (!source || sourceMatches(itemSource, source)) && itemDate === date;
    });
    const totals = cashBreakdown(items);
    const serviceTotals = serviceOnlyCashBreakdown(items);
    const profit = serviceTotals.income - serviceTotals.commission - serviceTotals.material;
    const setText = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
    setText("#mobileDailyPageIncome", money(totals.income));
    setText("#mobileDailyPageCommission", money(totals.commission));
    setText("#mobileDailyPageMaterial", money(totals.material));
    setText("#mobileDailyPageExpense", money(totals.manualExpense));
    setText("#mobileDailyPageProfit", money(profit));
    setText("#mobileDailyCashPageDate", date === isoToday ? `Bugün · ${formatDisplayDate(date)}` : formatDisplayDate(date));
  }

  window.ekzenMobileStableRender = function ekzenMobileStableRender() {
    if (mode === "cash") renderMobileCashStable();
    else renderMobileServicesStable();
  };

  document.addEventListener("click", function(event) {
    const filterButton = event.target.closest("[data-mobile-filter]");
    if (filterButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      mobileTechFilter = filterButton.dataset.mobileFilter || "remaining";
      renderMobileServicesStable();
      return;
    }

    const actionButton = event.target.closest("[data-mobile-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.mobileAction;

    if (action === "open-daily-cash") {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderMobileCashStable();
      return;
    }

    if (action === "today-date") {
      event.preventDefault();
      event.stopImmediatePropagation();
      mobileAllDates = false;
      const picker = document.querySelector("#mobileDatePicker");
      if (picker) picker.value = isoToday;
      mobileSelectedDate = isoToday;
      // V5.1.3: Eski mobil render yerine açık/kapalı fiş sayaçlarını ve
      // listeyi aynı anda yenileyen güncel motoru çalıştır.
      if (typeof window.ekzenMobileOpenClosedV511 === "function") {
        window.ekzenMobileOpenClosedV511(false);
      } else {
        renderMobileServicesStable();
      }
      return;
    }

    if (action === "close-daily-cash") {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderMobileServicesStable();
      return;
    }
  }, true);

  document.addEventListener("change", function(event) {
    const sourcePicker = event.target.closest("#mobileSourcePicker");
    if (sourcePicker) {
      event.stopImmediatePropagation();
      mobileSelectedSource = sourcePicker.value || "";
      renderMobileServicesStable();
      return;
    }
    const picker = event.target.closest("#mobileDatePicker");
    if (!picker) return;
    event.stopImmediatePropagation();
    mobileAllDates = false;
    mobileSelectedDate = picker.value || isoToday;
    renderMobileServicesStable();
    window.ekzenUpdateWelcome?.();
  }, true);

  const oldRender = render;
  render = function renderV352StablePatch() {
    oldRender();
    setTimeout(() => {
      const badge = document.querySelector(".mobile-version-badge");
      if (badge) badge.textContent = `Ekzen Servis Takip ${VERSION}`;
      window.ekzenMobileStableRender?.();
    }, 0);
  };

  window.addEventListener("DOMContentLoaded", () => setTimeout(renderMobileServicesStable, 60));
  window.addEventListener("load", () => setTimeout(renderMobileServicesStable, 120));
  setTimeout(renderMobileServicesStable, 120);
})();


/* V3.5.3 - Erteleme, ödeme düzenleme ve kapanış kayıtlarını tekilleştirme */
function primaryCashForService(serviceId) {
  return (state.cash || []).find((item) => item.serviceId === serviceId && !item.parentCashId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense && item.type === "income");
}

function serviceCloseNote(service) {
  const notes = Array.isArray(service?.notes) ? service.notes : [];
  return notes.find((note) => note && typeof note.text === "string" && note.text.trim()) || null;
}

function openCompleteForm(serviceId) {
  if (isSourcePortal()) return;
  const service = state.services.find((item) => item.id === serviceId);
  if (!service || !matchesPortalSource(service.source)) return;
  const existingCash = primaryCashForService(serviceId);
  const existingNote = serviceCloseNote(service);
  completeForm.reset();
  completeForm.elements.serviceId.value = serviceId;
  completeForm.elements.type.value = "income";
  completeForm.elements.amount.value = existingCash ? String(Number(existingCash.amount) || 0) : (service.price && Number(service.price) > 0 ? String(service.price) : "");
  completeForm.elements.materialCost.value = existingCash ? String(Number(existingCash.materialCost) || 0) : "";
  if (completeForm.elements.otherExpense) completeForm.elements.otherExpense.value = existingCash ? String(Number(existingCash.otherExpense) || 0) : "";
  completeForm.elements.commissionRate.value = existingCash ? String(Number(existingCash.commissionRate) || 0) : "50";
  if (completeForm.elements.collectedBy) completeForm.elements.collectedBy.value = existingCash?.collectedBy === "source" ? "source" : "me";
  completeForm.elements.source.value = existingCash?.source || service.source || "";
  keepSelectValue(completeForm.elements.source, existingCash?.source || service.source);
  completeForm.elements.workNote.value = existingNote?.text || "";
  syncCompleteCommissionField();
  completeDialog.showModal();
}

function completeServiceFromForm(formData) {
  if (isSourcePortal()) return;
  const data = Object.fromEntries(formData);
  const service = state.services.find((item) => item.id === data.serviceId);
  if (!service || !matchesPortalSource(service.source)) return;

  const workNote = String(data.workNote || "").trim();
  const amountRaw = String(data.amount ?? "").trim();
  if (!workNote) { alert("Fişi kapatmak için yapılan işlemler alanı zorunludur."); return; }
  if (amountRaw === "") { alert("Fişi kapatmak için para bilgisi zorunludur. Ücretsiz işlemse 0 yaz."); return; }

  const oldPrimary = (state.cash || []).filter((item) => item.serviceId === service.id && !item.parentCashId && !item.autoMaterialExpense && !item.autoCommissionExpense && !item.autoOtherExpense && item.type === "income");
  const primary = oldPrimary[0];
  const oldPrimaryIds = new Set(oldPrimary.map((item) => item.id));
  state.cash = (state.cash || []).filter((item) => {
    if (oldPrimaryIds.has(item.id)) return item.id === primary?.id;
    if (item.parentCashId && oldPrimaryIds.has(item.parentCashId)) return item.parentCashId === primary?.id;
    return true;
  });

  const paymentMode = normalizePaymentMode(data.paymentMode);
  const rawAmount = Number(data.amount) || 0;
  const amount = paymentModeForcesZero(paymentMode) ? 0 : rawAmount;
  const materialCost = Number(data.materialCost) || 0;
  const otherExpense = Number(data.otherExpense) || 0;
  const sourceName = data.source || service.source || "";
  const commissionRate = isOwnWorkSource(sourceName) ? 0 : (Number(data.commissionRate) || 0);
  const closeDate = serviceMainDate(service) || primary?.date || isoToday;
  const cashItem = {
    ...(primary || {}),
    id: primary?.id || uid(),
    date: closeDate,
    type: "income",
    title: paymentMode,
    amount,
    materialCost,
    otherExpense,
    commission50: commissionRate > 0,
    commissionRate,
    collectedBy: data.collectedBy === "source" ? "source" : "me",
    source: sourceName,
    serviceId: service.id,
  };

  state.cash = state.cash.filter((item) => item.id !== cashItem.id && item.parentCashId !== cashItem.id);
  state.cash.unshift(cashItem);
  syncSettlementCash(cashItem);

  service.status = serviceStatusForPaymentMode(paymentMode);
  service.paymentStatus = paymentMode === "Tahsilat Yapıldı" && amount > 0 ? "Ödendi" : paymentMode;
  service.price = amount;
  service.source = sourceName;
  service.notes = Array.isArray(service.notes) ? service.notes : [];
  const note = serviceCloseNote(service);
  if (note) {
    note.text = workNote;
    note.updatedAt = new Date().toISOString();
    service.notes = [note, ...service.notes.filter((item) => item.id !== note.id && item.text !== workNote)];
  } else {
    service.notes.unshift({ id: uid(), text: workNote, createdAt: new Date().toISOString(), updatedAt: "" });
  }
  service.statusHistory = Array.isArray(service.statusHistory) ? service.statusHistory : [];
  const closeStatus = serviceStatusForPaymentMode(paymentMode);
  const lastClose = service.statusHistory.find((item) => item && (isStatus(item.status, "İşlem Tamam") || isStatus(item.status, "Ödeme Bekliyor")) && String(item.description || "").includes("Fiş kapatıldı"));
  const desc = `Fiş kapatıldı (${paymentMode}) - ${workNote}`;
  if (lastClose) {
    lastClose.date = closeDate;
    lastClose.status = closeStatus;
    lastClose.description = desc;
    lastClose.updatedAt = new Date().toISOString();
  } else {
    service.statusHistory.unshift({ id: uid(), date: closeDate, status: closeStatus, description: desc, createdAt: new Date().toISOString() });
  }

  saveState();
  if (completeDialog?.open) completeDialog.close();
  try {
    render();
  } catch (error) {
    console.warn("Ekran yenilenemedi.", error);
  }
  refreshMobileServiceViews();
}

document.addEventListener("click", function(event) {
  const btn = event.target.closest('[data-mobile-action="edit-payment"]');
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const serviceId = btn.dataset.serviceId;
  if (serviceId) {
    mobileSaveWorkNote(serviceId);
    mobileCloseDetail();
    openCompleteForm(serviceId);
  }
});

/* V3.6.4 - Mobil fiş kapatma sihirbazı: fişi kapatma alanları sırayla sorulur */
let mobileCloseServiceData = {};
let mobileCloseServiceIndex = 0;
let mobileCloseServiceKey = "workNote";
const mobileCloseServiceSteps = [
  { key: "workNote", label: "Yapılan İşlem", type: "textarea", placeholder: "Örn: Pompa temizlendi, test edildi.", required: true },
  { key: "amount", label: "Tahsil Edilen Tutar", type: "number", placeholder: "0", required: true },
  { key: "collectedBy", label: "Tahsilatı Kim Aldı?", type: "select", required: true, options: [{ value: "me", text: "Ben Aldım" }, { value: "source", text: "Servis Kaynağı Aldı" }] },
  { key: "materialCost", label: "Malzeme Gideri", type: "number", placeholder: "0", required: false },
  { key: "otherExpense", label: "Diğer Gider", type: "number", placeholder: "0", required: false },
  { key: "commissionRate", label: "Komisyon Oranı", type: "select", required: true, options: [{ value: "70", text: "%70" }, { value: "60", text: "%60" }, { value: "50", text: "%50" }, { value: "40", text: "%40" }, { value: "30", text: "%30" }, { value: "20", text: "%20" }, { value: "10", text: "%10" }, { value: "0", text: "Komisyon Yok" }] },
  { key: "paymentMode", label: "Kapanış Tipi", type: "select", required: true, options: [{ value: "Tahsilat Yapıldı", text: "Tahsilat Yapıldı" }, { value: "Havale Bekleniyor", text: "Havale Bekleniyor" }, { value: "Ücretsiz İşlem", text: "Ücretsiz İşlem" }, { value: "Garanti Kapsamında", text: "Garanti Kapsamında" }] },
  { key: "source", label: "Servis Kaynağı", type: "source", required: false }
];

function mobileCloseExistingData(service) {
  const existingCash = primaryCashForService(service.id);
  const noteFromDetail = document.querySelector(`[data-mobile-work-note="${CSS.escape(service.id)}"]`)?.value?.trim();
  const existingNote = serviceCloseNote(service)?.text || "";
  return {
    serviceId: service.id,
    workNote: noteFromDetail || existingNote || "",
    amount: existingCash ? String(Number(existingCash.amount) || 0) : (service.price && Number(service.price) > 0 ? String(service.price) : ""),
    collectedBy: existingCash?.collectedBy === "source" ? "source" : "me",
    materialCost: existingCash ? String(Number(existingCash.materialCost) || 0) : "",
    otherExpense: existingCash ? String(Number(existingCash.otherExpense) || 0) : "",
    commissionRate: existingCash ? String(Number(existingCash.commissionRate) || 0) : "50",
    paymentMode: normalizePaymentMode(existingCash?.title || "Tahsilat Yapıldı"),
    source: existingCash?.source || service.source || "Kendi İşim"
  };
}

function mobileCloseSteps() {
  return mobileCloseServiceSteps.filter((step) => step.key !== "commissionRate");
}

function openMobileCloseServiceWizard(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  mobileCloseServiceData = mobileCloseExistingData(service);
  mobileCloseServiceIndex = 0;
  mobileCloseServiceKey = "workNote";
  mobileCloseServiceData.commissionRate = String(sourceCommissionRate(mobileCloseServiceData.source));
  let overlay = document.querySelector("#mobileCloseServiceWizard");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mobileCloseServiceWizard";
    overlay.className = "mobile-wizard mobile-close-service-wizard";
    document.body.appendChild(overlay);
  }
  overlay.removeAttribute("hidden");
  renderMobileCloseServiceStep();
}

function closeMobileCloseServiceWizard() {
  document.querySelector("#mobileCloseServiceWizard")?.setAttribute("hidden", "");
}

function mobileCloseStepOptions(step) {
  if (step.type === "source") {
    const sources = ["Kendi İşim", ...settingsList("sources")].filter(Boolean);
    return [...new Set(sources)].map((item) => ({ value: item, text: item }));
  }
  return step.options || [];
}

function renderMobileCloseServiceStep() {
  const overlay = document.querySelector("#mobileCloseServiceWizard");
  if (!overlay) return;
  const steps = mobileCloseSteps();
  let index = steps.findIndex((step) => step.key === mobileCloseServiceKey);
  if (index < 0) index = 0;
  mobileCloseServiceIndex = index;
  mobileCloseServiceKey = steps[index].key;
  const step = steps[index];
  const progress = `${index + 1}/${steps.length}`;
  const value = mobileCloseServiceData[step.key] ?? "";
  let field = "";
  if (step.type === "textarea") {
    field = `<textarea id="mobileCloseWizardField" rows="6" placeholder="${escapeAttr(step.placeholder || "")}" ${step.required ? "required" : ""}>${escapeHtml(value)}</textarea>`;
  } else if (step.type === "select" || step.type === "source") {
    field = `<select id="mobileCloseWizardField" ${step.required ? "required" : ""}>${mobileCloseStepOptions(step).map((opt) => `<option value="${escapeAttr(opt.value)}" ${String(opt.value) === String(value) ? "selected" : ""}>${escapeHtml(opt.text)}</option>`).join("")}</select>`;
  } else {
    const numberAttrs = step.type === "number" ? ` inputmode="decimal" min="0" step="0.01"` : "";
    field = `<input id="mobileCloseWizardField" type="${escapeAttr(step.type || "text")}"${numberAttrs} value="${escapeAttr(value)}" placeholder="${escapeAttr(step.placeholder || "")}" ${step.required ? "required" : ""}>`;
  }
  overlay.innerHTML = `
    <div class="mobile-wizard-backdrop" data-mobile-close-wizard="close"></div>
    <section class="mobile-wizard-card" role="dialog" aria-modal="true" aria-label="Fişi kapat">
      <header>
        <div><small>Fişi Kapat · ${progress}</small><h2>${escapeHtml(step.label)}</h2></div>
        <button type="button" data-mobile-close-wizard="close">×</button>
      </header>
      <div class="mobile-wizard-body">
        <label><span>${escapeHtml(step.label)}</span>${field}</label>
        <p class="mobile-close-wizard-hint">${mobileCloseServiceIndex === 0 ? "Bu alan zorunlu. Müşteriye yapılan işi kısa ve net yaz." : "İleri diyerek sıradaki bilgiyi gir."}</p>
      </div>
      <footer>
        <button type="button" class="secondary" data-mobile-close-wizard="back" ${index === 0 ? "disabled" : ""}>Geri</button>
        <button type="button" class="primary" data-mobile-close-wizard="next">${index === steps.length - 1 ? "Fişi Kapat" : "İleri"}</button>
      </footer>
    </section>`;
  setTimeout(() => document.querySelector("#mobileCloseWizardField")?.focus({ preventScroll: true }), 60);
}

function saveMobileCloseCurrentStep() {
  const step = mobileCloseSteps()[mobileCloseServiceIndex];
  const field = document.querySelector("#mobileCloseWizardField");
  if (!step || !field) return false;
  const value = String(field.value ?? "").trim();
  if (step.required && value === "") {
    alert(`${step.label} zorunlu.`);
    field.focus({ preventScroll: true });
    return false;
  }
  mobileCloseServiceData[step.key] = value;
  if (step.key === "commissionRate") mobileCloseServiceData.commissionAnswered = true;
  return true;
}

function finishMobileCloseServiceWizard() {
  mobileCloseServiceData.commissionRate = String(sourceCommissionRate(mobileCloseServiceData.source));
  const fd = new FormData();
  ["serviceId", "paymentMode", "type", "amount", "collectedBy", "materialCost", "otherExpense", "commissionRate", "source", "workNote"].forEach((key) => {
    fd.append(key, key === "type" ? "income" : (mobileCloseServiceData[key] ?? ""));
  });
  closeMobileCloseServiceWizard();
  mobileCloseDetail();
  completeServiceFromForm(fd);
  refreshMobileServiceViews();
}

document.addEventListener("click", function(event) {
  const action = event.target.closest("[data-mobile-close-wizard]")?.dataset.mobileCloseWizard;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (action === "close") return closeMobileCloseServiceWizard();
  if (action === "back") {
    if (!saveMobileCloseCurrentStep()) return;
    const steps = mobileCloseSteps();
    const index = Math.max(0, steps.findIndex((step) => step.key === mobileCloseServiceKey));
    mobileCloseServiceKey = steps[Math.max(0, index - 1)].key;
    renderMobileCloseServiceStep();
    return;
  }
  if (action === "next") {
    if (!saveMobileCloseCurrentStep()) return;
    const steps = mobileCloseSteps();
    const index = steps.findIndex((step) => step.key === mobileCloseServiceKey);
    if (index >= steps.length - 1) return finishMobileCloseServiceWizard();
    mobileCloseServiceKey = steps[index + 1].key;
    renderMobileCloseServiceStep();
  }
});

// Mobilde fişi kapat butonu artık masaüstü formunu değil, soru-soru kapanış sihirbazını açar.
mobileFinishService = function mobileFinishServiceV364(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  openMobileCloseServiceWizard(serviceId);
};


/* V5.3.73 — home source selector uses the existing mobile source filter. */
document.addEventListener("change",event=>{
 const homePicker=event.target.closest("#mobileWelcomeSourcePicker");
 if(homePicker){
   const existing=document.querySelector("#mobileSourcePicker");
   if(!existing)return;
   existing.value=homePicker.value;
   existing.dispatchEvent(new Event("change",{bubbles:true}));
   window.ekzenUpdateWelcome?.();
   return;
 }
 if(event.target.matches("#mobileSourcePicker")){
   const home=document.querySelector("#mobileWelcomeSourcePicker");
   if(home){home.innerHTML=event.target.innerHTML;home.value=event.target.value;}
 }
},true);

/* V5.1.1 - Mobil açık/kapalı fiş listesi tek kaynaklı kesin yapı */
(function setupMobileOpenClosedV511() {
  const VERSION = "V5.3.18";
  let activeBucket = "open";
  let selectedDate = isoToday;

  function pickerDate() {
    const value = document.querySelector("#mobileDatePicker")?.value;
    return String(value || selectedDate || isoToday).slice(0, 10);
  }

  function selectedSource() {
    return document.querySelector("#mobileSourcePicker")?.value || "";
  }

  function serviceDateCandidates(service) {
    // Erteleme sonrası eski createdAt tarihi listede tutulmaz.
    const plannedDate = service.availableDate || service.visitDate || service.date;
    if (plannedDate) {
      const value = String(plannedDate).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? [value] : [];
    }
    if (service.createdAt) {
      const value = String(service.createdAt).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? [value] : [];
    }
    return [];
  }

  function matchesDate(service, bucket) {
    return mobileDateFilterMatch(service, selectedDate, bucket === "closed" ? "closed" : "open");
  }

  function matchesSource(service) {
    return mobileSourceVisible(service, selectedSource());
  }

  function isOpenService(service) {
    return mobileIsRemainingService(service);
  }

  function isClosedService(service) {
    return !mobileIsRemainingService(service);
  }

  function recordsFor(bucket) {
    const rows = sortServices(state.services || []).filter((service) => matchesSource(service) && mobileMatchesServiceQuery(service, mobileServiceQuery) && (bucket === "payment" || matchesDate(service, bucket)));
    return bucket === "payment" ? rows.filter((service) => isStatus(service.status, "Ödeme Bekliyor") || ["Havale Bekleniyor", "Sonra Tahsil Edilecek"].includes(String(service.paymentStatus || ""))) : bucket === "closed" ? rows.filter(isClosedService) : rows.filter(isOpenService);
  }

  function formattedDate() {
    if (mobileAllDates) return "Tüm tarihler";
    if (selectedDate === isoToday) return "Bugün";
    try {
      return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
        .format(new Date(`${selectedDate}T12:00:00`));
    } catch (_) {
      return selectedDate;
    }
  }

  function renderMobileOpenClosed(scrollToList = false) {
    const root = document.querySelector("#mobileTechApp");
    if (!root) return;

    const picker = document.querySelector("#mobileDatePicker");
    if (picker) {
      if (!picker.value) picker.value = selectedDate;
      selectedDate = String(picker.value || selectedDate || isoToday).slice(0, 10);
    }

    mobileSelectedDate = selectedDate;
    mobileSelectedSource = selectedSource();
    mobileCashModeOpen = false;
    mobileTechFilter = activeBucket === "closed" ? "done" : "remaining";
    syncMobileDateTools();

    const openRows = recordsFor("open");
    const closedRows = recordsFor("closed");
    const visibleRows = activeBucket === "payment" ? recordsFor("payment") : activeBucket === "closed" ? closedRows : openRows;

    const openCount = document.querySelector("#mobileCountOpen");
    const closedCount = document.querySelector("#mobileCountClosed");
    if (openCount) openCount.textContent = String(openRows.length);
    if (closedCount) closedCount.textContent = String(closedRows.length);

    document.querySelectorAll("#mobileTechApp [data-mobile-bucket]").forEach((button) => {
      const active = button.dataset.mobileBucket === activeBucket;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const bucketLabel = activeBucket === "payment" ? "Ödeme Bekliyor · Tüm Zamanlar" : activeBucket === "closed" ? "Kapalı Fişler" : "Açık Fişler";
    const title = document.querySelector("#mobileListTitle");
    if (title) title.textContent = `${formattedDate()} · ${bucketLabel}`;
    const summary = document.querySelector("#mobileTechSummary");
    if (summary) summary.textContent = `${bucketLabel} · ${visibleRows.length} fiş`;

    const cashPage = document.querySelector("#mobileDailyCashPage");
    if (cashPage) {
      cashPage.hidden = true;
      cashPage.style.setProperty("display", "none", "important");
    }
    root.classList.remove("is-cash-mode");

    const list = document.querySelector("#mobileServiceList");
    if (list) {
      list.hidden = false;
      list.style.setProperty("display", "grid", "important");
      list.innerHTML = visibleRows.length
        ? visibleRows.map(mobileServiceCard).join("")
        : `<div class="mobile-empty">${mobileServiceQuery ? "Aramaya uygun servis yok." : `${formattedDate()} için ${bucketLabel.toLocaleLowerCase("tr-TR")} bulunmuyor.`}</div>`;
    }

    const newButton = document.querySelector(".mobile-new-service-bar");
    if (newButton) {
      newButton.hidden = false;
      newButton.style.setProperty("display", "block", "important");
    }

    const badge = document.querySelector(".mobile-version-badge");
    if (badge) badge.textContent = `Ekzen Servis Takip ${VERSION}`;

    if (scrollToList && list) {
      requestAnimationFrame(() => list.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  window.ekzenMobileShowPaymentList = () => { activeBucket = "payment"; settle(false); };

  function settle(scrollToList = false) {
    // V5.1.2: Tarih değişiminde gecikmeli ikinci render kaldırıldı.
    // Eski mobil render'ların seçili tarihi yeniden bugüne çevirmesini önlemek için
    // tek ve senkron çizim kullanılır.
    renderMobileOpenClosed(scrollToList);
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("#mobileTechApp [data-mobile-bucket]");
    if (tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeBucket = tab.dataset.mobileBucket === "closed" ? "closed" : "open";
      settle(true);
      return;
    }

    const today = event.target.closest('#mobileTechApp [data-mobile-action="today-date"]');
    if (today) {
      event.preventDefault();
      event.stopImmediatePropagation();
      mobileAllDates = false;
      selectedDate = isoToday;
      const picker = document.querySelector("#mobileDatePicker");
      if (picker) picker.value = isoToday;
      settle(false);
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (!event.target.matches("#mobileDatePicker")) return;
    event.stopImmediatePropagation();
    mobileAllDates = false;
    const nextDate = String(event.target.value || selectedDate || isoToday).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    selectedDate = nextDate;
    mobileSelectedDate = nextDate;
    renderMobileOpenClosed(false);
    if (typeof window.ekzenUpdateWelcome === "function") window.ekzenUpdateWelcome();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target.matches("#mobileDatePicker")) {
      event.stopImmediatePropagation();
      mobileAllDates = false;
      selectedDate = String(event.target.value || isoToday).slice(0, 10);
      settle(false);
      if (typeof window.ekzenUpdateWelcome === "function") window.ekzenUpdateWelcome();
      return;
    }
    if (event.target.matches("#mobileSourcePicker")) {
      event.stopImmediatePropagation();
      mobileSelectedSource = event.target.value || "";
      settle(false);
    }
  }, true);

  const previousRender = render;
  render = function renderWithMobileOpenClosedV512() {
    // Global render sırasında eski mobil kod date input'u bugüne çekebiliyor.
    // Önce seçili tarihi sakla, eski render'ı çalıştır, sonra tarihi geri koyup
    // liste ve sayaçları aynı veri kümesinden anında çiz.
    const preservedDate = selectedDate || mobileSelectedDate || isoToday;
    const preservedSource = selectedSource();
    previousRender();
    selectedDate = String(preservedDate || isoToday).slice(0, 10);
    mobileSelectedDate = selectedDate;
    const picker = document.querySelector("#mobileDatePicker");
    if (picker) picker.value = selectedDate;
    const sourcePicker = document.querySelector("#mobileSourcePicker");
    if (sourcePicker && preservedSource) sourcePicker.value = preservedSource;
    renderMobileOpenClosed(false);
  };

  window.ekzenMobileOpenClosedV511 = function ekzenMobileOpenClosedV513(scrollToList = false) {
    // Bugün butonu gibi eski dinleyicilerden gelindiğinde seçili tarihi
    // inputtan tekrar okuyarak sayaç ve listeyi aynı tarihe senkronla.
    const picker = document.querySelector("#mobileDatePicker");
    const nextDate = String(picker?.value || mobileSelectedDate || selectedDate || isoToday).slice(0, 10);
    selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(nextDate) ? nextDate : isoToday;
    mobileSelectedDate = selectedDate;
    if (picker) picker.value = selectedDate;
    renderMobileOpenClosed(scrollToList);
  };
  window.addEventListener("load", () => {
    const picker = document.querySelector("#mobileDatePicker");
    selectedDate = String(picker?.value || mobileSelectedDate || isoToday).slice(0, 10);
    if (picker && !picker.value) picker.value = selectedDate;
    settle(false);
  });
  setTimeout(() => {
    const picker = document.querySelector("#mobileDatePicker");
    selectedDate = String(picker?.value || mobileSelectedDate || isoToday).slice(0, 10);
    settle(false);
  }, 180);
})();

/* V5.2.1 - Mobil karşılama ana sayfası ve ayrı liste akışı */
(function setupMobileWelcomeHomeV521() {
  const root = document.querySelector("#mobileTechApp");
  if (!root) return;

  const todayIso = () => toIsoDate(new Date());
  const dateInput = () => document.querySelector("#mobileDatePicker");

  function serviceDates(service) {
    // V5.3.10: Ana sayfa sayaçları da servis listesiyle aynı güncel planlama tarihini kullanır.
    const plannedDate = service.availableDate || service.visitDate || service.date;
    if (plannedDate) return [String(plannedDate).slice(0, 10)];
    return service.createdAt ? [String(service.createdAt).slice(0, 10)] : [];
  }

  function selectedDate() {
    const value = String(dateInput()?.value || todayIso()).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso();
  }

  function selectedSourceValue() {
    return document.querySelector("#mobileSourcePicker")?.value || "";
  }

  function dateRows() {
    const date = selectedDate();
    const source = selectedSourceValue();
    return (state.services || []).filter((service) => {
      if (!mobileSourceVisible(service, source) || !mobileMatchesServiceQuery(service, mobileServiceQuery)) return false;
      const bucket = mobileIsRemainingService(service) ? "open" : "closed";
      return mobileDateFilterMatch(service, date, bucket);
    });
  }

  function isClosedWelcomeService(service) {
    return isStatus(service.status, "İşlem Tamam") || isStatus(service.status, "İptal");
  }

  function formatWelcomeDate(date) {
    try {
      return new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date(`${date}T12:00:00`));
    } catch (_) { return date; }
  }

  function formatWelcomeDay(date) {
    try {
      return new Intl.DateTimeFormat("tr-TR", { weekday: "long" })
        .format(new Date(`${date}T12:00:00`));
    } catch (_) { return ""; }
  }

  function formatWelcomeSummary(date) {
    return date === todayIso() ? "Bugünün servis özeti" : `${formatWelcomeDate(date)} servis özeti`;
  }

  function updateWelcome() {
    const rows = dateRows();
    const openRows = rows.filter((service) => mobileIsRemainingService(service));
    const closedRows = rows.filter((service) => !mobileIsRemainingService(service));
    const openEl = document.querySelector("#mobileWelcomeOpenCount");
    const closedEl = document.querySelector("#mobileWelcomeClosedCount");
    const textEl = document.querySelector("#mobileWelcomeDateText");
    const dateDisplayEl = document.querySelector("#mobileWelcomeDateDisplay");
    const listDateEl = document.querySelector("#mobileListPageDate");
    if (openEl) openEl.textContent = String(openRows.length);
    if (closedEl) closedEl.textContent = String(closedRows.length);
    const paymentEl = document.querySelector("#mobileWelcomePaymentCount");
    if (paymentEl) paymentEl.textContent = String((state.services || []).filter((service) => mobileSourceVisible(service, selectedSourceValue()) && (isStatus(service.status, "Ödeme Bekliyor") || ["Havale Bekleniyor", "Sonra Tahsil Edilecek"].includes(String(service.paymentStatus || "")))).length);

    const source = selectedSourceValue();
    const cashItems = (state.cash || []).filter((item) => {
      const itemDate = String(item.date || "").slice(0, 10);
      const itemSource = cashItemSource(item);
      return cashIsPosted(item)
        && matchesPortalSource(itemSource)
        && (!source || sourceMatches(itemSource, source))
        && (mobileAllDates || dateInRange(itemDate, mobileRangeStart || selectedDate(), mobileRangeEnd || selectedDate()));
    });
    const serviceTotals = serviceOnlyCashBreakdown(cashItems);
    const income = Number(serviceTotals.income || 0);
    const earning = income - Number(serviceTotals.commission || 0) - Number(serviceTotals.material || 0);
    const incomeEl = document.querySelector("#mobileWelcomeIncome");
    const earningEl = document.querySelector("#mobileWelcomeEarning");
    if (incomeEl) incomeEl.textContent = money(income);
    if (earningEl) earningEl.textContent = money(earning);
    renderHomeCashCards("mobile",cashItems);
    const profitEl = document.querySelector("#mobileWelcomeProfitCount");
    if (profitEl) profitEl.textContent = money(dashboardServiceProfit((state.cash || []).filter((item) => cashIsPosted(item) && matchesPortalSource(cashItemSource(item)) && (!source || sourceMatches(cashItemSource(item), source)) && (mobileAllDates || dateInRange(cashFilterDate(item), mobileRangeStart || selectedDate(), mobileRangeEnd || selectedDate())))));

    if (textEl) textEl.textContent = mobileAllDates ? "Tüm tarihler servis özeti" : mobileRangeStart && mobileRangeEnd ? mobileDateRangeLabel() + " servis özeti" : formatWelcomeSummary(selectedDate());
    if (dateDisplayEl) {
      dateDisplayEl.innerHTML = mobileRangeStart && mobileRangeEnd ? `<span class="mobile-welcome-date-line">${escapeHtml(mobileDateRangeLabel())}</span><span class="mobile-welcome-day-line">${mobileRangeStart === mobileRangeEnd ? formatWelcomeDay(mobileRangeStart) : "Seçili tarih aralığı"}</span>` : mobileAllDates
        ? `<span class="mobile-welcome-date-line">Tüm tarihler</span><span class="mobile-welcome-day-line">Açık fişler gecikmiş olanlarla birlikte</span>`
        : `<span class="mobile-welcome-date-line">${formatWelcomeDate(selectedDate())}</span><span class="mobile-welcome-day-line">${formatWelcomeDay(selectedDate())}</span>`;
    }
    if (listDateEl) listDateEl.textContent = mobileAllDates ? "Tüm tarihler" : (selectedDate() === todayIso() ? "Bugün" : formatWelcomeDate(selectedDate()));
    syncMobileDateTools();
  }

  function syncExistingMobile() {
    const picker = dateInput();
    if (!picker) return;
    mobileSelectedDate = selectedDate();
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof window.ekzenMobileOpenClosedV511 === "function") window.ekzenMobileOpenClosedV511(false);
    updateWelcome();
  }

  let nativeActivePage = null;
  let nativeTransitionTimer = 0;

  function ensureNativePageShell() {
    let shell = document.querySelector("#mobileNativePageShell");
    if (shell) return shell;

    shell = document.createElement("section");
    shell.id = "mobileNativePageShell";
    shell.className = "mobile-native-page-shell";
    shell.setAttribute("aria-hidden", "true");

    const nodes = [
      root.querySelector(":scope > .mobile-tech-header"),
      root.querySelector(":scope > .mobile-list-head"),
      root.querySelector(":scope > #mobileDailyCashPage"),
      root.querySelector(":scope > #mobileServiceList"),
      root.querySelector(":scope > .mobile-new-service-bar"),
      root.querySelector(":scope > .mobile-version-badge")
    ].filter(Boolean);
    nodes.forEach((node) => shell.appendChild(node));

    const backdrop = document.createElement("button");
    backdrop.id = "mobileNativePageBackdrop";
    backdrop.className = "mobile-native-page-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Ana sayfaya dön");
    backdrop.addEventListener("click", () => showHome(false));

    root.append(backdrop, shell);
    return shell;
  }

  function openNativePage(mode) {
    const shell = ensureNativePageShell();
    const backdrop = document.querySelector("#mobileNativePageBackdrop");
    clearTimeout(nativeTransitionTimer);
    shell.classList.remove("is-active");
    shell.setAttribute("aria-hidden", "false");
    shell.style.visibility = "visible";
    if (backdrop) backdrop.classList.add("is-active");
    root.classList.add("has-native-page");
    nativeActivePage = mode;
    requestAnimationFrame(() => requestAnimationFrame(() => shell.classList.add("is-active")));
  }

  function showHome(resetToday = true) {
    const shell = ensureNativePageShell();
    const backdrop = document.querySelector("#mobileNativePageBackdrop");
    clearTimeout(nativeTransitionTimer);

    const finishHome = () => {
      if (resetToday) {
        const picker = dateInput();
        if (picker) picker.value = todayIso();
        mobileSelectedDate = todayIso();
      }
      root.classList.remove("is-list-mode", "is-cash-mode", "has-native-page");
      root.classList.add("is-welcome-mode");
      const cashPage = document.querySelector("#mobileDailyCashPage");
      const serviceList = document.querySelector("#mobileServiceList");
      const globalNewButton = document.querySelector("#mobileNativePageShell .mobile-new-service-bar");
      if (cashPage) cashPage.hidden = true;
      if (serviceList) {
        serviceList.hidden = true;
        serviceList.style.setProperty("display", "none", "important");
      }
      if (globalNewButton) {
        globalNewButton.hidden = true;
        globalNewButton.style.setProperty("display", "none", "important");
      }
      shell.setAttribute("aria-hidden", "true");
      shell.style.visibility = "hidden";
      nativeActivePage = null;
      syncExistingMobile();
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    if (nativeActivePage && shell.classList.contains("is-active")) {
      shell.classList.remove("is-active");
      if (backdrop) backdrop.classList.remove("is-active");
      nativeTransitionTimer = window.setTimeout(finishHome, 370);
    } else {
      if (backdrop) backdrop.classList.remove("is-active");
      finishHome();
    }
  }

  function showList(bucket) {
    ensureNativePageShell();
    root.classList.remove("is-welcome-mode", "is-cash-mode");
    root.classList.add("is-list-mode");
    document.querySelector("#mobileNativePageShell")?.querySelectorAll(".mobile-tech-header,.mobile-list-head").forEach(el=>el.style.removeProperty("display"));
    const serviceList = document.querySelector("#mobileServiceList");
    const globalNewButton = document.querySelector("#mobileNativePageShell .mobile-new-service-bar");
    if (serviceList) {
      serviceList.hidden = false;
      serviceList.style.removeProperty("display");
    }
    if (globalNewButton) {
      globalNewButton.hidden = false;
      globalNewButton.style.removeProperty("display");
    }
    const tab = document.querySelector(`#mobileTechApp [data-mobile-bucket="${bucket}"]`);
    if (bucket === "payment") window.ekzenMobileShowPaymentList?.();
    else if (tab) tab.click();
    updateWelcome();
    openNativePage("list");
    // Ana sayfadaki sayaç ile açılan liste aynı tarih aralığı, kaynak ve
    // açık/kapalı tanımını kullanmalı. Sekme tıklaması tek gün filtresine
    // dönebildiğinden, ana sayfadan gelen kayıtları doğrudan listeye bas.
    if (bucket === "closed" || bucket === "open") {
      const source = selectedSourceValue();
      const matching = sortServices(state.services || []).filter(service => {
        if (!mobileSourceVisible(service, source) || !mobileMatchesServiceQuery(service, mobileServiceQuery)) return false;
        const closed = !mobileIsRemainingService(service);
        return (bucket === "closed" ? closed : !closed) && mobileDateFilterMatch(service, selectedDate(), bucket);
      });
      const list = document.querySelector("#mobileServiceList");
      if (list) {
        list.hidden = false;
        list.style.setProperty("display", "grid", "important");
        list.innerHTML = matching.length ? matching.map(mobileServiceCard).join("") : '<div class="mobile-empty">Seçilen tarih aralığında servis kaydı bulunamadı.</div>';
      }
      const summary = document.querySelector("#mobileTechSummary");
      if (summary) summary.textContent = (bucket === "closed" ? "Kapanan Fişler" : "Günün İşleri") + " · " + matching.length + " fiş";
    }
    document.querySelector("#mobileNativePageShell")?.scrollTo({ top: 0, behavior: "auto" });
  }

  function showPaymentForSource(source) {
    showList("payment");
    const matching = sortServices(state.services || []).filter(service =>
      matchesPortalSource(service.source) &&
      (!source || sourceMatches(service.source, source)) &&
      (isStatus(service.status, "Ödeme Bekliyor") ||
        ["Havale Bekleniyor", "Sonra Tahsil Edilecek"].includes(String(service.paymentStatus || "")))
    );
    const list = document.querySelector("#mobileServiceList");
    if (list) {
      list.hidden = false;
      list.style.setProperty("display", "grid", "important");
      list.innerHTML = matching.length
        ? matching.map(mobileServiceCard).join("")
        : '<div class="mobile-empty">Seçilen kaynakta ödeme bekleyen servis yok.</div>';
    }
    const summary = document.querySelector("#mobileTechSummary");
    if (summary) summary.textContent = "Ödeme Bekliyor · " + (source || "Tüm Kaynaklar") + " · " + matching.length + " fiş";
  }
  window.ekzenMobileNavigatePayment = () => showPaymentForSource(mobileCashSource || (isSourcePortal() ? portalSourceName() : ""));
  window.ekzenMobileNavigatePaymentForHome = () => showPaymentForSource(selectedSourceValue() || (isSourcePortal() ? portalSourceName() : ""));

  function showCash() {
    ensureNativePageShell();
    root.classList.remove("is-welcome-mode", "is-list-mode");
    root.classList.add("is-cash-mode");
    // Servis üst menüsü native kasa ekranında hiçbir zaman görünmemeli.
    const nativeShell = document.querySelector("#mobileNativePageShell");
    if (nativeShell) nativeShell.querySelectorAll(".mobile-tech-header,.mobile-list-head,#mobileServiceList,.mobile-new-service-bar").forEach(el=>{el.style.setProperty("display","none","important");});
    const openCash = document.querySelector('#mobileTechApp [data-mobile-action="open-daily-cash"]');
    if (openCash) openCash.click();
    openNativePage("cash");
    document.querySelector("#mobileNativePageShell")?.scrollTo({ top: 0, behavior: "auto" });
  }

  document.addEventListener("click", (event) => {
    const addedCashCounter=event.target.closest("#mobileHomeCashCards [data-home-cash-slot]");
    if(addedCashCounter){
      event.preventDefault();
      event.stopImmediatePropagation();
      const slot=addedCashCounter.dataset.homeCashSlot;
      if(slot.startsWith("status-")){
        const statusName=decodeURIComponent(slot.slice(7));
        showList(statusGroup(statusName)==="complete"?"closed":"open");
        const list=document.querySelector("#mobileServiceList");
        if(list){
          const ids=new Set((state.services||[]).filter(service=>isStatus(service.status,statusName)).map(service=>String(service.id)));
          list.querySelectorAll("[data-service-id]").forEach(node=>{const id=node.dataset.serviceId;if(id&&!ids.has(String(id)))node.hidden=true;});
        }
        return;
      }
      if(slot==="payment"){window.ekzenMobileNavigatePaymentForHome?.();return;}
      if(slot==="expense"){
        const source = selectedSourceValue() || "";
        if (source && !isOwnWorkSource(source)) { mobileOpenSourcePayment(source); return; }
      }
      mobileCashDetailFilter=({income:"income",commission:"commission",material:"material",expense:"all",profit:"all"})[slot]||"all";
      showCash();
      if(mobileCashDetailFilter!=="all"){
        mobileRenderDailyCash();
        document.querySelector("#mobileCashMovementHeading")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
      return;
    }
    const counter = event.target.closest("#mobileWelcomePage [data-welcome-target]");
    if (counter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = counter.dataset.welcomeTarget;
      if (target === "profit") { showCash(); return; }
      showList(target === "payment" ? "payment" : target === "closed" ? "closed" : "open");
      return;
    }

    const action = event.target.closest("#mobileTechApp [data-welcome-action]");
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action.dataset.welcomeAction === "cash") showCash();
    if (action.dataset.welcomeAction === "home") showHome(true);
  }, true);

  document.addEventListener("change", (event) => {
    if (!event.target.matches("#mobileDatePicker")) return;
    mobileSelectedDate = selectedDate();
    updateWelcome();
  });

  const previousRender = render;
  render = function renderWithWelcomeHomeV521() {
    previousRender();
    updateWelcome();
  };

  window.ekzenUpdateWelcome = updateWelcome;
  window.ekzenMobileShowHome = () => showHome(true);
  window.ekzenMobileShowList = (bucket = "open") => showList(bucket);
  window.ekzenMobileShowCash = showCash;

  window.addEventListener("pageshow", () => showHome(true));
  window.addEventListener("load", () => showHome(true));
  setTimeout(() => showHome(true), 220);
})();

/* V5.3.6 mobile cash filters */
document.addEventListener("click", (event) => {
  const rangeButton = event.target.closest("[data-mobile-cash-range]");
  if (rangeButton) {
    event.preventDefault();
    const mode = rangeButton.dataset.mobileCashRange;
    const today = new Date(`${isoToday}T12:00:00`);
    const iso = (d) => {
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`;
    };
    mobileCashRangeInitialized = true;
    mobileCashRangeMode = mode;
    if (mode === "today") mobileCashRangeStart = mobileCashRangeEnd = isoToday;
    if (mode === "week") {
      const d = new Date(today); const diff=(d.getDay()+6)%7; d.setDate(d.getDate()-diff);
      mobileCashRangeStart=iso(d); mobileCashRangeEnd=isoToday;
    }
    if (mode === "month") {
      mobileCashRangeStart=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;
      mobileCashRangeEnd=isoToday;
    }
    if (mode === "all") { mobileCashRangeStart=""; mobileCashRangeEnd=""; }
    document.querySelectorAll("[data-mobile-cash-range]").forEach(b=>b.classList.toggle("is-active", b===rangeButton));
    mobileRenderDailyCash();
    return;
  }
  if (event.target.closest("#mobileCashApplyFilter")) {
    event.preventDefault();
    mobileCashRangeStart=document.querySelector("#mobileCashStartDate")?.value || "";
    mobileCashRangeEnd=document.querySelector("#mobileCashEndDate")?.value || "";
    mobileCashSource=document.querySelector("#mobileCashSourcePicker")?.value || "";
    mobileCashRangeInitialized = true;
    mobileCashRangeMode = "custom";
    document.querySelectorAll("[data-mobile-cash-range]").forEach(b=>b.classList.remove("is-active"));
    mobileRenderDailyCash();
  }
});

/* V5.3.7 - Mobil kasa filtrelerini servis filtrelerinden tamamen ayır */
document.addEventListener("change", (event) => {
  if (!event.target.closest("#mobileDailyCashPage")) return;

  if (event.target.matches("#mobileCashSourcePicker")) {
    event.stopImmediatePropagation();
    mobileCashSource = event.target.value || "";
    mobileCashRangeInitialized = true;
    mobileRenderDailyCash();
    return;
  }

  if (event.target.matches("#mobileCashStartDate, #mobileCashEndDate")) {
    event.stopImmediatePropagation();
    mobileCashRangeStart = document.querySelector("#mobileCashStartDate")?.value || "";
    mobileCashRangeEnd = document.querySelector("#mobileCashEndDate")?.value || "";
    mobileCashRangeMode = "custom";
    mobileCashRangeInitialized = true;
    document.querySelectorAll("[data-mobile-cash-range]").forEach((b) => b.classList.remove("is-active"));
    mobileRenderDailyCash();
  }
}, true);

/* V5.3.8 - Mobil kasadan gelir / gider ekleme */
document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-mobile-cash-add]");
  if (!addButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  const type = addButton.dataset.mobileCashAdd === "expense" ? "expense" : "income";
  openCashForm();

  if (cashForm?.elements?.type) cashForm.elements.type.value = type;
  if (cashForm?.elements?.date) cashForm.elements.date.value = mobileCashRangeEnd || mobileSelectedDate || isoToday;
  if (cashForm?.elements?.source) cashForm.elements.source.value = mobileCashSource || "";
  const title = document.querySelector("#cashDialogTitle");
  if (title) title.textContent = type === "expense" ? "Gider Ekle" : "Gelir Ekle";
}, true);

/* V5.3.13 - Mobilde tüm tarihler ve müşteri araması */
document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-mobile-all-dates]");
  if (!toggle) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  mobileAllDates = !mobileAllDates;
  refreshMobileServiceViews();
}, true);

document.addEventListener("input", (event) => {
  if (!event.target.matches("#mobileServiceSearch")) return;
  mobileServiceQuery = event.target.value || "";
  refreshMobileServiceViews();
}, true);

/* Kasa kaydı yapıldıktan sonra mobil kasa açıksa sayaçları/hareketleri yenile. */
const ekzenV538CashForm = document.querySelector("#cashForm");
if (ekzenV538CashForm) {
  ekzenV538CashForm.addEventListener("submit", () => {
    setTimeout(() => {
      if (document.querySelector("#mobileTechApp")?.classList.contains("is-cash-mode")) {
        mobileRenderDailyCash();
      }
    }, 80);
  });
}

/* Kaynak cari ödemesi: yalnızca tutar, tarih, açıklama. */
function mobileOpenSourcePayment(requestedSource = "") {
  if (isSourcePortal()) return;
  const source = requestedSource || mobileCashSource || "";
  if (!source || isOwnWorkSource(source)) {
    alert("Önce ödeme yapılacak servis kaynağını seçin.");
    return;
  }
  const dialog = document.querySelector("#mobileSourcePaymentDialog");
  if (!dialog) return;
  const form = dialog.querySelector("form");
  form.reset();
  form.elements.source.value = source;
  form.elements.date.value = toIsoDate(new Date());
  dialog.querySelector("[data-payment-source-name]").textContent = source;
  const items = (state.cash || []).filter(item => cashIsPosted(item) && sourceMatches(cashItemSource(item), source));
  const remaining = serviceSourceCounterBreakdown(items).remainingPayment;
  dialog.querySelector("[data-payment-remaining]").textContent = money(remaining);
  dialog.showModal();
}
document.addEventListener("submit", event => {
  if (event.target.id !== "mobileSourcePaymentForm") return;
  event.preventDefault();
  if (isSourcePortal()) return;
  const form = event.target;
  const source = form.elements.source.value;
  const amount = Number(form.elements.amount.value);
  const date = form.elements.date.value;
  const description = form.elements.description.value.trim();
  if (!source || isOwnWorkSource(source) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    alert("Geçerli tutar ve tarih girin."); return;
  }
  const items = (state.cash || []).filter(item => cashIsPosted(item) && sourceMatches(cashItemSource(item), source));
  const remaining = serviceSourceCounterBreakdown(items).remainingPayment;
  if (amount > remaining + 0.001) {
    alert("Ödeme, kaynağın kalan alacağını aşamaz: " + money(remaining)); return;
  }
  state.cash.unshift({
    id:uid(), date, type:"expense", title:"Kaynağa Ödeme",
    description:description || "Kaynak cari ödemesi",
    amount, cashPurpose:"source-offset", source, serviceId:"",
    materialCost:0, otherExpense:0, commission50:false, commissionRate:0
  });
  saveState();
  document.querySelector("#mobileSourcePaymentDialog")?.close();
  render();
  mobileRenderDailyCash();
});
document.addEventListener("click", event => {
  if (event.target.closest("#mobileSourcePaymentCancel")) document.querySelector("#mobileSourcePaymentDialog")?.close();
});
/* V5.3.20 — Kasa sayacı tıklama davranışları */
document.addEventListener("click", function(event) {
  const payment = event.target.closest("#mobileCashPaymentCounter");
  if (payment) {
    event.preventDefault();
    window.ekzenMobileNavigatePayment?.();
    return;
  }
  const sourceBalanceCounter = event.target.closest("#mobileDailyPageExpense")?.closest("[data-cash-detail]");
  if (sourceBalanceCounter && mobileCashSource && !isOwnWorkSource(mobileCashSource)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    mobileOpenSourcePayment();
    return;
  }
  const category = event.target.closest("[data-cash-detail]");
  if (category && category.closest("#mobileDailyCashPage")) {
    event.preventDefault();
    mobileCashDetailFilter = category.dataset.cashDetail;
    mobileRenderDailyCash();
    document.querySelector("#mobileCashMovementHeading")?.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  if (event.target.closest("#mobileCashDetailReset")) {
    event.preventDefault();
    mobileCashDetailFilter = "all";
    mobileRenderDailyCash();
    return;
  }
  const profit = event.target.closest("#mobileCashProfitCounter");
  if (profit) {
    event.preventDefault();
    mobileCashDetailFilter = "all";
    mobileRenderDailyCash();
    document.querySelector("#mobileCashMovementHeading")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
});


async function saveCustomCounterForm(form) {
  if(isSourcePortal()) { alert("Bu ayar yalnızca yönetici hesabında değiştirilebilir."); return; }
  const field=(name)=>form.querySelector('[name="'+name+'"]');
  const slot=field("slot")?.value || "";
  const terms=[...form.querySelectorAll("[data-sign]")].filter(el=>el.value!=="0")
    .map(el=>({key:el.dataset.sign,sign:Number(el.value)===-1?-1:1}));
  if(!terms.length && !slot){alert("En az bir hesaplama kalemi seçin.");return;}
  const name=(field("name")?.value||"").trim();
  if(!name){alert("Sayaç adı boş olamaz.");return;}
  const list=customCashCounters();
  const index=Number(field("index")?.value??-1);
  const old=Number.isInteger(index)&&index>=0&&index<list.length?list[index]:null;
  const counter={id:old?.id||uid(),name,color:field("color")?.value||"#2563eb",
    unit:field("unit")?.value==="count"?"count":"money",
    terms,visible:old?.visible!==false};
  if(slot){
    const def=cashSlotSettings().find(c=>c.id===slot);
    if(!def){alert("Sayaç bulunamadı.");return;}
    state.settings.cashSlotSettings=state.settings.cashSlotSettings||[];
    const i=state.settings.cashSlotSettings.findIndex(c=>c.id===slot);
    const updated={...counter,id:slot,terms:terms.length?terms:def.terms,visible:def.visible!==false};
    if(i<0)state.settings.cashSlotSettings.push(updated);
    else state.settings.cashSlotSettings[i]=updated;
  } else if(old)list[index]=counter;
  else {
    if(list.length>=30){alert("En fazla 30 özel sayaç oluşturabilirsiniz.");return;}
    list.push(counter);
  }
  const settingsSaved=persistLocalCounterSettings();
  const localSaved=saveLocalState();
  if(!settingsSaved && !localSaved){
    alert("Kaydedilemedi. Cihaz depolama alanını kontrol edin.");
    return;
  }
  renderCustomCashCounterSettings();
  mobileRenderDailyCash();
  if(!canSyncCloud()){
    alert("Değişiklikler bu cihazda kaydedildi. Bulut eşitlemesi şu anda kullanılamıyor.");
    return;
  }
  try {
    state.settings.cashSlotSettings=(state.settings.cashSlotSettings||[]).map(item=>({...item,visible:item?.visible!==false}));
    lastLocalCloudWriteAt = new Date().toISOString();
    await cloudRef.update({"state/settings/cashSlotSettings":state.settings.cashSlotSettings,"state/settings/customCashCounters":state.settings.customCashCounters||[],updatedAt:lastLocalCloudWriteAt});
    try { localStorage.removeItem(COUNTER_SETTINGS_LOCAL_KEY); } catch (_) {}
    alert("Değişiklikler kaydedildi ve telefonla eşitlendi.");
  } catch(error) {
    console.warn("Sayaç ayarları buluta yazılamadı:",error?.code||error?.message||error);
    if(isPermissionDenied(error))denyCloudWrite();
    const errorDetail=String(error?.message||error?.code||error||"Bilinmeyen hata").slice(0,350);
    alert("Cihaza kaydedildi, buluta kaydedilemedi. Firebase hatası: "+errorDetail);
  }
}
document.addEventListener("submit",event=>{
  if(event.target.id!=="customCounterForm")return;
  event.preventDefault();
  saveCustomCounterForm(event.target);
});
document.addEventListener("click",event=>{
  const button=event.target.closest("#customCounterSaveButton");
  if(!button)return;
  event.preventDefault();
  const form=button.closest("form");
  if(form)saveCustomCounterForm(form);
});

/* Mobil kasa hareketinden ilgili servis detayını aç. */
document.addEventListener("click", (event) => {
  const row = event.target.closest("[data-mobile-cash-service-id]");
  if (row) mobileOpenDetail(row.dataset.mobileCashServiceId);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-mobile-cash-service-id]");
  if (!row) return;
  event.preventDefault();
  mobileOpenDetail(row.dataset.mobileCashServiceId);
});

/* Safe customization-only reset. Never write the services/cash/company branches. */
async function resetEkzenCustomizations() {
  if (isSourcePortal()) return;
  if (!canSyncCloud()) {
    alert("Bulut bağlantısı hazır değil. Güvenli sıfırlama için bağlantıyı kontrol edin.");
    return;
  }
  const snapshot = await cloudRef.once("value").catch(() => null);
  if (!snapshot || !snapshot.val()?.state) {
    alert("Buluttaki güncel veriler doğrulanamadı. Hiçbir ayar değiştirilmedi.");
    return;
  }
  const live = snapshot.val().state;
  const backup = {app:"ekzen-servis-takip",version:1,exportedAt:new Date().toISOString(),reason:"customization-reset",state:live};
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href=url;
  anchor.download="ekzen-sifirlama-oncesi-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  const confirmation = prompt("Önce indirilen yedeği kontrol edin. Yalnızca görünüm ve sayaç özelleştirmeleri sıfırlanacak; servis, kasa ve müşteri kayıtları korunacak. Onay için AYARLARI SIFIRLA yazın:");
  if (confirmation !== "AYARLARI SIFIRLA") return;
  const old = live.settings || {};
  // Only explicitly whitelisted presentation settings may be reset.
  const reset = {
    dashboardCounters: [...dashboardCounters],
    dashboardCountersVersion: 3,
    cashCounters: normalizeCashCounters(null),
    customCashCounters: [],
    cashSlotSettings: [],
    dashboardCounterCopies: [],
    hiddenDashboardCounters: [],
    mobileLayoutCustom: {},
    homeLayout: {desktop:[],mobile:[]}
  };
  const patch = {updatedAt:new Date().toISOString()};
  Object.entries(reset).forEach(([key,value])=>patch["state/settings/"+key]=value);
  try {
    await cloudRef.update(patch);
    // Local settings are updated only after the cloud confirms the write.
    Object.assign(state.settings,reset);
    try { localStorage.removeItem(COUNTER_SETTINGS_LOCAL_KEY); } catch (_) {}
    saveLocalState();
    render();
    alert("Özelleştirmeler varsayılanlara döndü. Servis ve kasa kayıtları silinmedi.");
  } catch (error) {
    alert("Buluta kayıt yapılamadı. Hiçbir özelleştirme sıfırlanmadı.");
  }
}

/* Clone a counter into a new editable draft; saving uses the existing validated workflow. */
function duplicateCashCounter(slot,index) {
  if (isSourcePortal()) return;
  const source = slot ? cashSlotSettings().find(c=>c.id===slot) : customCashCounters()[Number(index)];
  if (!source) { alert("Kopyalanacak sayaç bulunamadı."); return; }
  if (customCashCounters().length >= 30) { alert("En fazla 30 ek sayaç oluşturabilirsiniz."); return; }
  const form = document.querySelector("#customCounterForm");
  if (!form) return;
  form.elements.index.value = "-1";
  form.elements.slot.value = "";
  form.elements.name.value = (source.name || "Sayaç") + " (Kopya)";
  form.elements.color.value = /^#[0-9a-fA-F]{6}$/.test(source.color) ? source.color : "#2563eb";
  form.elements.unit.value = source.unit === "count" ? "count" : "money";
  form.querySelectorAll("[data-sign]").forEach(el => {
    const term = (source.terms || []).find(t=>t.key===el.dataset.sign);
    el.value = term ? String(term.sign===-1?-1:1) : "0";
  });
  form.scrollIntoView({behavior:"smooth",block:"center"});
  form.elements.name.focus();
  form.elements.name.select();
}

/* Dashboard counter copies retain the original stat-box markup and underlying filter. */
function dashboardCounterCopies(){return Array.isArray(state.settings.dashboardCounterCopies)?state.settings.dashboardCounterCopies:[];}
function dashboardCounterBase(label){return dashboardCounterCopies().find(c=>c.name===label)?.base||label;}
function dashboardCounterDisplayName(label){return dashboardCounterCopies().find(c=>c.name===label)?.name||label;}
function dashboardVisibleCounters(){const hidden=state.settings.hiddenDashboardCounters||[];return settingsList("dashboardCounters").filter(label=>!hidden.includes(label));}
function renderDashboardCounterDesigner(){
 const root=document.querySelector("#dashboardCounterDesigner");if(!root)return;
 const list=settingsList("dashboardCounters"),hidden=state.settings.hiddenDashboardCounters||[];
 root.innerHTML='<h3>Ana Sayfa Sayaçları</h3><p>Çoğaltılan sayaçlar orijinaliyle aynı ölçüde, aynı hesaplama ve tıklama davranışıyla çalışır. Orijinal sayaç gizlenebilir.</p><div class="custom-counter-list">'+list.map((label,i)=>{
 const copy=dashboardCounterCopies().find(c=>c.name===label);
 return '<div class="custom-counter-row"><strong>'+escapeHtml(label)+'</strong><button type="button" data-action="move-dashboard-counter" data-label="'+escapeAttr(label)+'" data-direction="-1" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-action="move-dashboard-counter" data-label="'+escapeAttr(label)+'" data-direction="1" '+(i===list.length-1?'disabled':'')+'>↓</button><button type="button" data-action="duplicate-dashboard-counter" data-label="'+escapeAttr(label)+'">Çoğalt</button>'+(copy?'<button type="button" data-action="rename-dashboard-copy" data-label="'+escapeAttr(label)+'">İsim</button><button type="button" data-action="color-dashboard-copy" data-label="'+escapeAttr(label)+'">Renk</button>':'')+'<button type="button" data-action="toggle-dashboard-counter" data-label="'+escapeAttr(label)+'">'+(hidden.includes(label)?'Göster':'Gizle')+'</button>'+(copy?'<button type="button" data-action="delete-dashboard-copy" data-label="'+escapeAttr(label)+'">Sil</button>':'')+'</div>';
 }).join("")+'</div>';
}
function duplicateDashboardCounter(label){
 if(isSourcePortal())return;
 const list=settingsList("dashboardCounters");
 if(!list.includes(label)||dashboardCounterCopies().length>=40)return;
 const name=prompt("Yeni sayacın adı",label+" (Kopya)")?.trim();
 if(!name||list.includes(name)){if(name)alert("Bu isimde sayaç zaten var.");return;}
 const base=dashboardCounterBase(label);
 const inherited=dashboardCounterCopies().find(c=>c.name===label);
 state.settings.dashboardCounterCopies.push({name,base,color:inherited?.color||""});
 const index=list.indexOf(label);
 list.splice(index+1,0,name);
 saveState();render();
}
function toggleDashboardCounter(label){
 if(isSourcePortal())return;
 const hidden=state.settings.hiddenDashboardCounters||[];
 state.settings.hiddenDashboardCounters=hidden.includes(label)?hidden.filter(x=>x!==label):[...hidden,label];
 saveState();render();
}
function renameDashboardCopy(label){
 const c=dashboardCounterCopies().find(x=>x.name===label);if(!c||isSourcePortal())return;
 const name=prompt("Sayaç adı",label)?.trim();if(!name||name===label)return;
 if(settingsList("dashboardCounters").includes(name)){alert("Bu isim kullanılıyor.");return;}
 c.name=name;
 state.settings.dashboardCounters=state.settings.dashboardCounters.map(x=>x===label?name:x);
 state.settings.hiddenDashboardCounters=(state.settings.hiddenDashboardCounters||[]).map(x=>x===label?name:x);
 saveState();render();
}
function colorDashboardCopy(label){
 const c=dashboardCounterCopies().find(x=>x.name===label);if(!c||isSourcePortal())return;
 const color=prompt("Sayaç kenar rengi (örn. #2563eb)",c.color||"#2563eb");
 if(color===null)return;
 if(!/^#[0-9a-fA-F]{6}$/.test(color.trim())){alert("Renk #RRGGBB biçiminde olmalı.");return;}
 c.color=color.trim();saveState();render();
}
function deleteDashboardCopy(label){
 const c=dashboardCounterCopies().find(x=>x.name===label);if(!c||isSourcePortal())return;
 if(!confirm(label+" sayacı kaldırılsın mı?"))return;
 state.settings.dashboardCounterCopies=dashboardCounterCopies().filter(x=>x.name!==label);
 state.settings.dashboardCounters=settingsList("dashboardCounters").filter(x=>x!==label);
 state.settings.hiddenDashboardCounters=(state.settings.hiddenDashboardCounters||[]).filter(x=>x!==label);
 saveState();render();
}
function moveDashboardCounter(label,direction){
 if(isSourcePortal())return;
 const list=settingsList("dashboardCounters"),i=list.indexOf(label),j=i+direction;
 if(i<0||j<0||j>=list.length)return;
 [list[i],list[j]]=[list[j],list[i]];
 saveState();render();
}
