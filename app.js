// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyC9a4LaHstX5mfR7ojbJR6-efaQSOrgATM",
  authDomain: "mirror-f753b.firebaseapp.com",
  projectId: "mirror-f753b",
  storageBucket: "mirror-f753b.firebasestorage.app",
  messagingSenderId: "879820402446",
  appId: "1:879820402446:web:b69052c6b4061c06f1b15f",
  measurementId: "G-QC6XWB1GB2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
  user: null,
  notes: {},          // id -> note
  currentNoteId: null,
  filterFolder: null,
  filterTag: null,
  searchQuery: "",
  view: "editor",      // "editor" | "graph"
  unsubscribeNotes: null,
};

// ============================================================
// ELEMENTOS
// ============================================================
const el = {
  authScreen: document.getElementById("auth-screen"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  authToggle: document.getElementById("auth-toggle"),

  app: document.getElementById("app"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  logoutBtn: document.getElementById("logout-btn"),
  searchInput: document.getElementById("search-input"),
  newNoteBtn: document.getElementById("new-note-btn"),
  folderTree: document.getElementById("folder-tree"),
  tagList: document.getElementById("tag-list"),
  notesList: document.getElementById("notes-list"),
  notesListTitle: document.getElementById("notes-list-title"),

  noteTitleInput: document.getElementById("note-title-input"),
  noteFolderInput: document.getElementById("note-folder-input"),
  noteTagsInput: document.getElementById("note-tags-input"),
  deleteNoteBtn: document.getElementById("delete-note-btn"),
  viewEditorBtn: document.getElementById("view-editor-btn"),
  viewGraphBtn: document.getElementById("view-graph-btn"),

  editorView: document.getElementById("editor-view"),
  editorContainer: document.getElementById("editor-container"),
  graphView: document.getElementById("graph-view"),
  graphSvg: document.getElementById("graph-svg"),
  backlinks: document.getElementById("backlinks"),
  emptyState: document.getElementById("empty-state"),
  imageInput: document.getElementById("image-input"),
};

let isRegisterMode = false;

// ============================================================
// AUTENTICAÇÃO
// ============================================================
el.authToggle.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  el.authSubmit.textContent = isRegisterMode ? "Criar conta" : "Entrar";
  el.authToggle.textContent = isRegisterMode ? "Já tem conta? Entrar" : "Ainda não tem conta? Criar conta";
  el.authError.hidden = true;
});

el.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = el.authEmail.value.trim();
  const password = el.authPassword.value;
  el.authError.hidden = true;
  el.authSubmit.disabled = true;
  try {
    if (isRegisterMode) {
      await auth.createUserWithEmailAndPassword(email, password);
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (err) {
    console.error("Erro de autenticação:", err.code, err.message);
    el.authError.textContent = traduzErroAuth(err.code);
    el.authError.hidden = false;
  } finally {
    el.authSubmit.disabled = false;
  }
});

el.logoutBtn.addEventListener("click", () => auth.signOut());

function traduzErroAuth(code) {
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Esse e-mail já tem uma conta.",
    "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres).",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/operation-not-allowed": "Login por e-mail/senha não está ativado no Firebase. Ative em Authentication → Sign-in method.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  };
  return map[code] || "Algo deu errado. Tente novamente.";
}

auth.onAuthStateChanged((user) => {
  state.user = user;
  if (user) {
    el.authScreen.hidden = true;
    el.app.hidden = false;
    listenToNotes(user.uid);
  } else {
    el.authScreen.hidden = false;
    el.app.hidden = true;
    if (state.unsubscribeNotes) state.unsubscribeNotes();
    state.notes = {};
    state.currentNoteId = null;
  }
});

// ============================================================
// UTILITÁRIOS
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || "";
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function findNoteByTitle(title) {
  const norm = (title || "").trim().toLowerCase();
  return Object.values(state.notes).find((n) => (n.title || "").trim().toLowerCase() === norm);
}

// ============================================================
// QUILL — editor de texto rico
// ============================================================
const Font = Quill.import("formats/font");
Font.whitelist = ["sans", "serif", "mono"];
Quill.register(Font, true);

