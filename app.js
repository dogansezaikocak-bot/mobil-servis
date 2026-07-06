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
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);

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
    sortOrder: Number.isFinite(Number(service.sortOrder)) ? Number(service.sortOrder) : index,
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
    model: mobileNewServiceData.model || "",
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

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    const action = button?.dataset.action;
    const view = event.target.closest("[data-view]")?.dataset.view;
    const jump = event.target.closest("[data-view-jump]")?.dataset.viewJump;
    const serviceRow = event.target.closest("[data-service-id]");

    if (view) {
      if (view === "services") prepareTodayServiceList();
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
    if (action === "delete-service") deleteCurrentService();
    if (action === "print" || action === "print-list") window.print();
    if (action === "print-cash") printCash();
    if (action === "dashboard-stat") applyDashboardStatFilter(button.dataset.stat);
    if (action === "dashboard-source") applyDashboardSourceFilter(button.dataset.source);
    if (action === "show-open-services") showOpenServicesFromTopbar();
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
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });
  filterForm.elements.query.addEventListener("input", () => {
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });

  sortSelect?.addEventListener("change", renderServices);
  topSourceFilter.addEventListener("change", () => {
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });
  topStatusFilter.addEventListener("change", () => {
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });
  document.querySelector("#serviceDateFilter")?.addEventListener("change", () => {
    activeDashboardStat = "";
    activeDashboardSource = "";
    renderServices();
  });
  cashSourceFilter.addEventListener("change", renderCash);
  cashStartDate.addEventListener("change", renderCash);
  cashEndDate.addEventListener("change", renderCash);
  dashboardStartDate.addEventListener("change", renderDashboard);
  dashboardEndDate.addEventListener("change", renderDashboard);
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
  cashStartDate.value = "";
  cashEndDate.value = "";
  if (dashboardStartDate && !dashboardStartDate.value) dashboardStartDate.value = isoToday;
  if (dashboardEndDate && !dashboardEndDate.value) dashboardEndDate.value = isoToday;
}

function prepareTodayServiceList() {
  activeDashboardStat = "";
  activeDashboardSource = "";
  filterForm?.reset();
  if (topSourceFilter) topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  if (topStatusFilter) topStatusFilter.value = "";
  const serviceDateFilter = document.querySelector("#serviceDateFilter");
  if (serviceDateFilter) serviceDateFilter.value = isoToday;
}

function showOpenServicesFromTopbar() {
  activeDashboardStat = "Kalan İşler";
  activeDashboardSource = "";
  filterForm?.reset();
  if (topSourceFilter) topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  if (topStatusFilter) topStatusFilter.value = "";
  const serviceDateFilter = document.querySelector("#serviceDateFilter");
  if (serviceDateFilter) serviceDateFilter.value = isoToday;
  switchView("services");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.action === "show-open-services"));
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
  renderSettings();
  if (detailDialog.open && activeDetailId) renderDetail(activeDetailId);
}

