const UIT = 5350; 
let chartInstance = null;
let currentMonth = new Date().toISOString().slice(0, 7); 
let activeUser = null; 
let db = null;
let dom = {};

function getPeruDate() {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' 
  }).format(new Date());
}

// 1. Script de Consistencia y Migración de Esquemas
function initDatabase() {
  db = JSON.parse(localStorage.getItem('finops_db_prod'));
  if (!db) {
    const legacyDB = JSON.parse(localStorage.getItem('finops_db_secure'));
    db = legacyDB ? legacyDB : { profiles: {} };
    
    // Migración de "Pareja" a "Ivechi" si aplica
    if (db.profiles && db.profiles["Pareja"]) {
        db.profiles["Ivechi"] = db.profiles["Pareja"];
        delete db.profiles["Pareja"];
    }
  }
  
  // Garantizar existencia de perfiles iniciales si está vacía
  if (!db.profiles) db.profiles = {};
  if (Object.keys(db.profiles).length === 0) {
     db.profiles["Ricardo"] = { passwordHash: null, months: {}, goals: [] };
     db.profiles["Ivechi"] = { passwordHash: null, months: {}, goals: [] };
  }

  // Normalización estricta (Evitar undefined errors)
  Object.keys(db.profiles).forEach(p => {
     if (db.profiles[p].passwordHash === undefined) db.profiles[p].passwordHash = null;
     if (!db.profiles[p].months) db.profiles[p].months = {};
     if (!db.profiles[p].goals) db.profiles[p].goals = [];
  });

  localStorage.setItem('finops_db_prod', JSON.stringify(db));
}

// 2. Control del DOM
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();
  
  dom = {
    loginScreen: document.getElementById('loginScreen'),
    appScreen: document.getElementById('appScreen'),
    tabLogin: document.getElementById('tabLogin'),
    tabRegister: document.getElementById('tabRegister'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    authProfile: document.getElementById('authProfile'),
    authPassword: document.getElementById('authPassword'),
    authMessage: document.getElementById('authMessage'),
    authError: document.getElementById('authError'),
    authBtn: document.getElementById('authBtn'),
    regProfileName: document.getElementById('regProfileName'),
    regPassword: document.getElementById('regPassword'),
    navProfileName: document.getElementById('navProfileName'),
    monthSelector: document.getElementById('monthSelector'),
    grossInput: document.getElementById('grossInput'),
    pensionType: document.getElementById('pensionType'),
    healthType: document.getElementById('healthType'),
    expForm: document.getElementById('expenseForm'),
    expDate: document.getElementById('expDate'),
    expList: document.getElementById('expenseList'),
    goalForm: document.getElementById('goalForm'),
    goalsContainer: document.getElementById('goalsContainer'),
    adviceText: document.getElementById('financialAdviceText'),
    labels: { deductions: document.getElementById('lblDeductions'), net: document.getElementById('lblNet'), cts: document.getElementById('lblCts'), grati: document.getElementById('lblGrati') },
    kpis: { total: document.getElementById('kpiTotalExp'), paid: document.getElementById('kpiPaid'), surplus: document.getElementById('kpiSurplus'), health: document.getElementById('kpiHealth') }
  };

  initAuth();
});

// Criptografía
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auth Lifecycle
function initAuth() {
  loadProfiles();
  checkProfileStatus();
  
  dom.authProfile.addEventListener('change', checkProfileStatus);
  dom.loginForm.addEventListener('submit', handleLogin);
  dom.registerForm.addEventListener('submit', handleRegister);
  
  dom.tabLogin.addEventListener('click', () => switchTab('login'));
  dom.tabRegister.addEventListener('click', () => switchTab('register'));
}

function loadProfiles() {
  dom.authProfile.innerHTML = '';
  Object.keys(db.profiles).forEach(p => { 
      dom.authProfile.innerHTML += `<option value="${p}">${p}</option>`; 
  });
}