const Embed = Quill.import("blots/embed");
class MentionBlot extends Embed {
  static create(data) {
    const node = super.create();
    node.setAttribute("data-title", data.title);
    node.setAttribute("data-id", data.id || "");
    node.classList.add("mention");
    node.innerText = "@" + data.title;
    return node;
  }
  static value(node) {
    return { title: node.getAttribute("data-title"), id: node.getAttribute("data-id") };
  }
}
MentionBlot.blotName = "mention";
MentionBlot.tagName = "span";
Quill.register(MentionBlot);

const quill = new Quill(el.editorContainer, {
  theme: "snow",
  placeholder: "Escreva aqui… digite @ para linkar outra nota.",
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      [{ font: Font.whitelist }],
      ["bold", "italic", "underline"],
      [{ color: [] }],
      [{ align: [] }],
      ["image"],
      ["clean"],
    ],
  },
});

quill.container.style.position = "relative";

quill.getModule("toolbar").addHandler("image", () => el.imageInput.click());

el.imageInput.addEventListener("change", async () => {
  const file = el.imageInput.files[0];
  el.imageInput.value = "";
  if (!file || !state.currentNoteId) return;
  const range = quill.getSelection(true) || { index: quill.getLength() };
  const placeholderText = "Enviando imagem…";
  quill.insertText(range.index, placeholderText, "italic", true, "user");
  try {
    const path = `images/${state.user.uid}/${Date.now()}_${file.name}`;
    const ref = storage.ref(path);
    const snap = await ref.put(file);
    const url = await snap.ref.getDownloadURL();
    quill.deleteText(range.index, placeholderText.length, "user");
    quill.insertEmbed(range.index, "image", url, "user");
    quill.setSelection(range.index + 1, 0, "user");
  } catch (err) {
    console.error("Erro ao enviar imagem:", err);
    quill.deleteText(range.index, placeholderText.length, "user");
    alert("Não foi possível enviar a imagem. Confira se o Storage está ativado no Firebase.");
  }
});

// ============================================================
// FIRESTORE — SINCRONIZAÇÃO EM TEMPO REAL
// ============================================================
function listenToNotes(uid) {
  if (state.unsubscribeNotes) state.unsubscribeNotes();
  state.unsubscribeNotes = db
    .collection("notes")
    .where("uid", "==", uid)
    .onSnapshot(
      (snapshot) => {
        state.notes = {};
        snapshot.forEach((doc) => (state.notes[doc.id] = { id: doc.id, ...doc.data() }));
        renderSidebar();
        if (state.currentNoteId && state.notes[state.currentNoteId]) {
          renderBacklinks();
        } else if (state.currentNoteId && !state.notes[state.currentNoteId]) {
          openNote(null);
        }
        if (state.view === "graph") renderGraph();
      },
      (err) => console.error("Erro ao sincronizar notas:", err)
    );
}

function createNoteDoc(overrides = {}) {
  const ref = db.collection("notes").doc();
  const data = {
    uid: state.user.uid,
    title: "Nota sem título",
    content: "",
    folder: state.filterFolder || "",
    tags: state.filterTag ? [state.filterTag] : [],
    links: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...overrides,
  };
  ref.set(data);
  return ref.id;
}

