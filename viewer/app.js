const GRAPH_URL = "../graph/graph.json";
const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 1200;
const HEIGHT = 720;
const TYPE_LABELS = {
  prerequisite: "前提",
  "subtype-of": "下位",
  "used-by": "利用",
  "contrasts-with": "対比",
  "confusable-with": "混同",
};
const TYPE_VALUES = Object.keys(TYPE_LABELS);
const DOMAIN_COLORS = [
  "#6c8f87",
  "#8d789f",
  "#b18a55",
  "#6d87a7",
  "#a56d73",
  "#73916a",
  "#9a7b68",
];

const elements = {
  loadStatus: document.querySelector("#loadStatus"),
  search: document.querySelector("#searchInput"),
  domain: document.querySelector("#domainFilter"),
  status: document.querySelector("#statusFilter"),
  verification: document.querySelector("#verificationFilter"),
  type: document.querySelector("#typeFilter"),
  focus: document.querySelector("#focusFilter"),
  fit: document.querySelector("#fitButton"),
  count: document.querySelector("#visibleCount"),
  list: document.querySelector("#nodeList"),
  listEmpty: document.querySelector("#listEmpty"),
  graph: document.querySelector("#graph"),
  viewport: document.querySelector("#viewport"),
  edgeLayer: document.querySelector("#edgeLayer"),
  nodeLayer: document.querySelector("#nodeLayer"),
  graphEmpty: document.querySelector("#graphEmpty"),
  graphHint: document.querySelector("#graphHint"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detail: document.querySelector("#detail"),
  detailDomain: document.querySelector("#detailDomain"),
  detailTitle: document.querySelector("#detailTitle"),
  detailId: document.querySelector("#detailId"),
  detailBadges: document.querySelector("#detailBadges"),
  detailScope: document.querySelector("#detailScope"),
  detailPrinciple: document.querySelector("#detailPrinciple"),
  detailJudgment: document.querySelector("#detailJudgment"),
  detailExamples: document.querySelector("#detailExamples"),
  detailRelations: document.querySelector("#detailRelations"),
  detailSource: document.querySelector("#detailSource"),
};

const state = {
  graph: null,
  selectedId: null,
  filters: {
    search: "",
    domain: "",
    status: "",
    verification: "",
    type: "",
    focus: 0,
  },
  camera: { x: 0, y: 0, scale: 1 },
  pan: null,
};

function createSvg(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function option(select, value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  select.append(item);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ja"));
}

function setupFilters() {
  const { nodes } = state.graph;
  option(elements.domain, "", "すべての分野");
  uniqueSorted(nodes.map((node) => node.domain)).forEach((value) => {
    option(elements.domain, value, value);
  });
  option(elements.status, "", "すべての状態");
  uniqueSorted(nodes.map((node) => node.status)).forEach((value) => {
    option(elements.status, value, value);
  });
  option(elements.verification, "", "すべての検証状態");
  uniqueSorted(nodes.map((node) => node.verification)).forEach((value) => {
    option(elements.verification, "" + value, value);
  });
  option(elements.type, "", "すべての関係");
  TYPE_VALUES.forEach((value) => option(elements.type, value, TYPE_LABELS[value]));

  if (nodes.some((node) => node.domain === "nonfinite")) {
    state.filters.domain = "nonfinite";
    elements.domain.value = "nonfinite";
  }
}

function nodeById(id) {
  return state.graph.nodes.find((node) => node.id === id);
}

function matchesNode(node) {
  const { search, domain, status, verification } = state.filters;
  if (domain && node.domain !== domain) return false;
  if (status && node.status !== status) return false;
  if (verification && node.verification !== verification) return false;
  if (!search) return true;
  const text = [
    node.id,
    node.title,
    node.scope,
    node.summary.principle,
    ...node.summary.judgmentConditions,
    ...node.summary.examples,
  ]
    .join(" ")
    .toLocaleLowerCase("ja");
  return text.includes(search.toLocaleLowerCase("ja"));
}

function filteredNodes() {
  const nodes = state.graph.nodes.filter(matchesNode);
  if (!state.selectedId || state.filters.focus === 0) return nodes;
  const allowed = new Set(nodes.map((node) => node.id));
  if (!allowed.has(state.selectedId)) return nodes;

  const neighbors = new Map(nodes.map((node) => [node.id, new Set()]));
  state.graph.edges.forEach((edge) => {
    if (state.filters.type && edge.type !== state.filters.type) return;
    if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) return;
    neighbors.get(edge.source).add(edge.target);
    neighbors.get(edge.target).add(edge.source);
  });

  const visible = new Set([state.selectedId]);
  let frontier = new Set([state.selectedId]);
  for (let depth = 0; depth < state.filters.focus; depth += 1) {
    const next = new Set();
    frontier.forEach((id) => neighbors.get(id)?.forEach((neighbor) => next.add(neighbor)));
    next.forEach((id) => visible.add(id));
    frontier = next;
  }
  return nodes.filter((node) => visible.has(node.id));
}

function visibleEdges(nodeIds) {
  const ids = new Set(nodeIds.map((node) => node.id));
  return state.graph.edges.filter((edge) => {
    if (state.filters.type && edge.type !== state.filters.type) return false;
    return ids.has(edge.source) && ids.has(edge.target);
  });
}

function domainColor(domain) {
  let hash = 0;
  for (const character of domain) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return DOMAIN_COLORS[Math.abs(hash) % DOMAIN_COLORS.length];
}

function truncate(text, max = 15) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function layoutNodes(nodes) {
  const positions = new Map();
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const columns = Math.max(1, Math.min(7, Math.ceil(Math.sqrt(sorted.length * 1.4))));
  const rows = Math.max(1, Math.ceil(sorted.length / columns));
  const cellWidth = (WIDTH - 120) / columns;
  const cellHeight = (HEIGHT - 100) / rows;
  sorted.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(node.id, {
      x: 60 + cellWidth * (column + 0.5),
      y: 55 + cellHeight * (row + 0.5),
    });
  });
  return positions;
}

