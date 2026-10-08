/* ==========================================================================
   NEXORA '26 — GATE SCANNER ENGINE
   Full ZXing Scanner, Offline Resilience & Real-Time Sync
   ========================================================================== */

(function () {
  "use strict";

  /* ===== CONFIG ===== */
  const SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxh4eXyvRSSDjJcD2KL470Td6H42YW4_xBp9vO9VgRuAMcyMkqJw-956OnKOoHZZq_-/exec";
  const SCANNER_API_KEY = "NEXORA_SECURE_SCAN_KEY_2026_x9F2";
  const GATE_NAME = "GATE 1";

  /* Gate PIN (sessionStorage scoped per tab) */
  let SPIN = "";
  try {
    SPIN = sessionStorage.getItem("nx_spin") || "";
  } catch (_) {}

  const $ = (id) => document.getElementById(id);

  let reader = null;
  let isProcessing = false;
  let lastText = "";
  let lastTime = 0;
  let cameras = [];
  let camIdx = 0;
  let torchOn = false;
  let sheetTimer = null;
  let userStopped = false;

  const gateNameEl = $("gateName");
  if (gateNameEl) gateNameEl.textContent = GATE_NAME;

  /* --------------------------------------------------------------------------
     CAMERA & SCANNER ENGINE
     -------------------------------------------------------------------------- */
  function showOverlay(ico, title, text, btn) {
    const ovIco = $("ovIco");
    const ovTitle = $("ovTitle");
    const ovText = $("ovText");
    const ovBtn = $("ovBtn");
    const vp = $("viewport");

    if (ovIco) ovIco.textContent = ico;
    if (ovTitle) ovTitle.textContent = title;
    if (ovText) ovText.textContent = text;
    if (ovBtn) ovBtn.textContent = btn || "Retry";
    if (vp) vp.classList.remove("live");
  }

  function camProblem(err) {
    const n = err && err.name;
    if (!window.isSecureContext) {
      return ["🔒", "Secure Connection Required", "Camera access requires HTTPS or localhost. Direct HTTP is restricted by modern browsers."];
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return ["🌐", "In-App Browser Detected", "Please launch in standard Chrome or Safari rather than inside third-party apps."];
    }
    if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError") {
      return ["🚫", "Camera Access Denied", "Tap the permissions icon in your browser address bar → Allow camera → then tap Retry."];
    }
    if (n === "NotFoundError" || n === "DevicesNotFoundError") {
      return ["📷", "Hardware Not Found", "No camera sensor detected. Use manual alphanumeric lookup or 'Scan from photo' below."];
    }
    if (n === "NotReadableError" || n === "TrackStartError") {
      return ["⚠️", "Camera In Use", "Another application is actively using the camera hardware. Close other apps and retry."];
    }
    return ["⚠️", "Camera Sensor Error", (err && err.message) ? err.message : "Sensor initialization timed out. Tap Retry."];
  }

  function onDecode(result) {
    if (!result || isProcessing) return;
    const text = result.getText();
    const now = Date.now();
    if (text === lastText && now - lastTime < 3000) return;
    lastText = text;
    lastTime = now;
    verifyPass(text);
  }

  async function startScanner(deviceId) {
    if (reader) return;
    userStopped = false;

    if (typeof ZXing === "undefined") {
      return showOverlay("📡", "Library Loading Error", "ZXing scanner library failed to initialize. Check internet and reload.", "Reload");
    }
    if (!window.isSecureContext || !navigator.mediaDevices) {
      return showOverlay(...camProblem(null));
    }

    const btnStart = $("btnStart");
    const btnStop = $("btnStop");
    const ovBtn = $("ovBtn");

    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = false;
    showOverlay("⏳", "Initializing Camera…", "Grant camera permission if prompted by the operating system.", "Retry");
    if (ovBtn) ovBtn.style.display = "none";

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.EAN_13
    ]);
    reader = new ZXing.BrowserMultiFormatReader(hints, 150);

    const attempts = [
      deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false },
      { video: true, audio: false }
    ];

    let lastErr = null;
    for (const c of attempts) {
      try {
        await reader.decodeFromConstraints(c, "videoPreview", onDecode);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e && e.name !== "OverconstrainedError" && e.name !== "NotFoundError") break;
      }
    }

    if (ovBtn) ovBtn.style.display = "";
    if (lastErr) {
      try { reader.reset(); } catch (_) {}
      reader = null;
      if (btnStart) btnStart.disabled = false;
      if (btnStop) btnStop.disabled = true;
      return showOverlay(...camProblem(lastErr));
    }

    const vp = $("viewport");
    if (vp) vp.classList.add("live");
    setupCameraTools();
    requestWakeLock();
  }

  async function setupCameraTools() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      cameras = all.filter((d) => d.kind === "videoinput");
      const btnFlip = $("btnFlip");
      if (btnFlip) btnFlip.classList.toggle("show", cameras.length > 1);
    } catch (_) {}

    try {
      const vid = $("videoPreview");
      const track = vid && vid.srcObject ? vid.srcObject.getVideoTracks()[0] : null;
      const caps = track && track.getCapabilities ? track.getCapabilities() : {};
      const btnTorch = $("btnTorch");
      if (btnTorch) {
        btnTorch.classList.toggle("show", !!caps.torch);
        torchOn = false;
        btnTorch.classList.remove("on");
      }
    } catch (_) {}
  }

  async function toggleTorch() {
    try {
      const vid = $("videoPreview");
      const track = vid && vid.srcObject ? vid.srcObject.getVideoTracks()[0] : null;
      if (!track) return;
      torchOn = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      const btnTorch = $("btnTorch");
      if (btnTorch) btnTorch.classList.toggle("on", torchOn);
    } catch (_) {
      torchOn = false;
      notice("Flashlight unsupported on this camera sensor.", "info");
    }
  }

  function flipCamera() {
    if (cameras.length < 2) return;
    camIdx = (camIdx + 1) % cameras.length;
    const id = cameras[camIdx].deviceId;
    stopScanner(true);
    startScanner(id);
  }

  function stopScanner(silent) {
    if (reader) {
      try { reader.reset(); } catch (_) {}
      reader = null;
    }
    const btnStart = $("btnStart");
    const btnStop = $("btnStop");
    const ovBtn = $("ovBtn");

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;

    if (!silent) {
      userStopped = true;
      showOverlay("📷", "Camera Standby", "Tap button to begin barcode scanning.", "Enable camera");
    }
    if (ovBtn) ovBtn.style.display = "";
  }

  async function requestWakeLock() {
    try {
      if (navigator.wakeLock) await navigator.wakeLock.request("screen");
    } catch (_) {}
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && reader) requestWakeLock();
  });

  const btnStart = $("btnStart");
  if (btnStart) btnStart.onclick = () => startScanner();

  const btnStop = $("btnStop");
  if (btnStop) btnStop.onclick = () => stopScanner();

  const ovBtn = $("ovBtn");
  if (ovBtn) {
    ovBtn.onclick = () => {
      if (typeof ZXing === "undefined") location.reload();
      else startScanner();
    };
  }

  const btnTorch = $("btnTorch");
  if (btnTorch) btnTorch.onclick = toggleTorch;

  const btnFlip = $("btnFlip");
  if (btnFlip) btnFlip.onclick = flipCamera;

  /* --------------------------------------------------------------------------
     MANUAL & PHOTO LOOKUP
     -------------------------------------------------------------------------- */
  const manualCode = () => ($("manualInput") ? $("manualInput").value.trim() : "");

  const btnCheck = $("btnCheck");
  if (btnCheck) {
    btnCheck.onclick = () => {
      const c = manualCode();
      if (c && !isProcessing) verifyPass(c, "lookup");
    };
  }

  const btnAdmit = $("btnAdmit");
  if (btnAdmit) {
    btnAdmit.onclick = () => {
      const c = manualCode();
      if (c && !isProcessing) verifyPass(c);
    };
  }

  const btnUndo = $("btnUndo");
  if (btnUndo) {
    btnUndo.onclick = () => {
      const c = manualCode();
      if (!c || isProcessing) return;
      const pin = prompt("Enter Master Admin PIN to reset entry for " + c + ":");
      if (pin) verifyPass(c, "undo", pin);
    };
  }

  const manualInput = $("manualInput");
  if (manualInput) {
    manualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (btnCheck) btnCheck.click();
      }
    });
  }

  const btnPhoto = $("btnPhoto");
  const photoIn = $("photoIn");
  if (btnPhoto && photoIn) {
    btnPhoto.onclick = () => photoIn.click();
    photoIn.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      try {
        const r = await new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(url);
        verifyPass(r.getText());
      } catch (_) {
        notice("No decipherable QR / barcode detected in image. Please retake closer.", "error");
      }
      URL.revokeObjectURL(url);
      e.target.value = "";
    };
  }

  /* --------------------------------------------------------------------------
     NETWORK PROTOCOL (JSONP & CORS FALLBACK)
     -------------------------------------------------------------------------- */
  function jsonpFetch(url) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const s = document.createElement("script");
      let done = false;
      const end = (fn, v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        try { delete window[cb]; } catch (_) {}
        s.remove();
        fn(v);
      };
      const t = setTimeout(() => end(reject, new Error("timeout")), 12000);
      window[cb] = (d) => end(resolve, d);
      s.onerror = () => end(reject, new Error("jsonp-failed"));
      s.src = url + "&callback=" + cb + "&_=" + Date.now();
      document.body.appendChild(s);
    });
  }

  async function callBackend(url) {
    try {
      const d = await jsonpFetch(url);
      setNet(true);
      return d;
    } catch (_) {
      try {
        const r = await fetch(url + "&_=" + Date.now(), { redirect: "follow" });
        const d = JSON.parse(await r.text());
        setNet(true);
        return d;
      } catch (e) {
        setNet(false);
        throw new Error("Server unreachable. Check connection & Google Apps Script deployment.");
      }
    }
  }

  function setNet(ok) {
    const net = $("net");
    if (net) net.classList.toggle("off", !ok);
  }

  window.addEventListener("offline", () => setNet(false));
  window.addEventListener("online", () => {
    setNet(true);
    refreshStats();
  });

  /* --------------------------------------------------------------------------
     STATS TELEMETRY
     -------------------------------------------------------------------------- */
  function updateCounter(st) {
    if (!st) return;
    const sPaid = $("sPaid");
    const sLeft = $("sLeft");
    const sIn = $("sIn");
    const bar = $("bar");

    const left = Math.max(0, (st.paid || 0) - (st.entered || 0));
    if (sPaid) sPaid.textContent = st.paid || 0;
    if (sLeft) sLeft.textContent = left;

    if (sIn) {
      sIn.textContent = st.entered || 0;
      sIn.classList.remove("bump");
      void sIn.offsetWidth;
      sIn.classList.add("bump");
    }

    if (bar) {
      const pct = st.paid ? Math.min(100, (st.entered / st.paid) * 100) : 0;
      bar.style.width = pct + "%";
    }
  }

  async function refreshStats() {
    if (isProcessing || !SPIN) return;
    try {
      const d = await callBackend(
        SCRIPT_WEB_APP_URL +
          "?action=stats&apiKey=" +
          encodeURIComponent(SCANNER_API_KEY) +
          "&spin=" +
          encodeURIComponent(SPIN)
      );
      if (d.authFail) return showLock("Gate PIN rotated. Enter updated credentials.");
      updateCounter(d.stats);
    } catch (_) {}
  }

  setInterval(refreshStats, 30000);

  /* --------------------------------------------------------------------------
     PASS VERIFICATION FLOW
     -------------------------------------------------------------------------- */
  async function verifyPass(code, action = "", pin = "") {
    isProcessing = true;
    notice(
      action === "lookup"
        ? "Auditing ticket status…"
        : action === "undo"
        ? "Reversing attendance…"
        : "Authenticating security pass…",
      "loading"
    );
    let hold = 1500;

    try {
      let url =
        SCRIPT_WEB_APP_URL +
        "?apiKey=" +
        encodeURIComponent(SCANNER_API_KEY) +
        "&qrCode=" +
        encodeURIComponent(code.trim());
      if (action) url += "&action=" + encodeURIComponent(action);
      if (pin) url += "&pin=" + encodeURIComponent(pin);
      url += "&spin=" + encodeURIComponent(SPIN);

      const d = await callBackend(url);
      if (d.authFail) {
        hideNotice();
        return showLock("Invalid Gate PIN credentials.");
      }

      updateCounter(d.stats);
      hideNotice();

      if (d.lookup) {
        const ent = d.attendee && d.attendee.entryStatus === "entered";
        showSheet(
          ent ? "warn" : "neutral",
          ent ? "ALREADY ENTERED" : "NOT ENTERED YET",
          d.message,
          d.attendee
        );
        hold = 2500;
      } else if (d.undone) {
        tone(520, 0.15);
        showSheet("neutral", "ENTRY RESET", "Ticket cleared for gate re-entry.", d.attendee);
        hold = 2500;
      } else if (d.success) {
        tone(880, 0.12);
        vibrate([60]);
        showSheet("ok", "ENTRY GRANTED", d.message, d.attendee, 2500);
      } else {
        tone(250, 0.35);
        vibrate([150, 100, 150]);
        showSheet(
          d.duplicate ? "warn" : "bad",
          d.duplicate ? "ALREADY USED" : "ACCESS DENIED",
          d.message,
          d.attendee,
          4000
        );
        hold = 2500;
      }
    } catch (err) {
      notice(err.message, "error");
    } finally {
      setTimeout(() => {
        isProcessing = false;
      }, hold);
    }
  }

  /* --------------------------------------------------------------------------
     UI FEEDBACK & MODALS
     -------------------------------------------------------------------------- */
  function showSheet(kind, big, msg, a, autoMs) {
    a = a || {};
    const sh = $("sheet");
    if (!sh) return;
    sh.className = "sheet show " + kind;

    const shBig = $("shBig");
    const shMsg = $("shMsg");
    const shName = $("shName");
    const shRid = $("shRid");
    const shDept = $("shDept");
    const shCat = $("shCat");
    const shGen = $("shGen");
    const shTime = $("shTime");

    if (shBig) shBig.textContent = big;
    if (shMsg) shMsg.textContent = msg || "";
    if (shName) shName.textContent = a.name || "—";
    if (shRid) shRid.textContent = a.regId || "";
    if (shDept) shDept.textContent = (a.dept || "—") + (a.sem ? " (" + a.sem + ")" : "");
    if (shCat) shCat.textContent = a.category || "—";
    if (shGen) shGen.textContent = a.gender || "—";
    if (shTime) shTime.textContent = a.entryTime || "—";

    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(hideSheet, autoMs || 4500);
  }

  function hideSheet() {
    const sh = $("sheet");
    if (sh) sh.classList.remove("show");
  }
  window.hideSheet = hideSheet;

  function notice(msg, type) {
    const e = $("status");
    if (!e) return;
    e.className = "status " + type;
    e.textContent = msg;
    if (type !== "loading") setTimeout(hideNotice, 4000);
  }

  function hideNotice() {
    const e = $("status");
    if (e) {
      e.className = "status";
      e.textContent = "";
    }
  }

  function tone(f, d) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const c = new AudioCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = f;
      g.gain.value = 0.2;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + d);
      o.onended = () => c.close();
    } catch (_) {}
  }

  function vibrate(p) {
    if ("vibrate" in navigator) navigator.vibrate(p);
  }

  /* --------------------------------------------------------------------------
     PIN LOCK SYSTEM
     -------------------------------------------------------------------------- */
  function showLock(msg) {
    try {
      sessionStorage.removeItem("nx_spin");
    } catch (_) {}
    SPIN = "";
    stopScanner(true);

    const lockErr = $("lockErr");
    const pinIn = $("pinIn");
    const lock = $("lock");

    if (lockErr) lockErr.textContent = msg || "";
    if (pinIn) pinIn.value = "";
    if (lock) lock.style.display = "flex";
    setTimeout(() => {
      if (pinIn) pinIn.focus();
    }, 50);
  }

  async function tryUnlock(pin, silent) {
    pin = String(pin || "").trim();
    if (!pin) return false;

    const unlockBtn = $("unlockBtn");
    const lockErr = $("lockErr");
    const lock = $("lock");

    if (unlockBtn) {
      unlockBtn.disabled = true;
      unlockBtn.textContent = "VERIFYING…";
    }

    let ok = false;
    try {
      const d = await callBackend(
        SCRIPT_WEB_APP_URL +
          "?action=stats&apiKey=" +
          encodeURIComponent(SCANNER_API_KEY) +
          "&spin=" +
          encodeURIComponent(pin)
      );
      if (d.authFail) {
        if (!silent && lockErr) lockErr.textContent = "Access Denied: Incorrect PIN.";
      } else if (d.stats || d.success !== undefined) {
        ok = true;
        SPIN = pin;
        try {
          sessionStorage.setItem("nx_spin", pin);
        } catch (_) {}
        updateCounter(d.stats);
      } else if (!silent && lockErr) {
        lockErr.textContent = d.message || "Unable to authorize gate credentials.";
      }
    } catch (e) {
      if (!silent && lockErr) lockErr.textContent = e.message;
    }

    if (unlockBtn) {
      unlockBtn.disabled = false;
      unlockBtn.textContent = "UNLOCK SCANNER";
    }

    if (ok) {
      if (lock) lock.style.display = "none";
      startScanner();
    }
    return ok;
  }

  const unlockBtn = $("unlockBtn");
  const pinIn = $("pinIn");
  if (unlockBtn && pinIn) {
    unlockBtn.onclick = () => tryUnlock(pinIn.value);
    pinIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") unlockBtn.click();
    });
  }

  const lockBtn = $("lockBtn");
  if (lockBtn) lockBtn.onclick = () => showLock("");

  /* --------------------------------------------------------------------------
     SYSTEM BOOTSTRAP
     -------------------------------------------------------------------------- */
  showOverlay("📷", "Camera Standby", "Tap button to begin barcode scanning.", "Enable camera");

  window.addEventListener("load", async () => {
    if (SPIN && (await tryUnlock(SPIN, true))) return;
    showLock("");
  });
})();
