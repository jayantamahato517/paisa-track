/**
 * PAISATRACK — COMPLETE FINANCIAL OS & EXPENSE TRACKER
 * Full-featured client-side engine with Clean Default Slate (₹0),
 * Dedicated "Add Money" & "Add Expense" flows, Real-Time Auto-Calculations,
 * Pocket Allocation, Net Balance Engine, Chart.js, CSV export, and Budgets.
 */

// Category Definitions for Expenses & Incomes
const EXPENSE_CATEGORIES = {
  Food: { name: 'Food & Dining', icon: '🍕', color: '#f59e0b' },
  Travel: { name: 'Travel & Commute', icon: '🚗', color: '#06b6d4' },
  Shopping: { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  Education: { name: 'Education', icon: '🎓', color: '#8b5cf6' },
  Bills: { name: 'Utilities & Bills', icon: '💡', color: '#3b82f6' },
  Entertainment: { name: 'Entertainment', icon: '🎬', color: '#a855f7' },
  Health: { name: 'Health & Medical', icon: '💊', color: '#10b981' },
  Others: { name: 'Other Expenses', icon: '📦', color: '#64748b' }
};

const INCOME_CATEGORIES = {
  Salary: { name: 'Salary / Wages', icon: '💼', color: '#10b981' },
  Freelance: { name: 'Freelance & Business', icon: '💻', color: '#06b6d4' },
  Investments: { name: 'Investments & Returns', icon: '📈', color: '#8b5cf6' },
  Gifts: { name: 'Gifts & Allowance', icon: '🎁', color: '#ec4899' },
  Refunds: { name: 'Cashbacks & Refunds', icon: '🔄', color: '#f59e0b' },
  OtherIncome: { name: 'Other Income', icon: '💰', color: '#14b8a6' }
};

// Combined helper lookup
const ALL_CATEGORIES = { ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES };

// Payment Mode Display Config
const PAYMENT_MODES = {
  NetBanking: { name: 'Bank Account', icon: '🏦', color: '#3b82f6' },
  UPI: { name: 'UPI & Wallets', icon: '📱', color: '#10b981' },
  Cash: { name: 'Cash in Hand', icon: '💵', color: '#f59e0b' },
  Card: { name: 'Credit / Debit Card', icon: '💳', color: '#ec4899' }
};

// Global App State (CLEAN DEFAULT: NO DUMMY SPENDING)
const state = {
  currentUser: null,
  users: [],
  theme: 'light',
  activeView: 'overview',
  balanceTimeframe: 'all', // 'all', 'month', 'year'
  currentTrendsChartType: 'daily', // 'daily', 'monthly', 'cumulative'
  categoryChartTimeframe: 'month',
  selectedInsightDate: getTodayString()
};

// Chart.js Instances
let categoryChartInstance = null;
let trendsChartInstance = null;

// Helper: Format Date to YYYY-MM-DD
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Format Currency (Strictly Indian Rupees ₹)
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

// Helper: Format Date nicely: "Nov 01, 2026"
function formatDateNice(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// Escape HTML for XSS prevention
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ==========================================================================
// LocalStorage Persistence & Multi-User State
// BY DEFAULT: All transactions, opening balance, and spending are Clean (₹0)
// ==========================================================================
function loadFromStorage() {
  try {
    const rawUsers = localStorage.getItem('paisatrack_users_v2');
    if (rawUsers) {
      state.users = JSON.parse(rawUsers);
      // Remove any legacy default dummy user (user@example.com / usr-default-clean)
      state.users = state.users.filter(u => u.email !== 'user@example.com' && u.id !== 'usr-default-clean');
      saveUsersToStorage();
    } else {
      state.users = [];
    }

    const currentUserId = localStorage.getItem('paisatrack_current_user_id');
    if (currentUserId && currentUserId !== 'usr-default-clean') {
      state.currentUser = state.users.find(u => u.id === currentUserId) || null;
    } else {
      state.currentUser = null;
      localStorage.removeItem('paisatrack_current_user_id');
    }

    // IMPORTANT: BY DEFAULT NO ACCOUNT IS LOGGED IN!
    // Every visitor must sign in or register with their own Gmail.

    if (state.currentUser) {
      if (state.currentUser.openingBalance === undefined) state.currentUser.openingBalance = 0;
      if (state.currentUser.minBalanceAlert === undefined) state.currentUser.minBalanceAlert = 0;
      if (!Array.isArray(state.currentUser.transactions)) state.currentUser.transactions = [];
      if (!Array.isArray(state.currentUser.goals)) state.currentUser.goals = [];
    }

    const savedTheme = localStorage.getItem('paisatrack_theme');
    if (savedTheme) {
      state.theme = savedTheme;
    } else {
      state.theme = 'light';
    }
  } catch (err) {
    console.error('Error loading data from storage', err);
  }
}

function saveUsersToStorage() {
  try {
    localStorage.setItem('paisatrack_users_v2', JSON.stringify(state.users));
  } catch (err) {
    console.error('Error saving users', err);
  }
}

function saveCurrentUserData() {
  if (!state.currentUser) return;
  const idx = state.users.findIndex(u => u.id === state.currentUser.id);
  if (idx !== -1) {
    state.users[idx] = { ...state.currentUser };
    saveUsersToStorage();
  }
}

function setCurrentUserSession(user) {
  state.currentUser = user;
  if (user) {
    localStorage.setItem('paisatrack_current_user_id', user.id);
    if (user.openingBalance === undefined) user.openingBalance = 0;
    if (user.minBalanceAlert === undefined) user.minBalanceAlert = 0;
  } else {
    localStorage.removeItem('paisatrack_current_user_id');
  }
}

// ==========================================================================
// Toast Notification
// ==========================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-triangle' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  if (window.lucide) {
    lucide.createIcons();
  }

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ==========================================================================
// View Routing & App Shell Management
// ==========================================================================
function navigateToView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Close mobile sidebar drawer if open
  document.getElementById('appSidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('active');

  if (viewName === 'analytics') {
    setTimeout(updateCharts, 60);
  }
}

function updateAppShell() {
  const authSection = document.getElementById('authSection');
  const dashboardApp = document.getElementById('dashboardApp');

  if (!state.currentUser) {
    authSection.classList.remove('hidden');
    dashboardApp.classList.add('hidden');
    return;
  }

  authSection.classList.add('hidden');
  dashboardApp.classList.remove('hidden');

  const navUserName = document.getElementById('navUserName');
  const navUserAvatar = document.getElementById('navUserAvatar');
  const menuUserName = document.getElementById('menuUserName');
  const menuUserEmail = document.getElementById('menuUserEmail');
  const menuUserAvatar = document.getElementById('menuUserAvatar');
  const sidebarUserEmail = document.getElementById('sidebarUserEmail');
  const welcomeGreeting = document.getElementById('welcomeGreeting');

  const initial = state.currentUser.name ? state.currentUser.name.charAt(0).toUpperCase() : 'U';
  if (navUserName) navUserName.textContent = state.currentUser.name;
  if (navUserAvatar) navUserAvatar.textContent = initial;
  if (menuUserName) menuUserName.textContent = state.currentUser.name;
  if (menuUserEmail) menuUserEmail.textContent = state.currentUser.email;
  if (menuUserAvatar) menuUserAvatar.textContent = initial;
  if (sidebarUserEmail) sidebarUserEmail.textContent = state.currentUser.email;
  if (welcomeGreeting) welcomeGreeting.textContent = `Welcome, ${state.currentUser.name.split(' ')[0]} 👋`;

  // Website is strictly for Indian Rupees (₹)
  state.currentUser.currency = '₹';
  document.querySelectorAll('.currency-symbol-label').forEach(el => el.textContent = '₹');
  const formCurrencyPrefix = document.getElementById('formCurrencyPrefix');
  if (formCurrencyPrefix) formCurrencyPrefix.textContent = '₹';
  const budgetCurrencyPrefix = document.getElementById('budgetCurrencyPrefix');
  if (budgetCurrencyPrefix) budgetCurrencyPrefix.textContent = '₹';
  const budgetConfigCurrencyPrefix = document.getElementById('budgetConfigCurrencyPrefix');
  if (budgetConfigCurrencyPrefix) budgetConfigCurrencyPrefix.textContent = '₹';
  const openingCurrencyPrefix = document.getElementById('openingCurrencyPrefix');
  if (openingCurrencyPrefix) openingCurrencyPrefix.textContent = '₹';
  const safetyCurrencyPrefix = document.getElementById('safetyCurrencyPrefix');
  if (safetyCurrencyPrefix) safetyCurrencyPrefix.textContent = '₹';

  const budgetConfigInput = document.getElementById('budgetConfigInput');
  if (budgetConfigInput) budgetConfigInput.value = state.currentUser.budget || 15000;

  refreshAllViews();
}

// ==========================================================================
// Authentication System Logic
// ==========================================================================
function switchToTab(tabName) {
  const tabLogin = document.getElementById('authTabLogin');
  const tabRegister = document.getElementById('authTabRegister');
  const formLogin = document.getElementById('loginForm');
  const formRegister = document.getElementById('registerForm');

  if (tabName === 'register') {
    tabRegister?.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.remove('hidden');
    formLogin?.classList.add('hidden');
    document.getElementById('regName')?.focus();
  } else {
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.remove('hidden');
    formRegister?.classList.add('hidden');
    document.getElementById('loginEmail')?.focus();
  }
  if (window.lucide) lucide.createIcons();
}

function handleLogin(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    showToast('Please enter both your Gmail/Email and password.', 'warning');
    return false;
  }

  // 1. Check if user already exists
  const user = state.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (user) {
    if (user.password !== password) {
      showToast('Incorrect password for this email. Please try again.', 'danger');
      return false;
    }
    setCurrentUserSession(user);
    updateAppShell();
    showToast(`Welcome back, ${user.name}!`);
    return true;
  }

  // 2. If user does not exist yet, automatically create a fresh account for their Gmail!
  // This allows everyone to log in seamlessly with their own Gmail.
  const nameParts = cleanEmail.split('@')[0].replace(/[._-]/g, ' ').split(' ');
  const formattedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'My Account';

  const newUser = {
    id: 'usr-' + Date.now(),
    name: formattedName,
    email: cleanEmail,
    password: password,
    currency: '₹',
    budget: 15000,
    openingBalance: 0,
    minBalanceAlert: 0,
    transactions: [],
    goals: []
  };

  state.users.push(newUser);
  saveUsersToStorage();
  setCurrentUserSession(newUser);
  updateAppShell();
  showToast(`Welcome to PaisaTrack, ${newUser.name}! Your account has been created.`);
  return true;
}

