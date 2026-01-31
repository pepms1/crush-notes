/* Cuaderno de Datos (GitHub Pages / LocalStorage)
   - Categorías (páginas)
   - Agregar/editar/borrar datos
   - Buscar global
   - Exportar/Importar JSON
*/

const STORAGE_KEY = "crush_book_v1";

// Password gate constant: change this value to require a different password
// before acceder a la aplicación.
const PASSWORD = "230713";

// Firebase Realtime Database URL (sin barra final). Ejemplo:
// "https://tu-proyecto-default-rtdb.firebaseio.com"
// Si se deja vacío (""), la app solo usará LocalStorage.
// URL de tu base de datos Realtime en Firebase (sin barra final).
// Actualiza esto con la URL de tu base de datos. Ejemplo:
// "https://crush-notes-default-rtdb.firebaseio.com"
const FIREBASE_DB_URL = "https://crush-notes-default-rtdb.firebaseio.com";

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nowISO() {
  return new Date().toISOString();
}

function defaultData() {
  const categories = [
    { id: uid(), emoji: "🍜", name: "Comida", items: [] },
    { id: uid(), emoji: "🎂", name: "Cumpleaños", items: [] },
    { id: uid(), emoji: "🎵", name: "Música", items: [] },
    { id: uid(), emoji: "🎬", name: "Películas/Series", items: [] },
    { id: uid(), emoji: "🎮", name: "Juegos", items: [] },
    { id: uid(), emoji: "🐶", name: "Mascotas", items: [] },
    { id: uid(), emoji: "📍", name: "Lugares", items: [] },
    { id: uid(), emoji: "🎁", name: "Ideas de regalo", items: [] },
  ];

  return {
    version: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    categories,
  };
}

async function loadData() {
  // Intenta cargar desde Firebase si está configurado
  if (FIREBASE_DB_URL) {
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/data.json`);
      if (res.ok) {
        const remote = await res.json();
        // Validar estructura mínima
        if (remote && Array.isArray(remote.categories)) {
          // Normalización de datos remotos
          for (const c of remote.categories) {
            c.id ??= uid();
            c.name ??= "Sin nombre";
            c.emoji ??= "📁";
            c.items ??= [];
            if (!Array.isArray(c.items)) c.items = [];
            for (const it of c.items) {
              it.id ??= uid();
              it.key ??= "";
              it.value ??= "";
              it.note ??= "";
              it.createdAt ??= nowISO();
              it.updatedAt ??= nowISO();
            }
          }
          remote.version ??= 1;
          remote.createdAt ??= nowISO();
          remote.updatedAt ??= nowISO();
          return remote;
        }
      }
    } catch (err) {
      console.error("Error loading data from Firebase", err);
    }
  }
  // Fallback a LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      return defaultData();
    }
    parsed.version ??= 1;
    parsed.updatedAt ??= nowISO();
    return parsed;
  } catch {
    return defaultData();
  }
}

async function saveData() {
  state.data.updatedAt = nowISO();
  // Guardar en LocalStorage como respaldo
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch {}
  // Guardar en Firebase si está configurado
  if (FIREBASE_DB_URL) {
    try {
      await fetch(`${FIREBASE_DB_URL}/data.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.data),
      });
    } catch (err) {
      console.error("Error saving data to Firebase", err);
    }
  }
}

function getCategoryById(id) {
  return state.data.categories.find(c => c.id === id);
}

function allItems() {
  const out = [];
  for (const c of state.data.categories) {
    for (const item of c.items) {
      out.push({ ...item, categoryId: c.id, categoryName: c.name, categoryEmoji: c.emoji });
    }
  }
  // newest first
  out.sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return out;
}

function escapeForDownloadFilename(s) {
  return (s || "cuaderno").replace(/[^\w\-]+/g, "_").slice(0, 50);
}

const state = {
  data: null, // Se establecerá tras la contraseña
  route: { page: "overview", categoryId: null },
  search: "",
  editingItem: null, // {categoryId, itemId}
};

/* ---------- Rendering ---------- */

function renderSidebar() {
  const list = $("#categoryList");
  list.innerHTML = "";

  for (const c of state.data.categories) {
    const a = el("a", "navlink");
    a.href = `#/cat/${c.id}`;
    a.dataset.catId = c.id;
    a.append(document.createTextNode(`${c.emoji || "📁"} ${c.name}`));

    list.append(a);
  }

  highlightActiveNav();
  renderCategorySelect();
}