function setCamera() {
  const { x, y, scale } = state.camera;
  elements.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
}

function renderList(nodes) {
  elements.list.replaceChildren();
  elements.count.textContent = `${nodes.length}件`;
  elements.listEmpty.hidden = nodes.length > 0;
  nodes.forEach((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "node-button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(node.id === state.selectedId));
    button.dataset.id = node.id;

    const dot = document.createElement("span");
    dot.className = "node-dot";
    dot.style.backgroundColor = domainColor(node.domain);
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = node.title;
    const id = document.createElement("small");
    id.textContent = node.id;
    text.append(title, id);
    button.append(dot, text);
    button.addEventListener("click", () => selectNode(node.id, true));
    elements.list.append(button);
  });
}

function renderGraph(nodes, edges) {
  elements.edgeLayer.replaceChildren();
  elements.nodeLayer.replaceChildren();
  elements.graphEmpty.hidden = nodes.length > 0;
  const positions = layoutNodes(nodes);

  edges.forEach((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return;
    const group = createSvg("g", { class: `edge ${edge.status}`, "data-type": edge.type });
    const line = createSvg("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
    });
    if (edge.directed) line.setAttribute("marker-end", "url(#arrowhead)");
    const label = createSvg("text", {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2 - 5,
      class: "edge-label",
    });
    label.textContent = TYPE_LABELS[edge.type] || edge.type;
    const title = createSvg("title");
    title.textContent = `${TYPE_LABELS[edge.type] || edge.type}: ${edge.reason}`;
    group.append(line, label, title);
    elements.edgeLayer.append(group);
  });

  nodes.forEach((node) => {
    const position = positions.get(node.id);
    const group = createSvg("g", {
      class: "node",
      tabindex: "0",
      role: "button",
      "aria-label": `${node.title} (${node.id})`,
      "data-id": node.id,
      "data-selected": String(node.id === state.selectedId),
      transform: `translate(${position.x} ${position.y})`,
    });
    const circle = createSvg("circle", {
      r: node.id === state.selectedId ? 29 : 25,
      fill: domainColor(node.domain),
    });
    const text = createSvg("text", { y: 45 });
    text.textContent = truncate(node.title);
    const title = createSvg("title");
    title.textContent = `${node.title} [${node.status}]`;
    group.append(circle, text, title);
    group.addEventListener("click", () => selectNode(node.id, true));
    group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectNode(node.id, true);
    });
    elements.nodeLayer.append(group);
  });
  setCamera();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderRichText(container, text) {
  const paragraphs = String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  container.innerHTML = paragraphs.length
    ? paragraphs.map((part) => `<p>${inlineMarkdown(part).replaceAll("\n", "<br>")}</p>`).join("")
    : '<p class="muted-item">記載なし</p>';
}

function renderItems(container, items) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "muted-item";
    empty.textContent = "記載なし";
    container.append(empty);
    return;
  }
  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = inlineMarkdown(item);
    container.append(listItem);
  });
}

function relationOther(edge, node) {
  return edge.source === node.id ? nodeById(edge.target) : nodeById(edge.source);
}

