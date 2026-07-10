const STORAGE_KEY = "ekzen-servis-takip-v1";
const CLOUD_STATE_PATH = "servis_takip_v2/state";
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
let cloudInitialHandled = false;

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
  fillSelects();
  applySourcePortalMode();
  bindEvents();
  setDefaultDates();
  saveLocalState();
  render();
  initCloudSync();
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
  const migrated = {
    company: oldState.company || {},
    settings: {
      brands: uniqueValues(oldState.settings?.brands || brands),
      devices: uniqueValues(oldState.settings?.devices || devices),
      statuses: ensureValues(uniqueValues(oldState.settings?.statuses || statuses), ["Yeni Kayıt", "İşlemde", "Ödeme Bekliyor", "İşlem Tamam", "Geri Dönen İş", "İptal"]),
      dashboardCounters: dashboardCountersVersion < 3 ? ensureValues(currentCounters, ["Açık Fişler", "Toplam Servis"]) : currentCounters,
      dashboardCountersVersion: 3,
      cashCounters: normalizeCashCounters(oldState.settings?.cashCounters),
      sources: ensureValues(sourceNames.length ? sourceNames : [...sources], ["Korkmaz Teknik", "Sedef Teknik", "Kendi İşim"]),
      cities: uniqueValues(oldState.settings?.cities || cities),
      sourcePhones: { ...(oldState.settings?.sourcePhones || {}) },
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

function normalizeStatusHistory(service) {
  if (Array.isArray(service.statusHistory) && service.statusHistory.length) {
    return service.statusHistory.map((item) => ({
      id: item.id || uid(),
      date: item.date || toIsoDate(new Date(item.at || service.createdAt || new Date())),
      status: item.status || service.status || "Yeni Kayıt",
      technician: item.technician || service.technician || "",
      description: item.description || item.text || "",
      createdAt: item.createdAt || item.at || new Date().toISOString(),
    }));
  }

  return [{
    id: uid(),
    date: toIsoDate(new Date(service.createdAt || new Date())),
    status: service.status || "Yeni Kayıt",
    sortOrder: Number.isFinite(Number(service.sortOrder)) ? Number(service.sortOrder) : index,
    technician: service.technician || "",
    description: "İlk kayıt",
    createdAt: service.createdAt || new Date().toISOString(),
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
  if (!cloudRef || !cloudReady || cloudApplyingState) return;
  cloudRef.set({
    updatedAt: new Date().toISOString(),
    state,
  }).catch(() => {
    console.warn("Firebase kaydı yapılamadı, yerel kayıt korundu.");
  });
}

function initCloudSync() {
  if (!window.firebase?.database) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    cloudRef = firebase.database().ref(CLOUD_STATE_PATH);
    cloudRef.on("value", (snapshot) => {
      const data = snapshot.val();
      cloudReady = true;

      if (data?.state) {
        const openDetailId = detailDialog.open ? activeDetailId : null;
        cloudApplyingState = true;
        state = migrateState(data.state);
        activeDetailId = openDetailId && state.services.some((service) => service.id === openDetailId) ? openDetailId : null;
        activeDashboardStat = "";
        activeDashboardSource = "";
        saveLocalState();
        cloudApplyingState = false;
        render();
      } else if (!cloudInitialHandled) {
        saveState();
      }

      cloudInitialHandled = true;
    }, () => {
      cloudReady = false;
      console.warn("Firebase bağlantısı kurulamadı, yerel kayıtla devam ediliyor.");
    });
  } catch (error) {
    cloudReady = false;
    console.warn("Firebase başlatılamadı, yerel kayıtla devam ediliyor.");
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
    if (action === "print" || action === "print-list") window.print();
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
      topStatusFilter.value = button.dataset.status || "";
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
  select.innerHTML = "";
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = ["Marka", "Cihaz Türü", "Servis Durumu", "Servis Kaynağı", "Tüm İller", "Tüm Kaynaklar", "Tüm Durumlar"].includes(option) ? "" : option;
    item.textContent = option;
    select.append(item);
  });
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

function setDefaultDates() {
  if (cashStartDate) cashStartDate.value = isoToday;
  if (cashEndDate) cashEndDate.value = isoToday;
  if (dashboardStartDate && !dashboardStartDate.value) dashboardStartDate.value = isoToday;
  if (dashboardEndDate && !dashboardEndDate.value) dashboardEndDate.value = isoToday;
  syncDashboardDateRangeControls();
}

function resetDashboardDateToToday() {
  if (dashboardStartDate) dashboardStartDate.value = isoToday;
  if (dashboardEndDate) dashboardEndDate.value = isoToday;
  if (dashboardRangeStartPicker) dashboardRangeStartPicker.value = isoToday;
  if (dashboardRangeEndPicker) dashboardRangeEndPicker.value = isoToday;
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
  if (isSourcePortal() && !["dashboard", "cash", "services"].includes(view)) view = "dashboard";
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
  const counters = settingsList("dashboardCounters");
  document.querySelector("#dashboardCounters").innerHTML = counters.length ? counters.map((label) => `
    <article class="stat-box is-clickable ${dashboardCounterClass(label)}" data-action="dashboard-stat" data-stat="${escapeAttr(label)}">
      <span>${escapeHtml(label)}</span>
      <b>${dashboardCounterCount(label, services)}</b>
    </article>
  `).join("") : `<p class="empty">Sayaç bulunamadı.</p>`;
}

function dashboardCounterClass(label) {
  if (isStatus(label, "Bugün")) return "stat-today";
  if (isStatus(label, "Yarın")) return "stat-tomorrow";
  if (isStatus(label, "Açık Fişler")) return "stat-open";
  if (isStatus(label, "İşlem Tamam")) return "stat-complete";
  if (isStatus(label, "Yeni Kayıt")) return "stat-new";
  if (isStatus(label, "İşlemde")) return "stat-process";
  return "stat-neutral";
}

function dashboardCounterBaseServices(label, services) {
  // V3.6.1: Yarın ve Açık Fişler sayaçları ana sayfa tarih aralığına takılmasın.
  // Yarın her zaman bugünden yarının açık fişlerini, Açık Fişler ise tüm açık fişleri sayar.
  if (isStatus(label, "Yarın") || isStatus(label, "Açık Fişler")) {
    return (state.services || []).filter((service) => matchesPortalSource(service.source)
      && (!activeDashboardSource || sourceMatches(service.source, activeDashboardSource)));
  }
  return services || [];
}

function dashboardCounterCount(label, services) {
  return dashboardCounterBaseServices(label, services).filter((service) => matchesDashboardCounter(service, label)).length;
}

function renderServices() {
  let services = sortServices(filteredServices());
  const list = document.querySelector("#serviceList");
  if (list) list.innerHTML = services.length
    ? services.map(serviceRow).join("")
    : `<p class="empty v420-empty">Servis kaydı bulunamadı.</p>`;
  const resultCount = document.querySelector("#resultCount");
  if (resultCount) resultCount.textContent = services.length;
  renderServiceQuickStats(services);
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

function filteredServices() {
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
      && (!statusFilter || service.status === statusFilter)
      && dateInRange(serviceMainDate(service), range.start, range.end)
      && (!sourceFilter || sourceMatches(service.source, sourceFilter))
      && (!activeDashboardSource || sourceMatches(service.source, activeDashboardSource))
      && matchesDashboardStat(service);
  });
}

function applyDashboardStatFilter(stat) {
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
  if (isStatus(activeDashboardStat, "Yarın")) {
    const value = toIsoDate(tomorrow);
    return { start: value, end: value };
  }
  if (isStatus(activeDashboardStat, "Açık Fişler")) return { start: "", end: "" };
  return { start: dashboardStartDate?.value || "", end: dashboardEndDate?.value || (dashboardStartDate?.value || "") };
}

function dashboardCounterClickRange(stat) {
  if (isStatus(stat, "Yarın")) {
    const value = toIsoDate(tomorrow);
    return { start: value, end: value };
  }
  if (isStatus(stat, "Bugün")) return { start: isoToday, end: isoToday };
  if (isStatus(stat, "Açık Fişler")) return { start: "", end: "" };
  return null;
}

function matchesDashboardStat(service) {
  if (!activeDashboardStat) return true;
  return matchesDashboardCounter(service, activeDashboardStat);
}

function matchesDashboardCounter(service, label) {
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
  document.querySelector("#sourceList").innerHTML = settingsList("sources").map((source) => `
    <div class="data-row">
      <strong>${escapeHtml(source)}</strong>
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
    remainingPayment: hakedis - manualExpense - sourceCollectedReceivable + manualIncome,
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
        <div><span>Manuel yapılan ödeme</span><b class="cash-negative">-${money(totals.manualExpense)}</b></div>
        <div><span>Manuel geri giriş / düzeltme</span><b>${money(totals.manualIncome)}</b></div>
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

function renderSettings() {
  const form = document.querySelector("#settingsForm");
  Object.entries(state.company).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value || "";
  });
  renderSettingsLists();
}

function renderSettingsLists() {
  const container = document.querySelector("#settingsLists");
  container.innerHTML = Object.entries(settingsLabels).map(([key, label]) => `
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

function openServiceForm(service) {
  if (isSourcePortal() && service) return;
  serviceForm.reset();
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
  state.services = state.services.filter((service) => service.id !== id);
  state.cash = state.cash.filter((item) => item.serviceId !== id);
  saveState();
  serviceDialog.close();
  if (detailDialog.open) detailDialog.close();
  render();
}

function openDetail(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  activeDetailId = id;
  renderDetail(id);
  detailDialog.showModal();
}

function renderDetail(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service || !matchesPortalSource(service.source)) return;
  document.querySelector("#detailTitle").textContent = ``;
  const linkedCash = state.cash.filter((item) => item.serviceId === service.id);
  const cleanPhone = digits(service.phone);
  const addressText = [service.city, service.district, service.address].filter(Boolean).join(" ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
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
    <div class="v412-detail">
      <div class="v412-grid v412-top-grid">
        <section class="v412-card">
          <h3><span class="v412-section-icon">●</span> Müşteri Bilgileri</h3>
          <dl>
            <dt>İsim Soyisim</dt><dd>${escapeHtml(service.customerName || "-")}</dd>
            <dt>Telefon</dt><dd>${escapeHtml(service.phone || "-")} ${cleanPhone ? `<a class="v412-inline-phone" href="tel:${cleanPhone}" title="Ara">☎</a>` : ""}</dd>
            <dt>Adres</dt><dd>${escapeHtml(addressText || service.address || "-")}</dd>
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
  detailBody.querySelector("[data-print-service]")?.addEventListener("click", () => window.print(), { once: true });
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
  completeForm.elements.commissionRate.value = "50";
  if (completeForm.elements.collectedBy) completeForm.elements.collectedBy.value = "me";
  completeForm.elements.source.value = service.source || "";
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
  const commissionRate = Number(data.commissionRate) || 0;
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
  sourceDialog.querySelector("[data-action='delete-source']").style.visibility = "hidden";
  document.querySelector("#sourceDialogTitle").textContent = "Kaynak Ekle";
  if (name) {
    sourceForm.elements.oldName.value = name;
    sourceForm.elements.name.value = name;
    if (sourceForm.elements.phone) sourceForm.elements.phone.value = sourcePhone(name);
    sourceDialog.querySelector("[data-action='delete-source']").dataset.sourceName = name;
    sourceDialog.querySelector("[data-action='delete-source']").style.visibility = "visible";
    document.querySelector("#sourceDialogTitle").textContent = "Kaynak Düzenle";
  }
  sourceDialog.showModal();
}

function saveSource(formData) {
  const data = Object.fromEntries(formData);
  const name = data.name.trim();
  if (!name) return;
  if (!state.settings.sourcePhones) state.settings.sourcePhones = {};
  if (data.oldName) {
    updateSettingItem("sources", data.oldName, name);
    if (data.oldName !== name) delete state.settings.sourcePhones[data.oldName];
  } else addSettingValue("sources", name);
  const phone = (data.phone || "").trim();
  if (phone) state.settings.sourcePhones[name] = phone;
  else delete state.settings.sourcePhones[name];
  saveState();
  sourceDialog.close();
  render();
}

function deleteSource(name) {
  const sourceName = name || sourceForm.elements.oldName.value;
  if (!sourceName || !confirm(`${sourceName} silinsin mi?`)) return;
  removeSettingValue("sources", sourceName);
  if (state.settings.sourcePhones) delete state.settings.sourcePhones[sourceName];
  saveState();
  if (sourceDialog.open) sourceDialog.close();
  render();
}

function addSettingItem(listKey) {
  if (listKey === "cashCounters") return;
  const label = settingsLabels[listKey] || "Ayar";
  const value = prompt(`${label} için yeni kayıt`);
  if (value === null) return;
  addSettingValue(listKey, value.trim());
  saveState();
  render();
}

function editSettingItem(listKey, oldValue) {
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
  if (listKey === "cashCounters") return;
  if (!confirm(`${value} silinsin mi?`)) return;
  removeSettingValue(listKey, value);
  saveState();
  render();
}

function addSettingValue(listKey, value) {
  if (!value) return;
  const list = settingsList(listKey);
  if (!list.includes(value)) state.settings[listKey] = [...list, value];
}

function updateSettingItem(listKey, oldValue, newValue) {
  if (!newValue) return;
  state.settings[listKey] = settingsList(listKey).map((item) => item === oldValue ? newValue : item);
  state.settings[listKey] = uniqueValues(state.settings[listKey]);
  updateExistingRecords(listKey, oldValue, newValue);
}

function removeSettingValue(listKey, value) {
  state.settings[listKey] = settingsList(listKey).filter((item) => item !== value);
  updateExistingRecords(listKey, value, "");
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
      if (listKey === "statuses") {
        service.statusHistory.forEach((item) => {
          if (item.status === oldValue) item.status = newValue;
        });
      }
    });
  }
  if (listKey === "statuses") {
    state.settings.dashboardCounters = settingsList("dashboardCounters")
      .map((item) => item === oldValue ? newValue : item)
      .filter(Boolean);
  }
  if (listKey === "sources") {
    state.cash.forEach((item) => {
      if (item.source === oldValue) item.source = newValue;
    });
  }
}

function printCash() {
  document.body.dataset.printMode = "cash";
  window.print();
  setTimeout(() => delete document.body.dataset.printMode, 300);
}

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
  const dates = [service.availableDate, service.visitDate, service.date].filter(Boolean);
  if (!dates.length && service.createdAt) dates.push(toIsoDate(new Date(service.createdAt)));
  return uniqueValues(dates);
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

function sourceKey(source) {
  const value = norm(source);
  // Eski kayıtlarda kaynak boş, farklı büyük/küçük harfli veya "kendi iş" gibi kaydedilmiş olabilir.
  // Bunların hepsi Kendi İşim filtresinde birlikte görünmeli.
  if (!value || value === "kendi işim" || value === "kendi isim" || value === "kendi iş" || value === "kendı işim" || value === "kendim") return "kendi-isim";
  return value;
}

function sourceMatches(actual, expected) {
  return !expected || sourceKey(actual) === sourceKey(expected);
}

function isOwnWorkSource(source) {
  return sourceKey(source) === "kendi-isim";
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
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatServiceCardDay(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long" }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
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
  return [service.city || "Ankara", service.district, service.address].filter(Boolean).join(" ").trim();
}

function mobileMapUrl(service) {
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
  return isStatus(service.status, "İşlem Tamam") || isClosed(service.status);
}

function mobileIsRemainingService(service) {
  return !mobileIsDoneService(service) && statusGroup(service.status) !== "danger";
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
  const root = document.querySelector("#mobileTechApp");
  if (!root) return;
  const counts = mobileServiceCounts();
  const currentCount = counts[mobileTechFilter] ?? counts.remaining;
  const filterLabel = mobileTechFilter === "new" ? "Yeni" : mobileTechFilter === "done" ? "Biten" : "Kalan";

  const summary = document.querySelector("#mobileTechSummary");
  if (summary) summary.textContent = `${filterLabel} · ${currentCount} servis`;
  document.querySelector("#mobileCountRemaining").textContent = counts.remaining;
  const newCounter = document.querySelector("#mobileCountNew");
  if (newCounter) newCounter.textContent = counts.new;
  document.querySelector("#mobileCountDone").textContent = counts.done;
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


function mobileRenderDailyCash() {
  const date = mobileSelectedDate || isoToday;
  const items = (state.cash || []).filter((item) => cashIsPosted(item) && matchesPortalSource(cashItemSource(item)) && (item.date || "") === date);
  const totals = cashBreakdown(items);
  const serviceTotals = serviceOnlyCashBreakdown(items);
  const profit = serviceTotals.income - serviceTotals.commission - serviceTotals.material;
  const setText = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
  setText("#mobileDailyPageIncome", money(totals.income));
  setText("#mobileDailyPageCommission", money(totals.commission));
  setText("#mobileDailyPageMaterial", money(totals.material));
  setText("#mobileDailyPageExpense", money(totals.manualExpense));
  setText("#mobileDailyPageProfit", money(profit));
  const dateLabel = date === isoToday ? `Bugün · ${formatDisplayDate(date)}` : formatDisplayDate(date);
  setText("#mobileDailyCashPageDate", dateLabel);
}

function mobileOpenDailyCashPage() {
  mobileRenderDailyCash();
  mobileSetCashMode(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mobileCloseDailyCashPage() {
  mobileSetCashMode(false);
  mobileRenderTechPanel();
}

function mobileServiceCard(service) {
  const dateValue = service.availableDate || service.visitDate || service.createdAt?.slice(0, 10) || "";
  const timeValue = (service.availableTime || service.createdAt?.slice(11, 16) || "").replace("Saat yok", "");
  const phoneClean = digits(service.phone);
  const phoneHref = phoneClean ? `tel:${phoneClean}` : "#";
  const whatsappHref = phoneClean ? `https://wa.me/90${phoneClean.replace(/^0/, "")}` : "#";
  const mapHref = mobileMapUrl(service);
  const bucket = mobileStatusBucket(service.status);
  const deviceTitle = [service.brand, service.device].filter(Boolean).join(" ") || "Cihaz bilgisi yok";
  const paymentModeLabel = servicePaymentModeLabel(service);
  return `
    <article class="mobile-service-card mobile-status-${bucket}" data-mobile-service-id="${escapeAttr(service.id)}">
      <div class="mobile-card-top" data-mobile-action="open-detail" data-service-id="${escapeAttr(service.id)}">
        <div class="mobile-date">
          <b>${escapeHtml(formatServiceCardDate(dateValue))}</b>
          <span>${escapeHtml(timeValue || formatServiceCardDay(dateValue))}</span>
        </div>
        <span class="mobile-status-pill">${escapeHtml(service.status || "Durum yok")}${paymentModeLabel ? ` · ${escapeHtml(paymentModeLabel)}` : ""}</span>
      </div>
      <div data-mobile-action="open-detail" data-service-id="${escapeAttr(service.id)}">
        <div class="mobile-device">${escapeHtml(deviceTitle)}</div>
        <div class="mobile-customer">${escapeHtml(service.customerName || "İsimsiz Müşteri")}</div>
        <div class="mobile-address">${escapeHtml(service.address || "Adres girilmedi")}</div>
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
  document.querySelector("#mobileDetailSheet")?.removeAttribute("hidden");
}

function mobileCloseDetail() {
  mobileActiveServiceId = "";
  document.querySelector("#mobileDetailSheet")?.setAttribute("hidden", "");
}

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

    <div class="mobile-detail-actions mobile-detail-actions-six">
      <a href="${phoneHref}">📞<b>Ara</b></a>
      <a href="${whatsappHref}" target="_blank" rel="noopener">💬<b>WhatsApp</b></a>
      <a href="${mapHref || '#'}" target="_blank" rel="noopener">🗺️<b>Harita</b></a>
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

    <footer class="mobile-sheet-footer">
      <button class="mobile-delay-btn" type="button" data-mobile-action="delay-service" data-service-id="${escapeAttr(service.id)}">Ertele</button>
      <button class="mobile-close-btn" type="button" data-mobile-action="finish-service" data-service-id="${escapeAttr(service.id)}">Fişi Kapat</button>
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
  setTimeout(() => completeForm?.elements?.amount?.focus({ preventScroll: true }), 80);
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
  mobileSelectedDate = nextDate;
  mobileSaveWorkNote(serviceId);
  saveState();
  mobileCloseDetail();
  render();
}


const mobileNewServiceSteps = [
  { key: "customerName", label: "İsim Soyisim", type: "text", placeholder: "Müşteri adı soyadı", required: true },
  { key: "phone", label: "Telefon", type: "tel", placeholder: "05xx xxx xx xx", required: true },
  { key: "address", label: "Adres", type: "textarea", placeholder: "Mahalle, sokak, bina, daire", required: true },
  { key: "fault", label: "Şikayet", type: "textarea", placeholder: "Örn: çalışmıyor, su akıtıyor", required: true },
  { key: "device", label: "Cihaz Türü", type: "select", optionsKey: "devices", required: true },
  { key: "brand", label: "Marka", type: "select", optionsKey: "brands", required: true },
  { key: "model", label: "Model", type: "text", placeholder: "Varsa model yaz", required: false },
];
let mobileNewServiceData = {};
let mobileNewServiceIndex = 0;

function openMobileNewServiceWizard() {
  mobileNewServiceData = { availableDate: mobileSelectedDate || isoToday, source: "Kendi İşim" };
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

function closeMobileNewServiceWizard() {
  document.querySelector("#mobileNewServiceWizard")?.setAttribute("hidden", "");
}

function renderMobileNewServiceStep() {
  const overlay = document.querySelector("#mobileNewServiceWizard");
  if (!overlay) return;
  const step = mobileNewServiceSteps[mobileNewServiceIndex];
  const progress = `${mobileNewServiceIndex + 1}/${mobileNewServiceSteps.length}`;
  const value = mobileNewServiceData[step.key] || "";
  let field = "";
  if (step.type === "textarea") {
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
  if (step.required && !value) {
    alert(`${step.label} boş kalmasın.`);
    return;
  }
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
    address: mobileNewServiceData.address || "",
    fault: mobileNewServiceData.fault || "",
    device: mobileNewServiceData.device || "",
    brand: mobileNewServiceData.brand || "",
    model: mobileNewServiceData.model || "",
    source: mobileNewServiceData.source || "Kendi İşim",
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
    render();
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
  const VERSION = "V5.2.0 Beta 2";
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
    return !source || sourceMatches(service.source, source);
  }

  function fillMobileSourcePickerSafe() {
    const picker = document.querySelector("#mobileSourcePicker");
    if (!picker) return;
    const previous = mobileSelectedSource || picker.value || "";
    const names = settingsList("sources").filter(Boolean);
    picker.innerHTML = `<option value="">Tüm Kaynaklar</option>${names.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("")}`;
    picker.value = names.includes(previous) ? previous : "";
    mobileSelectedSource = picker.value;
  }

  function isDoneSafe(service) {
    return isStatus(service.status, "İşlem Tamam") || isClosed(service.status);
  }

  function isRemainingSafe(service) {
    return !isDoneSafe(service) && statusGroup(service.status) !== "danger";
  }

  function servicesForMobile(filter, date) {
    const source = selectedSource();
    let list = sortServices(state.services || []).filter((service) => serviceMatchesDateSafe(service, date) && serviceMatchesSourceSafe(service, source));
    if (filter === "done") list = list.filter(isDoneSafe);
    else if (filter === "new") list = list.filter((service) => isStatus(service.status, "Yeni Kayıt"));
    else list = list.filter(isRemainingSafe);
    return list;
  }

  function countsForMobile(date) {
    const source = selectedSource();
    const list = sortServices(state.services || []).filter((service) => serviceMatchesDateSafe(service, date) && serviceMatchesSourceSafe(service, source));
    return {
      remaining: list.filter(isRemainingSafe).length,
      done: list.filter(isDoneSafe).length,
      new: list.filter((service) => isStatus(service.status, "Yeni Kayıt")).length,
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

    const services = servicesForMobile(mobileTechFilter || "remaining", date);
    if (list) {
      list.innerHTML = services.length
        ? services.map(mobileServiceCard).join("")
        : `<div class="mobile-empty">Bu tarih için ${mobileTechFilter === "done" ? "biten" : "kalan"} servis yok.</div>`;
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
    mobileSelectedDate = picker.value || isoToday;
    renderMobileServicesStable();
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
  completeForm.elements.workNote.value = existingNote?.text || "";
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
  const commissionRate = Number(data.commissionRate) || 0;
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
    source: data.source || service.source || "",
    serviceId: service.id,
  };

  state.cash = state.cash.filter((item) => item.id !== cashItem.id && item.parentCashId !== cashItem.id);
  state.cash.unshift(cashItem);
  syncSettlementCash(cashItem);

  service.status = serviceStatusForPaymentMode(paymentMode);
  service.paymentStatus = paymentMode === "Tahsilat Yapıldı" && amount > 0 ? "Ödendi" : paymentMode;
  service.price = amount;
  service.source = data.source || service.source || "";
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
  const lastClose = service.statusHistory.find((item) => (isStatus(item.status, "İşlem Tamam") || isStatus(item.status, "Ödeme Bekliyor")) && String(item.description || "").includes("Fiş kapatıldı"));
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
  completeDialog.close();
  render();
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

function openMobileCloseServiceWizard(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  mobileCloseServiceData = mobileCloseExistingData(service);
  mobileCloseServiceIndex = 0;
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
  const step = mobileCloseServiceSteps[mobileCloseServiceIndex];
  const progress = `${mobileCloseServiceIndex + 1}/${mobileCloseServiceSteps.length}`;
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
        <button type="button" class="secondary" data-mobile-close-wizard="back" ${mobileCloseServiceIndex === 0 ? "disabled" : ""}>Geri</button>
        <button type="button" class="primary" data-mobile-close-wizard="next">${mobileCloseServiceIndex === mobileCloseServiceSteps.length - 1 ? "Fişi Kapat" : "İleri"}</button>
      </footer>
    </section>`;
  setTimeout(() => document.querySelector("#mobileCloseWizardField")?.focus({ preventScroll: true }), 60);
}

function saveMobileCloseCurrentStep() {
  const step = mobileCloseServiceSteps[mobileCloseServiceIndex];
  const field = document.querySelector("#mobileCloseWizardField");
  if (!step || !field) return false;
  const value = String(field.value ?? "").trim();
  if (step.required && value === "") {
    alert(`${step.label} zorunlu.`);
    field.focus({ preventScroll: true });
    return false;
  }
  mobileCloseServiceData[step.key] = value;
  return true;
}

function finishMobileCloseServiceWizard() {
  const fd = new FormData();
  ["serviceId", "paymentMode", "type", "amount", "collectedBy", "materialCost", "otherExpense", "commissionRate", "source", "workNote"].forEach((key) => {
    fd.append(key, key === "type" ? "income" : (mobileCloseServiceData[key] ?? ""));
  });
  closeMobileCloseServiceWizard();
  mobileCloseDetail();
  completeServiceFromForm(fd);
}

document.addEventListener("click", function(event) {
  const action = event.target.closest("[data-mobile-close-wizard]")?.dataset.mobileCloseWizard;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (action === "close") return closeMobileCloseServiceWizard();
  if (action === "back") {
    if (!saveMobileCloseCurrentStep()) return;
    mobileCloseServiceIndex = Math.max(0, mobileCloseServiceIndex - 1);
    renderMobileCloseServiceStep();
    return;
  }
  if (action === "next") {
    if (!saveMobileCloseCurrentStep()) return;
    if (mobileCloseServiceIndex >= mobileCloseServiceSteps.length - 1) return finishMobileCloseServiceWizard();
    mobileCloseServiceIndex += 1;
    renderMobileCloseServiceStep();
  }
});

// Mobilde fişi kapat butonu artık masaüstü formunu değil, soru-soru kapanış sihirbazını açar.
mobileFinishService = function mobileFinishServiceV364(serviceId) {
  const service = state.services.find((item) => item.id === serviceId);
  if (!service) return;
  openMobileCloseServiceWizard(serviceId);
};


/* V5.1.1 - Mobil açık/kapalı fiş listesi tek kaynaklı kesin yapı */
(function setupMobileOpenClosedV511() {
  const VERSION = "V5.2.0 Beta 2";
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
    return [service.availableDate, service.visitDate, service.date, service.createdAt]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
  }

  function matchesDate(service) {
    return serviceDateCandidates(service).includes(selectedDate);
  }

  function matchesSource(service) {
    const source = selectedSource();
    return !source || sourceMatches(service.source, source);
  }

  function isOpenService(service) {
    return isStatus(service.status, "Yeni Kayıt") || isStatus(service.status, "İşlemde");
  }

  function isClosedService(service) {
    return isStatus(service.status, "İşlem Tamam") || isStatus(service.status, "İptal");
  }

  function recordsFor(bucket) {
    const rows = sortServices(state.services || []).filter((service) => matchesSource(service) && matchesDate(service));
    return bucket === "closed" ? rows.filter(isClosedService) : rows.filter(isOpenService);
  }

  function formattedDate() {
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

    const openRows = recordsFor("open");
    const closedRows = recordsFor("closed");
    const visibleRows = activeBucket === "closed" ? closedRows : openRows;

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

    const bucketLabel = activeBucket === "closed" ? "Kapalı Fişler" : "Açık Fişler";
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
        : `<div class="mobile-empty">${formattedDate()} için ${bucketLabel.toLocaleLowerCase("tr-TR")} bulunmuyor.</div>`;
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
      selectedDate = isoToday;
      const picker = document.querySelector("#mobileDatePicker");
      if (picker) picker.value = isoToday;
      settle(false);
    }
  }, true);

  document.addEventListener("input", (event) => {
    if (!event.target.matches("#mobileDatePicker")) return;
    event.stopImmediatePropagation();
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
    return [service.availableDate, service.visitDate, service.date, service.createdAt]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 10));
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
      const dateMatch = serviceDates(service).includes(date);
      const sourceMatch = !source || sourceMatches(service.source, source);
      return dateMatch && sourceMatch;
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
    const openRows = rows.filter((service) => !isClosedWelcomeService(service));
    const closedRows = rows.filter(isClosedWelcomeService);
    const openEl = document.querySelector("#mobileWelcomeOpenCount");
    const closedEl = document.querySelector("#mobileWelcomeClosedCount");
    const textEl = document.querySelector("#mobileWelcomeDateText");
    const dateDisplayEl = document.querySelector("#mobileWelcomeDateDisplay");
    const listDateEl = document.querySelector("#mobileListPageDate");
    if (openEl) openEl.textContent = String(openRows.length);
    if (closedEl) closedEl.textContent = String(closedRows.length);

    const source = selectedSourceValue();
    const cashItems = (state.cash || []).filter((item) => {
      const itemDate = String(item.date || "").slice(0, 10);
      const itemSource = cashItemSource(item);
      return cashIsPosted(item)
        && matchesPortalSource(itemSource)
        && (!source || sourceMatches(itemSource, source))
        && itemDate === selectedDate();
    });
    const serviceTotals = serviceOnlyCashBreakdown(cashItems);
    const income = Number(serviceTotals.income || 0);
    const earning = income - Number(serviceTotals.commission || 0) - Number(serviceTotals.material || 0);
    const incomeEl = document.querySelector("#mobileWelcomeIncome");
    const earningEl = document.querySelector("#mobileWelcomeEarning");
    if (incomeEl) incomeEl.textContent = money(income);
    if (earningEl) earningEl.textContent = money(earning);

    if (textEl) textEl.textContent = formatWelcomeSummary(selectedDate());
    if (dateDisplayEl) {
      dateDisplayEl.innerHTML = `<span class="mobile-welcome-date-line">${formatWelcomeDate(selectedDate())}</span><span class="mobile-welcome-day-line">${formatWelcomeDay(selectedDate())}</span>`;
    }
    if (listDateEl) listDateEl.textContent = selectedDate() === todayIso() ? "Bugün" : formatWelcomeDate(selectedDate());
  }

  function syncExistingMobile() {
    const picker = dateInput();
    if (!picker) return;
    mobileSelectedDate = selectedDate();
    picker.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof window.ekzenMobileOpenClosedV511 === "function") window.ekzenMobileOpenClosedV511(false);
    updateWelcome();
  }

  function showHome(resetToday = true) {
    if (resetToday) {
      const picker = dateInput();
      if (picker) picker.value = todayIso();
      mobileSelectedDate = todayIso();
    }
    root.classList.remove("is-list-mode", "is-cash-mode");
    root.classList.add("is-welcome-mode");
    const cashPage = document.querySelector("#mobileDailyCashPage");
    const serviceList = document.querySelector("#mobileServiceList");
    const globalNewButton = document.querySelector("#mobileTechApp > .mobile-new-service-bar");
    if (cashPage) cashPage.hidden = true;
    if (serviceList) {
      serviceList.hidden = true;
      serviceList.style.setProperty("display", "none", "important");
    }
    if (globalNewButton) {
      globalNewButton.hidden = true;
      globalNewButton.style.setProperty("display", "none", "important");
    }
    syncExistingMobile();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showList(bucket) {
    root.classList.remove("is-welcome-mode", "is-cash-mode");
    root.classList.add("is-list-mode");
    const serviceList = document.querySelector("#mobileServiceList");
    const globalNewButton = document.querySelector("#mobileTechApp > .mobile-new-service-bar");
    if (serviceList) {
      serviceList.hidden = false;
      serviceList.style.removeProperty("display");
    }
    if (globalNewButton) {
      globalNewButton.hidden = false;
      globalNewButton.style.removeProperty("display");
    }
    const tab = document.querySelector(`#mobileTechApp [data-mobile-bucket="${bucket}"]`);
    if (tab) tab.click();
    updateWelcome();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function showCash() {
    root.classList.remove("is-welcome-mode", "is-list-mode");
    root.classList.add("is-cash-mode");
    const openCash = document.querySelector('#mobileTechApp [data-mobile-action="open-daily-cash"]');
    if (openCash) openCash.click();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  document.addEventListener("click", (event) => {
    const counter = event.target.closest("#mobileWelcomePage [data-welcome-target]");
    if (counter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showList(counter.dataset.welcomeTarget === "closed" ? "closed" : "open");
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