function handleRegister(name, email, password, currency = '₹') {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    showToast('Please enter your email and password.', 'warning');
    return false;
  }
  if (password.length < 6) {
    showToast('Password must be at least 6 characters long.', 'warning');
    return false;
  }

  const exists = state.users.some(u => u.email.toLowerCase() === cleanEmail);
  if (exists) {
    showToast('An account with this email already exists. Please Sign In.', 'warning');
    switchToTab('login');
    const loginEmailInput = document.getElementById('loginEmail');
    if (loginEmailInput) {
      loginEmailInput.value = cleanEmail;
      document.getElementById('loginPassword')?.focus();
    }
    return false;
  }

  const newUser = {
    id: 'usr-' + Date.now(),
    name: name.trim() || 'My Account',
    email: cleanEmail,
    password: password,
    currency: currency,
    budget: 15000,
    openingBalance: 0,
    minBalanceAlert: 0,
    transactions: [],
    goals: []
  };

  state.users.push(newUser);
  saveUsersToStorage();
  setCurrentUserSession(newUser);
  updateAppShell();
  showToast(`Account created! Welcome, ${newUser.name}.`);
  return true;
}

function handleLogout() {
  setCurrentUserSession(null);
  updateAppShell();
  // Clear any inputs in login and register forms
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
  const regName = document.getElementById('regName');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  if (regName) regName.value = '';
  if (regEmail) regEmail.value = '';
  if (regPassword) regPassword.value = '';
  switchToTab('login');
  showToast('You have been signed out successfully.', 'warning');
}

// ==========================================================================
// AUTO-CALCULATION & NET BALANCE ENGINE ("ITSELF ADD EVERYTHING")
// ==========================================================================
function updateNetBalanceHub() {
  if (!state.currentUser) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const timeframe = state.balanceTimeframe;

  const openingBalance = Number(state.currentUser.openingBalance) || 0;
  const minBalanceAlert = Number(state.currentUser.minBalanceAlert) || 0;
  const txns = state.currentUser.transactions || [];

  let periodInflow = 0;
  let periodOutflow = 0;
  let periodInflowCount = 0;
  let periodOutflowCount = 0;

  let allTimeInflow = 0;
  let allTimeOutflow = 0;

  // Pocket trackers: Bank, UPI, Cash, Card
  const pocketInflow = { NetBanking: 0, UPI: 0, Cash: 0, Card: 0 };
  const pocketOutflow = { NetBanking: 0, UPI: 0, Cash: 0, Card: 0 };
  const pocketTxnCount = { NetBanking: 0, UPI: 0, Cash: 0, Card: 0 };

  txns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const tDate = new Date(t.date + 'T00:00:00');
    const mode = t.paymentMode || 'NetBanking';

    if (t.type === 'income') {
      allTimeInflow += amt;
    } else {
      allTimeOutflow += amt;
    }

    if (pocketTxnCount[mode] !== undefined) {
      pocketTxnCount[mode]++;
      if (t.type === 'income') pocketInflow[mode] += amt;
      else pocketOutflow[mode] += amt;
    }

    let matches = false;
    if (timeframe === 'all') matches = true;
    else if (timeframe === 'month') matches = (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth);
    else if (timeframe === 'year') matches = (tDate.getFullYear() === currentYear);

    if (matches) {
      if (t.type === 'income') {
        periodInflow += amt;
        periodInflowCount++;
      } else {
        periodOutflow += amt;
        periodOutflowCount++;
      }
    }
  });

  const netBalance = timeframe === 'all'
    ? (openingBalance + periodInflow - periodOutflow)
    : (periodInflow - periodOutflow);

  const actualAllTimeNetBalance = openingBalance + allTimeInflow - allTimeOutflow;

  // Savings Rate %
  const savingsRate = periodInflow > 0
    ? Math.max(0, Math.min(100, Math.round(((periodInflow - periodOutflow) / periodInflow) * 100)))
    : 0;

  // Burn rate based on actual days passed
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = Math.max(1, now.getDate());

  let monthExpenseTotal = 0;
  txns.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && t.type === 'expense') {
      monthExpenseTotal += Number(t.amount);
    }
  });

  const dailyBurnRate = monthExpenseTotal > 0 ? Math.round(monthExpenseTotal / currentDay) : 0;
  const remainingDays = daysInMonth - currentDay;
  const projectedMonthEndBalance = actualAllTimeNetBalance - (dailyBurnRate * remainingDays);

  // DOM Updates: Command Center
  const hubNetBalanceVal = document.getElementById('hubNetBalanceVal');
  const hubCashFlowTag = document.getElementById('hubCashFlowTag');
  const hubOpeningNote = document.getElementById('hubOpeningNote');
  const hubInflowVal = document.getElementById('hubInflowVal');
  const hubInflowCount = document.getElementById('hubInflowCount');
  const hubOutflowVal = document.getElementById('hubOutflowVal');
  const hubOutflowCount = document.getElementById('hubOutflowCount');
  const savingsRateVal = document.getElementById('savingsRateVal');
  const savingsRateBar = document.getElementById('savingsRateBar');
  const savingsRateSub = document.getElementById('savingsRateSub');

  const dailyBurnRateVal = document.getElementById('dailyBurnRateVal');
  const projectedMonthEndVal = document.getElementById('projectedMonthEndVal');
  const projectedMonthEndDesc = document.getElementById('projectedMonthEndDesc');
  const minBalanceTargetVal = document.getElementById('minBalanceTargetVal');
  const safetyIndicator = document.getElementById('safetyIndicator');
  const safetyIndicatorText = document.getElementById('safetyIndicatorText');

  if (hubNetBalanceVal) {
    hubNetBalanceVal.textContent = formatCurrency(netBalance);
    hubNetBalanceVal.style.color = netBalance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }

  const topbarNetBalance = document.getElementById('topbarNetBalance');
  if (topbarNetBalance) {
    topbarNetBalance.textContent = formatCurrency(actualAllTimeNetBalance);
    topbarNetBalance.style.color = actualAllTimeNetBalance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }

  if (hubCashFlowTag) {
    if (netBalance >= 0) {
      hubCashFlowTag.className = 'cash-flow-tag positive';
      hubCashFlowTag.innerHTML = `<i data-lucide="trending-up"></i> Net Surplus`;
    } else {
      hubCashFlowTag.className = 'cash-flow-tag negative';
      hubCashFlowTag.innerHTML = `<i data-lucide="trending-down"></i> Net Deficit`;
    }
  }

  if (hubOpeningNote) {
    if (timeframe === 'all') {
      hubOpeningNote.textContent = openingBalance > 0 ? `Includes ${formatCurrency(openingBalance)} starting balance` : 'Clean balance from tracked entries';
    } else if (timeframe === 'month') {
      hubOpeningNote.textContent = `Monthly Cash Flow (Inflow vs Outflow)`;
    } else {
      hubOpeningNote.textContent = `Yearly Cash Flow for ${currentYear}`;
    }
  }

  if (hubInflowVal) hubInflowVal.textContent = formatCurrency(periodInflow);
  if (hubInflowCount) hubInflowCount.textContent = `${periodInflowCount} deposits`;
  if (hubOutflowVal) hubOutflowVal.textContent = formatCurrency(periodOutflow);
  if (hubOutflowCount) hubOutflowCount.textContent = `${periodOutflowCount} expenses`;

  if (savingsRateVal) savingsRateVal.textContent = `${savingsRate}%`;
  if (savingsRateBar) savingsRateBar.style.width = `${savingsRate}%`;
  if (savingsRateSub) {
    savingsRateSub.textContent = periodInflow > 0
      ? `Retained ${formatCurrency(Math.max(0, periodInflow - periodOutflow))} of ${formatCurrency(periodInflow)}`
      : 'Add income to calculate your savings rate';
  }

  if (dailyBurnRateVal) dailyBurnRateVal.textContent = `${formatCurrency(dailyBurnRate)}/day`;
  if (projectedMonthEndVal) {
    projectedMonthEndVal.textContent = formatCurrency(projectedMonthEndBalance);
    projectedMonthEndVal.style.color = projectedMonthEndBalance >= minBalanceAlert ? 'var(--color-accent)' : 'var(--color-expense)';
  }
  if (projectedMonthEndDesc) {
    projectedMonthEndDesc.textContent = `${remainingDays} days left this month`;
  }
  if (minBalanceTargetVal) minBalanceTargetVal.textContent = formatCurrency(minBalanceAlert);

  if (safetyIndicator && safetyIndicatorText) {
    if (minBalanceAlert > 0 && actualAllTimeNetBalance < minBalanceAlert) {
      safetyIndicator.className = 'safety-indicator danger';
      safetyIndicator.innerHTML = `<i data-lucide="alert-triangle"></i> <span>Below Safety Net (${formatCurrency(minBalanceAlert - actualAllTimeNetBalance)} deficit)</span>`;
    } else {
      safetyIndicator.className = 'safety-indicator';
      safetyIndicator.style.background = 'var(--color-income-bg)';
      safetyIndicator.style.color = 'var(--color-income)';
      safetyIndicator.innerHTML = `<i data-lucide="shield-check"></i> <span>Safety Net: Active</span>`;
    }
  }

  // Populate Pocket Balances Grid
  renderPocketBalances(openingBalance, pocketInflow, pocketOutflow, pocketTxnCount);

  // Refresh dynamic Lucide icons in metrics
  if (window.lucide) lucide.createIcons();
}