function renderDashboard() {
  const services = filteredDashboardServices();
  const cashItems = filteredDashboardCash();
  const cashBalanceItems = filteredDashboardCashForBalance();
  document.querySelector("#dashboardTitle").textContent = portalTitle();
  document.querySelector("#dashboardOwnerLine").hidden = isSourcePortal();
  renderSourceMetrics(services, cashItems, cashBalanceItems);
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

function renderSourceMetrics(services, cashItems, cashBalanceItems) {
  const totals = cashBreakdown(cashItems);
  const isSourceFiltered = Boolean(activeDashboardSource);

  if (isSourceFiltered) {
    document.querySelector("#sourceMetrics").innerHTML = `
      <article class="metric-card finance-card income-card">
        <span>Toplam Kazanç</span>
        <b>${money(totals.commission)}</b>
      </article>
      <article class="metric-card finance-card expense-card">
        <span>Yapılan Ödeme</span>
        <b>${money(totals.manualExpense)}</b>
      </article>
      <article class="metric-card finance-card cash-status-card">
        <span>Kalan Ödeme</span>
        <b>${money(totals.commission - totals.manualExpense)}</b>
      </article>
    `;
    return;
  }

  document.querySelector("#sourceMetrics").innerHTML = `
    <article class="metric-card finance-card income-card">
      <span>Toplam Hasılat</span>
      <b>${money(totals.income)}</b>
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
      <b>${money(totals.income - totals.commission - totals.material - totals.manualExpense)}</b>
    </article>
  `;
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
    const profit = totals.income - totals.commission - totals.material - totals.manualExpense;
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

function dashboardCounterCount(label, services) {
  return services.filter((service) => matchesDashboardCounter(service, label)).length;
}

function renderServices() {
  let services = sortServices(filteredServices());
  document.querySelector("#serviceList").innerHTML = services.length
    ? services.map(serviceRow).join("")
    : `<p class="empty">Servis kaydı bulunamadı.</p>`;
  document.querySelector("#resultCount").textContent = `Toplam ${services.length} kayıt`;
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
    const dateFilter = document.querySelector("#serviceDateFilter")?.value || "";
    return matchesPortalSource(service.source)
      && (!query || query.split(" ").every((word) => queryText.includes(word)))
      && (!statusFilter || service.status === statusFilter)
      && (!dateFilter || serviceHasDate(service, dateFilter))
      && (!sourceFilter || service.source === sourceFilter)
      && (!activeDashboardSource || (service.source === activeDashboardSource && isOpenDashboardSourceStatus(service.status)))
      && matchesDashboardStat(service);
  });
}