function highlightActiveNav() {
  document.querySelectorAll(".navlink").forEach(n => n.classList.remove("active"));

  const hash = location.hash || "#/overview";
  if (hash.startsWith("#/overview")) $("#linkOverview").classList.add("active");
  else if (hash.startsWith("#/all")) $("#linkAll").classList.add("active");
  else if (hash.startsWith("#/cat/")) {
    const catId = hash.split("/")[2];
    const link = document.querySelector(`.navlink[data-cat-id="${catId}"]`);
    if (link) link.classList.add("active");
  }
}

function renderCategorySelect() {
  const sel = $("#itemCategory");
  sel.innerHTML = "";

  for (const c of state.data.categories) {
    const opt = el("option");
    opt.value = c.id;
    opt.textContent = `${c.emoji || "📁"} ${c.name}`;
    sel.append(opt);
  }
}

function setPageTitle(text) {
  $("#pageTitle").textContent = text;
}

function showEmpty(show) {
  $("#emptyState").classList.toggle("hidden", !show);
}

function renderCardsForItems(items, title) {
  const cards = $("#cards");
  cards.innerHTML = "";

  setPageTitle(title);

  // Empty state
  const hasAny = items.length > 0;
  showEmpty(!hasAny);
  if (!hasAny) return;

  for (const it of items) {
    const card = el("div", "card");

    const top = el("div", "card__top");
    const badge = el("div", "badge");
    badge.textContent = `${it.categoryEmoji || "📁"} ${it.categoryName}`;
    top.append(badge);

    const meta = el("div");
    meta.style.textAlign = "right";
    meta.style.color = "rgba(148,163,184,.95)";
    meta.style.fontSize = "12px";
    meta.textContent = formatDate(it.updatedAt || it.createdAt);
    top.append(meta);

    card.append(top);

    const kv = el("div", "kv");
    const k = el("div", "kv__k");
    k.textContent = it.key;
    const v = el("div", "kv__v");
    v.textContent = it.value;
    kv.append(k, v);
    card.append(kv);

    if (it.note && it.note.trim()) {
      const note = el("div", "note");
      note.textContent = it.note.trim();
      card.append(note);
    }

    const actions = el("div", "card__actions");
    const editBtn = el("button", "smallbtn");
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => openEditItem(it.categoryId, it.id));

    const delBtn = el("button", "smallbtn smallbtn--danger");
    delBtn.type = "button";
    delBtn.textContent = "Borrar";
    delBtn.addEventListener("click", () => deleteItem(it.categoryId, it.id));

    actions.append(editBtn, delBtn);
    card.append(actions);

    cards.append(card);
  }
}

function renderOverview() {
  const items = allItems();
  const total = items.length;
  const cats = state.data.categories.length;

  const latest = items.slice(0, 10);

  const title = `📌 Resumen — ${total} dato${total === 1 ? "" : "s"} en ${cats} categoría${cats === 1 ? "" : "s"}`;
  renderCardsForItems(latest, title);
}

function renderAll() {
  const items = allItems();
  const filtered = applySearch(items);
  renderCardsForItems(filtered, `🗂️ Todo (${filtered.length})`);
}

function renderCategory(catId) {
  const c = getCategoryById(catId);
  if (!c) {
    location.hash = "#/overview";
    return;
  }
  let items = (c.items || []).map(it => ({
    ...it,
    categoryId: c.id,
    categoryName: c.name,
    categoryEmoji: c.emoji
  }));
  // newest first
  items.sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

  items = applySearch(items);
  renderCardsForItems(items, `${c.emoji || "📁"} ${c.name} (${items.length})`);
}

