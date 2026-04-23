// =============================================
// ГИМНАЗИЯ ГАНЧ — Main Application
// Firebase Realtime Database + Google Auth
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  get,
  remove,
  onValue,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---- Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyAqlg4b-vhtRhmSHOtyMNJ8Jx_1tkBvxTQ",
  authDomain: "ganj-20dbb.firebaseapp.com",
  projectId: "ganj-20dbb",
  storageBucket: "ganj-20dbb.firebasestorage.app",
  messagingSenderId: "859797495197",
  appId: "1:859797495197:web:87172b5aa745c30a556374",
  databaseURL: "https://ganj-20dbb-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ---- Allowed Google accounts (email whitelist) ----
// Добавьте сюда email-адреса тех, кто может войти в систему
const ALLOWED_EMAILS = [
  // "director@gmail.com",
  // "accountant@gmail.com",
  // Оставьте пустым чтобы разрешить любой Google аккаунт
];

// ---- Constants ----
const CLASSES = [
  "1а","1б","2а","2б","3а","3б","4а","4б","5а","5б",
  "6а","6б","7а","7б","8а","8б","9а","9б","10а","10б","11а","11б"
];

const MONTHS_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

const CAT_ICONS = {
  "канцелярия": "✏️",
  "коммунальные": "💡",
  "зарплата": "💼",
  "ремонт": "🔧",
  "оборудование": "🖥️",
  "мероприятия": "🎉",
  "прочее": "📦"
};

// ---- State ----
let students = {};
let payments = {};
let expenses = {};
let activeClass = "11а";
let activePage = "dashboard";
let editingStudentId = null;
let selectMode = false;
let selectedStudents = new Set();
let studentSearchQuery = "";
let studentStatusFilter = "";
let paymentSortKey = "createdAt";
let paymentSortDir = "desc";
let studentSortKey = "name";
let studentSortDir = "asc";
let expensePieChart = null;
let importedStudents = [];

const now = new Date();
let currentMonth = now.getMonth();
let currentYear = now.getFullYear();

// ---- Init ----
let isAppInitialized = false;

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem('ganj-theme') || 'light';
  applyTheme(saved);
}
function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('ganj-theme', theme);
}
function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
}

document.addEventListener("DOMContentLoaded", () => {
  // Apply saved theme immediately (before auth)
  initTheme();

  // Wire theme toggles
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  document.getElementById("themeToggleMob")?.addEventListener("click", toggleTheme);

  // Show loader immediately, hide authScreen until auth resolves
  document.getElementById("authScreen").classList.add("hidden");

  // Auth state listener — controls what user sees
  onAuthStateChanged(auth, (user) => {
    // Always hide loader once auth state is known
    document.getElementById("loaderScreen").classList.add("hidden");

    if (user) {
      // Check whitelist if it has entries
      if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
        showAuthError(`Доступ запрещён для ${user.email}. Обратитесь к администратору.`);
        signOut(auth);
        return;
      }
      // Logged in — show app
      document.getElementById("authScreen").classList.add("hidden");
      document.getElementById("app-shell").classList.remove("hidden");
      renderUserInfo(user);
      // Setup UI only once (DOM wiring)
      if (!isAppInitialized) {
        isAppInitialized = true;
        setupUI();
      }
      // Always re-subscribe to get fresh realtime data
      subscribeToData();
    } else {
      // Logged out — show auth screen, hide app
      isAppInitialized = false;
      document.getElementById("authScreen").classList.remove("hidden");
      document.getElementById("app-shell").classList.add("hidden");
    }
  });

  // Login button
  document.getElementById("googleSignInBtn").addEventListener("click", async () => {
    const btn = document.getElementById("googleSignInBtn");
    btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Вход...`;
    clearAuthError();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Войти через Google`;
      if (e.code !== "auth/popup-closed-by-user") {
        showAuthError("Ошибка входа. Попробуйте ещё раз.");
      }
    }
  });

  // Logout button (desktop sidebar)
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (confirm("Выйти из системы?")) {
      await signOut(auth);
      showToast("Вы вышли из системы");
    }
  });

  // Mobile profile button — tap avatar to show logout menu
  document.getElementById("mobProfileBtn")?.addEventListener("click", () => {
    showMobileLogoutMenu();
  });
});

// ---- Subscribe to realtime data ----
let _unsubs = [];
function subscribeToData() {
  _unsubs.forEach(fn => fn());
  _unsubs = [];
  const onErr = (err) => {
    console.error("DB error:", err.code, err.message);
    showToast("Ошибка чтения: " + err.code, true);
  };
  // Show skeletons while first load
  renderSkeleton("classContent", 6);
  renderSkeleton("recentPayments", 4);
  renderSkeleton("debtorsGrid", 3);

  _unsubs.push(onValue(ref(db, "students"), snap => {
    students = snap.val() || {};
    refreshAll();
  }, onErr));
  _unsubs.push(onValue(ref(db, "payments"), snap => {
    payments = snap.val() || {};
    refreshAll();
  }, onErr));
  _unsubs.push(onValue(ref(db, "expenses"), snap => {
    expenses = snap.val() || {};
    refreshAll();
  }, onErr));
}

function refreshAll() {
  try {
    renderDashboard();
    renderClassContent(activeClass);
    renderDebtors();
    renderExpenses();
    renderPaymentsTable();
    updateDebtorsBadge();
  } catch(e) {
    console.error("refreshAll error:", e);
  }
}

function renderUserInfo(user) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  // Desktop sidebar user info
  const el = document.getElementById("userInfo");
  if (el) {
    const avatarHtml = user.photoURL
      ? `<img src="${user.photoURL}" alt="" class="user-avatar" onerror="this.style.display='none'">`
      : `<div class="user-avatar-placeholder">${(user.displayName||"?")[0].toUpperCase()}</div>`;
    el.innerHTML = `
      <div class="user-info-card">
        <div class="user-avatar-wrap">
          ${avatarHtml}
          <div class="user-online-dot"></div>
        </div>
        <div class="user-details">
          <div class="user-name">${user.displayName || "Пользователь"}</div>
          <div class="user-email">${user.email}</div>
          <div class="user-last-login">Вход: ${dateStr}, ${timeStr}</div>
        </div>
      </div>`;
  }
  // Mobile header avatar
  const mobAvatar = document.getElementById("mobAvatar");
  const mobIcon   = document.getElementById("mobAvatarIcon");
  if (mobAvatar && user.photoURL) {
    mobAvatar.src = user.photoURL;
    mobAvatar.style.display = "block";
    if (mobIcon) mobIcon.style.display = "none";
  }
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function clearAuthError() {
  const el = document.getElementById("authError");
  if (el) el.style.display = "none";
}