// Render Pocket Balances Across Payment Modes
function renderPocketBalances(openingBalance, pocketInflow, pocketOutflow, pocketTxnCount) {
  const grid = document.getElementById('pocketGrid');
  if (!grid) return;

  const pocketKeys = ['NetBanking', 'UPI', 'Cash', 'Card'];

  grid.innerHTML = pocketKeys.map(k => {
    const config = PAYMENT_MODES[k] || { name: k, icon: '💼', color: '#64748b' };

    // Money added to pocket minus money spent from pocket
    // If openingBalance exists, Bank absorbs it initially
    const startingForPocket = (k === 'NetBanking' ? openingBalance : 0);
    const netPocket = (startingForPocket + pocketInflow[k]) - pocketOutflow[k];
    const count = pocketTxnCount[k] || 0;
    const isNegative = netPocket < 0;

    return `
      <div class="pocket-card">
        <div class="pocket-top">
          <span class="pocket-name">
            <span>${config.icon}</span>
            <span>${config.name}</span>
          </span>
          <span class="pocket-badge">${count} txns</span>
        </div>
        <div class="pocket-amount" style="color: ${isNegative ? 'var(--color-expense)' : 'var(--text-main)'}">
          ${formatCurrency(netPocket)}
        </div>
        <div class="pocket-footer">
          <span>Added: ${formatCurrency(pocketInflow[k])}</span>
          <span>Spent: ${formatCurrency(pocketOutflow[k])}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// Financial Metrics, Budget & Health Calculations
// ==========================================================================
function updateFinancialMetrics() {
  if (!state.currentUser) return;

  const todayStr = getTodayString();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const sevenDaysAgoDate = new Date();
  sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
  sevenDaysAgoDate.setHours(0, 0, 0, 0);

  let totalIncome = 0;
  let totalExpense = 0;
  let todaySpend = 0;
  let weeklySpend = 0;
  let monthlySpend = 0;
  let monthlyIncome = 0;

  const txns = state.currentUser.transactions || [];

  txns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const tDate = new Date(t.date + 'T00:00:00');

    if (t.type === 'income') {
      totalIncome += amt;
      if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
        monthlyIncome += amt;
      }
    } else {
      totalExpense += amt;

      if (t.date === todayStr) {
        todaySpend += amt;
      }

      if (tDate >= sevenDaysAgoDate && tDate <= now) {
        weeklySpend += amt;
      }

      if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
        monthlySpend += amt;
      }
    }
  });

  const statTodaySpendEl = document.getElementById('statTodaySpend');
  const statWeeklySpendEl = document.getElementById('statWeeklySpend');
  const statMonthlySpendEl = document.getElementById('statMonthlySpend');
  const statCurrentMonthEl = document.getElementById('statCurrentMonth');
  const statMonthlySavings = document.getElementById('statMonthlySavings');
  const statMonthlySavingsRate = document.getElementById('statMonthlySavingsRate');

  if (statTodaySpendEl) statTodaySpendEl.textContent = formatCurrency(todaySpend);
  if (statWeeklySpendEl) statWeeklySpendEl.textContent = formatCurrency(weeklySpend);
  if (statMonthlySpendEl) statMonthlySpendEl.textContent = formatCurrency(monthlySpend);
  if (statCurrentMonthEl) {
    statCurrentMonthEl.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const monthlyNet = monthlyIncome - monthlySpend;
  if (statMonthlySavings) {
    statMonthlySavings.textContent = formatCurrency(monthlyNet);
    statMonthlySavings.style.color = monthlyNet >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }
  if (statMonthlySavingsRate) {
    statMonthlySavingsRate.textContent = monthlyNet >= 0 ? `+${formatCurrency(monthlyNet)} Surplus` : 'Deficit';
  }

  // Update Net Balance Command Center
  updateNetBalanceHub();

  // Update Budget Widget
  updateBudgetWidget(monthlySpend);
}

// Monthly Budget Progress Widget
function updateBudgetWidget(monthlySpend) {
  const budget = state.currentUser?.budget || 15000;
  const spent = monthlySpend;
  const percentUsed = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const remaining = budget - spent;

  const budgetSpentVal = document.getElementById('budgetSpentVal');
  const budgetTargetVal = document.getElementById('budgetTargetVal');
  const budgetProgressBar = document.getElementById('budgetProgressBar');
  const budgetStatusBadge = document.getElementById('budgetStatusBadge');
  const budgetRemainingText = document.getElementById('budgetRemainingText');

  if (budgetSpentVal) budgetSpentVal.textContent = formatCurrency(spent);
  if (budgetTargetVal) budgetTargetVal.textContent = formatCurrency(budget);

  if (budgetProgressBar) {
    budgetProgressBar.style.width = `${percentUsed}%`;
    budgetProgressBar.classList.remove('warning', 'danger');
    if (spent > budget) {
      budgetProgressBar.classList.add('danger');
    } else if (percentUsed >= 80) {
      budgetProgressBar.classList.add('warning');
    }
  }

  if (budgetStatusBadge) {
    budgetStatusBadge.classList.remove('warning', 'danger');
    if (spent > budget) {
      budgetStatusBadge.classList.add('danger');
      budgetStatusBadge.innerHTML = `<i data-lucide="alert-octagon"></i> Over Budget (${Math.round((spent / budget) * 100)}%)`;
    } else if (percentUsed >= 80) {
      budgetStatusBadge.classList.add('warning');
      budgetStatusBadge.innerHTML = `<i data-lucide="alert-triangle"></i> Caution (${percentUsed}% Used)`;
    } else {
      budgetStatusBadge.innerHTML = `<i data-lucide="shield-check"></i> On Track (${percentUsed}% Used)`;
    }
  }

  if (budgetRemainingText) {
    if (remaining >= 0) {
      budgetRemainingText.textContent = `${formatCurrency(remaining)} remaining this month`;
      budgetRemainingText.style.color = 'var(--text-muted)';
    } else {
      budgetRemainingText.textContent = `Exceeded by ${formatCurrency(Math.abs(remaining))}`;
      budgetRemainingText.style.color = 'var(--color-expense)';
    }
  }

  renderCategoryBudgetBreakdown();
}

function renderCategoryBudgetBreakdown() {
  const listContainer = document.getElementById('catBudgetList');
  if (!listContainer || !state.currentUser) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const catTotals = {};
  let totalExpenseMonth = 0;

  (state.currentUser.transactions || []).forEach(t => {
    if (t.type === 'expense') {
      const d = new Date(t.date + 'T00:00:00');
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
        totalExpenseMonth += Number(t.amount);
      }
    }
  });

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);

  if (sortedCats.length === 0) {
    listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--text-dim); padding:0.5rem 0;">No category expenses recorded this month yet.</div>`;
    return;
  }

  listContainer.innerHTML = sortedCats.map(([cat, amt]) => {
    const catInfo = ALL_CATEGORIES[cat] || { name: cat, icon: '🏷️' };
    const pct = totalExpenseMonth > 0 ? Math.round((amt / totalExpenseMonth) * 100) : 0;
    return `
      <div class="cat-budget-item">
        <div class="cat-budget-info">
          <span>${catInfo.icon}</span>
          <span>${catInfo.name}</span>
        </div>
        <div class="cat-budget-bar">
          <span class="cat-budget-amt">${formatCurrency(amt)}</span>
          <span class="cat-budget-percent">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// UNIQUE IDEA: At the end of each day, show a summary such as:
// "You spent ₹250 today. Your biggest expense was food."
// ==========================================================================
function updateSmartDailySummary(targetDateStr = state.selectedInsightDate) {
  if (!state.currentUser) return;

  const headlineEl = document.getElementById('insightHeadline');
  const subtextEl = document.getElementById('insightSubtext');
  const todaySpendValEl = document.getElementById('todaySpendVal');
  const todayTopCategoryEl = document.getElementById('todayTopCategory');
  const todayTxnCountEl = document.getElementById('todayTxnCount');
  const datePicker = document.getElementById('insightDatePicker');

  if (datePicker && datePicker.value !== targetDateStr) {
    datePicker.value = targetDateStr;
  }

  const txns = state.currentUser.transactions || [];
  const dayTxns = txns.filter(t => t.date === targetDateStr);
  const dayExpenses = dayTxns.filter(t => t.type === 'expense');
  const dayIncome = dayTxns.filter(t => t.type === 'income');

  const totalSpent = dayExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalEarned = dayIncome.reduce((sum, t) => sum + Number(t.amount), 0);

  const catSums = {};
  dayExpenses.forEach(t => {
    catSums[t.category] = (catSums[t.category] || 0) + Number(t.amount);
  });

  let biggestCat = null;
  let biggestCatAmount = 0;
  for (const [cat, amt] of Object.entries(catSums)) {
    if (amt > biggestCatAmount) {
      biggestCatAmount = amt;
      biggestCat = cat;
    }
  }

  const isToday = targetDateStr === getTodayString();
  const dayLabel = isToday ? 'today' : `on ${formatDateNice(targetDateStr)}`;

  if (todaySpendValEl) todaySpendValEl.textContent = formatCurrency(totalSpent);
  if (todayTxnCountEl) todayTxnCountEl.textContent = `${dayTxns.length} entries`;

  if (dayExpenses.length === 0 && dayIncome.length === 0) {
    if (headlineEl) {
      headlineEl.innerHTML = `You spent <span class="highlight-spend">${formatCurrency(0)}</span> ${dayLabel}.`;
    }
    if (subtextEl) {
      subtextEl.textContent = isToday
        ? "No expenses logged today. Click '+ Add Expense' or '➕ Add Money' to start tracking."
        : "No transactions recorded for this selected date.";
    }
    if (todayTopCategoryEl) todayTopCategoryEl.textContent = 'None';
    return;
  }

  if (dayExpenses.length === 0 && totalEarned > 0) {
    if (headlineEl) {
      headlineEl.innerHTML = `You added <span class="text-income">${formatCurrency(totalEarned)}</span> with <span class="highlight-spend">${formatCurrency(0)}</span> spent ${dayLabel}!`;
    }
    if (subtextEl) {
      subtextEl.textContent = `Money successfully deposited into your accounts. Net savings added: +${formatCurrency(totalEarned)}. 🚀`;
    }
    if (todayTopCategoryEl) todayTopCategoryEl.textContent = 'Income Added';
    return;
  }

  const catName = (ALL_CATEGORIES[biggestCat] ? ALL_CATEGORIES[biggestCat].name : biggestCat) || 'Others';
  const catIcon = (ALL_CATEGORIES[biggestCat] ? ALL_CATEGORIES[biggestCat].icon : '🏷️');
  const catPercentage = totalSpent > 0 ? Math.round((biggestCatAmount / totalSpent) * 100) : 0;

  // Find biggest expense transaction to display its exact "Why Spent" Reason
  const biggestTxn = dayExpenses
    .filter(t => t.category === biggestCat)
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const reasonText = biggestTxn?.spendReason ? ` for "${escapeHtml(biggestTxn.spendReason)}"` : '';

  if (headlineEl) {
    headlineEl.innerHTML = `You spent <span class="highlight-spend">${formatCurrency(totalSpent)}</span> ${dayLabel}. Your biggest expense was <span class="highlight-cat">${catName}</span>${reasonText}.`;
  }

  if (subtextEl) {
    subtextEl.textContent = `${catIcon} ${catName} accounted for ${formatCurrency(biggestCatAmount)} (${catPercentage}% of your spending ${dayLabel})${reasonText}.`;
  }

  if (todayTopCategoryEl) {
    todayTopCategoryEl.textContent = `${catIcon} ${catName} (${formatCurrency(biggestCatAmount)})`;
  }
}

// ==========================================================================
// Chart.js Visualizations (Includes Cumulative Net Balance Trajectory)
// ==========================================================================
function updateCharts() {
  if (!state.currentUser) return;
  updateCategoryChart();
  updateTrendsChart();
}

function updateCategoryChart() {
  const ctx = document.getElementById('categoryDoughnutChart');
  const emptyState = document.getElementById('noCategoryData');
  const analyticsListEl = document.getElementById('analyticsCatList');
  if (!ctx || !state.currentUser) return;

  const timeframe = state.categoryChartTimeframe;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const txns = state.currentUser.transactions || [];
  const filtered = txns.filter(t => {
    if (t.type !== 'expense') return false;
    const d = new Date(t.date + 'T00:00:00');
    if (timeframe === 'month') {
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    } else if (timeframe === 'week') {
      return d >= sevenDaysAgo && d <= now;
    }
    return true;
  });

  const catMap = {};
  let totalPeriodExpense = 0;
  filtered.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount);
    totalPeriodExpense += Number(t.amount);
  });

  const labels = Object.keys(catMap);
  const data = Object.values(catMap);

  if (analyticsListEl) {
    if (labels.length === 0) {
      analyticsListEl.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim); padding:1rem 0;">No expenses recorded yet. Add an expense to see the ranked distribution.</div>`;
    } else {
      analyticsListEl.innerHTML = labels
        .map(cat => ({ cat, amt: catMap[cat] }))
        .sort((a, b) => b.amt - a.amt)
        .map(item => {
          const catInfo = ALL_CATEGORIES[item.cat] || { name: item.cat, icon: '🏷️', color: '#64748b' };
          const pct = totalPeriodExpense > 0 ? Math.round((item.amt / totalPeriodExpense) * 100) : 0;
          return `
            <div class="analytics-cat-row">
              <div class="analytics-cat-head">
                <span>${catInfo.icon} ${catInfo.name}</span>
                <span>${formatCurrency(item.amt)} (${pct}%)</span>
              </div>
              <div class="analytics-progress-bar">
                <div class="analytics-progress-fill" style="width: ${pct}%; background-color: ${catInfo.color};"></div>
              </div>
            </div>
          `;
        }).join('');
    }
  }

  if (labels.length === 0) {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }
    ctx.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  ctx.style.display = 'block';
  if (emptyState) emptyState.classList.add('hidden');

  const backgroundColors = labels.map(l => (ALL_CATEGORIES[l] ? ALL_CATEGORIES[l].color : '#64748b'));
  const prettyLabels = labels.map(l => `${ALL_CATEGORIES[l] ? ALL_CATEGORIES[l].icon : ''} ${ALL_CATEGORIES[l] ? ALL_CATEGORIES[l].name : l}`);

  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#FBF6EF' : '#3A2618';

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: prettyLabels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: isDark ? '#3A2618' : '#FBF6EF',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            boxWidth: 14,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

function updateTrendsChart() {
  const ctx = document.getElementById('spendingTrendsChart');
  if (!ctx || !state.currentUser) return;

  const isDark = state.theme === 'dark';
  const gridColor = isDark ? 'rgba(251, 246, 239, 0.08)' : 'rgba(58, 38, 24, 0.08)';
  const textColor = isDark ? '#d8c6b5' : '#6e5443';

  if (trendsChartInstance) {
    trendsChartInstance.destroy();
  }

  const txns = state.currentUser.transactions || [];

  if (state.currentTrendsChartType === 'daily') {
    const days = 14;
    const labels = [];
    const expenseData = [];
    const dateLookup = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${da}`;

      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(label);
      dateLookup[dateStr] = 0;
    }

    txns.forEach(t => {
      if (t.type === 'expense' && dateLookup[t.date] !== undefined) {
        dateLookup[t.date] += Number(t.amount);
      }
    });

    Object.keys(dateLookup).sort().forEach(dateStr => {
      expenseData.push(dateLookup[dateStr]);
    });

    trendsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Expenses',
          data: expenseData,
          backgroundColor: '#A9744F',
          hoverBackgroundColor: '#8c4e25',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: val => `₹${val}`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Spending: ${formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  } else if (state.currentTrendsChartType === 'monthly') {
    const months = 6;
    const labels = [];
    const monthKeys = [];
    const incomeData = [];
    const expenseData = [];

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yr}-${mo}`;
      monthKeys.push(key);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }

    const monthlyMap = {};
    monthKeys.forEach(k => {
      monthlyMap[k] = { income: 0, expense: 0 };
    });

    txns.forEach(t => {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const key = `${parts[0]}-${parts[1]}`;
        if (monthlyMap[key]) {
          if (t.type === 'income') {
            monthlyMap[key].income += Number(t.amount);
          } else {
            monthlyMap[key].expense += Number(t.amount);
          }
        }
      }
    });

    monthKeys.forEach(k => {
      incomeData.push(monthlyMap[k].income);
      expenseData.push(monthlyMap[k].expense);
    });

    trendsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Money Added (In)',
            data: incomeData,
            backgroundColor: '#1e7d4f',
            borderRadius: 6
          },
          {
            label: 'Expenses (Out)',
            data: expenseData,
            backgroundColor: '#d32f2f',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: val => `₹${val}`
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  } else {
    // Cumulative Net Balance Curve
    const sortedTxns = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));
    const openingBalance = Number(state.currentUser.openingBalance) || 0;

    const dateMap = {};
    sortedTxns.forEach(t => {
      if (!dateMap[t.date]) dateMap[t.date] = 0;
      if (t.type === 'income') dateMap[t.date] += Number(t.amount);
      else dateMap[t.date] -= Number(t.amount);
    });

    const dates = Object.keys(dateMap).sort();
    const labels = [];
    const cumulativePoints = [];

    let runningBalance = openingBalance;
    dates.forEach(d => {
      runningBalance += dateMap[d];
      labels.push(formatDateNice(d));
      cumulativePoints.push(runningBalance);
    });

    if (labels.length === 0) {
      labels.push('Starting');
      cumulativePoints.push(openingBalance);
    }

    trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cumulative Net Balance',
          data: cumulativePoints,
          borderColor: '#A9744F',
          backgroundColor: 'rgba(169, 116, 79, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#A9744F',
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: val => `₹${val}`
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Net Balance: ${formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  }
}

