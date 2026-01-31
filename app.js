/* Cuaderno de Datos (GitHub Pages / LocalStorage)
   - Categorías (páginas)
   - Agregar/editar/borrar datos
   - Buscar global
   - Exportar/Importar JSON
*/

const STORAGE_KEY = "crush_book_v1";

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

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);

    // Migraciones simples
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

function saveData() {
  state.data.updatedAt = nowISO();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
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
  data: loadData(),
  route: { page: "overview", categoryId: null },
  search: "",
  editingItem: null, // {categoryId, itemId}
};

/* ---------- Rendering ---------- */

function renderSidebar() {
  const list = document.querySelector("#categoryList");
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
  if (hash.startsWith("#/overview")) document.querySelector("#linkOverview").classList.add("active");
  else if (hash.startsWith("#/all")) document.querySelector("#linkAll").classList.add("active");
  else if (hash.startsWith("#/cat/")) {
    const catId = hash.split("/")[2];
    const link = document.querySelector(`.navlink[data-cat-id="${catId}"]`);
    if (link) link.classList.add("active");
  }
}

function renderCategorySelect() {
  const sel = document.querySelector("#itemCategory");
  sel.innerHTML = "";

  for (const c of state.data.categories) {
    const opt = el("option");
    opt.value = c.id;
    opt.textContent = `${c.emoji || "📁"} ${c.name}`;
    sel.append(opt);
  }
}

function setPageTitle(text) {
  document.querySelector("#pageTitle").textContent = text;
}

function showEmpty(show) {
  document.querySelector("#emptyState").classList.toggle("hidden", !show);
}

function renderCardsForItems(items, title) {
  const cards = document.querySelector("#cards");
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
  document.querySelector(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  document.querySelector(id).classList.add("hidden");
  document.body.style.overflow = "";
}

function openAddItem(defaultCatId = null) {
  state.editingItem = null;
  document.querySelector("#itemModalTitle").textContent = "Agregar dato";
  document.querySelector("#itemForm").reset();

  renderCategorySelect();
  if (defaultCatId) document.querySelector("#itemCategory").value = defaultCatId;

  openModal("#itemModal");
  document.querySelector("#itemKey").focus();
}

function openEditItem(categoryId, itemId) {
  const c = getCategoryById(categoryId);
  if (!c) return;
  const item = c.items.find(x => x.id === itemId);
  if (!item) return;

  state.editingItem = { categoryId, itemId };
  document.querySelector("#itemModalTitle").textContent = "Editar dato";

  renderCategorySelect();
  document.querySelector("#itemCategory").value = categoryId;
  document.querySelector("#itemKey").value = item.key || "";
  document.querySelector("#itemValue").value = item.value || "";
  document.querySelector("#itemNote").value = item.note || "";

  openModal("#itemModal");
  document.querySelector("#itemKey").focus();
}

function submitItemForm(e) {
  e.preventDefault();

  const categoryId = document.querySelector("#itemCategory").value;
  const key = document.querySelector("#itemKey").value.trim();
  const value = document.querySelector("#itemValue").value.trim();
  const note = document.querySelector("#itemNote").value.trim();

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
  document.querySelector("#catForm").reset();
  document.querySelector("#catEmoji").value = "📁";
  openModal("#catModal");
  document.querySelector("#catName").focus();
}

function submitCategoryForm(e) {
  e.preventDefault();
  const name = document.querySelector("#catName").value.trim();
  let emoji = (document.querySelector("#catEmoji").value || "📁").trim();
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

      const ok = confirm("\u00bfImportar y reemplazar lo actual?\n\nTip: exporta antes por si acaso.");
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
  const ok = confirm("\u00bfBorrar TODO?\n\nEsto no se puede deshacer (a menos que tengas un export).");
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
  document.querySelector("#sidebar").classList.toggle("open");
}

function closeSidebarOnMobile() {
  if (window.matchMedia("(max-width: 880px)").matches) {
    document.querySelector("#sidebar").classList.remove("open");
  }
}

function wireEvents() {
  window.addEventListener("hashchange", () => {
    closeSidebarOnMobile();
    parseRoute();
  });

  document.querySelector("#btnToggleNav").addEventListener("click", toggleSidebar);

  document.querySelector("#btnAddItem").addEventListener("click", () => openAddItem(state.route.categoryId));
  document.querySelector("#btnAddItemEmpty").addEventListener("click", () => openAddItem(state.route.categoryId));

  document.querySelector("#btnAddCategory").addEventListener("click", openAddCategory);

  document.querySelector("#btnCloseItemModal").addEventListener("click", () => closeModal("#itemModal"));
  document.querySelector("#btnCancelItem").addEventListener("click", () => closeModal("#itemModal"));
  document.querySelector("#itemForm").addEventListener("submit", submitItemForm);

  document.querySelector("#btnCloseCatModal").addEventListener("click", () => closeModal("#catModal"));
  document.querySelector("#btnCancelCat").addEventListener("click", () => closeModal("#catModal"));
  document.querySelector("#catForm").addEventListener("submit", submitCategoryForm);

  document.querySelector("#btnTools").addEventListener("click", () => openModal("#toolsModal"));
  document.querySelector("#btnCloseToolsModal").addEventListener("click", () => closeModal("#toolsModal"));

  document.querySelector("#btnExport").addEventListener("click", exportJSON);
  document.querySelector("#importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importJSONFile(file);
    e.target.value = "";
  });
  document.querySelector("#btnWipe").addEventListener("click", wipeAll);

  document.querySelector("#searchInput").addEventListener("input", (e) => {
    state.search = e.target.value || "";
    render();
  });

  // Cerrar modal si tocan fondo oscuro
  ["#itemModal", "#catModal", "#toolsModal"].forEach(id => {
    document.querySelector(id).addEventListener("click", (e) => {
      if (e.target === document.querySelector(id)) closeModal(id);
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
        if (!document.querySelector(id).classList.contains("hidden")) closeModal(id);
      });
      document.querySelector("#sidebar").classList.remove("open");
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
function boot() {
  renderSidebar();
  wireEvents();
  parseRoute();
  registerSW();
}

boot();