// =============================================
// UI SETUP
// =============================================
function setupUI() {
  // Page date
  document.getElementById("pageDate").textContent =
    new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Current month footer + topbar
  const monthLabel = MONTHS_RU[currentMonth] + " " + currentYear;
  document.getElementById("currentMonth").textContent = monthLabel.toUpperCase();
  const topbarMonth = document.getElementById("topbarMonth");
  if (topbarMonth) topbarMonth.textContent = monthLabel;

  // Greeting by time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const topbarGreeting = document.getElementById("topbarGreeting");
  if (topbarGreeting) topbarGreeting.textContent = greeting;

  // Desktop nav items
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.page);
      closeSidebar();
    });
  });
  // Mobile bottom nav items
  document.querySelectorAll(".mob-nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
  document.querySelectorAll(".text-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });

  // Build class tabs
  const tabsEl = document.getElementById("classTabs");
  CLASSES.forEach(cls => {
    const tab = document.createElement("button");
    tab.className = "class-tab" + (cls === activeClass ? " active" : "");
    tab.textContent = cls.toUpperCase();
    tab.addEventListener("click", () => {
      activeClass = cls;
      document.querySelectorAll(".class-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderClassContent(cls);
    });
    tabsEl.appendChild(tab);
  });

  // Month/year selects
  populateMonthSelects();

  // Modals
  document.getElementById("addStudentBtn").addEventListener("click", () => {
    editingStudentId = null;
    document.getElementById("modalStudentTitle").textContent = "Добавить ученика";
    document.getElementById("studentName").value = "";
    document.getElementById("studentClass").value = activeClass;
    document.getElementById("studentFee").value = "200";
    document.getElementById("studentPhone").value = "";
    openModal("modalStudent");
  });
  document.getElementById("saveStudentBtn").addEventListener("click", saveStudent);

  document.getElementById("addPaymentBtn").addEventListener("click", () => openPaymentModal());
  document.getElementById("savePaymentBtn").addEventListener("click", savePayment);

  document.getElementById("addExpenseBtn").addEventListener("click", () => {
    document.getElementById("expenseDesc").value = "";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];
    openModal("modalExpense");
  });
  document.getElementById("saveExpenseBtn").addEventListener("click", saveExpense);

  // Close modals
  document.querySelectorAll(".modal-close, [data-modal]").forEach(btn => {
    if (btn.dataset.modal) {
      btn.addEventListener("click", () => closeModal(btn.dataset.modal));
    }
  });
  document.getElementById("modalOverlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modalOverlay")) closeAllModals();
  });

  // Mobile sidebar
  document.getElementById("mobileToggle")?.addEventListener("click", toggleSidebar);
  document.getElementById("overlay")?.addEventListener("click", closeSidebar);

  // Filter selects
  document.getElementById("filterClass").innerHTML =
    '<option value="">Все классы</option>' +
    CLASSES.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join("");
  document.getElementById("filterClass").addEventListener("change", renderPaymentsTable);
  document.getElementById("filterMonth").addEventListener("change", renderPaymentsTable);
  document.getElementById("filterYear").addEventListener("change", renderPaymentsTable);

  // Debtor selects
  document.getElementById("debtorMonth").addEventListener("change", renderDebtors);
  document.getElementById("debtorYear").addEventListener("change", renderDebtors);

  // ── Export & utility buttons ──
  document.getElementById("exportClassCsvBtn")?.addEventListener("click", exportClassCSV);
  document.getElementById("importCsvBtn")?.addEventListener("click", () => {
    document.getElementById("csvFileInput").value = "";
    document.getElementById("importPreview").classList.add("hidden");
    document.getElementById("importError").classList.add("hidden");
    document.getElementById("confirmImportBtn").classList.add("hidden");
    openModal("modalImportCSV");
  });
  document.getElementById("csvFileInput")?.addEventListener("change", handleCSVFile);
  document.getElementById("confirmImportBtn")?.addEventListener("click", confirmImport);
  document.getElementById("downloadTemplateBtn")?.addEventListener("click", downloadImportTemplate);
  document.getElementById("exportPaymentsCsvBtn")?.addEventListener("click", exportPaymentsCSV);
  document.getElementById("exportPaymentsPdfBtn")?.addEventListener("click", exportPaymentsPDF);
  document.getElementById("exportDebtorsCsvBtn")?.addEventListener("click", exportDebtorsCSV);
  document.getElementById("copyDebtorsBtn")?.addEventListener("click", copyDebtorsList);

  // ── Batch select ──
  document.getElementById("selectModeBtn")?.addEventListener("click", toggleSelectMode);
  document.getElementById("batchCancelBtn")?.addEventListener("click", cancelSelectMode);
  document.getElementById("batchPaidBtn")?.addEventListener("click", markSelectedAsPaid);

  // ── Search & filter in classes ──
  document.getElementById("studentSearch")?.addEventListener("input", e => {
    studentSearchQuery = e.target.value.toLowerCase();
    renderClassContent(activeClass);
  });
  document.getElementById("statusFilter")?.addEventListener("change", e => {
    studentStatusFilter = e.target.value;
    renderClassContent(activeClass);
  });

  // ── Search in payments ──
  document.getElementById("searchStudent")?.addEventListener("input", renderPaymentsTable);

  // ── Edit payment ──
  document.getElementById("saveEditPaymentBtn")?.addEventListener("click", saveEditPayment);

  // ── Populate edit modal month/year selects ──
  const editMonthSel = document.getElementById("editPaymentMonth");
  const editYearSel  = document.getElementById("editPaymentYear");
  if (editMonthSel) {
    editMonthSel.innerHTML = MONTHS_RU.map((m, i) =>
      `<option value="${i}" ${i === currentMonth ? "selected" : ""}>${m}</option>`).join("");
  }
  if (editYearSel) {
    const years = [];
    for (let y = 2023; y <= currentYear + 1; y++) years.push(y);
    editYearSel.innerHTML = years.map(y =>
      `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`).join("");
  }
}

function populateMonthSelects() {
  const ids = ["paymentMonth", "filterMonth", "debtorMonth"];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = MONTHS_RU.map((m, i) =>
      `<option value="${i}" ${i === currentMonth ? "selected" : ""}>${m}</option>`
    ).join("");
  });

  const yearIds = ["paymentYear", "filterYear", "debtorYear"];
  const years = [];
  for (let y = 2023; y <= currentYear + 1; y++) years.push(y);
  yearIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = years.map(y =>
      `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`
    ).join("");
  });
}

