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
  databaseURL: "https://ganj-20dbb-default-rtdb.firebaseio.com"
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

const now = new Date();
let currentMonth = now.getMonth();
let currentYear = now.getFullYear();

// ---- Init ----
let isAppInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
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
      // Only setup UI and subscribe once
      if (!isAppInitialized) {
        isAppInitialized = true;
        setupUI();
        subscribeToData();
      }
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

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (confirm("Выйти из системы?")) {
      await signOut(auth);
      showToast("Вы вышли из системы");
    }
  });
});

// ---- Subscribe to realtime data ----
function subscribeToData() {
  onValue(ref(db, "students"), snap => {
    students = snap.val() || {};
    refreshAll();
  });
  onValue(ref(db, "payments"), snap => {
    payments = snap.val() || {};
    refreshAll();
  });
  onValue(ref(db, "expenses"), snap => {
    expenses = snap.val() || {};
    refreshAll();
  });
}

function refreshAll() {
  renderDashboard();
  renderClassContent(activeClass);
  renderDebtors();
  renderExpenses();
  renderPaymentsTable();
  updateDebtorsBadge();
}

function renderUserInfo(user) {
  const el = document.getElementById("userInfo");
  if (!el) return;
  el.innerHTML = `
    <img src="${user.photoURL || ''}" alt="" class="user-avatar" onerror="this.style.display='none'">
    <div class="user-details">
      <div class="user-name">${user.displayName || "Пользователь"}</div>
      <div class="user-email">${user.email}</div>
    </div>`;
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

  // Current month footer
  document.getElementById("currentMonth").textContent =
    MONTHS_RU[currentMonth] + " " + currentYear;

  // Nav items
  document.querySelectorAll(".nav-item[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.page);
      closeSidebar();
    });
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
  document.getElementById("mobileToggle").addEventListener("click", toggleSidebar);
  document.getElementById("overlay").addEventListener("click", closeSidebar);

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
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.page === page);
  });
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
  const classStudents = Object.entries(students)
    .filter(([, s]) => s.class === cls)
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));

  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  let paidCount = 0;
  let totalCollected = 0;

  const rows = classStudents.map(s => {
    const paid = getPaidAmount(s.id, currentMonth, currentYear);
    const fee = Number(s.fee) || 0;
    totalCollected += paid;

    let statusHtml;
    if (paid >= fee) {
      paidCount++;
      statusHtml = `<span class="status-badge status-paid">✓ Оплачено</span>`;
    } else if (paid > 0) {
      statusHtml = `<span class="status-badge status-partial">~ Частично</span>`;
    } else {
      statusHtml = `<span class="status-badge status-unpaid">✕ Не оплачено</span>`;
    }

    return `<tr>
      <td>${s.name || "—"}</td>
      <td>${s.phone || "—"}</td>
      <td>${formatMoney(fee)}</td>
      <td>${paid > 0 ? formatMoney(paid) : "—"}</td>
      <td>${statusHtml}</td>
      <td>
        <button class="action-btn" onclick="quickPayment('${s.id}')" title="Добавить платёж">💳</button>
        <button class="action-btn" onclick="editStudent('${s.id}')" title="Редактировать">✏️</button>
        <button class="action-btn danger" onclick="deleteStudent('${s.id}')" title="Удалить">🗑️</button>
      </td>
    </tr>`;
  }).join("");

  const total = classStudents.length;
  const unpaid = total - paidCount;

  document.getElementById("classContent").innerHTML = `
    <div class="class-stats-row">
      <div class="class-stat-pill">Учеников: <span>${total}</span></div>
      <div class="class-stat-pill">Оплатили: <span>${paidCount}</span></div>
      <div class="class-stat-pill" style="--text:var(--red)">Должников: <span style="color:var(--red)">${unpaid}</span></div>
      <div class="class-stat-pill">Собрано: <span style="color:var(--green)">${formatMoney(totalCollected)}</span></div>
    </div>
    <div class="students-table-wrap">
      ${total === 0 ? '<div class="empty-state">Нет учеников в этом классе. Добавьте первого!</div>' : `
      <table class="students-table">
        <thead>
          <tr>
            <th>Имя</th><th>Телефон</th><th>Плата/мес</th>
            <th>${MONTHS_RU[currentMonth]} ${currentYear}</th>
            <th>Статус</th><th>Действия</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
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
  const cards = activeClasses.map(cls => {
    const list = debtors[cls] || [];
    totalDebtors += list.length;
    const items = list.length === 0
      ? '<div class="no-debtors">✓ Все оплатили</div>'
      : list.map(d => `
        <div class="debtor-item">
          <span class="debtor-name">${d.name}</span>
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

  document.getElementById("debtorsGrid").innerHTML = cards;
  updateDebtorsBadge();
}

function getDebtorsList(month, year) {
  const result = {};
  CLASSES.forEach(c => result[c] = []);

  Object.entries(students).forEach(([id, s]) => {
    const paid = getPaidAmount(id, month, year);
    const fee = Number(s.fee) || 0;
    if (paid < fee) {
      result[s.class] = result[s.class] || [];
      result[s.class].push({ name: s.name, debt: fee - paid });
    }
  });
  return result;
}

function updateDebtorsBadge() {
  const debtors = getDebtorsList(currentMonth, currentYear);
  const count = Object.values(debtors).reduce((s, arr) => s + arr.length, 0);
  const badge = document.getElementById("debtorsBadge");
  badge.textContent = count > 0 ? count : "";
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
}

// =============================================
// PAYMENTS TABLE
// =============================================
function renderPaymentsTable() {
  const filterClass = document.getElementById("filterClass")?.value || "";
  const filterMonth = document.getElementById("filterMonth")?.value;
  const filterYear = document.getElementById("filterYear")?.value;

  let paymentsArr = Object.entries(payments).map(([id, p]) => ({ id, ...p }));

  if (filterClass) paymentsArr = paymentsArr.filter(p => p.studentClass === filterClass);
  if (filterMonth !== "" && filterMonth !== undefined) {
    paymentsArr = paymentsArr.filter(p => String(p.month) === String(filterMonth));
  }
  if (filterYear) paymentsArr = paymentsArr.filter(p => String(p.year) === String(filterYear));

  paymentsArr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
        <button class="action-btn danger" onclick="deletePayment('${p.id}')" title="Удалить">🗑️</button>
      </td>
    </tr>`).join("");
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
