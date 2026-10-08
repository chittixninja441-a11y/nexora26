/* ==========================================================
   NEXORA 2026 — MASTER FRESHER PARTY
   Primary Client-Side Interactivity
   ========================================================== */
(function () {
  "use strict";

  /* ----------------------------------------------------------
     1. TEAM DIRECTORY CONFIGURATION
     ---------------------------------------------------------- */
  const TEAM = [
    {
      dept: "Chemistry",
      members: [
        { name: "Sagar Lahre", photo: "assets/sagar-lahre.jpg", initials: "SL" },
        { name: "Ankit Patel", photo: "assets/ankit-patel.jpeg", initials: "AP" },
        { name: "Md Kaif", photo: "assets/md-kaif.jpeg", initials: "MK" },
        { name: "Harsh Jaiswal", photo: "assets/harsh-jaiswal.jpeg", initials: "HJ" }
      ]
    },
    {
      dept: "Zoology",
      members: [
        { name: "Kritika Vaishnav", photo: "assets/kritika-vaishnav.jpg", initials: "KV" },
        { name: "Muskan Kshatriya", photo: "assets/muskan.jpg", initials: "MK" }
      ]
    },
    {
      dept: "Computer Science",
      members: [
        { name: "Abhay Singh", photo: "assets/abhay-singh.jpg", initials: "AS" },
        { name: "Ajay Chandra", photo: "assets/ajay-chandra.jpg", initials: "AC" }
      ]
    }
  ];

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  // Render Team members into #teamRoot
  const teamRoot = document.getElementById("teamRoot");
  if (teamRoot) {
    teamRoot.innerHTML = TEAM.map(d => `
      <div class="team-dept reveal">
        <div class="dept-title-bar">
          <h3>${esc(d.dept)}</h3>
          <span class="line"></span>
          <span class="count-badge">${d.members.length} member${d.members.length > 1 ? "s" : ""}</span>
        </div>
        <div class="team-grid">
          ${d.members.map(m => `
            <div class="team-card">
              <div class="member-avatar" data-photo="${esc(m.photo)}">
                <img alt="${esc(m.name)}" loading="lazy">
                <div class="initials">${esc(m.initials || m.name.slice(0, 2))}</div>
              </div>
              <div class="name">${esc(m.name)}</div>
              <div class="role">M.Sc. Student</div>
              <span class="dept-tag">${esc(d.dept)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    // Load available photos or show initials avatar
    document.querySelectorAll(".member-avatar").forEach(box => {
      const img = box.querySelector("img");
      const src = box.dataset.photo;
      if (!src || !img) return;

      img.onload = () => {
        box.classList.add("has-img");
        img.style.display = "block";
      };
      img.onerror = () => {
        box.classList.remove("has-img");
        img.style.display = "none";
      };
      img.src = src;

      if (img.complete && img.naturalWidth > 0) {
        box.classList.add("has-img");
        img.style.display = "block";
      }
    });
  }

  /* ----------------------------------------------------------
     2. EVENT COUNTDOWN & REGISTRATION STATUS TICKER
     ---------------------------------------------------------- */
  // Party date: 13 October 2026, 11:00 AM IST
  const EVENT = new Date("2026-10-13T11:00:00+05:30");
  const OPEN = new Date("2026-10-01T00:00:00+05:30");
  const CLOSE = new Date("2026-10-12T23:59:59+05:30");
  const pad = (n) => String(n).padStart(2, "0");

  function tick() {
    const now = new Date();
    const ms = EVENT - now;
    const countEl = document.getElementById("count");

    if (ms <= 0) {
      if (countEl) {
        countEl.innerHTML = '<div style="grid-column:1/-1;padding:12px;text-align:center"><b style="font-size:22px;color:var(--sun)">The celebration is live! 🎉</b></div>';
      }
    } else {
      const s = Math.floor(ms / 1000);
      const days = Math.floor(s / 86400);
      const hrs = pad(Math.floor((s % 86400) / 3600));
      const mins = pad(Math.floor((s % 3600) / 60));
      const secs = pad(s % 60);

      const cd = document.getElementById("cd");
      const ch = document.getElementById("ch");
      const cm = document.getElementById("cm");
      const cs = document.getElementById("cs");

      if (cd) cd.textContent = pad(days);
      if (ch) ch.textContent = hrs;
      if (cm) cm.textContent = mins;
      if (cs) cs.textContent = secs;
    }

    const chip = document.getElementById("regChip");
    const regTxt = document.getElementById("regTxt");
    const regBtn = document.getElementById("regBtn");

    if (chip && regTxt) {
      if (now < OPEN) {
        regTxt.textContent = "Registration opening soon";
        chip.classList.add("closed");
      } else if (now <= CLOSE) {
        regTxt.textContent = "Registration open · Limited VIP passes";
        chip.classList.remove("closed");
      } else {
        regTxt.textContent = "Registration closed";
        chip.classList.add("closed");
        if (regBtn) {
          regBtn.textContent = "REGISTRATION CLOSED";
          regBtn.setAttribute("aria-disabled", "true");
        }
      }
    }
  }

  tick();
  setInterval(tick, 1000);

  /* ----------------------------------------------------------
     3. STICKY HEADER & DYNAMIC SCROLLSPY
     ---------------------------------------------------------- */
  const nav = document.getElementById("navbar");
  const navPills = document.querySelectorAll(".nav-desktop .nav-item, .mobile-drawer .nav-item");
  const trackedSections = [
    document.getElementById("home"),
    document.getElementById("about"),
    document.getElementById("pricing"),
    document.getElementById("event"),
    document.getElementById("gallery"),
    document.getElementById("team")
  ].filter(Boolean);

  function updateScrollSpy() {
    if (nav) nav.classList.toggle("stuck", window.scrollY > 25);
    const scrollY = window.scrollY;
    const viewThreshold = scrollY + 160;

    let currentId = "home";
    for (let i = 0; i < trackedSections.length; i++) {
      const sec = trackedSections[i];
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (viewThreshold >= top && viewThreshold < top + height) {
        currentId = sec.id;
        break;
      }
    }

    if (scrollY + window.innerHeight >= document.documentElement.scrollHeight - 60) {
      const last = trackedSections[trackedSections.length - 1];
      if (last) currentId = last.id;
    }

    navPills.forEach(pill => {
      const href = pill.getAttribute("href") || "";
      const target = href.replace("#", "");
      if (target === currentId) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });
  }

  window.addEventListener("scroll", updateScrollSpy, { passive: true });
  updateScrollSpy();

  /* ----------------------------------------------------------
     4. MOBILE HAMBURGER MENU
     ---------------------------------------------------------- */
  const navToggle = document.getElementById("navToggle");
  const mobileDrawer = document.getElementById("mobileDrawer");

  if (navToggle && mobileDrawer) {
    const toggleMenu = (force) => {
      const open = typeof force === "boolean" ? force : !mobileDrawer.classList.contains("open");
      navToggle.classList.toggle("open", open);
      mobileDrawer.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };

    navToggle.addEventListener("click", () => toggleMenu());

    mobileDrawer.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => toggleMenu(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobileDrawer.classList.contains("open")) {
        toggleMenu(false);
      }
    });
  }

  /* ----------------------------------------------------------
     5. LIGHTBOX MODAL FOR IMAGES
     ---------------------------------------------------------- */
  const lightbox = document.getElementById("lightboxModal");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxText = document.getElementById("lightboxText");
  const lightboxDownloadBtn = document.getElementById("lightboxDownloadBtn");
  const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");

  function openLightbox(src, caption) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    if (lightboxText) lightboxText.textContent = caption || "NEXORA ’26 Visual";
    if (lightboxDownloadBtn) {
      lightboxDownloadBtn.href = src;
      lightboxDownloadBtn.download = (caption ? caption.replace(/[^a-zA-Z0-9]/g, "-") : "nexora") + ".jpg";
    }
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener("click", closeLightbox);

  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox && lightbox.classList.contains("open")) {
      closeLightbox();
    }
  });

  // Attach lightbox to gallery cards
  document.querySelectorAll(".gallery-item").forEach(item => {
    const trigger = () => {
      const img = item.querySelector("img");
      const caption = item.dataset.caption || (img ? img.alt : "");
      if (img) openLightbox(img.src, caption);
    };

    item.addEventListener("click", trigger);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger();
      }
    });
  });

  // Hero flyer preview
  const heroPoster = document.getElementById("heroPosterCard");
  if (heroPoster) {
    heroPoster.addEventListener("click", () => {
      openLightbox("assets/party-bg.jpg", "NEXORA ’26 — Official Master's Fresher Celebration");
    });
  }

  /* ----------------------------------------------------------
     6. SCROLL REVEAL OBSERVER
     ---------------------------------------------------------- */
  function initReveal() {
    const reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05, rootMargin: "0px 0px 50px 0px" });

      reveals.forEach(el => observer.observe(el));
    } else {
      reveals.forEach(el => el.classList.add("in"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }
})();