// =============================================
// NAVIGATION
// =============================================
function navigateTo(page) {
  activePage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + page)?.classList.add("active");
  // Desktop sidebar nav
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });
  // Mobile bottom nav
  document.querySelectorAll(".mob-nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });
  // Scroll to top on mobile
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// =============================================
// DASHBOARD
// =============================================
function renderDashboard() {
  const studentsArr = Object.values(students);
  document.getElementById("totalStudents").textContent = studentsArr.length;

  // Collected this month
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  let collected = 0;
  Object.values(payments).forEach(p => {
    if (p.monthKey === monthKey) collected += Number(p.amount) || 0;
  });
  document.getElementById("totalCollected").textContent = formatMoney(collected);

  // Debtors
  const debtors = getDebtorsList(currentMonth, currentYear);
  const totalDebtorCount = Object.values(debtors).reduce((s, arr) => s + arr.length, 0);
  document.getElementById("totalDebtors").textContent = totalDebtorCount;

  // Expenses this month
  let expTotal = 0;
  Object.values(expenses).forEach(e => {
    const d = new Date(e.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      expTotal += Number(e.amount) || 0;
    }
  });
  document.getElementById("totalExpenses").textContent = formatMoney(expTotal);

  renderClassChart();
  renderRecentPayments();
  renderYearlyStats();
}

function renderYearlyStats() {
  // Total collected this year
  let yearTotal = 0, yearExpenses = 0;
  const monthlyData = new Array(12).fill(0);

  Object.values(payments).forEach(p => {
    if (Number(p.year) === currentYear) {
      yearTotal += Number(p.amount) || 0;
      monthlyData[Number(p.month)] += Number(p.amount) || 0;
    }
  });
  Object.values(expenses).forEach(e => {
    const d = new Date(e.date);
    if (d.getFullYear() === currentYear) yearExpenses += Number(e.amount) || 0;
  });

  const bestMonth = monthlyData.indexOf(Math.max(...monthlyData));
  const avgMonth  = Math.round(monthlyData.filter(v => v > 0).reduce((a, b) => a + b, 0) /
                   Math.max(monthlyData.filter(v => v > 0).length, 1));
  const balance   = yearTotal - yearExpenses;

  const el = document.getElementById("yearlyStats");
  if (!el) return;
  el.innerHTML = `
    <div class="year-pill">
      <div class="year-pill-label">Собрано за ${currentYear}</div>
      <div class="year-pill-value" style="color:var(--green)">${formatMoney(yearTotal)}</div>
      <div class="year-pill-sub">${Object.values(payments).filter(p => Number(p.year) === currentYear).length} платежей</div>
    </div>
    <div class="year-pill">
      <div class="year-pill-label">Расходы за ${currentYear}</div>
      <div class="year-pill-value" style="color:var(--orange)">${formatMoney(yearExpenses)}</div>
      <div class="year-pill-sub">За ${Object.values(expenses).filter(e => new Date(e.date).getFullYear() === currentYear).length} записей</div>
    </div>
    <div class="year-pill">
      <div class="year-pill-label">Баланс за ${currentYear}</div>
      <div class="year-pill-value" style="color:${balance >= 0 ? 'var(--green)' : 'var(--red)'}">${formatMoney(balance)}</div>
      <div class="year-pill-sub">${balance >= 0 ? 'Профицит' : 'Дефицит'}</div>
    </div>
    <div class="year-pill">
      <div class="year-pill-label">Лучший месяц</div>
      <div class="year-pill-value">${MONTHS_RU[bestMonth] || '—'}</div>
      <div class="year-pill-sub">${formatMoney(monthlyData[bestMonth])}</div>
    </div>
    <div class="year-pill">
      <div class="year-pill-label">Среднее в месяц</div>
      <div class="year-pill-value">${formatMoney(avgMonth)}</div>
      <div class="year-pill-sub">за активные месяцы</div>
    </div>`;
}

function renderClassChart() {
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const byClass = {};
  CLASSES.forEach(c => byClass[c] = 0);
  Object.values(payments).forEach(p => {
    if (p.monthKey === monthKey && byClass[p.studentClass] !== undefined) {
      byClass[p.studentClass] += Number(p.amount) || 0;
    }
  });

  const activeClasses = CLASSES.filter(c => {
    const hasStudents = Object.values(students).some(s => s.class === c);
    return hasStudents || byClass[c] > 0;
  });

  if (!activeClasses.length) {
    document.getElementById("classChart").innerHTML = '<div class="empty-state">Нет данных</div>';
    return;
  }

  const maxVal = Math.max(...activeClasses.map(c => byClass[c]), 1);
  const bars = activeClasses.map(c => {
    const h = Math.max(4, Math.round((byClass[c] / maxVal) * 160));
    return `<div class="bar-group">
      <div class="bar-wrap">
        <div class="bar" style="height:${h}px">
          <div class="bar-tooltip">${c.toUpperCase()}: ${formatMoney(byClass[c])}</div>
        </div>
      </div>
      <div class="bar-label">${c.toUpperCase()}</div>
    </div>`;
  }).join("");

  document.getElementById("classChart").innerHTML =
    `<div class="bar-chart">${bars}</div>`;
}

function renderRecentPayments() {
  const all = Object.entries(payments)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);

  if (!all.length) {
    document.getElementById("recentPayments").innerHTML = '<div class="empty-state">Нет платежей</div>';
    return;
  }

  document.getElementById("recentPayments").innerHTML = all.map(p => {
    const name = p.studentName || "—";
    const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    return `<div class="recent-item">
      <div class="recent-avatar">${initials}</div>
      <div class="recent-info">
        <div class="recent-name">${name}</div>
        <div class="recent-class">${(p.studentClass || "").toUpperCase()} · ${MONTHS_RU[Number(p.month) || 0]}</div>
      </div>
      <div class="recent-amount">+${formatMoney(p.amount)}</div>
    </div>`;
  }).join("");
}

