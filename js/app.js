const UIT = 5350; 
let chartInstance = null;
let currentMonth = new Date().toISOString().slice(0, 7); 
let activeUser = null; 

const defaultProfiles = ["Ricardo", "Pareja"];
let db = JSON.parse(localStorage.getItem('finops_db_secure'));

if (!db) {
  db = { profiles: {} };
  defaultProfiles.forEach(p => {
    db.profiles[p] = { passwordHash: null, months: {}, goals: [] };
  });
  localStorage.setItem('finops_db_secure', JSON.stringify(db));
}

const dom = {
  loginScreen: document.getElementById('loginScreen'),
  appScreen: document.getElementById('appScreen'),
  authProfile: document.getElementById('authProfile'),
  authPassword: document.getElementById('authPassword'),
  authMessage: document.getElementById('authMessage'),
  authError: document.getElementById('authError'),
  authForm: document.getElementById('loginForm'),
  navProfileName: document.getElementById('navProfileName'),
  monthSelector: document.getElementById('monthSelector'),
  grossInput: document.getElementById('grossInput'),
  pensionType: document.getElementById('pensionType'),
  healthType: document.getElementById('healthType'),
  expForm: document.getElementById('expenseForm'),
  expList: document.getElementById('expenseList'),
  labels: { deductions: document.getElementById('lblDeductions'), net: document.getElementById('lblNet') },
  kpis: { total: document.getElementById('kpiTotalExp'), paid: document.getElementById('kpiPaid'), surplus: document.getElementById('kpiSurplus'), health: document.getElementById('kpiHealth') }
};

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initAuth() {
  dom.authProfile.innerHTML = '';
  Object.keys(db.profiles).forEach(p => { dom.authProfile.innerHTML += `<option value="${p}">${p}</option>`; });
  checkProfileStatus();
  dom.authProfile.addEventListener('change', checkProfileStatus);
  dom.authForm.addEventListener('submit', handleLogin);
}

function checkProfileStatus() {
  const selected = dom.authProfile.value;
  dom.authError.classList.add('hidden');
  dom.authPassword.value = '';
  if (db.profiles[selected].passwordHash === null) {
    dom.authMessage.classList.remove('hidden');
    document.getElementById('authBtn').innerText = 'Registrar Contraseña & Entrar';
  } else {
    dom.authMessage.classList.add('hidden');
    document.getElementById('authBtn').innerText = 'Validar Acceso';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const selected = dom.authProfile.value;
  const hashed = await hashPassword(dom.authPassword.value);
  const profile = db.profiles[selected];

  if (profile.passwordHash === null) {
    profile.passwordHash = hashed;
    localStorage.setItem('finops_db_secure', JSON.stringify(db));
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
  
  // Asignar fecha por defecto
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  
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
  // Ocultar temporalmente los botones de eliminar para la captura
  const deleteBtns = document.querySelectorAll('.delete-btn');
  deleteBtns.forEach(btn => btn.style.display = 'none');

  html2canvas(node, { backgroundColor: '#020617', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Reporte_${activeUser}_${currentMonth}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Restaurar botones
    deleteBtns.forEach(btn => btn.style.display = 'block');
  });
};

let listenersAttached = false;
function attachDashboardListeners() {
  if (listenersAttached) return;
  dom.monthSelector.addEventListener('change', (e) => { currentMonth = e.target.value; ensureDataContext(); renderAll(); });
  dom.grossInput.addEventListener('input', updateIncomeData);
  dom.pensionType.addEventListener('change', updateIncomeData);
  dom.healthType.addEventListener('change', updateIncomeData);
  dom.expForm.addEventListener('submit', addExpense);
  listenersAttached = true;
}

function ensureDataContext() {
  if (!db.profiles[activeUser].months[currentMonth]) {
    db.profiles[activeUser].months[currentMonth] = { gross: 0, pension: 'AFP', health: 'ESSALUD', expenses: [] };
    localStorage.setItem('finops_db_secure', JSON.stringify(db));
  }
}

function updateIncomeData() {
  const monthData = db.profiles[activeUser].months[currentMonth];
  monthData.gross = parseFloat(dom.grossInput.value) || 0;
  monthData.pension = dom.pensionType.value;
  monthData.health = dom.healthType.value;
  localStorage.setItem('finops_db_secure', JSON.stringify(db));
  renderAll();
}

function addExpense(e) {
  e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;
  const date = document.getElementById('expDate').value;

  if (name && amount > 0 && date) {
    db.profiles[activeUser].months[currentMonth].expenses.push({ 
      id: Date.now().toString(), name, amount, category, date, paid: false 
    });
    localStorage.setItem('finops_db_secure', JSON.stringify(db));
    document.getElementById('expName').value = '';
    document.getElementById('expAmount').value = '';
    renderAll();
  }
}

window.togglePaid = function(id) {
  const exp = db.profiles[activeUser].months[currentMonth].expenses.find(x => x.id === id);
  if (exp) { exp.paid = !exp.paid; localStorage.setItem('finops_db_secure', JSON.stringify(db)); renderAll(); }
};

window.deleteExpense = function(id) {
  db.profiles[activeUser].months[currentMonth].expenses = db.profiles[activeUser].months[currentMonth].expenses.filter(x => x.id !== id);
  localStorage.setItem('finops_db_secure', JSON.stringify(db));
  renderAll();
};

function renderAll() {
  if (!activeUser) return;
  const monthData = db.profiles[activeUser].months[currentMonth];
  
  if (document.activeElement !== dom.grossInput) dom.grossInput.value = monthData.gross > 0 ? monthData.gross : '';
  dom.pensionType.value = monthData.pension;
  
  const pensionRate = monthData.pension === "AFP" ? 0.125 : 0.13;
  let deductions = monthData.gross * pensionRate;
  if (monthData.gross * 14 > 7 * UIT) deductions += ((monthData.gross * 14 - 7 * UIT) * 0.08) / 12;
  const net = monthData.gross - deductions;
  
  dom.labels.deductions.innerText = `-S/ ${deductions.toFixed(2)}`;
  dom.labels.net.innerText = `S/ ${net.toFixed(2)}`;

  document.querySelectorAll('.value-update').forEach(el => { el.classList.remove('update-flash'); void el.offsetWidth; el.classList.add('update-flash'); });

  let totalExp = 0, paidExp = 0;
  dom.expList.innerHTML = '';
  
  // Ordenamiento cronológico de gastos
  const sortedExpenses = [...monthData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedExpenses.forEach(exp => {
    totalExp += exp.amount; if (exp.paid) paidExp += exp.amount;
    dom.expList.innerHTML += `
      <div class="flex justify-between items-center p-2 rounded-lg border ${exp.paid ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-950/50 border-slate-800'}">
        <div class="flex items-center space-x-3">
          <input type="checkbox" ${exp.paid ? 'checked' : ''} onchange="togglePaid('${exp.id}')" class="w-4 h-4 accent-emerald-500 cursor-pointer">
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

document.addEventListener('DOMContentLoaded', initAuth);