function switchTab(tab) {
  if(tab === 'login') {
      dom.loginForm.classList.remove('hidden');
      dom.registerForm.classList.add('hidden');
      dom.tabLogin.classList.replace('text-slate-500', 'text-emerald-400');
      dom.tabLogin.classList.replace('border-transparent', 'border-emerald-500');
      dom.tabRegister.classList.replace('text-emerald-400', 'text-slate-500');
      dom.tabRegister.classList.replace('border-emerald-500', 'border-transparent');
  } else {
      dom.loginForm.classList.add('hidden');
      dom.registerForm.classList.remove('hidden');
      dom.tabRegister.classList.replace('text-slate-500', 'text-emerald-400');
      dom.tabRegister.classList.replace('border-transparent', 'border-emerald-500');
      dom.tabLogin.classList.replace('text-emerald-400', 'text-slate-500');
      dom.tabLogin.classList.replace('border-emerald-500', 'border-transparent');
  }
}

function checkProfileStatus() {
  const selected = dom.authProfile.value;
  if(!selected || !db.profiles[selected]) return;
  
  dom.authError.classList.add('hidden');
  dom.authPassword.value = '';
  
  if (!db.profiles[selected].passwordHash) {
    dom.authMessage.classList.remove('hidden');
    dom.authBtn.innerText = 'Registrar Clave & Entrar';
  } else {
    dom.authMessage.classList.add('hidden');
    dom.authBtn.innerText = 'Desbloquear Bóveda';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = dom.regProfileName.value.trim();
  const pwd = dom.regPassword.value;
  
  if(db.profiles[name]) {
      alert("Violación de restricción única: Esta etiqueta de perfil ya existe.");
      return;
  }
  
  const hashed = await hashPassword(pwd);
  db.profiles[name] = { passwordHash: hashed, months: {}, goals: [] };
  localStorage.setItem('finops_db_prod', JSON.stringify(db));
  
  dom.regProfileName.value = '';
  dom.regPassword.value = '';
  loadProfiles();
  switchTab('login');
  dom.authProfile.value = name;
  checkProfileStatus();
  alert(`Instancia de partición para '${name}' creada con éxito.`);
}

async function handleLogin(e) {
  e.preventDefault();
  const selected = dom.authProfile.value;
  if(!selected) return;
  
  const hashed = await hashPassword(dom.authPassword.value);
  const profile = db.profiles[selected];

  if (!profile.passwordHash) {
    profile.passwordHash = hashed;
    localStorage.setItem('finops_db_prod', JSON.stringify(db));
    loginSuccess(selected);
  } else {
    if (profile.passwordHash === hashed) loginSuccess(selected);
    else { dom.authError.classList.remove('hidden'); dom.authPassword.value = ''; }
  }
}

function loginSuccess(username) {
  activeUser = username;
  dom.navProfileName.innerText = username;
  dom.loginScreen.classList.add('hidden');
  dom.appScreen.classList.remove('hidden');
  dom.monthSelector.value = currentMonth;
  dom.expDate.value = getPeruDate();
  
  ensureDataContext();
  attachDashboardListeners();
  renderAll();
}

window.logout = function() {
  activeUser = null;
  dom.appScreen.classList.add('hidden');
  dom.loginScreen.classList.remove('hidden');
  dom.authPassword.value = '';
  checkProfileStatus();
};

window.exportDashboard = function() {
  const node = document.getElementById('exportableArea');
  const noPrintElements = document.querySelectorAll('.no-print, .delete-btn, .action-btn');
  noPrintElements.forEach(el => el.style.display = 'none');

  html2canvas(node, { backgroundColor: '#020617', scale: 2, useCORS: true, logging: false }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Reporte_${activeUser}_${currentMonth}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    noPrintElements.forEach(el => el.style.display = '');
  }).catch(() => { noPrintElements.forEach(el => el.style.display = ''); });
};