// =============================================
// CLASSES
// =============================================
function renderClassContent(cls) {
  let classStudents = Object.entries(students)
    .filter(([, s]) => s.class === cls)
    .map(([id, s]) => ({ id, ...s }));

  // Sort
  classStudents.sort((a, b) => {
    let va, vb;
    if (studentSortKey === "name") { va = a.name || ""; vb = b.name || ""; return studentSortDir === "asc" ? va.localeCompare(vb, "ru") : vb.localeCompare(va, "ru"); }
    if (studentSortKey === "fee")  { va = Number(a.fee)||0; vb = Number(b.fee)||0; }
    if (studentSortKey === "paid") { va = getPaidAmount(a.id, currentMonth, currentYear); vb = getPaidAmount(b.id, currentMonth, currentYear); }
    return studentSortDir === "asc" ? va - vb : vb - va;
  });

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  let paidCount = 0;
  let totalCollected = 0;

  // Apply search & status filter
  let filtered = classStudents;
  if (studentSearchQuery) {
    filtered = filtered.filter(s => (s.name || "").toLowerCase().includes(studentSearchQuery));
  }

  const rows = filtered.map(s => {
    const paid = getPaidAmount(s.id, currentMonth, currentYear);
    const fee = Number(s.fee) || 0;
    totalCollected += paid;

    let statusKey, statusHtml;
    if (paid >= fee) {
      paidCount++;
      statusKey = "paid";
      statusHtml = `<span class="status-badge status-paid">✓ Оплачено</span>`;
    } else if (paid > 0) {
      statusKey = "partial";
      statusHtml = `<span class="status-badge status-partial">~ Частично</span>`;
    } else {
      statusKey = "unpaid";
      statusHtml = `<span class="status-badge status-unpaid">✕ Не оплачено</span>`;
    }

    if (studentStatusFilter && statusKey !== studentStatusFilter) return "";

    const isSelected = selectedStudents.has(s.id);
    const checkboxCol = selectMode
      ? `<td><input type="checkbox" class="row-checkbox" ${isSelected ? "checked" : ""}
           onchange="toggleStudentSelect('${s.id}', this.checked)"></td>`
      : "";
    const actionsCol = selectMode ? `<td></td>` : `<td>
        <button class="action-btn" onclick="quickPayment('${s.id}')" title="Добавить платёж">💳</button>
        <button class="action-btn" onclick="editStudent('${s.id}')" title="Редактировать">✏️</button>
        <button class="action-btn danger" onclick="deleteStudent('${s.id}')" title="Удалить">🗑️</button>
      </td>`;

    return `<tr class="${isSelected ? "selected" : ""}">
      ${checkboxCol}
      <td>${s.name || "—"}</td>
      <td>${s.phone || "—"}</td>
      <td>${formatMoney(fee)}</td>
      <td>${paid > 0 ? formatMoney(paid) : "—"}</td>
      <td>${statusHtml}</td>
      ${actionsCol}
    </tr>`;
  }).filter(Boolean).join("");

  const total = classStudents.length;
  const unpaid = total - paidCount;

  const avgPayment = paidCount > 0 ? Math.round(totalCollected / paidCount) : 0;
  const paidPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const progressClass = paidPct >= 80 ? "" : paidPct >= 50 ? "warn" : "danger";

  document.getElementById("classContent").innerHTML = `
    <div class="class-stats-row">
      <div class="class-stat-pill">Учеников: <span>${total}</span></div>
      <div class="class-stat-pill">Оплатили: <span>${paidCount}</span></div>
      <div class="class-stat-pill">Должников: <span style="color:var(--red)">${unpaid}</span></div>
      <div class="class-stat-pill">Собрано: <span style="color:var(--green)">${formatMoney(totalCollected)}</span></div>
      <div class="class-stat-pill">Сред. платёж: <span>${formatMoney(avgPayment)}</span></div>
    </div>
    <div class="class-progress-wrap">
      <div class="class-progress-header">
        <span>Оплатили в ${MONTHS_RU[currentMonth]}</span>
        <span class="class-progress-pct">${paidPct}% (${paidCount} из ${total})</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill ${progressClass}" style="width:${paidPct}%"></div>
      </div>
    </div>
    <div class="students-table-wrap">
      ${total === 0 ? '<div class="empty-state">Нет учеников в этом классе. Добавьте первого!</div>' : `
      <table class="students-table">
        <thead>
          <tr>
            ${selectMode ? '<th><input type="checkbox" class="row-checkbox" onchange="toggleSelectAll(this.checked)"></th>' : ""}
            <th class="sortable ${studentSortKey==='name'?studentSortDir:''}" onclick="setSortStudents('name')">Имя</th>
            <th>Телефон</th>
            <th class="sortable ${studentSortKey==='fee'?studentSortDir:''}" onclick="setSortStudents('fee')">Плата/мес</th>
            <th class="sortable ${studentSortKey==='paid'?studentSortDir:''}" onclick="setSortStudents('paid')">${MONTHS_RU[currentMonth]} ${currentYear}</th>
            <th>Статус</th>
            <th>${selectMode ? "" : "Действия"}</th>
          </tr>
        </thead>
<tbody>${rows}</tbody>
      </table>
      <div class="student-card-list">${buildStudentCards(filtered)}</div>`}
    </div>`;
}

function buildStudentCards(list) {
  return list.filter(s => {
    if (!studentStatusFilter) return true;
    const p = getPaidAmount(s.id, currentMonth, currentYear);
    const f = Number(s.fee) || 0;
    const sk = p >= f ? "paid" : p > 0 ? "partial" : "unpaid";
    return sk === studentStatusFilter;
  }).map(s => {
    const paid = getPaidAmount(s.id, currentMonth, currentYear);
    const fee  = Number(s.fee) || 0;
    const badge = paid >= fee
      ? '<span class="status-badge status-paid">✓ Оплачено</span>'
      : paid > 0
        ? '<span class="status-badge status-partial">~ Частично</span>'
        : '<span class="status-badge status-unpaid">✕ Не оплачено</span>';
    const phone = s.phone
      ? '<div class="student-card-row"><span>Телефон</span><span>' + s.phone + '</span></div>'
      : '';
    return '<div class="student-card">' +
      '<div class="student-card-top">' +
        '<div class="student-card-name">' + (s.name || "—") + '</div>' +
        '<div class="student-card-class">' + (s.class || "").toUpperCase() + '</div>' +
      '</div>' +
      badge +
      '<div class="student-card-row"><span>Плата/мес</span><span>' + formatMoney(fee) + '</span></div>' +
      '<div class="student-card-row"><span>Оплачено</span><span style="color:var(--green)">' +
        (paid > 0 ? formatMoney(paid) : "—") + '</span></div>' +
      phone +
      '<div class="student-card-actions">' +
        '<button class="btn-secondary" onclick="quickPayment(&apos;' + s.id + '&apos;)">💳</button>' +
        '<button class="btn-secondary" onclick="editStudent(&apos;' + s.id + '&apos;)">✏️</button>' +
        '<button class="action-btn danger" onclick="deleteStudent(&apos;' + s.id + '&apos;)">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join("");

}

// =============================================
// DEBTORS
// =============================================
function renderDebtors() {
  const month = parseInt(document.getElementById("debtorMonth")?.value ?? currentMonth);
  const year = parseInt(document.getElementById("debtorYear")?.value ?? currentYear);
  const debtors = getDebtorsList(month, year);

  const activeClasses = CLASSES.filter(c =>
    Object.values(students).some(s => s.class === c)
  );

  if (!activeClasses.length) {
    document.getElementById("debtorsGrid").innerHTML =
      '<div class="empty-state">Нет учеников в системе</div>';
    return;
  }

  let totalDebtors = 0;
  let grandTotalDebt = 0;
  const cards = activeClasses.map(cls => {
    const list = debtors[cls] || [];
    totalDebtors += list.length;
    list.forEach(d => grandTotalDebt += d.debt);

    const items = list.length === 0
      ? '<div class="no-debtors">✓ Все оплатили</div>'
      : list.map(d => `
        <div class="debtor-item">
          <span class="debtor-name">
            ${d.name}
            ${d.streak >= 2 ? `<span class="debtor-escalated">🔴 ${d.streak} мес.</span>` : ""}
          </span>
          <span class="debtor-amount">-${formatMoney(d.debt)}</span>
        </div>`).join("");

    return `<div class="debtor-card">
      <div class="debtor-card-header">
        <div class="debtor-class-label">${cls.toUpperCase()}</div>
        ${list.length > 0 ? `<div class="debtor-count">${list.length} чел.</div>` : ""}
      </div>
      <div class="debtor-list">${items}</div>
    </div>`;
  }).join("");

  document.getElementById("debtorsGrid").innerHTML =
    (grandTotalDebt > 0 ? `<div class="debtors-total-bar" style="grid-column:1/-1">
      <div><div class="debtors-total-label">Общий долг по школе</div></div>
      <div class="debtors-total-value">−${formatMoney(grandTotalDebt)}</div>
    </div>` : "") + cards;
  updateDebtorsBadge();
}

function getDebtorsList(month, year) {
  const result = {};
  CLASSES.forEach(c => result[c] = []);

  Object.entries(students).forEach(([id, s]) => {
    const paid = getPaidAmount(id, month, year);
    const fee = Number(s.fee) || 0;
    if (paid < fee) {
      // Check escalation: how many consecutive months unpaid?
      let streak = 0;
      let m = month, y = year;
      for (let i = 0; i < 6; i++) {
        if (getPaidAmount(id, m, y) < fee) streak++;
        else break;
        m--; if (m < 0) { m = 11; y--; }
      }
      result[s.class] = result[s.class] || [];
      result[s.class].push({ name: s.name, debt: fee - paid, streak });
    }
  });
  return result;
}

function updateDebtorsBadge() {
  const debtors = getDebtorsList(currentMonth, currentYear);
  const count = Object.values(debtors).reduce((s, arr) => s + arr.length, 0);
  // Desktop sidebar badge
  const badge = document.getElementById("debtorsBadge");
  if (badge) badge.textContent = count > 0 ? count : "";
  // Mobile bottom nav badge
  const mobBadge = document.getElementById("mobDebtorsBadge");
  if (mobBadge) mobBadge.textContent = count > 0 ? count : "";
}

// =============================================
// EXPENSES
// =============================================
function renderExpenses() {
  const expArr = Object.entries(expenses)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Summary
  const byCategory = {};
  let monthTotal = 0;
  let allTotal = 0;
  expArr.forEach(e => {
    const d = new Date(e.date);
    const cat = e.category || "прочее";
    allTotal += Number(e.amount) || 0;
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthTotal += Number(e.amount) || 0;
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount) || 0;
    }
  });

  document.getElementById("expensesSummary").innerHTML = `
    <div class="exp-summary-pill">
      <div class="pill-label">За этот месяц</div>
      <div class="pill-value" style="color:var(--orange)">${formatMoney(monthTotal)}</div>
    </div>
    <div class="exp-summary-pill">
      <div class="pill-label">Всего</div>
      <div class="pill-value">${formatMoney(allTotal)}</div>
    </div>
    ${Object.entries(byCategory).map(([cat, amt]) => `
    <div class="exp-summary-pill">
      <div class="pill-label">${capitalize(cat)}</div>
      <div class="pill-value" style="font-size:15px">${formatMoney(amt)}</div>
    </div>`).join("")}`;

  if (!expArr.length) {
    document.getElementById("expensesList").innerHTML = '<div class="empty-state">Нет расходов. Добавьте первый!</div>';
    return;
  }

  document.getElementById("expensesList").innerHTML = expArr.map((e, i) => `
    <div class="expense-item" style="animation-delay:${i * 0.04}s">
      <div class="expense-cat-icon">${CAT_ICONS[e.category] || "📦"}</div>
      <div class="expense-info">
        <div class="expense-desc">${e.description || "—"}</div>
        <div class="expense-meta">${capitalize(e.category || "прочее")} · ${formatDate(e.date)}</div>
      </div>
      <div class="expense-amount">−${formatMoney(e.amount)}</div>
      <button class="expense-delete" onclick="deleteExpense('${e.id}')" title="Удалить">✕</button>
    </div>`).join("");

  renderExpensePieChart(byCategory);
}

