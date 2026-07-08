"use strict";

/* ---------- helpers ---------- */

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

/*
 * Bilingual field: { en, ja }.
 * Rule: show both in parallel when both exist; otherwise show whichever exists.
 * Japanese text is wrapped in <span class="ja"> so CSS can optically match its size to Latin text.
 */
function bi(field, sep = " / ") {
  if (!field) return "";
  if (typeof field === "string") return esc(field);
  const en = field.en ? esc(field.en) : "";
  const ja = field.ja ? `<span class="ja" lang="ja">${esc(field.ja)}</span>` : "";
  if (en && ja) return `${en}${sep}${ja}`;
  return en || ja;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
  return res.json();
}

/* "2025-09-16" -> "2025/09/16", "2023-04" -> "2023/04" */
const fmtDate = (iso) => (iso ? esc(iso).replaceAll("-", "/") : "");

const fmtPeriod = (start, end) =>
  end === null ? `${fmtDate(start)} – present` : `${fmtDate(start)} – ${fmtDate(end)}`;

/* Group items by year (descending), preserving input order within a year. */
function renderByYear(items, getYear, renderItem) {
  const byYear = new Map();
  for (const it of items) {
    const y = getYear(it);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(it);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return years
    .map((y) => `<h3 class="year">${y}</h3>` + byYear.get(y).map(renderItem).join(""))
    .join("");
}

function showError(err) {
  console.error(err);
  const main = document.querySelector("main");
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent =
    "Failed to load data. If you are viewing this page locally, serve it via a local HTTP server " +
    "(e.g. python3 -m http.server) instead of opening the file directly.";
  main.prepend(p);
}

/* ---------- generic filtered list ---------- */

function setupFilteredList(sectionId, items, getYear, renderItem) {
  const section = document.getElementById(sectionId);
  const listEl = section.querySelector("[data-list]");
  const countEl = section.querySelector("[data-count]");
  const filterBoxes = [...section.querySelectorAll("input[data-filter]")];
  const invitedBox = section.querySelector("input[data-invited-only]");

  const apply = () => {
    const groups = {};
    for (const box of filterBoxes) {
      if (!groups[box.dataset.filter]) groups[box.dataset.filter] = new Set();
      if (box.checked) groups[box.dataset.filter].add(box.value);
    }
    const visible = items.filter(
      (it) =>
        Object.entries(groups).every(([key, set]) => set.has(it[key])) &&
        (!invitedBox || !invitedBox.checked || it.invited)
    );
    listEl.innerHTML = renderByYear(visible, getYear, renderItem);
    if (countEl) countEl.textContent = `${visible.length} / ${items.length} shown`;
  };

  for (const box of [...filterBoxes, invitedBox]) {
    if (box) box.addEventListener("change", apply);
  }
  apply();
}

/* ---------- item renderers ---------- */

const MY_NAMES = ["Takuya Yoda", "世田 拓也", "世田拓也"];

function renderAuthors(authors) {
  return authors
    .map((a) => (MY_NAMES.includes(a) ? `<span class="me">${esc(a)}</span>` : esc(a)))
    .join(", ");
}

function badge(cls, text) {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function renderPublication(pub) {
  const links = [];
  if (pub.journal) links.push(esc(pub.journal));
  if (pub.arxiv) {
    links.push(
      `<a href="https://arxiv.org/abs/${esc(pub.arxiv)}" target="_blank" rel="noopener">arXiv:${esc(pub.arxiv)}</a>`
    );
  }
  return `<div class="item">
    <div class="title">${bi(pub.title)}</div>
    <div class="meta authors">${renderAuthors(pub.authors)}</div>
    <div class="meta">${links.join(" · ")}</div>
  </div>`;
}

function renderTalk(talk) {
  const badges =
    (talk.invited ? badge("invited", "Invited") : "") +
    (talk.format === "poster" ? badge("format", "Poster") : "");
  const where = [bi(talk.event), bi(talk.venue)].filter(Boolean).join(", ");
  const note = talk.note ? ` · ${bi(talk.note)}` : "";
  return `<div class="item">
    <div class="title">${bi(talk.title)}${badges}</div>
    <div class="meta">${where} — ${fmtDate(talk.date)}${note}</div>
  </div>`;
}

function renderSeminar(sem) {
  const badges = sem.invited ? badge("invited", "Invited") : "";
  return `<div class="item">
    <div class="title">${bi(sem.title)}${badges}</div>
    <div class="meta">${bi(sem.venue)} — ${fmtDate(sem.date)}</div>
  </div>`;
}

/* ---------- pages ---------- */

async function initHome() {
  const [profile, news] = await Promise.all([
    loadJSON("data/profile.json"),
    loadJSON("data/news.json"),
  ]);

  const affiliations = profile.affiliations
    .map((a) => {
      const label = bi(a.name, "<br>");
      const body = a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${label}</a>` : label;
      return `<p class="affiliation">${body}</p>`;
    })
    .join("");

  const links = profile.links
    .map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${bi(l.name)}</a></li>`)
    .join("");

  document.getElementById("profile-body").innerHTML = `
    <img class="portrait" src="${esc(profile.photo)}" alt="Portrait of ${esc(profile.name.en)}">
    <div class="profile-text">
      <h1>${bi(profile.name, "<br>")}</h1>
      <p class="position">${bi(profile.position, "<br>")}</p>
      ${affiliations}
      <p class="keywords"><span class="muted">Keywords:</span> ${bi(profile.keywords, "<br>")}</p>
      <ul class="profile-links">${links}</ul>
    </div>`;

  const emails = profile.emails
    .map((e) => {
      const note = bi(e.note, "<br>");
      return `<li><code>${esc(e.address)}</code>${note ? `<br><span class="muted">${note}</span>` : ""}</li>`;
    })
    .join("");
  document.getElementById("contact-body").innerHTML = `
    <ul class="email-list">${emails}</ul>
    <p class="email-hint">${bi(profile.email_hint, "<br>")}</p>`;

  document.getElementById("news-body").innerHTML = news
    .map((n) => `<p class="news-item"><span class="date">${fmtDate(n.date)}</span>${bi(n.text, "<br>")}</p>`)
    .join("");
}

async function initResearch() {
  const [pubs, talks, seminars] = await Promise.all([
    loadJSON("data/publications.json"),
    loadJSON("data/talks.json"),
    loadJSON("data/seminars.json"),
  ]);
  const yearOf = (it) => Number(it.date.slice(0, 4));
  setupFilteredList("publications", pubs, (p) => p.year, renderPublication);
  setupFilteredList("talks", talks, yearOf, renderTalk);
  setupFilteredList("seminars", seminars, yearOf, renderSeminar);
}

async function initResources() {
  const data = await loadJSON("data/resources.json");
  document.getElementById("resources-body").innerHTML = data.sections
    .map((sec) => {
      const items = sec.items
        .map((it) => {
          const name = it.url
            ? `<a href="${esc(it.url)}" target="_blank" rel="noopener">${bi(it.name)}</a>`
            : bi(it.name);
          const note = it.note ? ` <span class="note">— ${bi(it.note)}</span>` : "";
          return `<li class="resource-item">${name}${note}</li>`;
        })
        .join("");
      return `<section id="${esc(sec.id)}"><h2>${bi(sec.title)}</h2><ul class="plain-list">${items}</ul></section>`;
    })
    .join("");
}

async function initCV() {
  const cv = await loadJSON("data/cv.json");

  const cvItem = (period, bodyHTML) => `<div class="cv-item">
    <span class="cv-period">${period}</span>
    <div class="cv-body">${bodyHTML}</div>
  </div>`;

  /* note: null | {en,ja} | array of {en,ja} — each note becomes its own line */
  const cvNotes = (note) =>
    note
      ? (Array.isArray(note) ? note : [note])
          .map((n) => {
            const text = bi(n);
            return text ? `<div class="note">${text}</div>` : "";
          })
          .join("")
      : "";

  const render = {
    employment: (e) =>
      cvItem(
        fmtPeriod(e.start, e.end),
        `<div>${bi(e.title)}, ${bi(e.institution)}</div>` + cvNotes(e.note)
      ),
    education: (e) =>
      cvItem(fmtPeriod(e.start, e.end), `<div>${bi(e.degree)}, ${bi(e.institution)}</div>`),
    funding: (f) =>
      cvItem(
        fmtPeriod(f.start, f.end),
        `<div>${bi(f.name)}${f.amount ? ` <span class="note">(${esc(f.amount)})</span>` : ""}</div>` +
          cvNotes(f.note)
      ),
    awards: (a) => cvItem(fmtDate(a.date), `<div>${bi(a.name)}</div>` + cvNotes(a.note)),
    teaching: (t) =>
      cvItem(
        fmtPeriod(t.start, t.end),
        `<div>${bi(t.role)}, ${bi(t.course)}, ${bi(t.institution)}</div>`
      ),
  };

  for (const [key, renderFn] of Object.entries(render)) {
    const el = document.querySelector(`[data-cv="${key}"]`);
    if (el && cv[key]) el.innerHTML = cv[key].map(renderFn).join("");
  }
}

/* ---------- dispatch ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const init = {
    home: initHome,
    research: initResearch,
    resources: initResources,
    cv: initCV,
  }[document.body.dataset.page];
  if (init) init().catch(showError);
});