// ==========================================
// CONTROL LÓGICO DE LA APLICACIÓN
// ==========================================
let listenersAttached = false;
function attachDashboardListeners() {
  if (listenersAttached) return;
  dom.monthSelector.addEventListener('change', (e) => { currentMonth = e.target.value; ensureDataContext(); renderAll(); });
  
  // Enlaces reactivos (Disparan renderizado sin recargar DOM completo)
  dom.grossInput.addEventListener('input', updateIncomeData);
  dom.pensionType.addEventListener('change', updateIncomeData);
  dom.healthType.addEventListener('change', updateIncomeData);
  dom.expForm.addEventListener('submit', addExpense);
  dom.goalForm.addEventListener('submit', addGoal);
  listenersAttached = true;
}

function ensureDataContext() {
  if (!db.profiles[activeUser].months[currentMonth]) {
    db.profiles[activeUser].months[currentMonth] = { gross: 0, pension: 'AFP', health: 'ESSALUD', expenses: [] };
    localStorage.setItem('finops_db_prod', JSON.stringify(db));
  }
}

function updateIncomeData() {
  const monthData = db.profiles[activeUser].months[currentMonth];
  monthData.gross = parseFloat(dom.grossInput.value) || 0;
  monthData.pension = dom.pensionType.value;
  monthData.health = dom.healthType.value;
  localStorage.setItem('finops_db_prod', JSON.stringify(db));
  renderAll();
}

function addExpense(e) {
  e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;
  const date = dom.expDate.value;

  if (name && amount > 0 && date) {
    db.profiles[activeUser].months[currentMonth].expenses.push({ 
      id: Date.now().toString(), name, amount, category, date, paid: false 
    });
    localStorage.setItem('finops_db_prod', JSON.stringify(db));
    document.getElementById('expName').value = '';
    document.getElementById('expAmount').value = '';
    dom.expDate.value = getPeruDate();
    renderAll();
  }
}

function addGoal(e) {
  e.preventDefault();
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const monthly = parseFloat(document.getElementById('goalMonthly').value);

  if (name && target > 0 && monthly > 0) {
    db.profiles[activeUser].goals.push({ id: Date.now().toString(), name, target, monthly, current: 0 });
    localStorage.setItem('finops_db_prod', JSON.stringify(db));
    dom.goalForm.reset();
    renderAll();
  }
}

window.addFundsToGoal = function(id) {
  const input = document.getElementById(`fund_${id}`);
  const amount = parseFloat(input.value);
  if (amount > 0) {
    const goal = db.profiles[activeUser].goals.find(g => g.id === id);
    if (goal) {
      goal.current += amount;
      if (goal.current > goal.target) goal.current = goal.target;
      localStorage.setItem('finops_db_prod', JSON.stringify(db));
      renderAll();
    }
  }
}

window.togglePaid = function(id) {
  const exp = db.profiles[activeUser].months[currentMonth].expenses.find(x => x.id === id);
  if (exp) { exp.paid = !exp.paid; localStorage.setItem('finops_db_prod', JSON.stringify(db)); renderAll(); }
};

window.deleteExpense = function(id) {
  db.profiles[activeUser].months[currentMonth].expenses = db.profiles[activeUser].months[currentMonth].expenses.filter(x => x.id !== id);
  localStorage.setItem('finops_db_prod', JSON.stringify(db));
  renderAll();
};

window.deleteGoal = function(id) {
  db.profiles[activeUser].goals = db.profiles[activeUser].goals.filter(x => x.id !== id);
  localStorage.setItem('finops_db_prod', JSON.stringify(db));
  renderAll();
}

// Analítica
function getRecommendationInsight(monthsRequired) {
  if (monthsRequired >= 12) return { type: "Bloqueo DPF", desc: "Capitaliza en Cajas Municipales (ej. Huancayo, Arequipa) con TEA > 7.0%. Mitigación de riesgo vía FSD.", color: "border-emerald-500/40 text-emerald-300" };
  else if (monthsRequired >= 6) return { type: "Cuenta High-Yield", desc: "Arbitraje en Ágora PAY o BCP Warda. Flexibilidad transaccional con TEA ~5.5%.", color: "border-indigo-500/40 text-indigo-300" };
  else return { type: "Alta Liquidez", desc: "Prioridad: disponibilidad inmediata. Omite vehículos con comisiones de mantenimiento.", color: "border-amber-500/40 text-amber-300" };
}