function renderExpensePieChart(byCategory) {
  const canvas = document.getElementById("expensePieChart");
  if (!canvas) return;

  const labels  = Object.keys(byCategory).map(capitalize);
  const data    = Object.values(byCategory);
  const total   = data.reduce((a, b) => a + b, 0);

  const COLORS = ["#c9a84c","#3ecf8e","#6e9ef0","#f0a96e","#f06e6e","#b06ef0","#6ef0e8"];

  // Destroy previous chart instance to avoid canvas reuse error
  if (expensePieChart) { expensePieChart.destroy(); expensePieChart = null; }

  if (!data.length) {
    canvas.parentElement.innerHTML = '<div class="empty-state" style="padding:32px">Нет данных за этот месяц</div>';
    document.getElementById("pieLegend").innerHTML = "";
    return;
  }

  expensePieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS.slice(0, data.length), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      cutout: "62%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.toLocaleString("ru-RU")} с (${Math.round(ctx.parsed/total*100)}%)`
          }
        }
      }
    }
  });

  // Custom legend
  const legendEl = document.getElementById("pieLegend");
  if (legendEl) {
    legendEl.innerHTML = Object.entries(byCategory).map(([cat, amt], i) => `
      <div class="pie-legend-item">
        <div class="pie-legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <div class="pie-legend-label">${capitalize(cat)}</div>
        <div class="pie-legend-value">${formatMoney(amt)}</div>
      </div>`).join("");
  }
}