function applySearch(items) {
  const q = (state.search || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter(it => {
    const hay = `${it.categoryName} ${it.key} ${it.value} ${it.note || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  } catch {
    return "";
  }
}

/* ---------- Router ---------- */

function parseRoute() {
  const hash = location.hash || "#/overview";
  const parts = hash.replace("#/", "").split("/");

  if (parts[0] === "cat" && parts[1]) {
    state.route = { page: "cat", categoryId: parts[1] };
  } else if (parts[0] === "all") {
    state.route = { page: "all", categoryId: null };
  } else {
    state.route = { page: "overview", categoryId: null };
  }
  highlightActiveNav();
  render();
}

function render() {
  if (state.route.page === "overview") renderOverview();
  else if (state.route.page === "all") renderAll();
  else if (state.route.page === "cat") renderCategory(state.route.categoryId);
}

/* ---------- Modales ---------- */

function openModal(id) {
  $(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  $(id).classList.add("hidden");
  document.body.style.overflow = "";
}

function openAddItem(defaultCatId = null) {
  state.editingItem = null;
  $("#itemModalTitle").textContent = "Agregar dato";
  $("#itemForm").reset();

  renderCategorySelect();
  if (defaultCatId) $("#itemCategory").value = defaultCatId;

  openModal("#itemModal");
  $("#itemKey").focus();
}

function openEditItem(categoryId, itemId) {
  const c = getCategoryById(categoryId);
  if (!c) return;
  const item = c.items.find(x => x.id === itemId);
  if (!item) return;

  state.editingItem = { categoryId, itemId };
  $("#itemModalTitle").textContent = "Editar dato";

  renderCategorySelect();
  $("#itemCategory").value = categoryId;
  $("#itemKey").value = item.key || "";
  $("#itemValue").value = item.value || "";
  $("#itemNote").value = item.note || "";

  openModal("#itemModal");
  $("#itemKey").focus();
}

function submitItemForm(e) {
  e.preventDefault();

  const categoryId = $("#itemCategory").value;
  const key = $("#itemKey").value.trim();
  const value = $("#itemValue").value.trim();
  const note = $("#itemNote").value.trim();

  if (!categoryId || !key || !value) return;

  const targetCategory = getCategoryById(categoryId);
  if (!targetCategory) return;

  // Si estaba editando y cambió de categoría: movemos el item
  if (state.editingItem) {
    const { categoryId: oldCatId, itemId } = state.editingItem;
    const oldCat = getCategoryById(oldCatId);
    if (!oldCat) return;

    const idx = oldCat.items.findIndex(x => x.id === itemId);
    if (idx < 0) return;

    const existing = oldCat.items[idx];
    const updated = {
      ...existing,
      key, value, note,
      updatedAt: nowISO(),
    };

    // Remover del viejo
    oldCat.items.splice(idx, 1);

    // Insertar en nuevo
    targetCategory.items.push(updated);

    state.editingItem = null;
    saveData();
    closeModal("#itemModal");
    renderSidebar();
    location.hash = `#/cat/${categoryId}`;
    return;
  }

  // Crear nuevo
  const item = {
    id: uid(),
    key,
    value,
    note,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  targetCategory.items.push(item);
  saveData();
  closeModal("#itemModal");
  renderSidebar();
  location.hash = `#/cat/${categoryId}`;
}

function deleteItem(categoryId, itemId) {
  const c = getCategoryById(categoryId);
  if (!c) return;
  const it = c.items.find(x => x.id === itemId);
  if (!it) return;

  const ok = confirm(`¿Borrar este dato?\n\n${it.key} → ${it.value}`);
  if (!ok) return;

  c.items = c.items.filter(x => x.id !== itemId);
  saveData();
  render();
}

function openAddCategory() {
  $("#catForm").reset();
  $("#catEmoji").value = "📁";
  openModal("#catModal");
  $("#catName").focus();
}

function submitCategoryForm(e) {
  e.preventDefault();
  const name = $("#catName").value.trim();
  let emoji = ($("#catEmoji").value || "📁").trim();
  if (!emoji) emoji = "📁";
  if (!name) return;

  const newCat = { id: uid(), name, emoji, items: [] };
  state.data.categories.push(newCat);
  saveData();
  closeModal("#catModal");
  renderSidebar();
  location.hash = `#/cat/${newCat.id}`;
}

/* ---------- Export / Import / Wipe ---------- */

function exportJSON() {
  const payload = JSON.stringify(state.data, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${escapeForDownloadFilename("cuaderno_datos")}_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.categories)) throw new Error("Formato inválido");

      // Validación suave + normalización
      for (const c of parsed.categories) {
        c.id ??= uid();
        c.name ??= "Sin nombre";
        c.emoji ??= "📁";
        c.items ??= [];
        if (!Array.isArray(c.items)) c.items = [];
        for (const it of c.items) {
          it.id ??= uid();
          it.key ??= "";
          it.value ??= "";
          it.note ??= "";
          it.createdAt ??= nowISO();
          it.updatedAt ??= nowISO();
        }
      }

      const ok = confirm("¿Importar y reemplazar lo actual?\n\nTip: exporta antes por si acaso.");
      if (!ok) return;

      state.data = parsed;
      saveData();
      closeModal("#toolsModal");
      renderSidebar();
      location.hash = "#/overview";
      render();
      alert("✅ Importación lista.");
    } catch (err) {
      alert("No pude importar ese archivo. Asegúrate que sea un JSON exportado por esta app.");
    }
  };
  reader.readAsText(file);
}