// ==========================================================================
// Transaction History Table & Recent List
// ==========================================================================
function renderTransactionList() {
  if (!state.currentUser) return;

  const tbody = document.getElementById('transactionListBody');
  const recentListEl = document.getElementById('recentTxnsList');
  const emptyState = document.getElementById('emptyHistoryState');
  const counterEl = document.getElementById('historyCounter');

  const txns = state.currentUser.transactions || [];

  if (recentListEl) {
    const recentTxns = [...txns]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recentTxns.length === 0) {
      recentListEl.innerHTML = `
        <div style="font-size:0.85rem; color:var(--text-dim); text-align:center; padding:1.75rem 1rem;">
          <p>No recent activity. Click <strong>"Add Money"</strong> or <strong>"Add Expense"</strong> above.</p>
        </div>
      `;
    } else {
      recentListEl.innerHTML = recentTxns.map(t => {
        const catInfo = ALL_CATEGORIES[t.category] || { name: t.category, icon: '🏷️' };
        const isExp = t.type === 'expense';
        const displayTitle = t.spendReason || t.description || catInfo.name;
        const subNote = t.spendReason && t.description && t.spendReason !== t.description
          ? ` &bull; ${escapeHtml(t.description)}`
          : '';
        return `
          <div class="recent-txn-item">
            <div class="recent-txn-left">
              <div class="recent-txn-icon">${catInfo.icon}</div>
              <div class="recent-txn-details">
                <strong>${escapeHtml(displayTitle)}</strong>
                <span>${catInfo.name} &bull; ${formatDateNice(t.date)}${subNote}</span>
              </div>
            </div>
            <div class="recent-txn-amt ${isExp ? 'text-expense' : 'text-income'}">
              ${isExp ? '-' : '+'}${formatCurrency(t.amount)}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (!tbody) return;

  const searchKeyword = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('filterType')?.value || 'all';
  const catFilter = document.getElementById('filterCategory')?.value || 'all';
  const sortBy = document.getElementById('sortBy')?.value || 'date-desc';

  let filtered = txns.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (searchKeyword) {
      const descMatch = (t.description || '').toLowerCase().includes(searchKeyword);
      const reasonMatch = (t.spendReason || '').toLowerCase().includes(searchKeyword);
      const catMatch = (t.category || '').toLowerCase().includes(searchKeyword);
      const payMatch = (t.paymentMode || '').toLowerCase().includes(searchKeyword);
      if (!descMatch && !reasonMatch && !catMatch && !payMatch) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
    if (sortBy === 'amount-asc') return Number(a.amount) - Number(b.amount);
    return 0;
  });

  if (counterEl) {
    counterEl.textContent = `Showing ${filtered.length} of ${txns.length} transactions`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  tbody.innerHTML = filtered.map(t => {
    const isExpense = t.type === 'expense';
    const catInfo = ALL_CATEGORIES[t.category] || { name: t.category, icon: '🏷️' };
    const sign = isExpense ? '-' : '+';
    const amountClass = isExpense ? 'expense' : 'income';
    const pocketInfo = PAYMENT_MODES[t.paymentMode] || { name: t.paymentMode || 'Cash', icon: '💵' };

    return `
      <tr data-id="${t.id}">
        <td><strong>${formatDateNice(t.date)}</strong></td>
        <td>
          <span class="cat-badge">
            <span>${catInfo.icon}</span>
            <span>${catInfo.name}</span>
          </span>
        </td>
        <td>
          <span class="reason-badge">
            ${t.spendReason ? escapeHtml(t.spendReason) : '<span style="color:var(--text-dim)">—</span>'}
          </span>
        </td>
        <td>
          <span class="desc-text">${escapeHtml(t.description || '')}</span>
        </td>
        <td>
          <span class="pay-badge">
            <span>${pocketInfo.icon}</span> ${pocketInfo.name}
          </span>
        </td>
        <td class="amount-cell ${amountClass}">
          ${sign}${formatCurrency(t.amount)}
        </td>
        <td>
          <div class="row-actions">
            <button class="action-btn-sm edit-btn" onclick="openEditTransactionModal('${t.id}')" title="Edit Transaction">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn-sm delete delete-btn" onclick="deleteTransaction('${t.id}')" title="Delete Transaction">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ==========================================================================
// Savings Goals Tracker Logic
// ==========================================================================
function renderSavingsGoals() {
  const container = document.getElementById('goalsContainer');
  if (!container || !state.currentUser) return;

  const goals = state.currentUser.goals || [];

  if (goals.length === 0) {
    container.innerHTML = `<div style="font-size:0.875rem; color:var(--text-dim); text-align:center; padding:1.5rem 0;">No savings goals created yet. Click "New Goal" above to start!</div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
    return `
      <div class="goal-card-item">
        <div class="goal-card-header">
          <div class="goal-title-wrap">
            <span class="goal-icon">${g.icon || '🎯'}</span>
            <strong>${escapeHtml(g.title)}</strong>
          </div>
          <button class="action-btn-sm delete" onclick="deleteGoal('${g.id}')" title="Delete Goal">
            <i data-lucide="trash-2"></i>
          </button>
        </div>

        <div class="analytics-progress-bar">
          <div class="analytics-progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #6366f1, #10b981);"></div>
        </div>

        <div class="goal-amounts">
          <span>Saved: <strong>${formatCurrency(g.current)}</strong> (${pct}%)</span>
          <span>Target: <strong>${formatCurrency(g.target)}</strong></span>
        </div>

        <div class="goal-actions">
          <button class="btn btn-secondary btn-sm" onclick="depositToGoal('${g.id}', 500)">+500</button>
          <button class="btn btn-secondary btn-sm" onclick="depositToGoal('${g.id}', 1000)">+1000</button>
          <button class="btn btn-secondary btn-sm" onclick="depositToGoal('${g.id}', 2500)">+2500</button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

window.depositToGoal = function (goalId, amount) {
  if (!state.currentUser) return;
  const goal = state.currentUser.goals.find(g => g.id === goalId);
  if (!goal) return;

  goal.current = Number(goal.current) + amount;
  saveCurrentUserData();
  renderSavingsGoals();

  // Refresh all icons on full view update
  if (window.lucide) lucide.createIcons();
  showToast(`Added ${formatCurrency(amount)} to "${goal.title}"!`);
};

window.deleteGoal = function (goalId) {
  if (!confirm('Are you sure you want to remove this savings goal?')) return;
  state.currentUser.goals = state.currentUser.goals.filter(g => g.id !== goalId);
  saveCurrentUserData();
  renderSavingsGoals();
  showToast('Savings goal deleted', 'warning');
};

// ==========================================================================
// DYNAMIC MODAL WORKFLOW: ADD MONEY vs ADD EXPENSE
// ==========================================================================
function populateCategoryDropdown(type, selectedCategory = '') {
  const catSelect = document.getElementById('txnCategory');
  const catLabel = document.getElementById('categoryLabel');
  const paymentModeLabel = document.getElementById('paymentModeLabel');
  const saveBtnText = document.getElementById('saveTxnBtnText');
  const quickAmountsContainer = document.getElementById('quickAmountsContainer');

  if (!catSelect) return;

  catSelect.innerHTML = '';

  if (type === 'income') {
    if (catLabel) catLabel.textContent = 'Income Source *';
    if (paymentModeLabel) paymentModeLabel.textContent = 'Deposit Into Account *';
    if (saveBtnText) saveBtnText.textContent = 'Deposit Money & Auto-Calculate';

    Object.entries(INCOME_CATEGORIES).forEach(([key, info]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${info.icon} ${info.name}`;
      if (selectedCategory === key) opt.selected = true;
      catSelect.appendChild(opt);
    });

    if (quickAmountsContainer) {
      quickAmountsContainer.innerHTML = `
        <button type="button" class="quick-amount-chip" data-add="500">+500</button>
        <button type="button" class="quick-amount-chip" data-add="1000">+1000</button>
        <button type="button" class="quick-amount-chip" data-add="5000">+5000</button>
        <button type="button" class="quick-amount-chip" data-add="10000">+10000</button>
        <button type="button" class="quick-amount-chip" data-add="25000">+25000</button>
      `;
    }
  } else {
    if (catLabel) catLabel.textContent = 'Expense Category *';
    if (paymentModeLabel) paymentModeLabel.textContent = 'Paid From Account *';
    if (saveBtnText) saveBtnText.textContent = 'Save Expense & Auto-Calculate';

    Object.entries(EXPENSE_CATEGORIES).forEach(([key, info]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${info.icon} ${info.name}`;
      if (selectedCategory === key) opt.selected = true;
      catSelect.appendChild(opt);
    });

    if (quickAmountsContainer) {
      quickAmountsContainer.innerHTML = `
        <button type="button" class="quick-amount-chip" data-add="50">+50</button>
        <button type="button" class="quick-amount-chip" data-add="100">+100</button>
        <button type="button" class="quick-amount-chip" data-add="250">+250</button>
        <button type="button" class="quick-amount-chip" data-add="500">+500</button>
        <button type="button" class="quick-amount-chip" data-add="1000">+1000</button>
      `;
    }
  }

  // Re-bind chip clicks
  document.querySelectorAll('.quick-amount-chip').forEach(chip => {
    chip.onclick = () => {
      const add = Number(chip.getAttribute('data-add')) || 0;
      const amtInput = document.getElementById('txnAmount');
      const current = Number(amtInput.value) || 0;
      amtInput.value = (current + add).toFixed(2);
    };
  });
}

// ==========================================================================
// MODAL MANAGEMENT & HELPERS
// ==========================================================================
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (window.lucide) lucide.createIcons();
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

// ==========================================================================
// DYNAMIC MODAL WORKFLOW: ADD MONEY vs ADD EXPENSE
// ==========================================================================
window.openTransactionModalWithType = function (type = 'income') {
  document.getElementById('transactionForm').reset();
  document.getElementById('editTxnId').value = '';
  document.getElementById('txnDate').value = getTodayString();

  const radio = document.querySelector(`input[name="txnType"][value="${type}"]`);
  if (radio) radio.checked = true;

  const modalTitle = document.getElementById('modalTitle');
  const modalHeaderIcon = document.getElementById('modalHeaderIcon');
  const labelText = document.getElementById('txnReasonLabel');
  const reasonInput = document.getElementById('txnReason');
  const optionsContainer = document.getElementById('modalReasonOptions');

  if (type === 'income') {
    if (modalTitle) modalTitle.textContent = 'Add Money / Deposit (₹)';
    if (modalHeaderIcon) {
      modalHeaderIcon.innerHTML = `<i data-lucide="arrow-down-left"></i>`;
      modalHeaderIcon.style.color = 'var(--color-income)';
      modalHeaderIcon.style.background = 'var(--color-income-bg)';
    }
    if (labelText) labelText.textContent = "Source / Reason for Money Added *";
    if (optionsContainer) {
      optionsContainer.innerHTML = `
        <button type="button" class="modal-reason-btn" data-reason="💼 Monthly Salary">💼 Salary</button>
        <button type="button" class="modal-reason-btn" data-reason="💻 Freelance Gig">💻 Freelance</button>
        <button type="button" class="modal-reason-btn" data-reason="📈 Investment Returns">📈 Investments</button>
        <button type="button" class="modal-reason-btn" data-reason="🎁 Gift / Allowance">🎁 Gift</button>
        <button type="button" class="modal-reason-btn" data-reason="🔄 Cashback / Refund">🔄 Cashback</button>
        <button type="button" class="modal-reason-btn" data-reason="💰 Bonus / Extra">💰 Bonus</button>
      `;
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Daily Expense (₹)';
    if (modalHeaderIcon) {
      modalHeaderIcon.innerHTML = `<i data-lucide="arrow-up-right"></i>`;
      modalHeaderIcon.style.color = 'var(--color-expense)';
      modalHeaderIcon.style.background = 'var(--color-expense-bg)';
    }
    if (labelText) labelText.textContent = "Why did you spend this money? (Reason / Purpose) *";
    if (optionsContainer) {
      optionsContainer.innerHTML = `
        <button type="button" class="modal-reason-btn" data-reason="🍽️ Lunch / Dinner">🍽️ Lunch / Dinner</button>
        <button type="button" class="modal-reason-btn" data-reason="☕ Chai & Snacks">☕ Chai & Snacks</button>
        <button type="button" class="modal-reason-btn" data-reason="🚕 Auto / Cab / Metro">🚕 Auto / Cab</button>
        <button type="button" class="modal-reason-btn" data-reason="🛒 Groceries Refill">🛒 Groceries</button>
        <button type="button" class="modal-reason-btn" data-reason="💊 Medicine & Health">💊 Medicine</button>
        <button type="button" class="modal-reason-btn" data-reason="🛍️ Quick Shopping">🛍️ Shopping</button>
        <button type="button" class="modal-reason-btn" data-reason="💡 Bill / Recharge">💡 Recharge</button>
        <button type="button" class="modal-reason-btn" data-reason="🎉 Outing / Friends">🎉 Outing</button>
        <button type="button" class="modal-reason-btn" data-reason="🎁 Family Help">🎁 Family Help</button>
        <button type="button" class="modal-reason-btn" data-reason="🚨 Urgent Expense">🚨 Urgent Need</button>
      `;
    }
  }

  // Bind reason clicks
  optionsContainer?.querySelectorAll('.modal-reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (reasonInput) {
        reasonInput.value = btn.getAttribute('data-reason');
        reasonInput.focus();
      }
    });
  });

  populateCategoryDropdown(type);
  if (window.lucide) lucide.createIcons();
  openModal('transactionModal');

  // Reset scroll position to top
  const form = document.getElementById('transactionForm');
  if (form) form.scrollTop = 0;
  const backdrop = document.getElementById('transactionModal');
  if (backdrop) backdrop.scrollTop = 0;
};

window.openEditTransactionModal = function (txnId) {
  if (!state.currentUser) return;
  const txn = (state.currentUser.transactions || []).find(t => t.id === txnId);
  if (!txn) return;

  document.getElementById('editTxnId').value = txn.id;
  document.getElementById('txnAmount').value = txn.amount;
  document.getElementById('txnDate').value = txn.date;
  document.getElementById('txnReason').value = txn.spendReason || txn.description || '';
  document.getElementById('txnDesc').value = txn.description || '';
  document.getElementById('txnPaymentMode').value = txn.paymentMode || 'UPI';

  const type = txn.type || 'expense';
  const radio = document.querySelector(`input[name="txnType"][value="${type}"]`);
  if (radio) radio.checked = true;

  const modalTitle = document.getElementById('modalTitle');
  const modalHeaderIcon = document.getElementById('modalHeaderIcon');
  const labelText = document.getElementById('txnReasonLabel');
  const reasonInput = document.getElementById('txnReason');
  const optionsContainer = document.getElementById('modalReasonOptions');

  if (type === 'income') {
    if (modalTitle) modalTitle.textContent = 'Edit Money / Income (₹)';
    if (modalHeaderIcon) {
      modalHeaderIcon.innerHTML = `<i data-lucide="arrow-down-left"></i>`;
      modalHeaderIcon.style.color = 'var(--color-income)';
      modalHeaderIcon.style.background = 'var(--color-income-bg)';
    }
    if (labelText) labelText.textContent = "Source / Reason for Money Added *";
    if (optionsContainer) {
      optionsContainer.innerHTML = `
        <button type="button" class="modal-reason-btn" data-reason="💼 Monthly Salary">💼 Salary</button>
        <button type="button" class="modal-reason-btn" data-reason="💻 Freelance Gig">💻 Freelance</button>
        <button type="button" class="modal-reason-btn" data-reason="📈 Investment Returns">📈 Investments</button>
        <button type="button" class="modal-reason-btn" data-reason="🎁 Gift / Allowance">🎁 Gift</button>
        <button type="button" class="modal-reason-btn" data-reason="🔄 Cashback / Refund">🔄 Cashback</button>
        <button type="button" class="modal-reason-btn" data-reason="💰 Bonus / Extra">💰 Bonus</button>
      `;
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Edit Daily Expense (₹)';
    if (modalHeaderIcon) {
      modalHeaderIcon.innerHTML = `<i data-lucide="arrow-up-right"></i>`;
      modalHeaderIcon.style.color = 'var(--color-expense)';
      modalHeaderIcon.style.background = 'var(--color-expense-bg)';
    }
    if (labelText) labelText.textContent = "Why did you spend this money? (Reason / Purpose) *";
    if (optionsContainer) {
      optionsContainer.innerHTML = `
        <button type="button" class="modal-reason-btn" data-reason="🍽️ Lunch / Dinner">🍽️ Lunch / Dinner</button>
        <button type="button" class="modal-reason-btn" data-reason="☕ Chai & Snacks">☕ Chai & Snacks</button>
        <button type="button" class="modal-reason-btn" data-reason="🚕 Auto / Cab / Metro">🚕 Auto / Cab</button>
        <button type="button" class="modal-reason-btn" data-reason="🛒 Groceries Refill">🛒 Groceries</button>
        <button type="button" class="modal-reason-btn" data-reason="💊 Medicine & Health">💊 Medicine</button>
        <button type="button" class="modal-reason-btn" data-reason="🛍️ Quick Shopping">🛍️ Shopping</button>
        <button type="button" class="modal-reason-btn" data-reason="💡 Bill / Recharge">💡 Recharge</button>
        <button type="button" class="modal-reason-btn" data-reason="🎉 Outing / Friends">🎉 Outing</button>
        <button type="button" class="modal-reason-btn" data-reason="🎁 Family Help">🎁 Family Help</button>
        <button type="button" class="modal-reason-btn" data-reason="🚨 Urgent Expense">🚨 Urgent Need</button>
      `;
    }
  }

  optionsContainer?.querySelectorAll('.modal-reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (reasonInput) {
        reasonInput.value = btn.getAttribute('data-reason');
        reasonInput.focus();
      }
    });
  });

  populateCategoryDropdown(type, txn.category);
  if (window.lucide) lucide.createIcons();
  openModal('transactionModal');

  // Reset scroll position to top
  const form = document.getElementById('transactionForm');
  if (form) form.scrollTop = 0;
  const backdrop = document.getElementById('transactionModal');
  if (backdrop) backdrop.scrollTop = 0;
};