// =============================================
// PAYMENTS TABLE
// =============================================
function renderPaymentsTable() {
  const filterClass = document.getElementById("filterClass")?.value || "";
  const filterMonth = document.getElementById("filterMonth")?.value;
  const filterYear = document.getElementById("filterYear")?.value;

  const searchVal = (document.getElementById("searchStudent")?.value || "").toLowerCase();

  let paymentsArr = Object.entries(payments).map(([id, p]) => ({ id, ...p }));

  if (filterClass) paymentsArr = paymentsArr.filter(p => p.studentClass === filterClass);
  if (filterMonth !== "" && filterMonth !== undefined) {
    paymentsArr = paymentsArr.filter(p => String(p.month) === String(filterMonth));
  }
  if (filterYear) paymentsArr = paymentsArr.filter(p => String(p.year) === String(filterYear));
  if (searchVal) paymentsArr = paymentsArr.filter(p => (p.studentName || "").toLowerCase().includes(searchVal));

  // Status filter (п.2 — was wired in HTML but not JS)
  const filterStatus = document.getElementById("filterStatus")?.value || "";
  if (filterStatus) {
    paymentsArr = paymentsArr.filter(p => {
      const s = students[p.studentId];
      const fee = Number(s?.fee) || Number(p.amount) || 0;
      const paid = getPaidAmount(p.studentId, Number(p.month), Number(p.year));
      if (filterStatus === "paid")    return paid >= fee;
      if (filterStatus === "unpaid")  return paid === 0;
      if (filterStatus === "partial") return paid > 0 && paid < fee;
      return true;
    });
  }

  // Sort
  paymentsArr.sort((a, b) => {
    let va, vb;
    if (paymentSortKey === "name")   { va = a.studentName||""; vb = b.studentName||""; return paymentSortDir==="asc" ? va.localeCompare(vb,"ru") : vb.localeCompare(va,"ru"); }
    if (paymentSortKey === "amount") { va = Number(a.amount)||0; vb = Number(b.amount)||0; }
    else /* date/createdAt */        { va = a.createdAt||0; vb = b.createdAt||0; }
    return paymentSortDir === "asc" ? va - vb : vb - va;
  });

  const tbody = document.getElementById("paymentsTableBody");
  if (!paymentsArr.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Нет данных</td></tr>';
    return;
  }

  tbody.innerHTML = paymentsArr.map(p => `
    <tr>
      <td>${p.studentName || "—"}</td>
      <td>${(p.studentClass || "").toUpperCase()}</td>
      <td class="amount-cell">${formatMoney(p.amount)}</td>
      <td>${MONTHS_RU[Number(p.month) || 0]} ${p.year || ""}</td>
      <td>${p.createdAt ? formatDate(new Date(p.createdAt).toISOString().split("T")[0]) : "—"}</td>
      <td>
        <button class="action-btn" onclick="openEditPayment('${p.id}')" title="Редактировать">✏️</button>
        <button class="action-btn danger" onclick="deletePayment('${p.id}')" title="Удалить">🗑️</button>
      </td>
    </tr>`).join("");

  // Mobile card view — injected after table
  const wrap = document.querySelector(".payments-table-wrap");
  let cardList = wrap?.querySelector(".payment-card-list");
  if (!cardList && wrap) {
    cardList = document.createElement("div");
    cardList.className = "payment-card-list";
    wrap.appendChild(cardList);
  }
  if (cardList) {
    cardList.innerHTML = paymentsArr.map(p => {
      const initials = (p.studentName || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
      return `<div class="payment-card">
        <div class="payment-card-avatar">${initials}</div>
        <div class="payment-card-info">
          <div class="payment-card-name">${p.studentName || "—"}</div>
          <div class="payment-card-meta">${(p.studentClass||"").toUpperCase()} · ${MONTHS_RU[Number(p.month)||0]} ${p.year||""}</div>
        </div>
        <div class="payment-card-right">
          <div class="payment-card-amount">+${formatMoney(p.amount)}</div>
          <div class="payment-card-date">${p.createdAt ? formatDate(new Date(p.createdAt).toISOString().split("T")[0]) : "—"}</div>
          <div class="payment-card-actions">
            <button class="action-btn" onclick="openEditPayment('${p.id}')">✏️</button>
            <button class="action-btn danger" onclick="deletePayment('${p.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }
}

// =============================================
// CRUD OPERATIONS
// =============================================

// ---- Students ----
async function saveStudent() {
  const name = document.getElementById("studentName").value.trim();
  const cls = document.getElementById("studentClass").value;
  const fee = Number(document.getElementById("studentFee").value) || 200;
  const phone = document.getElementById("studentPhone").value.trim();

  if (!name) { showToast("Введите имя ученика", true); return; }

  try {
    if (editingStudentId) {
      await set(ref(db, `students/${editingStudentId}`), { name, class: cls, fee, phone });
      showToast("Ученик обновлён");
    } else {
      await push(ref(db, "students"), { name, class: cls, fee, phone, createdAt: Date.now() });
      showToast("Ученик добавлен");
    }
    closeModal("modalStudent");
    editingStudentId = null;
  } catch (e) {
    showToast("Ошибка сохранения: " + e.message, true);
  }
}

window.editStudent = function(id) {
  const s = students[id];
  if (!s) return;
  editingStudentId = id;
  document.getElementById("modalStudentTitle").textContent = "Редактировать ученика";
  document.getElementById("studentName").value = s.name || "";
  document.getElementById("studentClass").value = s.class || "11а";
  document.getElementById("studentFee").value = s.fee || 200;
  document.getElementById("studentPhone").value = s.phone || "";
  openModal("modalStudent");
};

window.deleteStudent = async function(id) {
  if (!confirm("Удалить ученика? Все его платежи останутся.")) return;
  await remove(ref(db, `students/${id}`));
  showToast("Ученик удалён");
};

// ---- Payments ----
function openPaymentModal(presetStudentId = null) {
  populatePaymentStudentSelect(presetStudentId);
  document.getElementById("paymentAmount").value = "";
  document.getElementById("paymentNote").value = "";
  document.getElementById("paymentMonth").value = currentMonth;
  document.getElementById("paymentYear").value = currentYear;
  openModal("modalPayment");
}

window.quickPayment = function(studentId) {
  openPaymentModal(studentId);
  const s = students[studentId];
  if (s) document.getElementById("paymentAmount").value = s.fee || 200;
};

function populatePaymentStudentSelect(presetId = null) {
  const sel = document.getElementById("paymentStudent");
  const sorted = Object.entries(students)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.class || "").localeCompare(b.class || "", "ru") || (a.name || "").localeCompare(b.name || "", "ru"));

  sel.innerHTML = sorted.map(s =>
    `<option value="${s.id}" data-fee="${s.fee || 200}" data-class="${s.class}">
      ${s.name} (${(s.class || "").toUpperCase()})
    </option>`
  ).join("");

  if (presetId) sel.value = presetId;

  sel.onchange = () => {
    const opt = sel.selectedOptions[0];
    if (opt) document.getElementById("paymentAmount").value = opt.dataset.fee || 200;
  };
}

async function savePayment() {
  const sel = document.getElementById("paymentStudent");
  const studentId = sel.value;
  const student = students[studentId];
  const amount = Number(document.getElementById("paymentAmount").value);
  const month = parseInt(document.getElementById("paymentMonth").value);
  const year = parseInt(document.getElementById("paymentYear").value);
  const note = document.getElementById("paymentNote").value.trim();

  if (!studentId || !student) { showToast("Выберите ученика", true); return; }
  if (!amount || amount <= 0) { showToast("Введите сумму", true); return; }

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  try {
    await push(ref(db, "payments"), {
      studentId,
      studentName: student.name,
      studentClass: student.class,
      amount,
      month,
      year,
      monthKey,
      note,
      createdAt: Date.now()
    });
    showToast(`Платёж ${formatMoney(amount)} сохранён`);
    closeModal("modalPayment");
  } catch (e) {
    showToast("Ошибка: " + e.message, true);
  }
}

window.deletePayment = async function(id) {
  if (!confirm("Удалить платёж?")) return;
  await remove(ref(db, `payments/${id}`));
  showToast("Платёж удалён");
};

// ---- Expenses ----
async function saveExpense() {
  const description = document.getElementById("expenseDesc").value.trim();
  const amount = Number(document.getElementById("expenseAmount").value);
  const category = document.getElementById("expenseCategory").value;
  const date = document.getElementById("expenseDate").value;

  if (!description) { showToast("Введите описание", true); return; }
  if (!amount || amount <= 0) { showToast("Введите сумму", true); return; }
  if (!date) { showToast("Введите дату", true); return; }

  try {
    await push(ref(db, "expenses"), { description, amount, category, date, createdAt: Date.now() });
    showToast("Расход добавлен");
    closeModal("modalExpense");
  } catch (e) {
    showToast("Ошибка: " + e.message, true);
  }
}

window.deleteExpense = async function(id) {
  if (!confirm("Удалить расход?")) return;
  await remove(ref(db, `expenses/${id}`));
  showToast("Расход удалён");
};

// =============================================
// HELPERS
// =============================================
function getPaidAmount(studentId, month, year) {
  return Object.values(payments)
    .filter(p => p.studentId === studentId && Number(p.month) === month && Number(p.year) === year)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("ru-RU") + " с";
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// =============================================
// MODALS
// =============================================
function openModal(id) {
  document.getElementById("modalOverlay").classList.add("active");
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
  const anyActive = document.querySelectorAll(".modal.active").length > 0;
  if (!anyActive) document.getElementById("modalOverlay").classList.remove("active");
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
  document.getElementById("modalOverlay").classList.remove("active");
}


// =============================================
// BATCH SELECT
// =============================================
function toggleSelectMode() {
  selectMode = !selectMode;
  selectedStudents.clear();
  const btn = document.getElementById("selectModeBtn");
  const bar = document.getElementById("batchBar");
  if (btn) btn.textContent = selectMode ? "✕ Отмена" : "☑ Выбрать";
  bar?.classList.toggle("hidden", !selectMode);
  renderClassContent(activeClass);
}

function cancelSelectMode() {
  selectMode = false;
  selectedStudents.clear();
  const btn = document.getElementById("selectModeBtn");
  const bar = document.getElementById("batchBar");
  if (btn) btn.textContent = "☑ Выбрать";
  bar?.classList.add("hidden");
  renderClassContent(activeClass);
}

window.toggleStudentSelect = function(id, checked) {
  if (checked) selectedStudents.add(id);
  else selectedStudents.delete(id);
  const info = document.getElementById("batchInfo");
  if (info) info.textContent = `Выбрано: ${selectedStudents.size}`;
};

window.toggleSelectAll = function(checked) {
  const classStudents = Object.entries(students)
    .filter(([, s]) => s.class === activeClass)
    .map(([id]) => id);
  if (checked) classStudents.forEach(id => selectedStudents.add(id));
  else selectedStudents.clear();
  const info = document.getElementById("batchInfo");
  if (info) info.textContent = `Выбрано: ${selectedStudents.size}`;
  renderClassContent(activeClass);
};

async function markSelectedAsPaid() {
  if (selectedStudents.size === 0) { showToast("Выберите учеников", true); return; }
  const month = currentMonth;
  const year = currentYear;
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  let count = 0;
  for (const studentId of selectedStudents) {
    const s = students[studentId];
    if (!s) continue;
    const alreadyPaid = getPaidAmount(studentId, month, year);
    const fee = Number(s.fee) || 0;
    if (alreadyPaid >= fee) continue; // already paid
    try {
      await push(ref(db, "payments"), {
        studentId, studentName: s.name, studentClass: s.class,
        amount: fee - alreadyPaid, month, year, monthKey,
        note: "Пакетная оплата", createdAt: Date.now()
      });
      count++;
    } catch(e) { console.error("Batch pay error:", e); }
  }
  showToast(`Отмечено оплаченными: ${count} учеников`);
  cancelSelectMode();
}

// =============================================
// COPY DEBTORS LIST
// =============================================
function copyDebtorsList() {
  const month = parseInt(document.getElementById("debtorMonth")?.value ?? currentMonth);
  const year = parseInt(document.getElementById("debtorYear")?.value ?? currentYear);
  const debtors = getDebtorsList(month, year);
  const monthName = MONTHS_RU[month] + " " + year;

  let lines = [`📋 Список должников — ${monthName}\n`];
  let total = 0;
  CLASSES.forEach(cls => {
    const list = debtors[cls] || [];
    if (list.length === 0) return;
    lines.push(`\n${cls.toUpperCase()}:`);
    list.forEach(d => {
      lines.push(`  • ${d.name} — ${formatMoney(d.debt)}`);
      total += d.debt;
    });
  });
  lines.push(`\n💰 Общий долг: ${formatMoney(total)}`);

  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => showToast("Список скопирован в буфер обмена ✓"))
    .catch(() => showToast("Не удалось скопировать", true));
}

// =============================================
// CSV EXPORT
// =============================================
function downloadCSV(filename, rows) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const csv = BOM + rows.map(r => r.map(cell =>
    `"${String(cell ?? "").replace(/"/g, '""')}"`
  ).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPaymentsCSV() {
  const rows = [["Ученик", "Класс", "Сумма (сомони)", "Месяц", "Год", "Дата записи", "Примечание"]];
  Object.values(payments)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach(p => {
      rows.push([
        p.studentName || "",
        (p.studentClass || "").toUpperCase(),
        p.amount || 0,
        MONTHS_RU[Number(p.month)] || "",
        p.year || "",
        p.createdAt ? new Date(p.createdAt).toLocaleDateString("ru-RU") : "",
        p.note || ""
      ]);
    });
  downloadCSV(`platezhi_${currentYear}_${currentMonth + 1}.csv`, rows);
  showToast("CSV платежей скачан");
}

function exportClassCSV() {
  const classStudents = Object.entries(students)
    .filter(([, s]) => s.class === activeClass)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));

  const rows = [["Имя", "Класс", "Телефон", "Плата/мес", `${MONTHS_RU[currentMonth]} ${currentYear}`, "Статус"]];
  classStudents.forEach(s => {
    const paid = getPaidAmount(s.id, currentMonth, currentYear);
    const fee = Number(s.fee) || 0;
    const status = paid >= fee ? "Оплачено" : paid > 0 ? "Частично" : "Не оплачено";
    rows.push([s.name || "", (s.class || "").toUpperCase(), s.phone || "", fee, paid || 0, status]);
  });
  downloadCSV(`klass_${activeClass}_${currentYear}_${currentMonth + 1}.csv`, rows);
  showToast(`CSV класса ${activeClass.toUpperCase()} скачан`);
}