function updateFinancialAdvice(surplus) {
  if (surplus <= 0) {
    dom.adviceText.innerHTML = "Evaluación de Riesgo: <strong>Flujo de caja agotado</strong>. Revisa tus obligaciones transaccionales para identificar fugas de capital.";
  } else if (surplus < 500) {
    dom.adviceText.innerHTML = `Líquido Detectado: <strong>S/ ${surplus.toFixed(2)}</strong>. Inyecta este capital inicial a un Fondo de Emergencia de alta liquidez (~5% TREA).`;
  } else {
    dom.adviceText.innerHTML = `Rendimiento Óptimo: Tienes <strong>S/ ${surplus.toFixed(2)}</strong> libres. Asigna 30% a fondo de liquidez y 70% a tus <strong>Bóvedas de Objetivos (Metas)</strong>.`;
  }
}

// Renderización Principal 
function renderAll() {
  if (!activeUser) return;
  const profile = db.profiles[activeUser];
  const monthData = profile.months[currentMonth];
  
  if (document.activeElement !== dom.grossInput) dom.grossInput.value = monthData.gross > 0 ? monthData.gross : '';
  dom.pensionType.value = monthData.pension;
  dom.healthType.value = monthData.health;
  
  const pensionRate = monthData.pension === "AFP" ? 0.125 : 0.13;
  const healthRate = monthData.health === "ESSALUD" ? 0.09 : 0.0675;
  
  let deductions = monthData.gross * pensionRate;
  if (monthData.gross * 14 > 7 * UIT) deductions += ((monthData.gross * 14 - 7 * UIT) * 0.08) / 12;
  const net = monthData.gross - deductions;
  
  const grati = monthData.gross + (monthData.gross * healthRate);
  const cts = (monthData.gross + (grati / 6)) / 2;

  dom.labels.deductions.innerText = `-S/ ${deductions.toFixed(2)}`;
  dom.labels.net.innerText = `S/ ${net.toFixed(2)}`;
  dom.labels.cts.innerText = `S/ ${cts.toFixed(2)}`;
  dom.labels.grati.innerText = `S/ ${grati.toFixed(2)}`;

  document.querySelectorAll('.value-update').forEach(el => { el.classList.remove('update-flash'); void el.offsetWidth; el.classList.add('update-flash'); });

  let totalExp = 0, paidExp = 0;
  dom.expList.innerHTML = '';
  
  const sortedExpenses = [...monthData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedExpenses.forEach(exp => {
    totalExp += exp.amount; if (exp.paid) paidExp += exp.amount;
    dom.expList.innerHTML += `
      <div class="flex justify-between items-center p-2 rounded-lg border ${exp.paid ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-950/50 border-slate-800'}">
        <div class="flex items-center space-x-3">
          <input type="checkbox" ${exp.paid ? 'checked' : ''} onchange="togglePaid('${exp.id}')" class="w-4 h-4 accent-emerald-500 cursor-pointer action-btn">
          <div class="flex flex-col">
            <span class="text-xs ${exp.paid ? 'text-slate-400 line-through' : 'text-slate-200'}">${exp.name}</span>
            <span class="text-[9px] text-slate-500"><i class="fa-regular fa-clock mr-1"></i>${exp.date}</span>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-xs font-bold ${exp.paid ? 'text-emerald-500' : 'text-slate-300'}">S/ ${exp.amount.toFixed(2)}</span>
          <button onclick="deleteExpense('${exp.id}')" class="delete-btn text-slate-600 hover:text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  });

  const surplus = Math.max(0, net - totalExp);
  const healthRatio = net > 0 ? (totalExp / net) * 100 : 0;
  
  dom.kpis.total.innerText = `S/ ${totalExp.toFixed(2)}`;
  dom.kpis.paid.innerText = `S/ ${paidExp.toFixed(2)}`;
  dom.kpis.surplus.innerText = `S/ ${surplus.toFixed(2)}`;
  dom.kpis.health.innerText = `${healthRatio.toFixed(1)}%`;
  dom.kpis.health.className = `text-xl font-bold mt-1 ${healthRatio > 50 ? 'text-rose-400' : 'text-emerald-400'}`;

  updateFinancialAdvice(surplus);

  dom.goalsContainer.innerHTML = '';
  profile.goals.forEach(goal => {
    const monthsRequired = Math.ceil(Math.max(0, goal.target - goal.current) / goal.monthly);
    const insight = getRecommendationInsight(monthsRequired);
    const progress = Math.min((goal.current / goal.target) * 100, 100);
    const isComplete = progress >= 100;

    dom.goalsContainer.innerHTML += `
      <div class="bg-slate-950 p-4 rounded-xl border ${isComplete ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] goal-completed' : 'border-slate-800'} relative overflow-hidden transition-all duration-500">
        <button onclick="deleteGoal('${goal.id}')" class="delete-btn absolute top-3 right-3 text-slate-600 hover:text-rose-500"><i class="fa-solid fa-xmark"></i></button>
        <div class="flex justify-between items-end mb-2">
          <div>
            <h4 class="text-sm font-bold ${isComplete ? 'text-emerald-400' : 'text-white'}">${goal.name} ${isComplete ? '<i class="fa-solid fa-circle-check ml-1"></i>' : ''}</h4>
            <span class="text-xs text-slate-400">Progreso: S/ ${goal.current.toFixed(2)} de S/ ${goal.target.toFixed(2)}</span>
          </div>
          <div class="text-right">
            ${isComplete ? `<span class="block text-lg font-black text-emerald-400">¡Capitalizado!</span>` : `<span class="block text-xl font-black text-rose-400">${monthsRequired} <span class="text-xs text-slate-400 font-normal">meses</span></span>`}
          </div>
        </div>
        
        <div class="w-full bg-slate-900 rounded-full h-2 mb-3 mt-1"><div class="${isComplete ? 'bg-emerald-500' : 'bg-rose-500'} h-2 rounded-full transition-all duration-700" style="width: ${progress}%"></div></div>

        ${!isComplete ? `
          <div class="flex items-center justify-between mb-3 bg-slate-900 p-2 rounded-lg border border-slate-800 no-print">
            <span class="text-[10px] text-slate-400">Transacción al fondo:</span>
            <div class="flex space-x-2">
              <input type="number" id="fund_${goal.id}" placeholder="Monto" class="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold focus:border-emerald-500 focus:outline-none">
              <button onclick="addFundsToGoal('${goal.id}')" class="action-btn bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs transition shadow">Aportar</button>
            </div>
          </div>
          <div class="bg-slate-900/50 p-3 rounded-lg border ${insight.color} text-xs"><strong class="block mb-1"><i class="fa-solid fa-bolt mr-1"></i>${insight.type}</strong>${insight.desc}</div>
        ` : `<div class="bg-emerald-900/20 p-3 rounded-lg border border-emerald-500/30 text-xs text-emerald-300 text-center">Fondo Completado Exitosamente.</div>`}
      </div>`;
  });

  renderChart(monthData.expenses);
}

function renderChart(expenses) {
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  const grouped = expenses.reduce((acc, curr) => { acc[curr.category] = (acc[curr.category] || 0) + curr.amount; return acc; }, {});
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(grouped), datasets: [{ data: Object.values(grouped), backgroundColor: ['#34d399', '#818cf8', '#fbbf24', '#f87171', '#c084fc', '#60a5fa'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } }
  });
}