function renderRelations(node) {
  elements.detailRelations.replaceChildren();
  const relations = state.graph.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .sort((a, b) => a.type.localeCompare(b.type));
  if (!relations.length) {
    const empty = document.createElement("p");
    empty.className = "muted-item";
    empty.textContent = "関連はまだありません。";
    elements.detailRelations.append(empty);
    return;
  }
  relations.forEach((edge) => {
    const other = relationOther(edge, node);
    if (!other) return;
    const card = document.createElement("div");
    card.className = `relation-card ${edge.status}`;
    const meta = document.createElement("div");
    meta.className = "relation-meta";
    const type = document.createElement("strong");
    type.textContent = TYPE_LABELS[edge.type] || edge.type;
    const status = document.createElement("span");
    status.textContent = edge.status;
    const direction = document.createElement("span");
    direction.textContent = edge.directed
      ? edge.source === node.id
        ? "→"
        : "←"
      : "↔";
    meta.append(type, status, direction);
    const link = document.createElement("a");
    link.className = "relation-other";
    link.href = `#${encodeURIComponent(other.id)}`;
    link.textContent = other.title;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      selectNode(other.id, true);
    });
    const reason = document.createElement("p");
    reason.className = "relation-reason";
    reason.innerHTML = inlineMarkdown(edge.reason);
    card.append(meta, link, reason);
    elements.detailRelations.append(card);
  });
}

function renderDetail() {
  const node = state.selectedId ? nodeById(state.selectedId) : null;
  elements.detailEmpty.hidden = Boolean(node);
  elements.detail.hidden = !node;
  if (!node) return;
  elements.detailDomain.textContent = node.domain;
  elements.detailTitle.textContent = node.title;
  elements.detailId.textContent = node.id;
  elements.detailBadges.replaceChildren();
  [node.status, node.verification].forEach((label) => {
    const badge = document.createElement("span");
    badge.className = `badge ${label === "proposed" ? "proposed" : ""}`;
    badge.textContent = label;
    elements.detailBadges.append(badge);
  });
  elements.detailScope.textContent = node.scope;
  renderRichText(elements.detailPrinciple, node.summary.principle);
  renderItems(elements.detailJudgment, node.summary.judgmentConditions);
  renderItems(elements.detailExamples, node.summary.examples);
  renderRelations(node);
  elements.detailSource.href = `../${node.path}`;
}

function updateHint(nodes, edges) {
  const focusText = state.filters.focus && state.selectedId ? `・フォーカス${state.filters.focus}段階` : "";
  elements.graphHint.textContent = `${nodes.length}ノード / ${edges.length}関係${focusText}。ノードはキーボードでも選択できます。`;
}

function render() {
  if (!state.graph) return;
  const nodes = filteredNodes();
  const edges = visibleEdges(nodes);
  renderList(nodes);
  renderGraph(nodes, edges);
  updateHint(nodes, edges);
  renderDetail();
}

function selectNode(id, focusList = false) {
  state.selectedId = id;
  render();
  if (focusList) {
    const button = elements.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    button?.focus();
  }
}

function bindControls() {
  elements.search.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim();
    render();
  });
  [elements.domain, elements.status, elements.verification, elements.type].forEach((select) => {
    select.addEventListener("change", (event) => {
      state.filters[select.id.replace("Filter", "")] = event.target.value;
      render();
    });
  });
  elements.focus.addEventListener("change", (event) => {
    state.filters.focus = Number(event.target.value);
    render();
  });
  elements.fit.addEventListener("click", () => {
    state.camera = { x: 0, y: 0, scale: 1 };
    setCamera();
  });
}

function bindPanZoom() {
  elements.graph.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 0.9 : 1.1;
    state.camera.scale = Math.min(2.4, Math.max(0.65, state.camera.scale * direction));
    setCamera();
  }, { passive: false });
  elements.graph.addEventListener("pointerdown", (event) => {
    if (event.target.closest?.(".node")) return;
    state.pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    elements.graph.setPointerCapture(event.pointerId);
  });
  elements.graph.addEventListener("pointermove", (event) => {
    if (!state.pan || state.pan.pointerId !== event.pointerId) return;
    state.camera.x += event.clientX - state.pan.x;
    state.camera.y += event.clientY - state.pan.y;
    state.pan.x = event.clientX;
    state.pan.y = event.clientY;
    setCamera();
  });
  ["pointerup", "pointercancel"].forEach((eventName) => {
    elements.graph.addEventListener(eventName, () => {
      state.pan = null;
    });
  });
}

async function init() {
  try {
    const response = await fetch(GRAPH_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.graph = await response.json();
    setupFilters();
    bindControls();
    bindPanZoom();
    elements.loadStatus.textContent = `${state.graph.nodes.length}枚のカード、${state.graph.edges.length}件の関係を読み込みました。`;
    render();
  } catch (error) {
    elements.loadStatus.textContent = `graph.jsonを読み込めませんでした。静的サーバー経由で開いてください。 (${error.message})`;
    elements.graphEmpty.hidden = false;
    elements.graphEmpty.textContent = "graph.jsonを読み込めません。READMEの起動方法を確認してください。";
  }
}

init();