function exportDebtorsCSV() {
  const month = parseInt(document.getElementById("debtorMonth")?.value ?? currentMonth);
  const year = parseInt(document.getElementById("debtorYear")?.value ?? currentYear);
  const debtors = getDebtorsList(month, year);
  const monthName = MONTHS_RU[month] + " " + year;

  const rows = [["Класс", "Имя ученика", "Долг (сомони)", "Месяц"]];
  CLASSES.forEach(cls => {
    (debtors[cls] || []).forEach(d => {
      rows.push([cls.toUpperCase(), d.name, d.debt, monthName]);
    });
  });
  downloadCSV(`dolzhniki_${year}_${month + 1}.csv`, rows);
  showToast("CSV должников скачан");
}

// =============================================
// PDF EXPORT (payments)
// =============================================
function exportPaymentsPDF() {
  const monthName = MONTHS_RU[currentMonth] + " " + currentYear;
  const paymentsArr = Object.values(payments)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  let totalSum = 0;
  const rows = paymentsArr.map(p => {
    totalSum += Number(p.amount) || 0;
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString("ru-RU") : "—";
    return `<tr>
      <td>${p.studentName || "—"}</td>
      <td>${(p.studentClass || "").toUpperCase()}</td>
      <td style="font-weight:700;color:#1e6e3e">${Number(p.amount || 0).toLocaleString("ru-RU")} с</td>
      <td>${MONTHS_RU[Number(p.month)] || ""} ${p.year || ""}</td>
      <td>${date}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Платежи — ${monthName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a2e; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f2f8; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #fafafa; }
    .total { margin-top: 16px; text-align: right; font-size: 15px; font-weight: 700; }
    .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>Гимназия Ганч — История платежей</h1>
  <div class="sub">Экспорт: ${new Date().toLocaleDateString("ru-RU")} · Всего записей: ${paymentsArr.length}</div>
  <table>
    <thead><tr><th>Ученик</th><th>Класс</th><th>Сумма</th><th>Месяц</th><th>Дата</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Итого: ${totalSum.toLocaleString("ru-RU")} сомони</div>
  <div class="footer">Гимназия Ганч · Сформировано автоматически</div>
  <script>window.onload = () => window.print();<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
  else showToast("Разрешите всплывающие окна для экспорта PDF", true);
}

// =============================================
// SORT HELPERS
// =============================================
window.setSortStudents = function(key) {
  if (studentSortKey === key) studentSortDir = studentSortDir === "asc" ? "desc" : "asc";
  else { studentSortKey = key; studentSortDir = "asc"; }
  renderClassContent(activeClass);
};

window.setSortPayments = function(key) {
  if (paymentSortKey === key) paymentSortDir = paymentSortDir === "asc" ? "desc" : "asc";
  else { paymentSortKey = key; paymentSortDir = "desc"; }
  renderPaymentsTable();
};

// =============================================
// EDIT PAYMENT
// =============================================
let editingPaymentId = null;

window.openEditPayment = function(id) {
  const p = payments[id];
  if (!p) return;
  editingPaymentId = id;
  document.getElementById("editPaymentStudent").value = p.studentName || "—";
  document.getElementById("editPaymentAmount").value  = p.amount || "";
  document.getElementById("editPaymentMonth").value   = p.month ?? currentMonth;
  document.getElementById("editPaymentYear").value    = p.year  ?? currentYear;
  document.getElementById("editPaymentNote").value    = p.note  || "";
  openModal("modalEditPayment");
};

async function saveEditPayment() {
  if (!editingPaymentId) return;
  const p = payments[editingPaymentId];
  const amount = Number(document.getElementById("editPaymentAmount").value);
  const month  = parseInt(document.getElementById("editPaymentMonth").value);
  const year   = parseInt(document.getElementById("editPaymentYear").value);
  const note   = document.getElementById("editPaymentNote").value.trim();

  if (!amount || amount <= 0) { showToast("Введите сумму", true); return; }

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  try {
    await set(ref(db, `payments/${editingPaymentId}`), {
      ...p, amount, month, year, monthKey, note,
      updatedAt: Date.now()
    });
    showToast("Платёж обновлён");
    closeModal("modalEditPayment");
    editingPaymentId = null;
  } catch(e) {
    showToast("Ошибка: " + e.message, true);
  }
}



// =============================================
// MOBILE LOGOUT MENU (tap avatar)
// =============================================
function showMobileLogoutMenu() {
  // Remove existing if any
  document.getElementById("mobileLogoutMenu")?.remove();

  const user = auth.currentUser;
  const menu = document.createElement("div");
  menu.id = "mobileLogoutMenu";
  menu.className = "mobile-logout-menu";
  menu.innerHTML = `
    <div class="mob-menu-overlay"></div>
    <div class="mob-menu-sheet">
      <div class="mob-menu-handle"></div>
      <div class="mob-menu-user">
        ${user?.photoURL
          ? `<img src="${user.photoURL}" class="mob-menu-avatar">`
          : `<div class="mob-menu-avatar-placeholder">${(user?.displayName||"?")[0]}</div>`}
        <div>
          <div class="mob-menu-name">${user?.displayName || "Пользователь"}</div>
          <div class="mob-menu-email">${user?.email || ""}</div>
        </div>
      </div>
      <button class="mob-menu-logout-btn" id="mobLogoutConfirmBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Выйти из аккаунта
      </button>
      <button class="mob-menu-cancel-btn" id="mobMenuCancelBtn">Отмена</button>
    </div>`;

  document.body.appendChild(menu);
  requestAnimationFrame(() => menu.querySelector(".mob-menu-sheet").classList.add("open"));

  const close = () => {
    menu.querySelector(".mob-menu-sheet").classList.remove("open");
    setTimeout(() => menu.remove(), 300);
  };

  menu.querySelector(".mob-menu-overlay").addEventListener("click", close);
  document.getElementById("mobMenuCancelBtn").addEventListener("click", close);
  document.getElementById("mobLogoutConfirmBtn").addEventListener("click", async () => {
    close();
    await signOut(auth);
    showToast("Вы вышли из системы");
  });
}

// =============================================
// CSV IMPORT
// =============================================
function downloadImportTemplate() {
  const BOM = "﻿";
  const csv = BOM + [
    ["Имя","Класс","Телефон","Плата"],
    ["Иванов Иван","11а","+992501234567","200"],
    ["Петрова Мария","10б","+992901234567","200"],
  ].map(r => r.map(v => `"${v}"`).join(",")).join("
");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "шаблон_ученики.csv"; a.click();
  URL.revokeObjectURL(url);
}

function handleCSVFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target.result.replace(/^﻿/, ""); // strip BOM
      const lines = text.split(/
?
/).filter(l => l.trim());
      // Skip header row if it looks like a header
      const start = lines[0]?.toLowerCase().includes("имя") || lines[0]?.toLowerCase().includes("name") ? 1 : 0;
      const parsed = []; const errors = [];
      lines.slice(start).forEach((line, i) => {
        const cols = parseCSVLine(line);
        const name = (cols[0] || "").trim();
        const cls  = (cols[1] || "").trim().toLowerCase();
        const phone= (cols[2] || "").trim();
        const fee  = Number((cols[3] || "200").trim()) || 200;
        if (!name) { errors.push(`Строка ${i+start+1}: пустое имя`); return; }
        if (!CLASSES.includes(cls)) { errors.push(`Строка ${i+start+1}: неверный класс "${cols[1]}"`); return; }
        parsed.push({ name, class: cls, phone, fee });
      });
      importedStudents = parsed;
      const previewEl = document.getElementById("importPreview");
      const titleEl   = document.getElementById("importPreviewTitle");
      const listEl    = document.getElementById("importPreviewList");
      const errorEl   = document.getElementById("importError");
      const confirmBtn= document.getElementById("confirmImportBtn");
      previewEl.classList.remove("hidden");
      titleEl.textContent = `Найдено: ${parsed.length} учеников${errors.length ? `, ошибок: ${errors.length}` : ""}`;
      listEl.innerHTML = [
        ...parsed.map(s => `<div class="import-preview-row ok"><span class="import-row-num">✓</span><span>${s.name}</span><span style="color:var(--gold)">${s.class.toUpperCase()}</span><span style="color:var(--text3)">${s.fee} с</span></div>`),
        ...errors.map(err => `<div class="import-preview-row error"><span class="import-row-num">✗</span><span>${err}</span></div>`)
      ].join("");
      if (errors.length && !parsed.length) {
        errorEl.textContent = "Нет допустимых строк для импорта";
        errorEl.classList.remove("hidden");
        confirmBtn.classList.add("hidden");
      } else {
        errorEl.classList.add("hidden");
        confirmBtn.classList.remove("hidden");
        confirmBtn.textContent = `Импортировать ${parsed.length} учеников`;
      }
    } catch(err) {
      showToast("Ошибка чтения файла: " + err.message, true);
    }
  };
  reader.readAsText(file, "UTF-8");
}

function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

async function confirmImport() {
  if (!importedStudents.length) return;
  const btn = document.getElementById("confirmImportBtn");
  btn.disabled = true; btn.textContent = "Импорт...";
  let done = 0;
  for (const s of importedStudents) {
    try {
      await push(ref(db, "students"), { ...s, createdAt: Date.now() });
      done++;
    } catch(e) { console.error("Import error:", e); }
  }
  showToast(`Импортировано ${done} из ${importedStudents.length} учеников`);
  importedStudents = [];
  closeModal("modalImportCSV");
  btn.disabled = false;
}

// =============================================
// SKELETON LOADERS
// =============================================
function renderSkeleton(containerId, rows = 5) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({ length: rows }, () => `
    <div class="skeleton-row">
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton-col">
        <div class="skeleton skeleton-line w60"></div>
        <div class="skeleton skeleton-line w40"></div>
      </div>
      <div class="skeleton skeleton-line w15" style="margin-left:auto"></div>
    </div>`).join("");
}

// =============================================
// TOAST
// =============================================
let toastTimeout;
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
