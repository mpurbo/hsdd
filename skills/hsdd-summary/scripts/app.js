// Page runtime: routes, audiences, diagrams, keyboard, theme. Runs in the
// browser after the view functions and PAGE_VIEWS are defined in this script.
(function () {
  "use strict";
  const page = JSON.parse(document.getElementById("hsdd-page").textContent);
  const main = document.getElementById("main");
  const crumbs = document.getElementById("crumbs");
  const store = {
    get(k) {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        /* storage blocked: the setting lasts for this visit only */
      }
    },
  };

  function route() {
    return parseRoute(window.location.hash, PAGE_VIEWS.audiences);
  }

  function go(audience, view, id) {
    window.location.hash = view && view !== "top" ? href(audience, view, id) : href(audience);
  }

  function wrap(text, max, maxLines) {
    const out = [];
    for (const para of String(text || "").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if ((line + " " + word).trim().length > max && line) {
          out.push(line);
          line = word;
        } else line = (line + " " + word).trim();
      }
      if (line) out.push(line);
    }
    if (out.length > maxLines) return [...out.slice(0, maxLines - 1), out[maxLines - 1].slice(0, max - 1) + "…"];
    return out;
  }

  function drawDiagram(slotId, spec) {
    const W = 216;
    const LINE = 16;
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: spec.direction || "LR", nodesep: 22, ranksep: 64, marginx: 10, marginy: 10 });
    g.setDefaultEdgeLabel(() => ({}));
    const lines = new Map();
    for (const n of spec.nodes) {
      const sub = wrap(n.sub, 30, 5);
      lines.set(n.id, sub);
      g.setNode(n.id, { width: W, height: 36 + sub.length * LINE + 6 });
    }
    spec.edges.forEach((e, i) => {
      const label = e.label ? wrap(e.label, 28, 2) : [];
      g.setEdge(e.from, e.to, label.length ? { width: 170, height: label.length * 14 + 4, labelpos: "c", lines: label } : {}, "e" + i);
    });
    dagre.layout(g);
    const size = g.graph();
    const marker = `arrow-${slotId}`;
    let svg = `<svg class="dg" viewBox="0 0 ${Math.ceil(size.width)} ${Math.ceil(size.height)}" width="${Math.ceil(size.width)}" height="${Math.ceil(size.height)}" role="img" aria-label="${esc(spec.nodes.length + " boxes")}">`;
    svg += `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`;
    spec.edges.forEach((e, i) => {
      const ed = g.edge({ v: e.from, w: e.to, name: "e" + i });
      if (!ed) return;
      const d = ed.points.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      svg += `<path class="edge edge-${esc(e.kind)}" d="${d}"${e.kind === "collides" ? "" : ` marker-end="url(#${marker})"`}/>`;
      if (ed.lines) {
        svg += `<text class="edge-label" x="${ed.x.toFixed(1)}" y="${(ed.y - ((ed.lines.length - 1) * 14) / 2 + 4).toFixed(1)}" text-anchor="middle">`;
        ed.lines.forEach((l, k) => (svg += `<tspan x="${ed.x.toFixed(1)}" dy="${k ? 14 : 0}">${esc(l)}</tspan>`));
        svg += `</text>`;
      }
    });
    for (const n of spec.nodes) {
      const box = g.node(n.id);
      const x = box.x - box.width / 2;
      const y = box.y - box.height / 2;
      const inner =
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${box.width}" height="${box.height}" rx="8"/>` +
        `<text class="box-label" x="${(x + 12).toFixed(1)}" y="${(y + 22).toFixed(1)}">${esc(wrap(n.label, 26, 1)[0] || "")}</text>` +
        lines.get(n.id).map((l, k) => `<text class="box-sub" x="${(x + 12).toFixed(1)}" y="${(y + 42 + k * LINE).toFixed(1)}">${esc(l)}</text>`).join("");
      svg += n.href
        ? `<a class="box role-${esc(n.role)}" href="${esc(n.href)}" data-key="box:${esc(n.id)}" tabindex="0"><title>${esc(n.label)}</title>${inner}</a>`
        : `<g class="box role-${esc(n.role)}"><title>${esc(n.label)}</title>${inner}</g>`;
    }
    svg += `</svg>`;
    const legend = spec.legend.length
      ? `<ul class="legend">${spec.legend.map((l) => `<li><span class="${l.edge ? "key-edge edge-" + esc(l.edge) : "key-box role-" + esc(l.swatch)}"></span>${esc(l.text)}</li>`).join("")}</ul>`
      : "";
    return `<div class="dg-scroll">${svg}</div>${legend}`;
  }

  function draw() {
    const r = route();
    const active = document.activeElement;
    const focusKey = active && active.getAttribute ? active.getAttribute("data-key") : null;
    const view = PAGE_VIEWS.render(page, r);
    document.title = view.title === page.project.name ? view.title : `${view.title} \u00b7 ${page.project.name}`;
    main.innerHTML = view.body;
    crumbs.innerHTML = view.crumbs
      .map((c, i) => (i === view.crumbs.length - 1 ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${esc(c.href)}">${esc(c.label)}</a>`))
      .join(`<span class="sep" aria-hidden="true">/</span>`);
    for (const d of view.diagrams) {
      const slot = main.querySelector(`[data-diagram="${d.id}"]`);
      if (slot) slot.innerHTML = drawDiagram(d.id, d.spec);
    }
    for (const b of document.querySelectorAll("[data-audience]")) b.setAttribute("aria-pressed", String(b.getAttribute("data-audience") === r.audience));
    for (const a of document.querySelectorAll("[data-nav]")) {
      const path = a.getAttribute("data-nav");
      a.setAttribute("href", path ? href(r.audience, path) : href(r.audience));
    }
    if (focusKey) {
      const again = main.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (again) again.focus();
    }
  }

  function setTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  document.addEventListener("click", (ev) => {
    const aud = ev.target.closest("[data-audience]");
    if (aud) {
      const r = route();
      go(aud.getAttribute("data-audience"), r.view, r.id);
      return;
    }
    const copy = ev.target.closest("[data-copy]");
    if (copy) {
      const code = copy.parentElement.querySelector("code");
      const done = (word) => {
        copy.textContent = word;
        window.setTimeout(() => (copy.textContent = "Copy"), 1500);
      };
      try {
        window.navigator.clipboard.writeText(code.textContent).then(() => done("Copied"), () => done("Select and copy"));
      } catch {
        done("Select and copy");
      }
      return;
    }
    if (ev.target.closest("[data-skip]")) {
      main.focus();
      return;
    }
    if (ev.target.closest("#theme")) {
      const dark = document.documentElement.getAttribute("data-theme") === "dark" || (!document.documentElement.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const next = dark ? "light" : "dark";
      setTheme(next);
      store.set("hsdd-summary-theme", next);
      return;
    }
    if (ev.target.closest("#keys")) {
      const btn = document.getElementById("keys");
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
      store.set("hsdd-summary-keys", on ? "on" : "off");
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.matches && ev.target.matches("a.box")) {
      window.location.hash = ev.target.getAttribute("href");
      ev.preventDefault();
      return;
    }
    if (ev.altKey || ev.ctrlKey || ev.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    if (document.getElementById("keys").getAttribute("aria-pressed") !== "true") return;
    const r = route();
    const n = Number(ev.key);
    if (n >= 1 && n <= PAGE_VIEWS.audiences.length) return go(PAGE_VIEWS.audiences[n - 1], r.view, r.id);
    if (ev.key === "u") {
      const links = crumbs.querySelectorAll("a");
      if (links.length) window.location.hash = links[links.length - 1].getAttribute("href");
      return;
    }
    if (ev.key in PAGE_VIEWS.keys) go(r.audience, PAGE_VIEWS.keys[ev.key] || "top");
  });

  setTheme(store.get("hsdd-summary-theme"));
  if (store.get("hsdd-summary-keys") === "off") document.getElementById("keys").setAttribute("aria-pressed", "false");
  window.addEventListener("hashchange", draw);
  draw();
})();