function applyDashboardStatFilter(stat) {
  activeDashboardStat = stat || "";
  activeDashboardSource = "";
  filterForm.reset();
  topSourceFilter.value = isSourcePortal() ? portalSourceName() : "";
  topStatusFilter.value = "";
  switchView("services");
  renderServices();
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
  const serviceDateFilter = document.querySelector("#serviceDateFilter");
  if (serviceDateFilter) serviceDateFilter.value = "";
  document.querySelectorAll(".service-check").forEach((input) => { input.checked = false; });
  renderServices();
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

function serviceRow(service) {
  const dateValue = service.availableDate || service.visitDate || service.createdAt?.slice(0, 10) || "";
  const timeValue = service.availableTime || service.createdAt?.slice(11, 16) || "Saat yok";
  const phoneClean = String(service.phone || "").replace(/\D/g, "");
  const phoneHref = phoneClean ? `tel:${phoneClean}` : "#";
  return `
    <article class="service-row service-card-row service-card-${serviceCardTheme(service.status)}" data-service-id="${service.id}">
      <div class="service-date-block">
        <span class="service-date-main">${escapeHtml(formatServiceCardDate(dateValue))}</span>
        <span class="service-time-main">${escapeHtml(timeValue)}</span>
        <span class="service-day-main">${escapeHtml(formatServiceCardDay(dateValue))}</span>
        <span class="service-source-main">${escapeHtml(service.source || "Kaynak yok")}</span>
      </div>
      <div class="service-customer-block">
        <p class="service-customer-name">${escapeHtml(service.customerName || "İsimsiz Müşteri")}</p>
        <p class="service-address-line">${escapeHtml(service.address || "Adres girilmedi")}</p>
        <p class="service-phone-line"><a href="${phoneHref}">${escapeHtml(service.phone || "Telefon yok")}</a></p>
      </div>
      <div class="service-device-block">
        <p class="service-device-title">${escapeHtml([service.brand, service.device].filter(Boolean).join(" | ") || "Cihaz bilgisi yok")}</p>
        <p class="service-model-line">${escapeHtml(service.model || "Model bilgisi yok")}</p>
      </div>
      <div class="service-status-block">
        <span class="status-pill ${statusClass(service.status)}">${escapeHtml(service.status || "Durum yok")}</span>
        <p class="service-fault-title">Şikayet:</p>
        <p class="service-fault-text">${escapeHtml(service.fault || "Şikayet yazılmadı")}</p>
      </div>
      <div class="service-order-controls" aria-label="Sıralama">
        <button class="service-order-button" type="button" data-action="move-service-order" data-service-id="${service.id}" data-direction="up" title="Yukarı taşı">↑</button>
        <button class="service-order-button" type="button" data-action="move-service-order" data-service-id="${service.id}" data-direction="down" title="Aşağı taşı">↓</button>
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
      <span>${state.services.filter((service) => service.source === source).length} servis</span>
      <span>${state.cash.filter((item) => cashItemSource(item) === source).length} kasa hareketi</span>
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
  document.querySelector("#cashList").innerHTML = renderCashGroups(items) || `<p class="empty">Para hareketi bulunamadı.</p>`;
}

function renderCashSummary(items, totals, breakdown) {
  const values = {
    income: money(totals.income),
    expense: `-${money(breakdown.manualExpense)}`,
    commission: `-${money(breakdown.commission)}`,
    material: `-${money(breakdown.material)}`,
    balance: money(cashRemainingBalance(items)),
  };
  document.querySelector("#cashSummary").innerHTML = cashCounterList().map((counter) => `
    <article>
      <span>${escapeHtml(counter.label)}</span>
      <b class="${["expense", "commission", "material"].includes(counter.key) ? "cash-negative" : ""}">${values[counter.key] || money(0)}</b>
    </article>
  `).join("");
}

function renderCashGroups(items) {
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

  return [
    ...serviceGroups.map(cashServiceGroup),
    manualItems.length ? `
      <section class="cash-group manual-cash-group">
        <header>
          <div>
            <b>Manuel kasa hareketleri</b>
            <span>Servise bağlı olmayan kayıtlar</span>
          </div>
          ${cashGroupSummary(manualItems)}
        </header>
        <div>${manualItems.map(cashRow).join("")}</div>
      </section>
    ` : "",
  ].join("");
}

function cashServiceGroup(group) {
  const service = state.services.find((item) => item.id === group.serviceId);
  const sortedItems = sortCashGroupItems(group.items);
  return `
    <section class="cash-group">
      <header>
        <div>
          <b>Servis ${escapeHtml(group.serviceId)} · ${escapeHtml(service?.customerName || "Servis kaydı")}</b>
          <span>${escapeHtml(service ? `${service.brand} ${service.device}` : "Bağlı servis")} · ${escapeHtml(service?.source || cashItemSource(group.items[0]) || "-")}</span>
        </div>
        ${cashServiceSummary(sortedItems)}
      </header>
      <div>${sortedItems.map(cashRow).join("")}</div>
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
  return `
    <div class="data-row cash-row ${item.type === "expense" ? "is-expense" : ""}">
      <strong class="cash-row-title">${escapeHtml(title)}${badge ? `<small>${badge}</small>` : ""}</strong>
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
  const start = cashStartDate.value;
  const end = cashEndDate.value;
  return state.cash.filter((item) => {
    const date = item.date || "";
    return cashIsPosted(item)
      && (!source || cashItemSource(item) === source)
      && (!start || date >= start)
      && (!end || date <= end);
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
    && (!activeDashboardSource || service.source === activeDashboardSource)
    && dateInRange(serviceMainDate(service), start, end));
}

function filteredDashboardCash() {
  const start = dashboardStartDate.value;
  const end = dashboardEndDate.value;
  return state.cash.filter((item) => cashIsPosted(item)
    && matchesPortalSource(cashItemSource(item))
    && (!activeDashboardSource || cashItemSource(item) === activeDashboardSource)
    && dateInRange(item.date || "", start, end));
}

function filteredDashboardCashForBalance() {
  const start = dashboardStartDate.value;
  const end = dashboardEndDate.value;
  if (isSourcePortal()) return filteredDashboardCash();
  if (start || end) return filteredDashboardCash();
  const week = currentWeekRange();
  return state.cash.filter((item) => cashIsPosted(item)
    && matchesPortalSource(cashItemSource(item))
    && (!activeDashboardSource || cashItemSource(item) === activeDashboardSource)
    && dateInRange(item.date || "", week.start, week.end));
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
  return (!start || date >= start) && (!end || date <= end);
}

function cashBreakdown(items = state.cash) {
  return postedCashItems(items).reduce((totals, item) => {
    const amount = Number(item.amount) || 0;
    if (item.type === "income") totals.income += amount;
    else if (item.autoCommissionExpense) totals.commission += amount;
    else if (item.autoMaterialExpense) totals.material += amount;
    else totals.manualExpense += amount;
    totals.balance = totals.income - totals.manualExpense - totals.commission - totals.material;
    return totals;
  }, { income: 0, manualExpense: 0, commission: 0, material: 0, balance: 0 });
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
  document.querySelector("#detailTitle").textContent = `Servis Detay (${service.id})`;
  const linkedCash = state.cash.filter((item) => item.serviceId === service.id);
  const cleanPhone = digits(service.phone);
  const addressText = [service.city, service.district, service.address].filter(Boolean).join(" ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
  const whatsappUrl = cleanPhone ? `https://wa.me/9${cleanPhone}` : "#";
  const serviceTotal = linkedCash.filter((item) => item.type === "income").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const serviceExpense = linkedCash.filter((item) => item.type === "expense").reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const serviceBalance = serviceTotal - serviceExpense;

  detailBody.innerHTML = `
    <div class="service-drawer-layout v232-detail-layout">
      <section class="service-drawer-main">
        <div class="drawer-summary-card v232-summary-card">
          <div>
            <span class="drawer-eyebrow">Servis No ${escapeHtml(service.id)}</span>
            <h3>${escapeHtml(service.customerName || "Müşteri")}</h3>
            <p>${escapeHtml(service.brand)} ${escapeHtml(service.device)} · ${escapeHtml(service.fault || "Arıza bilgisi yok")}</p>
          </div>
          <span class="status-pill ${statusClass(service.status)}">${escapeHtml(service.status)}</span>
        </div>

        <div class="v232-primary-grid">
          <section class="detail-section v232-card v232-customer-card">
            <h3>👤 Müşteri Bilgileri ${canEditPortalRecords() ? `<button class="mini-button" type="button" data-edit-service="${service.id}">✎</button>` : ""}</h3>
            <dl>
              <dt>Müşteri</dt><dd>${escapeHtml(service.customerName || "-")}</dd>
              <dt>Telefon</dt><dd>${escapeHtml(service.phone || "-")}</dd>
              <dt>Adres</dt><dd>${escapeHtml(service.address || "-")}</dd>
              <dt>Müsait Zaman</dt><dd>${formatDate(service.availableDate)} - ${escapeHtml(service.availableTime || "-")}</dd>
            </dl>
          </section>

          <section class="detail-section v232-card v232-device-card">
            <h3>🔧 Cihaz Bilgileri ${canEditPortalRecords() ? `<button class="mini-button" type="button" data-edit-service="${service.id}">✎</button>` : ""}</h3>
            <dl>
              <dt>Marka</dt><dd>${escapeHtml(service.brand || "-")}</dd>
              <dt>Cihaz</dt><dd>${escapeHtml(service.device || "-")}</dd>
              <dt>Model</dt><dd>${escapeHtml(service.model || "-")}</dd>
              <dt>Garanti Bitiş</dt><dd>${formatDate(service.warrantyEnd)}</dd>
              <dt>Şikayet</dt><dd class="v232-fault-text">${escapeHtml(service.fault || "-")}</dd>
            </dl>
          </section>
        </div>

        <section class="detail-section wide v232-card v232-finance-card">
          <h3>💰 Finans ${canEditPortalRecords() ? `<button class="primary-button" type="button" data-action="add-cash" data-service-id="${service.id}">Para Ekle</button>` : ""}</h3>
          <div class="drawer-money-strip v232-money-strip">
            <article><span>Tahsilat</span><b>${money(serviceTotal)}</b></article>
            <article><span>Gider</span><b>${money(serviceExpense)}</b></article>
            <article><span>Kalan</span><b>${money(serviceBalance)}</b></article>
          </div>
          <div class="history-list v232-history-list">
            ${linkedCash.map((item) => `
              <div class="history-item">
                <div><b>${escapeHtml(visibleCashTitle(item))}</b><p>${formatDate(item.date)} · ${item.type === "expense" ? "Gider" : "Tahsilat"} · ${money(item.amount)}</p></div>
                ${canEditPortalRecords() ? `<div class="row-actions">
                  <button class="mini-button" type="button" data-action="edit-cash" data-cash-id="${item.id}">✎</button>
                  <button class="mini-button danger" type="button" data-action="delete-cash" data-cash-id="${item.id}">×</button>
                </div>` : ""}
              </div>
            `).join("") || `<p class="empty">Henüz para hareketi yok.</p>`}
          </div>
        </section>

        <div class="v232-secondary-grid">
          <section class="detail-section v232-card">
            <h3>📝 Yapılan İşlemler ${canEditPortalRecords() ? `<button class="primary-button" type="button" data-action="add-note" data-service-id="${service.id}">İşlem Ekle</button>` : ""}</h3>
            <div class="history-list v232-history-list v239-work-list">
              ${service.notes.map((note) => `
                <div class="history-item v239-work-item">
                  <div><b>${formatDateTime(note.createdAt)}</b><p>${escapeHtml(note.text)}</p></div>
                  ${canEditPortalRecords() ? `<div class="row-actions">
                    <button class="mini-button" type="button" data-action="edit-note" data-service-id="${service.id}" data-note-id="${note.id}">✎</button>
                    <button class="mini-button danger" type="button" data-action="delete-note" data-service-id="${service.id}" data-note-id="${note.id}">×</button>
                  </div>` : ""}
                </div>
              `).join("") || `<p class="empty">Yapılan işlem bulunamadı.</p>`}
            </div>
          </section>
        </div>

        <section class="detail-section wide v232-card v232-photo-card">
          <h3>📷 Fotoğraflar ${canEditPortalRecords() ? `<button class="primary-button" type="button" data-action="add-photo" data-service-id="${service.id}">Fotoğraf Ekle / Çek</button>` : ""}</h3>
          ${service.photos.length ? `<div class="photo-grid">${service.photos.map((photo) => `
            <article class="photo-card">
              <img src="${photo.dataUrl}" alt="${escapeHtml(photo.caption || "Servis fotoğrafı")}">
              <footer>
                <b>${escapeHtml(photo.caption || "Fotoğraf")}</b>
                ${canEditPortalRecords() ? `<div class="row-actions">
                  <button class="mini-button" type="button" data-action="edit-photo" data-service-id="${service.id}" data-photo-id="${photo.id}">✎</button>
                  <button class="mini-button danger" type="button" data-action="delete-photo" data-service-id="${service.id}" data-photo-id="${photo.id}">×</button>
                </div>` : ""}
              </footer>
            </article>
          `).join("")}</div>` : `<p class="empty">Fotoğraf bulunamadı.</p>`}
        </section>
      </section>

      <aside class="service-action-rail v232-action-rail">
        <h3>Hızlı İşlemler</h3>
        <a class="drawer-action-button" href="tel:${cleanPhone}">Ara</a>
        <a class="drawer-action-button" href="${whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="drawer-action-button" href="${mapUrl}" target="_blank" rel="noopener">Yol Tarifi</a>
        ${canEditPortalRecords() ? `<button class="drawer-action-button" type="button" data-action="change-status" data-service-id="${service.id}">Durum Değiştir</button>` : ""}
        ${canEditPortalRecords() ? `<button class="drawer-action-button" type="button" data-action="add-cash" data-service-id="${service.id}">Tahsilat / Gider</button>` : ""}
        ${canEditPortalRecords() ? `<button class="drawer-action-button" type="button" data-action="add-note" data-service-id="${service.id}">Not Ekle</button>` : ""}
        ${canEditPortalRecords() ? `<button class="drawer-action-button" type="button" data-action="add-photo" data-service-id="${service.id}">Fotoğraf</button>` : ""}
        ${canEditPortalRecords() ? `<button class="drawer-action-button primary" type="button" data-action="complete-service" data-service-id="${service.id}">Fişi Kapat</button>` : ""}
        ${canEditPortalRecords() ? `<button class="drawer-action-button" type="button" data-edit-service="${service.id}">Servisi Güncelle</button>` : ""}
        <button class="drawer-action-button" type="button" data-action="open-related-service" data-service-id="${service.id}">Tekrar Servis Aç</button>
        <button class="drawer-action-button" type="button" data-print-service>Servis Fişi Yazdır</button>
      </aside>
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
  completeForm.elements.source.value = service.source || "";
  completeForm.elements.workNote.value = "";
  completeDialog.showModal();
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

  const amount = Number(data.amount) || 0;
  const materialCost = Number(data.materialCost) || 0;
  const otherExpense = Number(data.otherExpense) || 0;
  const commissionRate = Number(data.commissionRate) || 0;
  const cashType = data.type === "expense" ? "expense" : "income";
  const closeDate = isoToday;

  const cashItem = {
    id: uid(),
    date: closeDate,
    type: cashType,
    title: data.paymentMode || (cashType === "income" ? "Tahsilat" : "Gider"),
    amount,
    materialCost,
    otherExpense,
    commission50: commissionRate > 0,
    commissionRate,
    source: data.source || service.source || "",
    serviceId: service.id,
  };
  state.cash.unshift(cashItem);

  service.status = "İşlem Tamam";
  service.paymentStatus = amount > 0 && cashType === "income" ? "Ödendi" : (data.paymentMode || "Fiş Kapatıldı");
  if (amount > 0) service.price = amount;
  service.notes.unshift({
    id: uid(),
    text: workNote,
    createdAt: new Date().toISOString(),
    updatedAt: "",
  });
  service.statusHistory.unshift({
    id: uid(),
    date: closeDate,
    status: "İşlem Tamam",
    description: `${data.paymentMode || "Fiş kapatıldı"} - ${workNote}`,
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
      amount: commissionBase * commissionRate / 100,
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
    existing.date = toIsoDate(new Date());
    existing.type = "income";
    existing.title = `Servis tahsilatı ${service.id}`;
    existing.amount = service.price;
    existing.source = service.source || "";
    existing.autoServiceIncome = true;
    return;
  }
  if (shouldHaveIncome && !existing) {
    state.cash.unshift({ id: uid(), serviceId: service.id, source: service.source || "", autoServiceIncome: true, date: toIsoDate(new Date()), type: "income", title: `Servis tahsilatı ${service.id}`, amount: service.price });
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
  return serviceMainDate(service) === isoDate;
}

function serviceMainDate(service) {
  return service.availableDate || (service.createdAt ? toIsoDate(new Date(service.createdAt)) : "");
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

function isOwnWorkSource(source) {
  return norm(source) === norm("Kendi İşim");
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

function mobileFilteredServices() {
  let services = sortServices(state.services || []).filter((service) => serviceHasDate(service, mobileSelectedDate || isoToday));
  if (mobileTechFilter === "new") services = services.filter((service) => isStatus(service.status, "Yeni Kayıt"));
  if (mobileTechFilter === "done") services = services.filter((service) => isStatus(service.status, "İşlem Tamam"));
  if (mobileTechFilter === "remaining") services = services.filter((service) => !isStatus(service.status, "İşlem Tamam") && statusGroup(service.status) !== "danger");
  return services;
}


function mobileOpenMainDatePanel() {
  const picker = document.querySelector("#mobileDatePicker");
  if (!picker) return;
  picker.value = mobileSelectedDate || isoToday;
  picker.focus({ preventScroll: true });
}

function mobileCloseMainDatePanel() {
  // V3.3.13: Ana tarih paneli kaldırıldı; gerçek date input kullanılıyor.
}

function mobileApplyMainDate(value) {
  mobileSelectedDate = value || isoToday;
  mobileRenderTechPanel();
}

function mobileServiceCounts() {
  const services = (state.services || []).filter((service) => serviceHasDate(service, mobileSelectedDate || isoToday));
  return {
    remaining: services.filter((service) => !isStatus(service.status, "İşlem Tamam") && statusGroup(service.status) !== "danger").length,
    new: services.filter((service) => isStatus(service.status, "Yeni Kayıt")).length,
    done: services.filter((service) => isStatus(service.status, "İşlem Tamam")).length,
  };
}

function mobileRenderTechPanel() {
  const root = document.querySelector("#mobileTechApp");
  if (!root) return;
  const owner = state.company?.ownerName || "Doğan Sezai Koçak";
  const counts = mobileServiceCounts();
  const currentCount = counts[mobileTechFilter] ?? counts.remaining;
  const filterLabel = mobileTechFilter === "new" ? "Yeni" : mobileTechFilter === "done" ? "Biten" : "Kalan";

  document.querySelector("#mobileTechName").textContent = owner;
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
  list.innerHTML = services.length ? services.map(mobileServiceCard).join("") : `<div class="mobile-empty">Bu bölümde servis yok.</div>`;

  if (mobileActiveServiceId) mobileRenderDetail(mobileActiveServiceId);
}


function mobileRenderDailyCash() {
  const date = mobileSelectedDate || isoToday;
  const items = (state.cash || []).filter((item) => cashIsPosted(item) && matchesPortalSource(cashItemSource(item)) && (item.date || "") === date);
  const totals = cashBreakdown(items);
  const profit = totals.income - totals.commission - totals.material - totals.manualExpense;
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
  const page = document.querySelector("#mobileDailyCashPage");
  if (!page) return;
  page.hidden = false;
  requestAnimationFrame(() => page.classList.add("is-open"));
}

function mobileCloseDailyCashPage() {
  const page = document.querySelector("#mobileDailyCashPage");
  if (!page) return;
  page.classList.remove("is-open");
  setTimeout(() => { page.hidden = true; }, 180);
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
  return `
    <article class="mobile-service-card mobile-status-${bucket}" data-mobile-service-id="${escapeAttr(service.id)}">
      <div class="mobile-card-top" data-mobile-action="open-detail" data-service-id="${escapeAttr(service.id)}">
        <div class="mobile-date">
          <b>${escapeHtml(formatServiceCardDate(dateValue))}</b>
          <span>${escapeHtml(timeValue || formatServiceCardDay(dateValue))}</span>
        </div>
        <span class="mobile-status-pill">${escapeHtml(service.status || "Durum yok")}</span>
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
      <div class="mobile-detail-box"><h3>Alınan Tutar</h3><p>${escapeHtml(money(incomeTotal || service.price || 0))}</p></div>
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

    ${service.photos?.length ? `<div class="mobile-photo-strip">${service.photos.slice(0, 4).map((photo) => `<img src="${escapeAttr(photo.dataUrl)}" alt="Servis fotoğrafı">`).join("")}</div>` : ""}

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
      mobileTechFilter = filterButton.dataset.mobileFilter || "remaining";
      mobileRenderTechPanel();
      return;
    }
    const mobileAction = event.target.closest("[data-mobile-action]");
    if (!mobileAction) return;
    const action = mobileAction.dataset.mobileAction;
    const serviceId = mobileAction.dataset.serviceId;
    if (action === "open-new-service") {
      openMobileNewServiceWizard();
      return;
    }
    if (action === "open-daily-cash") {
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