function saveTransaction(txnData) {
  if (!state.currentUser) return;
  const txns = state.currentUser.transactions || [];

  if (txnData.id) {
    const idx = txns.findIndex(t => t.id === txnData.id);
    if (idx !== -1) {
      txns[idx] = { ...txns[idx], ...txnData };
      showToast('Transaction updated and recalculated!');
    }
  } else {
    const newTxn = {
      ...txnData,
      id: 'txn-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
    };
    txns.unshift(newTxn);

    const pocketName = PAYMENT_MODES[txnData.paymentMode]?.name || 'account';
    if (txnData.type === 'income') {
      showToast(`Added ${formatCurrency(txnData.amount)} to ${pocketName}! Everything recalculated.`);
    } else {
      const reasonSnippet = txnData.spendReason ? ` for "${txnData.spendReason}"` : '';
      showToast(`Recorded daily spend of ${formatCurrency(txnData.amount)}${reasonSnippet}! Everything recalculated.`);
    }
  }

  state.currentUser.transactions = txns;
  saveCurrentUserData();
  refreshAllViews();
}

window.deleteTransaction = function (id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  state.currentUser.transactions = (state.currentUser.transactions || []).filter(t => t.id !== id);
  saveCurrentUserData();
  showToast('Transaction removed. Balances auto-updated.', 'warning');
  refreshAllViews();
};

