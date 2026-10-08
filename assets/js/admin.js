/* ==========================================================
   NEXORA 2026 — ADMIN CONTROL ROOM
   Executive Dashboard Application Logic
   ========================================================== */

(function () {
  "use strict";

  /* ===== BACKEND CONFIGURATION ===== */
  const SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxh4eXyvRSSDjJcD2KL470Td6H42YW4_xBp9vO9VgRuAMcyMkqJw-956OnKOoHZZq_-/exec";
  const SCANNER_API_KEY    = "NEXORA_SECURE_SCAN_KEY_2026_x9F2";
  const DEFAULT_WA_LINK    = "https://chat.whatsapp.com/Ho8BsHd9P5wBZAYRNG41U5";

  const GENDERS = ["Male", "Female", "Other", "Prefer not to say", "Not specified"];
  const DEPTS   = ["Chemistry", "Biotechnology", "Computer Science", "Zoology", "PGDCA"];
  const CATS    = ["Junior", "Senior"];
  const METHODS = ["Cash", "Online"];
  const PAYS    = ["Pending", "Paid", "Cancelled"];

  const EV = {
    name: "NEXORA 2026",
    tag: "New People • New Stories • Same Dreams",
    date: "13 October 2026",
    time: "11:30 AM – 5:30 PM",
    venue: "Tamasha Balle Balle Restaurant, Bilaspur"
  };

  /* Application State */
  let PIN     = "";
  let DATA    = { rows: [], log: [], quota: null, waLink: DEFAULT_WA_LINK };
  let EDIT    = null;
  let payChip = "";
  let timer   = null;
  const SEL   = new Set();

  const $   = (id) => document.getElementById(id);
  const lc  = (s) => String(s || "").toLowerCase();
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const gOf = (r) => GENDERS.find(g => lc(g) === lc(r.gender)) || "Not specified";
  const isDup = (r) => /duplicate/i.test(r.pay) || /duplicate/i.test(r.regId);
  const pill  = (t, c) => `<span class="pill p-${c}">${esc(t || "—")}</span>`;
  const initials = (n) => (String(n).trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("") || "?").toUpperCase();

  function toast(m) {
    const t = $("toast");
    if (!t) return;
    t.textContent = m;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 3400);
  }

  /* ----------------------------------------------------------
     NETWORK & API LAYER (JSONP / CORS-FREE)
     ---------------------------------------------------------- */
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const s  = document.createElement("script");
      const done = (fn, v) => {
        clearTimeout(t);
        delete window[cb];
        s.remove();
        fn(v);
      };
      const t = setTimeout(() => done(reject, new Error("Request timeout. Check backend connectivity.")), 30000);
      window[cb] = (d) => done(resolve, d);
      s.onerror  = () => done(reject, new Error("Network connection failed."));
      s.src = url + "&callback=" + cb + "&_=" + Date.now();
      document.body.appendChild(s);
    });
  }

  async function api(action, extra = {}) {
    const params = new URLSearchParams({ apiKey: SCANNER_API_KEY, action, pin: PIN, ...extra });
    const url = SCRIPT_WEB_APP_URL + "?" + params.toString();
    try {
      const d = await jsonp(url);
      if ($("net")) $("net").classList.remove("off");
      return d;
    } catch (_) {
      try {
        const d = await (await fetch(url + "&_=" + Date.now())).json();
        if ($("net")) $("net").classList.remove("off");
        return d;
      } catch (e) {
        if ($("net")) $("net").classList.add("off");
        throw new Error("Server unreachable. Please verify Google Apps Script deployment.");
      }
    }
  }

  /* ----------------------------------------------------------
     DATA LOADING & DASHBOARD RENDERING
     ---------------------------------------------------------- */
  async function load(showErr) {
    try {
      const d = await api("admindata");
      if (!d.success) {
        if (showErr && $("loginMsg")) $("loginMsg").textContent = d.message;
        return false;
      }
      DATA = d;
      render();
      if ($("updated")) {
        $("updated").innerHTML = `<span class="dot" id="net"></span>Updated ${esc(d.serverTime)}` +
          (d.quota != null ? ` · ✉ ${d.quota} emails left today` : "");
      }
      return true;
    } catch (e) {
      if (showErr && $("loginMsg")) $("loginMsg").textContent = e.message;
      else toast(e.message);
      return false;
    }
  }

  function tally(rows, fn) {
    const m = {};
    rows.forEach(r => {
      const k = fn(r) || "—";
      m[k] = m[k] || { reg: 0, paid: 0, in: 0 };
      m[k].reg++;
      if (lc(r.pay) === "paid") {
        m[k].paid++;
        if (lc(r.entry) === "entered") m[k].in++;
      }
    });
    return m;
  }

  function bars(el, m, order) {
    const target = $(el);
    if (!target) return;
    const keys = (order || Object.keys(m)).filter(k => m[k]);
    const max  = Math.max(1, ...keys.map(k => m[k].reg));
    target.innerHTML = keys.map(k => `
      <div class="bar-row">
        <div class="l">
          <span>${esc(k)}</span>
          <span class="mut">${m[k].reg} reg · ${m[k].paid} paid · <b style="color:var(--ok)">${m[k].in} in</b></span>
        </div>
        <div class="bar"><i style="width:${(m[k].reg / max) * 100}%"></i></div>
      </div>
    `).join("") || '<div class="mut">No data recorded yet</div>';
  }

  function render() {
    const rows   = DATA.rows.filter(r => !isDup(r));
    const paid   = rows.filter(r => lc(r.pay) === "paid");
    const inn    = paid.filter(r => lc(r.entry) === "entered");
    const pend   = rows.filter(r => lc(r.pay) === "pending");
    const canc   = rows.filter(r => lc(r.pay) === "cancelled");
    const noPass = paid.filter(r => lc(r.passSent) !== "yes");
    const noWa   = paid.filter(r => r.email && lc(r.wa) !== "yes");
    const rev    = paid.reduce((a, r) => a + (r.amount || 0), 0);
    const pct    = paid.length ? Math.round((inn.length / paid.length) * 100) : 0;

    // KPI Cards
    const K = [
      ["Registered", rows.length, "", "var(--info)"],
      ["Paid", paid.length, rows.length ? Math.round((paid.length / rows.length) * 100) + "% of total" : "", "var(--ok)"],
      ["Pending", pend.length, "awaiting confirmation", "var(--warn)"],
      ["Cancelled", canc.length, "", "var(--bad)"],
      ["Checked In", inn.length, "of " + paid.length + " paid", "var(--gold2)"],
      ["Revenue", "₹" + rev.toLocaleString("en-IN"), "verified collections", "var(--gold2)"]
    ];

    if ($("kpis")) {
      $("kpis").innerHTML = K.map(k => `
        <div class="kpi" style="--c:${k[3]}">
          <span>${k[0]}</span>
          <b>${k[1]}</b>
          <small>${k[2]}&nbsp;</small>
        </div>
      `).join("");
    }

    if ($("ringArc")) $("ringArc").setAttribute("stroke-dasharray", (pct * 3.267) + " 326.7");
    if ($("ringPct")) $("ringPct").textContent = pct + "%";
    if ($("ringText")) {
      $("ringText").innerHTML = `<b style="color:var(--ok)">${inn.length}</b> verified inside<br>` +
        `<b style="color:var(--gold2)">${paid.length - inn.length}</b> remaining to arrive<br>` +
        `${paid.length} total paid tickets`;
    }

    if ($("attn")) {
      $("attn").innerHTML =
        `<div class="attn"><div><b>${pend.length}</b> <span class="mut">payments pending review</span></div><button data-go="Pending">Review</button></div>` +
        `<div class="attn"><div><b>${noPass.length}</b> <span class="mut">paid without VIP entry pass</span></div><button class="btn-gold" data-go="bulkPass"${noPass.length ? "" : " disabled"}>Send Passes</button></div>` +
        `<div class="attn"><div><b>${noWa.length}</b> <span class="mut">paid without WhatsApp group invite</span></div><button class="btn-wa" data-go="bulkWa"${noWa.length ? "" : " disabled"}>Broadcast Link</button></div>`;
    }

    bars("byDept", tally(rows, r => r.dept));
    bars("byGender", tally(rows, gOf), GENDERS);
    bars("byCat", tally(rows, r => r.category));
    bars("byMethod", tally(rows, r => r.method));

    const fill = (id, label, list) => {
      const s = $(id);
      if (!s) return;
      const v = s.value;
      s.innerHTML = `<option value="">${label}: all</option>` + list.map(x => `<option>${esc(x)}</option>`).join("");
      s.value = v;
    };
    fill("fGender", "Gender", GENDERS);
    fill("fDept", "Dept", [...new Set(rows.map(r => r.dept).filter(Boolean))].sort());

    if ($("nPeople")) $("nPeople").textContent = rows.length;

    renderChips();
    renderRows();

    if ($("logRows")) {
      $("logRows").innerHTML = DATA.log.map(l => `
        <tr>${l.map((c, i) => `<td data-label="${["Time", "Code", "Name", "Gender", "Result"][i]}">${esc(c)}</td>`).join("")}</tr>
      `).join("") || '<tr><td colspan="5" class="empty">No check-in logs recorded yet</td></tr>';
    }
  }

  /* ----------------------------------------------------------
     ATTENDEES DIRECTORY & FILTERING
     ---------------------------------------------------------- */
  function renderChips() {
    const rows = DATA.rows;
    const n = (p) => rows.filter(r => lc(r.pay) === lc(p)).length;
    const C = [
      ["", "All", rows.length],
      ["Paid", "Paid", n("Paid")],
      ["Pending", "Pending", n("Pending")],
      ["Cancelled", "Cancelled", n("Cancelled")],
      ["Duplicate", "Duplicates", n("Duplicate")]
    ];
    if ($("chips")) {
      $("chips").innerHTML = C.map(c => `
        <button class="chip${payChip === c[0] ? " on" : ""}" data-chip="${c[0]}">${c[1]} · ${c[2]}</button>
      `).join("");
    }
  }

  function filtered() {
    const q = lc($("q") ? $("q").value : "");
    const e = $("fEntry") ? $("fEntry").value : "";
    const g = $("fGender") ? $("fGender").value : "";
    const d = $("fDept") ? $("fDept").value : "";

    return DATA.rows.filter(r =>
      (!q || lc([r.regId, r.name, r.email, r.phone, r.txn].join(" ")).includes(q)) &&
      (!payChip || lc(r.pay) === lc(payChip)) &&
      (!e || lc(r.entry) === lc(e)) &&
      (!g || gOf(r) === g) &&
      (!d || r.dept === d)
    );
  }

  function renderRows() {
    const list = filtered();
    if ($("count")) $("count").textContent = list.length + " of " + DATA.rows.length + " attendee records shown";

    if ($("rows")) {
      $("rows").innerHTML = list.map(r => {
        const dup  = isDup(r);
        const paid = lc(r.pay) === "paid";
        const ent  = lc(r.entry) === "entered";
        const id   = esc(r.regId);

        let primary = "";
        if (!dup) {
          if (lc(r.pay) === "cancelled") {
            primary = `<button data-act="pay" data-v="Pending" data-id="${id}">Restore</button>`;
          } else if (!paid) {
            primary = `<button class="btn-gold" data-act="pay" data-v="Paid" data-id="${id}">Mark Paid</button>`;
          } else if (!ent) {
            primary = `<button class="btn-gold" data-act="entry" data-v="Entered" data-id="${id}">Admit</button>`;
          } else {
            primary = `<button data-act="entry" data-v="Not Entered" data-id="${id}">Undo Entry</button>`;
          }
        }

        return `
          <tr class="${SEL.has(r.regId) ? "sel" : ""}">
            <td class="nolabel">
              <input type="checkbox" data-sel="${id}" ${SEL.has(r.regId) ? "checked" : ""} ${dup ? "disabled" : ""}>
            </td>
            <td class="nolabel">
              <div class="who">
                <div class="av">${esc(initials(r.name))}</div>
                <div>
                  <b>${esc(r.name)}</b>
                  <span class="mut">${id} · ${esc(r.phone)}</span>
                </div>
              </div>
            </td>
            <td data-label="Dept">${esc(r.dept)}<br><span class="mut">${esc(r.category)}</span></td>
            <td data-label="Gender" class="hide-m">${esc(gOf(r))}</td>
            <td data-label="Payment">
              ${pill(r.pay, lc(r.pay) || "no")}
              ${r.shot ? ` <button class="kebab" data-act="shot" data-id="${id}" title="View Receipt" style="padding:1px 7px">🧾</button>` : ""}
              <br><span class="mut">${esc(r.method)} · ₹${r.amount || 0}</span>
            </td>
            <td data-label="Entry">
              ${ent ? pill("Entered", "entered") + `<br><span class="mut">${esc(r.entryTime)}</span>` : pill("Not entered", "no")}
            </td>
            <td class="acts-td">
              <div class="acts">
                ${dup ? '<span class="mut">duplicate</span>' : `${primary}<button class="kebab" data-menu="${id}" title="Actions">⋯</button>`}
              </div>
            </td>
          </tr>
        `;
      }).join("") || '<tr><td colspan="7" class="empty">No attendee records match current filters</td></tr>';
    }

    if ($("selAll")) {
      $("selAll").checked = list.length > 0 && list.filter(r => !isDup(r)).every(r => SEL.has(r.regId));
    }
    updateSelBar();
  }

  function updateSelBar() {
    const bar = $("selbar");
    if (!bar) return;
    bar.classList.toggle("show", SEL.size > 0);
    if ($("selCount")) $("selCount").textContent = SEL.size + " selected";
  }

  /* ----------------------------------------------------------
     INDIVIDUAL & ROW ACTIONS
     ---------------------------------------------------------- */
  async function run(act, id, v) {
    const r = DATA.rows.find(x => x.regId === id);
    if (!r) return;

    if (act === "edit") return openEdit(id);
    if (act === "dl")   return downloadPass(id);
    if (act === "link" || act === "wa") return sharePass(r, act);
    if (act === "shot") return openShot(r);

    const q = {
      pay: `Mark ${id} (${r.name}) as ${v}?` + (v === "Paid" ? " The VIP digital pass will be automatically dispatched." : ""),
      pass: `Resend VIP entry pass to ${r.email}?`,
      reg: `Resend registration confirmation to ${r.email}?`,
      entrymail: `Resend gate entry confirmation to ${r.email}?`,
      entry: `Set gate entry status of ${id} to ${v}?`
    }[act];

    if (!confirm(q)) return;

    try {
      const d = act === "pay"
        ? await api("adminpay", { regId: id, value: v })
        : act === "entry"
          ? await api("adminentry", { regId: id, value: v })
          : await api("adminresend", { regId: id, what: act === "entrymail" ? "entry" : act });

      toast(d.message || (d.success ? "Done" : "Action failed"));
      if (d.success) await load();
    } catch (e) {
      toast(e.message);
    }
  }

  // Row clicks delegator
  if ($("rows")) {
    $("rows").addEventListener("click", (ev) => {
      const sel = ev.target.closest("[data-sel]");
      if (sel) {
        if (sel.checked) SEL.add(sel.dataset.sel);
        else SEL.delete(sel.dataset.sel);
        sel.closest("tr").classList.toggle("sel", sel.checked);
        if ($("selAll")) $("selAll").checked = false;
        return updateSelBar();
      }
      const m = ev.target.closest("[data-menu]");
      if (m) return openMenu(m);
      const b = ev.target.closest("[data-act]");
      if (b) run(b.dataset.act, b.dataset.id, b.dataset.v);
    });
  }

  if ($("selAll")) {
    $("selAll").addEventListener("change", (e) => {
      filtered().filter(r => !isDup(r)).forEach(r => {
        if (e.target.checked) SEL.add(r.regId);
        else SEL.delete(r.regId);
      });
      renderRows();
    });
  }

  if ($("selClear")) {
    $("selClear").addEventListener("click", () => {
      SEL.clear();
      renderRows();
    });
  }

  if ($("chips")) {
    $("chips").addEventListener("click", (e) => {
      const c = e.target.closest("[data-chip]");
      if (!c) return;
      payChip = c.dataset.chip;
      renderChips();
      renderRows();
    });
  }

  ["q", "fEntry", "fGender", "fDept"].forEach(id => {
    if ($(id)) $(id).addEventListener("input", renderRows);
  });

  if ($("attn")) {
    $("attn").addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]");
      if (!b) return;
      if (b.dataset.go === "bulkPass") return openBulkPassModal();
      if (b.dataset.go === "bulkWa")   return openBulkWaModal();
      payChip = b.dataset.go;
      showTab("people");
      renderChips();
      renderRows();
    });
  }

  /* ----------------------------------------------------------
     POPOVER ACTION MENU
     ---------------------------------------------------------- */
  function openMenu(btn) {
    const id = btn.dataset.menu;
    const r = DATA.rows.find(x => x.regId === id);
    if (!r) return;

    const paid = lc(r.pay) === "paid";
    const ent  = lc(r.entry) === "entered";
    const E    = esc(id);

    const items = [
      ["edit", "✎ Edit attendee details"],
      r.shot && ["shot", "🧾 View payment proof"],
      paid && ["dl", "⬇ Download Pass (HD PNG)"],
      paid && ["pass", "🎟 Resend VIP Entry Pass"],
      paid && r.qr && ["link", "🔗 Copy Pass URL"],
      paid && r.qr && r.phone && ["wa", "💬 Send Pass link on WhatsApp"],
      ["reg", "✉ Resend Registration Email"],
      ent && ["entrymail", "✅ Resend Entry Confirmation"],
      "sep",
      lc(r.pay) !== "cancelled" && ["pay|Cancelled", "✖ Cancel registration"]
    ].filter(Boolean);

    const menu = $("menu");
    if (!menu) return;

    menu.innerHTML = items.map(i =>
      i === "sep" ? '<div class="sep"></div>' : `<button data-a="${i[0]}" data-id="${E}">${i[1]}</button>`
    ).join("");

    menu.style.display = "block";
    const b = btn.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;

    menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, b.right - mw)) + "px";
    menu.style.top  = (b.bottom + mh + 8 > innerHeight ? Math.max(8, b.top - mh - 4) : b.bottom + 4) + "px";
  }

  if ($("menu")) {
    $("menu").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]");
      if (!b) return;
      $("menu").style.display = "none";
      const [a, v] = b.dataset.a.split("|");
      run(a, b.dataset.id, v);
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#menu") && !e.target.closest("[data-menu]") && !e.target.closest("#exportBtn")) {
      if ($("menu")) $("menu").style.display = "none";
    }
  });
  window.addEventListener("scroll", () => {
    if ($("menu")) $("menu").style.display = "none";
  }, true);

  /* ----------------------------------------------------------
     TABS SWITCHER
     ---------------------------------------------------------- */
  function showTab(t) {
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === t));
    ["overview", "people", "log"].forEach(n => {
      if ($("tab-" + n)) $("tab-" + n).style.display = (n === t ? "block" : "none");
    });
  }

  if ($("tabs")) {
    $("tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tab]");
      if (b) showTab(b.dataset.tab);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && $("app") && $("app").style.display === "block") {
      e.preventDefault();
      showTab("people");
      if ($("q")) $("q").focus();
    }
    if (e.key === "Escape") {
      closeEdit();
      closeAdd();
      closeShot();
      closeBulkPassModal();
      closeBulkWaModal();
    }
  });

  /* ----------------------------------------------------------
     PASS DOWNLOAD & SHARE VIA WHATSAPP
     ---------------------------------------------------------- */
  const passLink = (r) => new URL("../pass/", location.href).href + "?t=" + encodeURIComponent(r.qr);

  async function sharePass(r, act) {
    const link = passLink(r);
    if (act === "link") {
      try {
        await navigator.clipboard.writeText(link);
        toast("Pass link copied for " + r.name);
      } catch (_) {
        prompt("Copy this pass URL:", link);
      }
      return;
    }

    let ph = String(r.phone).replace(/\D/g, "");
    if (ph.length === 10) ph = "91" + ph;

    const msg = `Hi ${r.name}, here is your official entry pass for NEXORA 2026 (${r.regId})!\n\nView & download your pass here: ${link}\n\nPresent this pass QR code at the entrance on 13 October. See you there!`;
    window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank");
  }

  const loadImg = (src) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

  async function passCanvas(r) {
    const W = 640, H = 940;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const GOLD = "#d4af37", YEL = "#ffd700", F = "-apple-system,'Segoe UI',Roboto,sans-serif";

    const text = (t, px, py, font, color, al) => {
      x.font = font; x.fillStyle = color; x.textAlign = al || "center"; x.fillText(t, px, py);
    };
    const fit = (t, font, maxW) => {
      let s = parseInt(font.match(/(\d+)px/)[1]);
      while (s > 12) {
        x.font = font.replace(/\d+px/, s + "px");
        if (x.measureText(t).width <= maxW) break;
        s -= 2;
      }
      return font.replace(/\d+px/, s + "px");
    };

    x.fillStyle = "#050507"; x.fillRect(0, 0, W, H);
    x.strokeStyle = GOLD; x.lineWidth = 3; x.strokeRect(18, 18, W - 36, H - 36);

    text("MASTER FRESHER", W / 2, 80, `700 18px ${F}`, GOLD);
    text(EV.name, W / 2, 140, `900 56px ${F}`, "#fff");
    text(EV.tag, W / 2, 175, `400 18px ${F}`, "#ccc");

    x.strokeStyle = GOLD; x.lineWidth = 2; x.setLineDash([6, 6]);
    x.beginPath(); x.moveTo(50, 205); x.lineTo(W - 50, 205); x.stroke();
    x.setLineDash([]);

    const details = [
      ["NAME", r.name],
      ["DEPARTMENT", r.dept],
      ["CATEGORY", r.category],
      ["PAYMENT", "VERIFIED"]
    ];

    details.forEach((row, i) => {
      const y = 255 + i * 46;
      text(row[0], 60, y, `700 15px ${F}`, "#8e8e93", "left");
      text(row[1] || "—", W - 60, y, fit(row[1] || "—", `700 22px ${F}`, 340), "#fff", "right");
    });

    text("REGISTRATION ID", W / 2, 470, `700 15px ${F}`, "#8e8e93");
    x.strokeStyle = GOLD; x.lineWidth = 3; x.strokeRect(W / 2 - 150, 485, 300, 56);
    text(r.regId, W / 2, 525, `900 30px ${F}`, YEL);

    if (typeof qrcode !== "undefined") {
      const qr = qrcode(0, "M");
      qr.addData(r.qr || r.regId);
      qr.make();
      const img = await loadImg(qr.createDataURL(10, 0));
      x.fillStyle = "#fff"; x.fillRect(W / 2 - 150, 570, 300, 320);
      x.imageSmoothingEnabled = false;
      x.drawImage(img, W / 2 - 130, 585, 260, 260);
    }

    text("SCAN AT ENTRANCE", W / 2, 875, `900 15px ${F}`, "#000");
    text(EV.date + " · " + EV.time, W / 2, 915, `700 16px ${F}`, YEL);

    return c;
  }

  async function downloadPass(id) {
    const r = DATA.rows.find(x => x.regId === id);
    if (!r) return;
    if (lc(r.pay) !== "paid" && !confirm("Payment is not marked Paid. Download pass anyway?")) return;
    const c = await passCanvas(r);
    c.toBlob((b) => download(r.regId + "-pass.png", b), "image/png");
    toast("Pass downloaded for " + r.name);
  }

  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ----------------------------------------------------------
     DEDICATED BULK PASS BROADCAST MODAL & ENGINE
     ---------------------------------------------------------- */
  function openBulkPassModal() {
    const paidNoPass = DATA.rows.filter(r => !isDup(r) && lc(r.pay) === "paid" && lc(r.passSent) !== "yes");
    const m = $("bulkPassModal");
    if (!m) return;

    $("bpCount").textContent = paidNoPass.length;
    $("bpSelected").textContent = SEL.size;
    $("bpProgWrap").classList.remove("active");
    $("bpStartBtn").disabled = (paidNoPass.length === 0 && SEL.size === 0);
    m.classList.add("show");
  }

  function closeBulkPassModal() {
    if ($("bulkPassModal")) $("bulkPassModal").classList.remove("show");
  }

  async function startBulkPassSend() {
    const sendSelectedOnly = $("bpOptSelected") && $("bpOptSelected").checked && SEL.size > 0;
    const targetRegs = sendSelectedOnly ? Array.from(SEL).join(",") : null;

    $("bpProgWrap").classList.add("active");
    $("bpStartBtn").disabled = true;
    $("bpCancelBtn").disabled = true;

    let totalSent = 0;
    let done = false;

    try {
      while (!done) {
        const d = await api("adminbulkpass", {
          batchSize: 10,
          regIds: targetRegs || ""
        });

        if (!d.success) {
          const msg = /registration.*not found/i.test(d.message || "")
            ? "⚠️ Outdated Backend: Copy code.gs to Google Apps Script and Deploy 'New version'."
            : (d.message || "Bulk send encountered an issue");
          toast(msg);
          $("bpProgStatus").textContent = msg;
          break;
        }

        totalSent += d.sent || 0;
        const total = d.total || totalSent;
        const remaining = d.remaining || 0;
        const pct = total > 0 ? Math.min(100, Math.round((totalSent / total) * 100)) : 100;

        $("bpProgBar").style.width = pct + "%";
        $("bpProgStatus").textContent = `Delivered ${totalSent} of ${total} pass(es) (${pct}%)`;

        if (remaining <= 0 || d.sent === 0) {
          done = true;
          toast(`All ${totalSent} VIP Entry Passes sent successfully!`);
        }
      }
    } catch (err) {
      toast("Error: " + err.message);
    } finally {
      $("bpStartBtn").disabled = false;
      $("bpCancelBtn").disabled = false;
      await load();
      setTimeout(closeBulkPassModal, 2000);
    }
  }

  /* ----------------------------------------------------------
     DEDICATED BULK WHATSAPP GROUP LINK MODAL & ENGINE
     ---------------------------------------------------------- */
  function openBulkWaModal() {
    const paid = DATA.rows.filter(r => !isDup(r) && lc(r.pay) === "paid" && r.email);
    const m = $("bulkWaModal");
    if (!m) return;

    if ($("waLinkInput")) {
      $("waLinkInput").value = DATA.waLink || DEFAULT_WA_LINK;
    }

    const unsent = paid.filter(r => lc(r.wa) !== "yes").length;
    if ($("waUnsentCount")) $("waUnsentCount").textContent = unsent;
    if ($("waTotalCount"))  $("waTotalCount").textContent  = paid.length;
    if ($("waSelCount"))    $("waSelCount").textContent    = SEL.size;

    $("waProgWrap").classList.remove("active");
    $("waStartBtn").disabled = false;
    m.classList.add("show");
  }

  function closeBulkWaModal() {
    if ($("bulkWaModal")) $("bulkWaModal").classList.remove("show");
  }

  async function startBulkWaSend() {
    const linkInput = $("waLinkInput");
    const link = linkInput ? linkInput.value.trim() : "";

    if (!link) {
      toast("Please enter a WhatsApp group invite link");
      return;
    }

    const reset = $("waOptAll") && $("waOptAll").checked ? "1" : "0";
    const sendSelectedOnly = $("waOptSelected") && $("waOptSelected").checked && SEL.size > 0;
    const targetRegs = sendSelectedOnly ? Array.from(SEL).join(",") : null;

    $("waProgWrap").classList.add("active");
    $("waStartBtn").disabled = true;
    $("waCancelBtn").disabled = true;

    let totalSent = 0;
    let totalFailed = 0;
    let done = false;

    try {
      while (!done) {
        const d = await api("adminwalink", {
          link: link,
          reset: reset,
          regIds: targetRegs || "",
          batchSize: 12
        });

        if (!d.success) {
          const msg = /registration.*not found/i.test(d.message || "")
            ? "⚠️ Outdated Backend: Copy code.gs to Google Apps Script and Deploy 'New version'."
            : (d.message || "Failed to broadcast WhatsApp link");
          toast(msg);
          $("waProgStatus").textContent = msg;
          break;
        }

        totalSent   += d.sent || 0;
        totalFailed += d.failed || 0;
        const total = d.total || (totalSent + (d.remaining || 0));
        const remaining = d.remaining || 0;
        const pct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 100;

        $("waProgBar").style.width = pct + "%";
        $("waProgStatus").textContent = `Delivered to ${d.done || totalSent} of ${total} attendee(s) (${pct}%)`;

        if (remaining <= 0 || (d.sent === 0 && d.failed === 0)) {
          done = true;
          toast(`WhatsApp link delivery complete (${totalSent} sent)`);
        }
      }
    } catch (err) {
      toast("Error: " + err.message);
    } finally {
      $("waStartBtn").disabled = false;
      $("waCancelBtn").disabled = false;
      await load();
      setTimeout(closeBulkWaModal, 2200);
    }
  }

  /* ----------------------------------------------------------
     ATTENDEE EDIT & ADD MODALS
     ---------------------------------------------------------- */
  const opts = (list, cur, blank) => (blank ? `<option value="">Not set</option>` : "") +
    (cur && !list.includes(cur) ? [cur, ...list] : list).map(x => `<option${x === cur ? " selected" : ""}>${esc(x)}</option>`).join("");
  const fld  = (l, h, full) => `<label class="${full ? "full" : ""}">${l}${h}</label>`;

  function openEdit(id) {
    const r = DATA.rows.find(x => x.regId === id);
    if (!r) return;
    EDIT = r;

    if ($("mTitle")) $("mTitle").textContent = r.regId + " · " + r.name;
    const g4 = GENDERS.slice(0, 4);

    if ($("mBody")) {
      $("mBody").innerHTML =
        fld("Full Name", `<input id="e_name" value="${esc(r.name)}">`, true) +
        fld("Email Address", `<input id="e_email" type="email" value="${esc(r.email)}">`) +
        fld("Phone Number", `<input id="e_phone" value="${esc(r.phone)}">`) +
        fld("Gender", `<select id="e_gender">${opts(g4, g4.find(g => lc(g) === lc(r.gender)) || r.gender, true)}</select>`) +
        fld("Department", `<select id="e_dept">${opts(DEPTS, r.dept)}</select>`) +
        fld("Category", `<select id="e_cat">${opts(CATS, r.category)}</select>`) +
        fld("Payment Method", `<select id="e_method">${opts(METHODS, r.method)}</select>`) +
        fld("Transaction ID", `<input id="e_txn" value="${esc(r.txn)}">`) +
        fld("Amount (₹)", `<input id="e_amount" type="number" min="0" value="${r.amount || 0}">`) +
        fld("Payment Status", `<select id="e_pay">${opts(PAYS, r.pay)}</select>`);
    }

    if ($("e_resend")) $("e_resend").checked = false;
    if ($("shotBtn")) $("shotBtn").style.display = r.shot ? "" : "none";
    if ($("modal")) $("modal").classList.add("show");
  }

  function closeEdit() {
    if ($("modal")) $("modal").classList.remove("show");
    EDIT = null;
  }

  async function saveEdit() {
    if (!EDIT) return;
    const f = {
      "Full Name":      $("e_name") ? $("e_name").value : "",
      "Email Address":  $("e_email") ? $("e_email").value : "",
      "Phone Number":   $("e_phone") ? $("e_phone").value : "",
      "Gender":         $("e_gender") ? $("e_gender").value : "",
      "Department":     $("e_dept") ? $("e_dept").value : "",
      "Category":       $("e_cat") ? $("e_cat").value : "",
      "Payment Method": $("e_method") ? $("e_method").value : "",
      "Transaction ID": $("e_txn") ? $("e_txn").value : "",
      "Amount":         $("e_amount") ? $("e_amount").value : "",
      "Payment Status": $("e_pay") ? $("e_pay").value : ""
    };

    $("mSave").disabled = true;
    try {
      const resend = $("e_resend") && $("e_resend").checked ? "reg" : "";
      const d = await api("adminedit", { regId: EDIT.regId, fields: JSON.stringify(f), resend });
      toast(d.message || (d.success ? "Saved" : "Update failed"));
      if (d.success) {
        closeEdit();
        await load();
      }
    } catch (e) {
      toast(e.message);
    }
    $("mSave").disabled = false;
  }

  if ($("mSave"))   $("mSave").addEventListener("click", saveEdit);
  if ($("mCancel")) $("mCancel").addEventListener("click", closeEdit);
  if ($("modal")) {
    $("modal").addEventListener("click", (e) => {
      if (e.target === $("modal")) closeEdit();
    });
  }

  document.querySelectorAll("[data-send]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!EDIT) return;
      try {
        const d = await api("adminresend", { regId: EDIT.regId, what: b.dataset.send });
        toast(d.message || "Done");
        if (d.success) load();
      } catch (e) {
        toast(e.message);
      }
    });
  });

  if ($("dlPass"))   $("dlPass").addEventListener("click", () => { if (EDIT) downloadPass(EDIT.regId); });
  if ($("linkPass")) $("linkPass").addEventListener("click", () => {
    if (EDIT) EDIT.qr ? sharePass(EDIT, "link") : toast("No QR token exists for this record.");
  });

  // Walk-in Add Attendee Modal
  function openAdd() {
    if ($("aBody")) {
      $("aBody").innerHTML =
        fld("Full Name", `<input id="a_name" placeholder="Full Name">`, true) +
        fld("Email Address", `<input id="a_email" type="email" placeholder="attendee@gmail.com">`) +
        fld("Phone Number", `<input id="a_phone" placeholder="10-digit number">`) +
        fld("Gender", `<select id="a_gender"><option value="">Select Gender</option>${opts(GENDERS.slice(0, 4), "")}</select>`) +
        fld("Department", `<select id="a_dept"><option value="">Select Department</option>${opts(DEPTS, "")}</select>`) +
        fld("Category", `<select id="a_cat">${opts(CATS, "Junior")}</select>`) +
        fld("Payment Method", `<select id="a_method">${opts(METHODS, "Cash")}</select>`) +
        fld("Transaction ID", `<input id="a_txn" placeholder="Optional for cash">`) +
        fld("Amount (₹)", `<input id="a_amount" type="number" placeholder="899" value="899">`, true);
    }

    if ($("a_paid")) $("a_paid").checked = true;
    if ($("a_send")) $("a_send").checked = true;
    if ($("addModal")) $("addModal").classList.add("show");
  }

  function closeAdd() {
    if ($("addModal")) $("addModal").classList.remove("show");
  }

  async function saveAdd() {
    const f = {
      "Full Name":      $("a_name") ? $("a_name").value : "",
      "Email Address":  $("a_email") ? $("a_email").value : "",
      "Phone Number":   $("a_phone") ? $("a_phone").value : "",
      "Gender":         $("a_gender") ? $("a_gender").value : "",
      "Department":     $("a_dept") ? $("a_dept").value : "",
      "Category":       $("a_cat") ? $("a_cat").value : "",
      "Payment Method": $("a_method") ? $("a_method").value : "",
      "Transaction ID": $("a_txn") ? $("a_txn").value : "",
      "Amount":         $("a_amount") ? $("a_amount").value : ""
    };

    $("aSave").disabled = true;
    try {
      const paid = $("a_paid") && $("a_paid").checked ? "1" : "0";
      const sendEmail = $("a_send") && $("a_send").checked ? "1" : "0";
      const d = await api("adminadd", { fields: JSON.stringify(f), paid, sendEmail });
      toast(d.message || (d.success ? "Attendee registered" : "Failed"));
      if (d.success) {
        closeAdd();
        await load();
      }
    } catch (e) {
      toast(e.message);
    }
    $("aSave").disabled = false;
  }

  if ($("addBtn"))  $("addBtn").addEventListener("click", openAdd);
  if ($("aSave"))   $("aSave").addEventListener("click", saveAdd);
  if ($("aCancel")) $("aCancel").addEventListener("click", closeAdd);

  // Payment Proof Modal
  async function openShot(r) {
    if ($("shotModal")) $("shotModal").classList.add("show");
    if ($("shotTitle")) $("shotTitle").textContent = "Receipt · " + r.name;
    if ($("shotMeta"))  $("shotMeta").textContent  = r.regId + " · " + r.method + " · ₹" + (r.amount || 0);
    if ($("shotImg"))   $("shotImg").innerHTML    = '<span class="mut">Fetching image from Drive…</span>';
    if ($("shotActs"))  $("shotActs").innerHTML   = "";

    try {
      const d = await api("adminshot", { regId: r.regId, idx: "0" });
      if (!d.success) {
        if ($("shotImg")) $("shotImg").innerHTML = `<span class="mut">${esc(d.message)}</span>`;
        return;
      }
      if ($("shotImg")) {
        if (d.data) {
          $("shotImg").innerHTML = `<img src="data:${d.mime};base64,${d.data}" alt="Proof" title="Click to zoom">`;
          const img = $("shotImg").querySelector("img");
          if (img) img.onclick = () => img.classList.toggle("big");
        } else {
          $("shotImg").innerHTML = `<span class="mut">${esc(d.name)}</span>`;
        }
      }
      if ($("shotActs")) {
        $("shotActs").innerHTML = `<a class="btnlink" href="${esc(d.url)}" target="_blank" rel="noopener">Open in Google Drive ↗</a>`;
      }
    } catch (e) {
      if ($("shotImg")) $("shotImg").innerHTML = `<span class="mut">${esc(e.message)}</span>`;
    }
  }

  function closeShot() {
    if ($("shotModal")) $("shotModal").classList.remove("show");
  }
  if ($("shotClose")) $("shotClose").addEventListener("click", closeShot);
  if ($("shotBtn"))   $("shotBtn").addEventListener("click", () => { if (EDIT) openShot(EDIT); });

  /* ----------------------------------------------------------
     EXPORTS (CSV / ZIP)
     ---------------------------------------------------------- */
  const targets = () => SEL.size ? DATA.rows.filter(r => SEL.has(r.regId)) : filtered();

  function exportEmails() {
    const list = targets().filter(r => r.email);
    if (!list.length) return toast("No attendees with email addresses in current view.");
    const csv = "Full Name,Email,Registration ID,Payment Status\n" +
      list.map(r => `"${r.name.replace(/"/g, '""')}","${r.email}","${r.regId}","${r.pay}"`).join("\n");
    download("nexora-emails.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
    toast("Exported " + list.length + " email(s)");
  }

  function exportAttendees() {
    const list = targets();
    if (!list.length) return toast("No attendees to export.");
    const H = ["Registration ID", "Full Name", "Department", "Category", "Gender", "Email", "Phone", "Payment", "Method", "Txn ID", "Amount", "Entry", "Entry Time", "WhatsApp Sent"];
    const rows = list.map(r => [
      r.regId, r.name, r.dept, r.category, r.gender, r.email, r.phone, r.pay, r.method, r.txn, r.amount, r.entry, r.entryTime, r.wa
    ].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    const csv = H.join(",") + "\n" + rows.join("\n");
    download("nexora-attendees.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
    toast("Exported " + list.length + " record(s)");
  }

  async function exportZip() {
    if (typeof JSZip === "undefined") return toast("ZIP library is loading. Please try again.");
    const list = targets().filter(r => !isDup(r) && lc(r.pay) === "paid");
    if (!list.length) return toast("No paid attendees found to generate passes.");

    toast(`Generating passes for ${list.length} attendee(s)...`);
    const zip = new JSZip();
    for (let i = 0; i < list.length; i++) {
      const c = await passCanvas(list[i]);
      const blob = await new Promise(res => c.toBlob(res, "image/png"));
      zip.file(`${list[i].regId}-${list[i].name.replace(/[^a-zA-Z0-9]/g, "_")}.png`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    download("nexora-vip-passes.zip", content);
    toast("Passes ZIP bundle generated!");
  }

  if ($("exportBtn")) {
    $("exportBtn").addEventListener("click", () => {
      const menu = $("menu");
      if (!menu) return;
      menu.innerHTML = `
        <button data-x="xa">📄 Export Attendees (CSV)</button>
        <button data-x="xe">✉ Export Emails (CSV)</button>
        <button data-x="xz">🎟 Export VIP Passes (ZIP)</button>
      `;
      menu.style.display = "block";
      const b = $("exportBtn").getBoundingClientRect();
      menu.style.left = Math.max(8, b.left) + "px";
      menu.style.top  = (b.bottom + 6) + "px";
    });
  }

  if ($("menu")) {
    $("menu").addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]");
      if (!b) return;
      $("menu").style.display = "none";
      ({ xa: exportAttendees, xe: exportEmails, xz: exportZip })[b.dataset.x]();
    });
  }

  if ($("selZip"))    $("selZip").addEventListener("click", exportZip);
  if ($("selEmails")) $("selEmails").addEventListener("click", exportEmails);

  /* ----------------------------------------------------------
     BULK BUTTON TRIGGERS
     ---------------------------------------------------------- */
  if ($("bulkBtn")) $("bulkBtn").addEventListener("click", openBulkPassModal);
  if ($("waBtn"))   $("waBtn").addEventListener("click", openBulkWaModal);

  if ($("bpStartBtn"))  $("bpStartBtn").addEventListener("click", startBulkPassSend);
  if ($("bpCancelBtn")) $("bpCancelBtn").addEventListener("click", closeBulkPassModal);

  if ($("waStartBtn"))  $("waStartBtn").addEventListener("click", startBulkWaSend);
  if ($("waCancelBtn")) $("waCancelBtn").addEventListener("click", closeBulkWaModal);

  if ($("refreshBtn")) {
    $("refreshBtn").addEventListener("click", async () => {
      await load();
      toast("Data refreshed from database");
    });
  }

  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", () => {
      PIN = "";
      SEL.clear();
      clearInterval(timer);
      if ($("app")) $("app").style.display = "none";
      if ($("login")) $("login").style.display = "flex";
      if ($("pinInput")) $("pinInput").value = "";
    });
  }

  /* ----------------------------------------------------------
     AUTHENTICATION & LOGIN
     ---------------------------------------------------------- */
  async function doLogin() {
    PIN = $("pinInput") ? $("pinInput").value.trim() : "";
    if (!PIN) return;
    if ($("loginMsg")) $("loginMsg").textContent = "";
    if ($("loginBtn")) {
      $("loginBtn").disabled = true;
      $("loginBtn").textContent = "Authenticating…";
    }

    const ok = await load(true);

    if ($("loginBtn")) {
      $("loginBtn").disabled = false;
      $("loginBtn").textContent = "Sign In";
    }

    if (ok) {
      if ($("login")) $("login").style.display = "none";
      if ($("app"))   $("app").style.display = "block";
      clearInterval(timer);
      timer = setInterval(() => load(), 30000);
    } else {
      PIN = "";
    }
  }

  if ($("loginBtn")) $("loginBtn").addEventListener("click", doLogin);
  if ($("pinInput")) {
    $("pinInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

})();