function saveCurrentNote(fields) {
  if (!state.currentNoteId) return;
  db.collection("notes")
    .doc(state.currentNoteId)
    .set({ ...fields, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

function deleteNote(id) {
  if (!confirm("Excluir esta nota? Essa ação não pode ser desfeita.")) return;
  db.collection("notes").doc(id).delete();
  if (state.currentNoteId === id) openNote(null);
}

// ============================================================
// AUTOSAVE DO CONTEÚDO + EXTRAÇÃO DE MENÇÕES
// ============================================================
const debouncedSaveContent = debounce(() => {
  const content = quill.root.innerHTML;
  const links = Array.from(quill.root.querySelectorAll("span.mention")).map((n) =>
    n.getAttribute("data-title")
  );
  const uniqueLinks = Array.from(new Set(links));
  saveCurrentNote({ content, links: uniqueLinks });
}, 500);

quill.on("text-change", (delta, oldDelta, source) => {
  if (source !== "user") return;
  debouncedSaveContent();
  handleMentionDetection();
});

quill.on("selection-change", (range, oldRange, source) => {
  if (!mentionState) return;
  if (!range || range.index < mentionState.startIndex) closeMention();
});

const debouncedSaveTitle = debounce((title) => saveCurrentNote({ title: title || "Nota sem título" }), 500);
el.noteTitleInput.addEventListener("input", () => debouncedSaveTitle(el.noteTitleInput.value));

const debouncedSaveFolder = debounce((folder) => saveCurrentNote({ folder }), 500);
el.noteFolderInput.addEventListener("input", () => debouncedSaveFolder(el.noteFolderInput.value.trim()));

const debouncedSaveTags = debounce((tagsStr) => {
  const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
  saveCurrentNote({ tags });
}, 500);
el.noteTagsInput.addEventListener("input", () => debouncedSaveTags(el.noteTagsInput.value));

el.deleteNoteBtn.addEventListener("click", () => {
  if (state.currentNoteId) deleteNote(state.currentNoteId);
});

el.newNoteBtn.addEventListener("click", () => openNote(createNoteDoc({})));

// ============================================================
// MENÇÕES (@) COM AUTOCOMPLETE
// ============================================================
let mentionState = null; // { startIndex }
let mentionSuggestions = [];
let mentionActiveIndex = 0;

const mentionDropdown = document.createElement("div");
mentionDropdown.className = "mention-dropdown";
mentionDropdown.hidden = true;
quill.container.appendChild(mentionDropdown);

function handleMentionDetection() {
  const sel = quill.getSelection();
  if (!sel) return;

  if (mentionState) {
    if (sel.index <= mentionState.startIndex) { closeMention(); return; }
    const query = quill.getText(mentionState.startIndex + 1, sel.index - (mentionState.startIndex + 1));
    if (query.includes("\n")) { closeMention(); return; }
    updateMentionSuggestions(query);
    positionMentionDropdown(sel.index);
    return;
  }

  if (sel.length > 0) return;
  const charBefore = sel.index > 0 ? quill.getText(sel.index - 1, 1) : "";
  if (charBefore !== "@") return;
  const charBefore2 = sel.index > 1 ? quill.getText(sel.index - 2, 1) : "\n";
  if (!/[\s\n]/.test(charBefore2) && sel.index !== 1) return;

  mentionState = { startIndex: sel.index - 1 };
  updateMentionSuggestions("");
  positionMentionDropdown(sel.index);
}

function updateMentionSuggestions(query) {
  const q = query.trim().toLowerCase();
  const notes = Object.values(state.notes)
    .filter((n) => !q || (n.title || "").toLowerCase().includes(q))
    .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
    .slice(0, 8)
    .map((n) => ({ id: n.id, title: n.title || "sem título", isCreate: false }));

  const exact = q && findNoteByTitle(query.trim());
  if (query.trim() && !exact) {
    notes.push({ title: query.trim(), isCreate: true });
  }

  mentionSuggestions = notes;
  mentionActiveIndex = 0;
  renderMentionDropdown();
}

function renderMentionDropdown() {
  if (mentionSuggestions.length === 0) {
    mentionDropdown.hidden = true;
    return;
  }
  mentionDropdown.innerHTML = mentionSuggestions
    .map(
      (s, i) => `
      <div class="mention-item ${i === mentionActiveIndex ? "is-active" : ""} ${s.isCreate ? "is-create" : ""}" data-idx="${i}">
        ${s.isCreate ? `Criar nota "${escapeHtml(s.title)}"` : escapeHtml(s.title)}
      </div>`
    )
    .join("");
  mentionDropdown.hidden = false;
  mentionDropdown.querySelectorAll(".mention-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectMentionSuggestion(Number(item.dataset.idx));
    });
  });
}

function positionMentionDropdown(index) {
  const bounds = quill.getBounds(index);
  mentionDropdown.style.left = bounds.left + "px";
  mentionDropdown.style.top = bounds.bottom + 6 + "px";
}

function closeMention() {
  mentionState = null;
  mentionSuggestions = [];
  mentionDropdown.hidden = true;
}

function selectMentionSuggestion(idx) {
  const item = mentionSuggestions[idx];
  if (!item || !mentionState) return;
  const sel = quill.getSelection();
  const { startIndex } = mentionState;
  const queryLength = sel ? sel.index - (startIndex + 1) : 0;

  let title = item.title;
  let id = item.id;
  if (item.isCreate) id = createNoteDoc({ title });

  quill.deleteText(startIndex, queryLength + 1, "user");
  quill.insertEmbed(startIndex, "mention", { title, id }, "user");
  quill.insertText(startIndex + 1, " ", "user");
  quill.setSelection(startIndex + 2, 0, "user");
  closeMention();
}