function wipeAll() {
  const ok = confirm("¿Borrar TODO?\n\nEsto no se puede deshacer (a menos que tengas un export).");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  state.data = defaultData();
  saveData();
  closeModal("#toolsModal");
  renderSidebar();
  location.hash = "#/overview";
  render();
}

/* ---------- UI wiring ---------- */

function toggleSidebar() {
  $("#sidebar").classList.toggle("open");
}

function closeSidebarOnMobile() {
  if (window.matchMedia("(max-width: 880px)").matches) {
    $("#sidebar").classList.remove("open");
  }
}

function wireEvents() {
  window.addEventListener("hashchange", () => {
    closeSidebarOnMobile();
    parseRoute();
  });

  $("#btnToggleNav").addEventListener("click", toggleSidebar);

  $("#btnAddItem").addEventListener("click", () => openAddItem(state.route.categoryId));
  $("#btnAddItemEmpty").addEventListener("click", () => openAddItem(state.route.categoryId));

  $("#btnAddCategory").addEventListener("click", openAddCategory);

  $("#btnCloseItemModal").addEventListener("click", () => closeModal("#itemModal"));
  $("#btnCancelItem").addEventListener("click", () => closeModal("#itemModal"));
  $("#itemForm").addEventListener("submit", submitItemForm);

  $("#btnCloseCatModal").addEventListener("click", () => closeModal("#catModal"));
  $("#btnCancelCat").addEventListener("click", () => closeModal("#catModal"));
  $("#catForm").addEventListener("submit", submitCategoryForm);

  $("#btnTools").addEventListener("click", () => openModal("#toolsModal"));
  $("#btnCloseToolsModal").addEventListener("click", () => closeModal("#toolsModal"));

  $("#btnExport").addEventListener("click", exportJSON);
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importJSONFile(file);
    e.target.value = "";
  });
  $("#btnWipe").addEventListener("click", wipeAll);

  $("#searchInput").addEventListener("input", (e) => {
    state.search = e.target.value || "";
    render();
  });

  // Cerrar modal si tocan fondo oscuro
  ["#itemModal", "#catModal", "#toolsModal"].forEach(id => {
    $(id).addEventListener("click", (e) => {
      if (e.target === $(id)) closeModal(id);
    });
  });

  // Cerrar sidebar al tocar un link
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#/']");
    if (a) closeSidebarOnMobile();
  });

  // ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ["#itemModal", "#catModal", "#toolsModal"].forEach(id => {
        if (!$(id).classList.contains("hidden")) closeModal(id);
      });
      $("#sidebar").classList.remove("open");
    }
  });
}

/* ---------- Service Worker ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

/* ---------- Boot ---------- */
async function boot() {
  // Asegurarse de tener datos cargados
  if (!state.data) {
    state.data = await loadData();
  }
  renderSidebar();
  wireEvents();
  parseRoute();
  registerSW();
}

/* ---------- Password Gate ---------- */
function initPasswordGate() {
  const gate = $("#passwordGate");
  // Si no existe gate (por ejemplo, pruebas unitarias), saltamos directamente
  if (!gate) {
    (async () => {
      state.data = await loadData();
      boot();
    })();
    return;
  }
  gate.classList.remove("hidden");
  const input = $("#passwordInput");
  const submit = $("#passwordSubmit");
  const error = $("#passwordError");
  submit.addEventListener("click", async () => {
    if (input.value === PASSWORD) {
      gate.remove();
      state.data = await loadData();
      boot();
    } else {
      error.textContent = "Contraseña incorrecta.";
      input.value = "";
      input.focus();
    }
  });
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submit.click();
    }
  });
}

// Iniciar la puerta de contraseña al cargar el script
initPasswordGate();