// ==========================================================================
// Refresh Views (Triggers "itself add everything" in real-time)
// ==========================================================================
function refreshAllViews() {
  if (!state.currentUser) return;
  updateFinancialMetrics();
  updateSmartDailySummary();
  updateCharts();
  renderTransactionList();
  renderSavingsGoals();
  if (window.lucide) lucide.createIcons();
}

// ==========================================================================
// Event Listeners & Bootstrapping
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();

  document.body.className = state.theme === 'light' ? 'light-theme' : 'dark-theme';

  updateAppShell();

  if (window.lucide) {
    lucide.createIcons();
  }

  const txnDateInput = document.getElementById('txnDate');
  if (txnDateInput) txnDateInput.value = getTodayString();


  // ==========================================================================
  // AUTHENTICATION EVENT LISTENERS (Sign In, Create Account, Tabs, Password Toggle, Sign Out)
  // ==========================================================================
  document.getElementById('authTabLogin')?.addEventListener('click', () => switchToTab('login'));
  document.getElementById('authTabRegister')?.addEventListener('click', () => switchToTab('register'));
  document.getElementById('linkToRegister')?.addEventListener('click', () => switchToTab('register'));
  document.getElementById('linkToLogin')?.addEventListener('click', () => switchToTab('login'));

  // Sign In Form Submission
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    handleLogin(email, password);
  });

  // Create Account Form Submission
  document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    handleRegister(name, email, password);
  });

  // Password Visibility Toggles
  document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i data-lucide="eye-off"></i>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<i data-lucide="eye"></i>';
      }
      if (window.lucide) lucide.createIcons();
    });
  });

  // Sign Out / Logout Buttons
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
    closeModal('profileModal');
    handleLogout();
  });

  // Navigation tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) navigateToView(view);
    });
  });

  // Theme toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.className = state.theme === 'light' ? 'light-theme' : 'dark-theme';
    if (window.lucide) lucide.createIcons();
  });

  // Mobile sidebar toggle
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => { sidebar?.classList.add('open'); backdrop?.classList.add('active'); });
  document.getElementById('menuToggleBtn')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  });
  document.getElementById('closeSidebarBtn')?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  });
  backdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  });

  // Transaction Modal Open Buttons
  document.getElementById('openAddMoneyBtn')?.addEventListener('click', () => openTransactionModalWithType('income'));
  document.getElementById('openAddExpenseBtn')?.addEventListener('click', () => openTransactionModalWithType('expense'));
  document.getElementById('closeTxnModalBtn')?.addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('cancelTxnBtn')?.addEventListener('click', () => closeModal('transactionModal'));

  // Switch type inside Transaction Modal
  document.querySelectorAll('input[name="txnType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const type = e.target.value;
      const modalTitle = document.getElementById('modalTitle');
      const modalHeaderIcon = document.getElementById('modalHeaderIcon');
      const labelText = document.getElementById('txnReasonLabel');
      const reasonInput = document.getElementById('txnReason');
      const optionsContainer = document.getElementById('modalReasonOptions');

      if (type === 'income') {
        if (modalTitle) modalTitle.textContent = 'Add Money / Deposit';
        if (modalHeaderIcon) modalHeaderIcon.innerHTML = `<i data-lucide="plus-circle"></i>`;
        if (labelText) labelText.textContent = "Source / Reason for Money Added *";
        if (optionsContainer) {
          optionsContainer.innerHTML = `
            <button type="button" class="modal-reason-btn" data-reason="💼 Monthly Salary">💼 Salary</button>
            <button type="button" class="modal-reason-btn" data-reason="💻 Freelance Gig">💻 Freelance</button>
            <button type="button" class="modal-reason-btn" data-reason="📈 Investment Returns">📈 Investments</button>
            <button type="button" class="modal-reason-btn" data-reason="🎁 Gift / Allowance">🎁 Gift</button>
            <button type="button" class="modal-reason-btn" data-reason="🔄 Cashback / Refund">🔄 Cashback</button>
            <button type="button" class="modal-reason-btn" data-reason="💰 Bonus / Extra">💰 Bonus</button>
          `;
        }
      } else {
        if (modalTitle) modalTitle.textContent = 'Add Daily Expense';
        if (modalHeaderIcon) modalHeaderIcon.innerHTML = `<i data-lucide="minus-circle"></i>`;
        if (labelText) labelText.textContent = "Why did you spend this money? (Reason / Purpose) *";
        if (optionsContainer) {
          optionsContainer.innerHTML = `
            <button type="button" class="modal-reason-btn" data-reason="🍽️ Lunch / Dinner">🍽️ Lunch / Dinner</button>
            <button type="button" class="modal-reason-btn" data-reason="☕ Chai & Snacks">☕ Chai & Snacks</button>
            <button type="button" class="modal-reason-btn" data-reason="🚕 Auto / Cab / Metro">🚕 Auto / Cab</button>
            <button type="button" class="modal-reason-btn" data-reason="🛒 Groceries Refill">🛒 Groceries</button>
            <button type="button" class="modal-reason-btn" data-reason="💊 Medicine & Health">💊 Medicine</button>
            <button type="button" class="modal-reason-btn" data-reason="🛍️ Quick Shopping">🛍️ Shopping</button>
            <button type="button" class="modal-reason-btn" data-reason="💡 Bill / Recharge">💡 Recharge</button>
            <button type="button" class="modal-reason-btn" data-reason="🎉 Outing / Friends">🎉 Outing</button>
            <button type="button" class="modal-reason-btn" data-reason="🎁 Family Help">🎁 Family Help</button>
            <button type="button" class="modal-reason-btn" data-reason="🚨 Urgent Expense">🚨 Urgent Need</button>
          `;
        }
      }

      optionsContainer?.querySelectorAll('.modal-reason-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (reasonInput) {
            reasonInput.value = btn.getAttribute('data-reason');
            reasonInput.focus();
          }
        });
      });

      populateCategoryDropdown(type);
      if (window.lucide) lucide.createIcons();
    });
  });

  // Transaction Form Submit
  document.getElementById('transactionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('editTxnId').value;
    const type = document.querySelector('input[name="txnType"]:checked')?.value || 'expense';
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const category = document.getElementById('txnCategory').value;
    const date = document.getElementById('txnDate').value;
    const spendReason = document.getElementById('txnReason').value.trim();
    const description = document.getElementById('txnDesc').value.trim();
    const paymentMode = document.getElementById('txnPaymentMode').value;

    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount greater than ₹0.', 'warning');
      return;
    }

    const txnData = {
      type,
      amount,
      category,
      date: date || getTodayString(),
      spendReason,
      description: description || spendReason,
      paymentMode
    };

    if (editId) txnData.id = editId;

    saveTransaction(txnData);
    closeModal('transactionModal');
  });

  // Quick Daily Spend Form (Overview middle page)
  const quickAmountInput = document.getElementById('quickSpendAmount');
  document.querySelectorAll('.quick-mini-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const add = Number(chip.getAttribute('data-amt')) || 0;
      const current = Number(quickAmountInput.value) || 0;
      quickAmountInput.value = (current + add).toFixed(2);
    });
  });

  const quickReasonInput = document.getElementById('quickSpendReason');
  document.querySelectorAll('.write-option-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const reason = chip.getAttribute('data-reason');
      if (quickReasonInput && reason) {
        quickReasonInput.value = reason;
        quickReasonInput.focus();
      }
    });
  });

  document.getElementById('quickDailySpendForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(quickAmountInput.value);
    const category = document.getElementById('quickSpendCategory').value;
    const paymentMode = document.getElementById('quickSpendPocket').value;
    const spendReason = quickReasonInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount greater than ₹0.', 'warning');
      return;
    }

    saveTransaction({
      type: 'expense',
      amount,
      category,
      date: getTodayString(),
      spendReason,
      description: spendReason,
      paymentMode
    });

    quickAmountInput.value = '';
    quickReasonInput.value = '';
  });

  // Net Balance Hub & Safety Net Configuration Handler
  const openNetBalanceModal = () => {
    if (state.currentUser) {
      const openInput = document.getElementById('openingBalanceInput');
      if (openInput) openInput.value = state.currentUser.openingBalance || 0;
      const minAlertInput = document.getElementById('minBalanceAlertInput');
      if (minAlertInput) minAlertInput.value = state.currentUser.minBalanceAlert || 0;
    }
    openModal('netBalanceModal');
  };

  // Net Balance Command Center - Buttons
  document.getElementById('hubAddMoneyBtn')?.addEventListener('click', () => {
    openTransactionModalWithType('income');
  });
  document.getElementById('configureBalanceBtn')?.addEventListener('click', openNetBalanceModal);
  document.getElementById('openNetBalanceModalBtn')?.addEventListener('click', openNetBalanceModal);
  document.getElementById('topbarBalancePill')?.addEventListener('click', openNetBalanceModal);
  document.getElementById('safetyIndicator')?.addEventListener('click', openNetBalanceModal);

  // Net Balance Command Center - Timeframe Pills (All-Time, This Month, This Year)
  document.querySelectorAll('#balanceTimeframePills .timeframe-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#balanceTimeframePills .timeframe-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.balanceTimeframe = pill.getAttribute('data-timeframe') || 'all';
      updateNetBalanceHub();
    });
  });

  document.getElementById('closeNetBalanceModalBtn')?.addEventListener('click', () => closeModal('netBalanceModal'));
  document.getElementById('cancelNetBalanceBtn')?.addEventListener('click', () => closeModal('netBalanceModal'));

  document.getElementById('netBalanceForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const opening = parseFloat(document.getElementById('openingBalanceInput').value);
    const minAlert = parseFloat(document.getElementById('minBalanceAlertInput')?.value) || 0;
    if (!isNaN(opening) && state.currentUser) {
      state.currentUser.openingBalance = opening;
      state.currentUser.minBalanceAlert = minAlert;
      saveCurrentUserData();
      closeModal('netBalanceModal');
      refreshAllViews();
      showToast(`Net Balance & Safety Net saved! Starting balance: ${formatCurrency(opening)}.`);
    }
  });

  // Budget Modal & Inline Form
  const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');

  document.getElementById('overviewEditBudgetBtn')?.addEventListener('click', () => {
    if (monthlyBudgetInput && state.currentUser) monthlyBudgetInput.value = state.currentUser.budget;
    openModal('budgetModal');
  });

  document.getElementById('closeBudgetModalBtn')?.addEventListener('click', () => closeModal('budgetModal'));
  document.getElementById('cancelBudgetBtn')?.addEventListener('click', () => closeModal('budgetModal'));

  document.getElementById('budgetForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newBudget = parseFloat(monthlyBudgetInput.value);
    if (!isNaN(newBudget) && newBudget > 0 && state.currentUser) {
      state.currentUser.budget = newBudget;
      saveCurrentUserData();
      closeModal('budgetModal');
      refreshAllViews();
      showToast(`Monthly budget set to ${formatCurrency(newBudget)}!`);
    }
  });

  document.getElementById('inlineBudgetForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseFloat(document.getElementById('budgetConfigInput').value);
    if (!isNaN(val) && val > 0 && state.currentUser) {
      state.currentUser.budget = val;
      saveCurrentUserData();
      refreshAllViews();
      showToast(`Monthly budget updated to ${formatCurrency(val)}!`);
    }
  });

  // Goals Modal
  document.getElementById('openAddGoalBtn')?.addEventListener('click', () => {
    document.getElementById('goalForm').reset();
    openModal('goalModal');
  });

  document.getElementById('closeGoalModalBtn')?.addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('cancelGoalBtn')?.addEventListener('click', () => closeModal('goalModal'));

  document.getElementById('goalForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('goalTitle').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
    const icon = document.getElementById('goalIcon').value;

    if (!title || isNaN(target) || target <= 0) {
      showToast('Please provide a valid goal title and target amount.', 'warning');
      return;
    }

    if (!state.currentUser.goals) state.currentUser.goals = [];

    state.currentUser.goals.push({
      id: 'goal-' + Date.now(),
      title,
      target,
      current,
      icon
    });

    saveCurrentUserData();
    renderSavingsGoals();
    closeModal('goalModal');
    showToast(`Savings goal "${title}" created!`);
  });

  // Account Settings Modal
  document.getElementById('openProfileSettingsBtn')?.addEventListener('click', () => {
    if (state.currentUser) {
      document.getElementById('profileName').value = state.currentUser.name;
      document.getElementById('profileEmail').value = state.currentUser.email;
      openModal('profileModal');
    }
  });

  document.getElementById('closeProfileModalBtn')?.addEventListener('click', () => closeModal('profileModal'));
  document.getElementById('cancelProfileBtn')?.addEventListener('click', () => closeModal('profileModal'));

  document.getElementById('profileForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = document.getElementById('profileName').value.trim();
    if (newName && state.currentUser) {
      state.currentUser.name = newName;
      saveCurrentUserData();
      updateAppShell();
      closeModal('profileModal');
      showToast('Profile updated successfully!');
    }
  });

  // Filters & Search
  document.getElementById('searchInput')?.addEventListener('input', renderTransactionList);
  document.getElementById('filterType')?.addEventListener('change', renderTransactionList);
  document.getElementById('filterCategory')?.addEventListener('change', renderTransactionList);
  document.getElementById('sortBy')?.addEventListener('change', renderTransactionList);

  document.getElementById('categoryChartFilter')?.addEventListener('change', (e) => {
    state.categoryChartTimeframe = e.target.value;
    updateCategoryChart();
  });

  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentTrendsChartType = tab.getAttribute('data-chart');
      updateTrendsChart();
    });
  });

  // Export CSV
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportTransactionsCsv);

  // Load Optional Sample Data (if user ever wants to inspect a populated demo)
  document.getElementById('loadDemoDataBtn')?.addEventListener('click', () => {
    if (confirm('Load sample transactions for preview? You can reset back to clean ₹0 anytime.')) {
      const today = getTodayString();
      state.currentUser.transactions = [
        { id: 'sample-1', type: 'income', amount: 35000, category: 'Salary', date: today, spendReason: 'Monthly Salary Deposit', description: 'Monthly Salary Deposit', paymentMode: 'NetBanking' },
        { id: 'sample-2', type: 'expense', amount: 250, category: 'Food', date: today, spendReason: 'Lunch & Chai', description: 'Lunch & Chai', paymentMode: 'UPI' },
        { id: 'sample-3', type: 'expense', amount: 1500, category: 'Shopping', date: today, spendReason: 'Running Shoes', description: 'Running Shoes', paymentMode: 'Card' }
      ];
      saveCurrentUserData();
      refreshAllViews();
      showToast('Sample data loaded for preview!');
    }
  });

  // Reset Everything to Clean ₹0
  document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
    if (confirm('Reset all transactions and balances back to clean ₹0?')) {
      state.currentUser.transactions = [];
      state.currentUser.openingBalance = 0;
      saveCurrentUserData();
      refreshAllViews();
      showToast('Everything reset to clean ₹0 slate!', 'warning');
    }
  });

  // Backdrop modal click
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('transactionModal');
      closeModal('budgetModal');
      closeModal('goalModal');
      closeModal('profileModal');
      closeModal('netBalanceModal');
    }
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal('transactionModal');
      closeModal('budgetModal');
      closeModal('goalModal');
      closeModal('profileModal');
      closeModal('netBalanceModal');
    }
  });
});