quill.root.addEventListener(
  "keydown",
  (e) => {
    if (!mentionState) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      mentionActiveIndex = (mentionActiveIndex + 1) % mentionSuggestions.length;
      renderMentionDropdown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      mentionActiveIndex = (mentionActiveIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length;
      renderMentionDropdown();
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      selectMentionSuggestion(mentionActiveIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMention();
    }
  },
  true
);

// Clique numa menção abre a nota linkada
quill.root.addEventListener("mousedown", (e) => {
  const mention = e.target.closest("span.mention");
  if (!mention) return;
  e.preventDefault();
  const title = mention.getAttribute("data-title");
  const existing = findNoteByTitle(title);
  if (existing) openNote(existing.id);
});

// ============================================================
// SELEÇÃO / ABERTURA DE NOTA
// ============================================================
function openNote(id) {
  state.currentNoteId = id;
  const note = id ? state.notes[id] : null;
  closeMention();

  if (!note) {
    el.emptyState.hidden = false;
    el.editorView.hidden = true;
    el.graphView.hidden = true;
    el.noteTitleInput.value = "";
    el.noteFolderInput.value = "";
    el.noteTagsInput.value = "";
    el.backlinks.classList.remove("has-links");
    quill.setText("");
    renderSidebar();
    return;
  }

  el.emptyState.hidden = true;
  setView("editor");
  el.noteTitleInput.value = note.title || "";
  el.noteFolderInput.value = note.folder || "";
  el.noteTagsInput.value = (note.tags || []).join(", ");

  quill.setText("", "silent");
  if (note.content) quill.clipboard.dangerouslyPasteHTML(note.content, "silent");

  renderBacklinks();
  renderSidebar();

  if (window.innerWidth <= 820) el.sidebar.classList.remove("is-open");
}

function renderBacklinks() {
  const note = state.notes[state.currentNoteId];
  if (!note) return;
  const title = (note.title || "").trim().toLowerCase();
  const linkers = Object.values(state.notes).filter(
    (n) => n.id !== note.id && (n.links || []).some((l) => (l || "").trim().toLowerCase() === title)
  );
  if (linkers.length === 0) {
    el.backlinks.classList.remove("has-links");
    el.backlinks.innerHTML = "";
    return;
  }
  el.backlinks.classList.add("has-links");
  el.backlinks.innerHTML =
    `<div class="backlinks-title">Notas que linkam para cá</div>` +
    linkers.map((n) => `<span class="backlink-chip" data-id="${n.id}">${escapeHtml(n.title || "sem título")}</span>`).join("");
  el.backlinks.querySelectorAll(".backlink-chip").forEach((chip) => {
    chip.addEventListener("click", () => openNote(chip.dataset.id));
  });
}

// ============================================================
// SIDEBAR — pastas, tags, lista de notas
// ============================================================
el.searchInput.addEventListener("input", () => {
  state.searchQuery = el.searchInput.value.trim().toLowerCase();
  renderSidebar();
});

function setFolderFilter(folder) {
  state.filterFolder = state.filterFolder === folder ? null : folder;
  state.filterTag = null;
  renderSidebar();
}
function setTagFilter(tag) {
  state.filterTag = state.filterTag === tag ? null : tag;
  state.filterFolder = null;
  renderSidebar();
}

function renderSidebar() {
  const notes = Object.values(state.notes);

  const folders = Array.from(new Set(notes.map((n) => n.folder).filter(Boolean))).sort();
  el.folderTree.innerHTML =
    folders
      .map((f) => `<button class="folder-item ${state.filterFolder === f ? "is-active" : ""}" data-folder="${escapeHtml(f)}">${escapeHtml(f)}</button>`)
      .join("") || `<div class="note-item-meta">Nenhuma pasta ainda</div>`;
  el.folderTree.querySelectorAll(".folder-item").forEach((btn) => btn.addEventListener("click", () => setFolderFilter(btn.dataset.folder)));

  const tags = Array.from(new Set(notes.flatMap((n) => n.tags || []))).sort();
  el.tagList.innerHTML =
    tags
      .map((t) => `<button class="tag-item ${state.filterTag === t ? "is-active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .join("") || `<div class="note-item-meta">Nenhuma tag ainda</div>`;
  el.tagList.querySelectorAll(".tag-item").forEach((btn) => btn.addEventListener("click", () => setTagFilter(btn.dataset.tag)));

  let filtered = notes;
  if (state.filterFolder) filtered = filtered.filter((n) => n.folder === state.filterFolder);
  if (state.filterTag) filtered = filtered.filter((n) => (n.tags || []).includes(state.filterTag));
  if (state.searchQuery) {
    filtered = filtered.filter(
      (n) => (n.title || "").toLowerCase().includes(state.searchQuery) || stripHtml(n.content).toLowerCase().includes(state.searchQuery)
    );
  }
  filtered.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

  el.notesListTitle.textContent = state.filterFolder ? `Pasta: ${state.filterFolder}` : state.filterTag ? `Tag: ${state.filterTag}` : "Todas as notas";

  el.notesList.innerHTML =
    filtered
      .map(
        (n) => `
      <div class="note-item ${state.currentNoteId === n.id ? "is-active" : ""}" data-id="${n.id}">
        <div class="note-item-title">${escapeHtml(n.title || "sem título")}</div>
        <div class="note-item-meta">${escapeHtml(stripHtml(n.content).slice(0, 60))}</div>
      </div>`
      )
      .join("") || `<div class="note-item-meta" style="padding:8px;">Nenhuma nota encontrada.</div>`;

  el.notesList.querySelectorAll(".note-item").forEach((item) => item.addEventListener("click", () => openNote(item.dataset.id)));
}

// ============================================================
// TROCA DE VIEW (editor / grafo) + SIDEBAR MOBILE
// ============================================================
function setView(view) {
  state.view = view;
  el.editorView.hidden = view !== "editor";
  el.graphView.hidden = view !== "graph";
  el.viewEditorBtn.classList.toggle("is-active", view === "editor");
  el.viewGraphBtn.classList.toggle("is-active", view === "graph");
  if (view === "graph") renderGraph();
}
el.viewEditorBtn.addEventListener("click", () => setView("editor"));
el.viewGraphBtn.addEventListener("click", () => setView("graph"));
el.sidebarToggle.addEventListener("click", () => el.sidebar.classList.toggle("is-open"));

// ============================================================
// GRAFO DE CONEXÕES (d3-force)
// ============================================================
let graphSimulation = null;

function renderGraph() {
  const svg = d3.select(el.graphSvg);
  svg.selectAll("*").remove();

  const notes = Object.values(state.notes);
  const nodes = notes.map((n) => ({ id: n.id, title: n.title || "sem título" }));
  const nodeByTitle = {};
  notes.forEach((n) => (nodeByTitle[(n.title || "").trim().toLowerCase()] = n.id));

  const links = [];
  notes.forEach((n) => {
    (n.links || []).forEach((linkedTitle) => {
      const targetId = nodeByTitle[(linkedTitle || "").trim().toLowerCase()];
      if (targetId && targetId !== n.id) links.push({ source: n.id, target: targetId });
    });
  });

  const width = el.graphView.clientWidth || 800;
  const height = el.graphView.clientHeight || 600;
  svg.attr("viewBox", [0, 0, width, height]);

  const container = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.3, 3]).on("zoom", (event) => container.attr("transform", event.transform)));

  const linkSel = container.append("g").selectAll("line").data(links).join("line").attr("class", "graph-link");

  const nodeSel = container
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "graph-node")
    .call(
      d3.drag()
        .on("start", (event, d) => { if (!event.active) graphSimulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => { if (!event.active) graphSimulation.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on("click", (event, d) => { setView("editor"); openNote(d.id); });

  nodeSel.append("circle").attr("r", 8);
  nodeSel.append("text").attr("x", 12).attr("y", 4).text((d) => d.title);

  graphSimulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(90))
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(40))
    .on("tick", () => {
      linkSel.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
}

window.addEventListener("resize", () => { if (state.view === "graph") renderGraph(); });

// Estado inicial: nada selecionado
openNote(null);
