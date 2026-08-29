// ==========================================
// CONFIGURACIÓN DE ESQUEMA (MULTI-TENANT)
// ==========================================
const UIT = 5350; 
let chartInstance = null;
let currentMonth = new Date().toISOString().slice(0, 7); 

// Esquema de base de datos local
const defaultStore = {
  activeProfile: "Usuario1",
  profiles: {
    "Usuario1": { months: {}, goals: [] },
    "Usuario2": { months: {}, goals: [] }
  }
};

// Migración/Inicialización de DB
let db = JSON.parse(localStorage.getItem('finops_db_v2'));
if (!db || !db.profiles) {
  db = defaultStore;
  localStorage.setItem('finops_db_v2', JSON.stringify(db));
}

// ==========================================
// REFERENCIAS DOM
// ==========================================
const dom = {
  profileSelector: document.getElementById('profileSelector'),
  monthSelector: document.getElementById('monthSelector'),
  grossInput: document.getElementById('grossInput'),
  pensionType: document.getElementById('pensionType'),
  healthType: document.getElementById('healthType'),
  expForm: document.getElementById('expenseForm'),
  expList: document.getElementById('expenseList'),
  goalForm: document.getElementById('goalForm'),
  goalsContainer: document.getElementById('goalsContainer'),
  labels: {
    deductions: document.getElementById('lblDeductions'),
    net: document.getElementById('lblNet')
  },
  kpis: {
    total: document.getElementById('kpiTotalExp'),
    paid: document.getElementById('kpiPaid'),
    surplus: document.getElementById('kpiSurplus'),
    health: document.getElementById('kpiHealth')
  }
};

// ==========================================
// INICIALIZACIÓN Y EVENTOS
// ==========================================
function init() {
  dom.profileSelector.value = db.activeProfile;
  dom.monthSelector.value = currentMonth;
  ensureDataContext();
  
  // Listeners reactivos
  dom.profileSelector.addEventListener('change', (e) => {
    db.activeProfile = e.target.value;
    ensureDataContext();
    renderAll();
  });

  dom.monthSelector.addEventListener('change', (e) => {
    currentMonth = e.target.value;
    ensureDataContext();
    renderAll();
  });

  dom.grossInput.addEventListener('input', updateIncomeData);
  dom.pensionType.addEventListener('change', updateIncomeData);
  dom.healthType.addEventListener('change', updateIncomeData);
  dom.expForm.addEventListener('submit', addExpense);
  dom.goalForm.addEventListener('submit', addGoal);

  renderAll();
}

function ensureDataContext() {
  const profile = db.profiles[db.activeProfile];
  if (!profile.months[currentMonth]) {
    profile.months[currentMonth] = { gross: 0, pension: 'AFP', health: 'ESSALUD', expenses: [] };
    saveData();
  }
}

function saveData() {
  localStorage.setItem('finops_db_v2', JSON.stringify(db));
}

// ==========================================
// CONTROLADORES FINANCIEROS Y METAS
// ==========================================
function updateIncomeData() {
  const monthData = db.profiles[db.activeProfile].months[currentMonth];
  monthData.gross = parseFloat(dom.grossInput.value) || 0;
  monthData.pension = dom.pensionType.value;
  monthData.health = dom.healthType.value;
  saveData();
  renderAll();
}

function addExpense(e) {
  e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;

  if (name && amount > 0) {
    db.profiles[db.activeProfile].months[currentMonth].expenses.push({
      id: Date.now().toString(), name, amount, category, paid: false
    });
    saveData();
    dom.expForm.reset();
    renderAll();
  }
}

function addGoal(e) {
  e.preventDefault();
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const monthly = parseFloat(document.getElementById('goalMonthly').value);

  if (name && target > 0 && monthly > 0) {
    db.profiles[db.activeProfile].goals.push({
      id: Date.now().toString(), name, target, monthly, current: 0
    });
    saveData();
    dom.goalForm.reset();
    renderAll();
  }
}

window.deleteGoal = function(id) {
  db.profiles[db.activeProfile].goals = db.profiles[db.activeProfile].goals.filter(x => x.id !== id);
  saveData();
  renderAll();
}

window.togglePaid = function(id) {
  const exp = db.profiles[db.activeProfile].months[currentMonth].expenses.find(x => x.id === id);
  if (exp) {
    exp.paid = !exp.paid;
    saveData();
    renderAll();
  }
};

window.deleteExpense = function(id) {
  db.profiles[db.activeProfile].months[currentMonth].expenses = db.profiles[db.activeProfile].months[currentMonth].expenses.filter(x => x.id !== id);
  saveData();
  renderAll();
};

// ==========================================
// MOTOR DE RECOMENDACIONES FINANCIERAS (PERÚ)
// ==========================================
function getRecommendationInsight(monthsRequired) {
  if (monthsRequired >= 12) {
    return {
      type: "Depósito a Plazo Fijo (DPF)",
      desc: "Horizonte óptimo para congelar liquidez. Sugerimos buscar Cajas Municipales (ej. Caja Arequipa, Huancayo) con TEA entre 6.5% - 8.0%. Riesgo 0 (Fondo de Seguro de Depósitos).",
      color: "border-emerald-500/40 text-emerald-300"
    };
  } else if (monthsRequired >= 6) {
    return {
      type: "Cuenta de Alto Rendimiento",
      desc: "Mediano plazo. Sugerencia: Agora PAY, Banco Ripley o BCP Warda. Permiten depósitos recurrentes con TEA ~5% - 6% manteniendo libre disponibilidad.",
      color: "border-indigo-500/40 text-indigo-300"
    };
  } else {
    return {
      type: "Ahorro Libre Inmediato",
      desc: "Corto plazo. Mantén el dinero en cuentas digitales de costo cero (sin mantenimiento) para evitar erosión del capital antes de ejecutar la meta.",
      color: "border-amber-500/40 text-amber-300"
    };
  }
}

// ==========================================
// RENDERIZADO UI (REACTIVO)
// ==========================================
function renderAll() {
  const profile = db.profiles[db.activeProfile];
  const monthData = profile.months[currentMonth];
  
  // 1. Planilla
  if (document.activeElement !== dom.grossInput) {
    dom.grossInput.value = monthData.gross > 0 ? monthData.gross : '';
  }
  dom.pensionType.value = monthData.pension;
  
  const pensionRate = monthData.pension === "AFP" ? 0.125 : 0.13;
  let deductions = monthData.gross * pensionRate;
  if (monthData.gross * 14 > 7 * UIT) deductions += ((monthData.gross * 14 - 7 * UIT) * 0.08) / 12;
  const net = monthData.gross - deductions;
  
  dom.labels.deductions.innerText = `-S/ ${deductions.toFixed(2)}`;
  dom.labels.net.innerText = `S/ ${net.toFixed(2)}`;

  // Animación de flash UI
  document.querySelectorAll('.value-update').forEach(el => {
    el.classList.remove('update-flash');
    void el.offsetWidth; 
    el.classList.add('update-flash');
  });

  // 2. Gastos
  let totalExp = 0, paidExp = 0;
  dom.expList.innerHTML = '';
  
  monthData.expenses.forEach(exp => {
    totalExp += exp.amount;
    if (exp.paid) paidExp += exp.amount;
    dom.expList.innerHTML += `
      <div class="flex justify-between items-center p-2 rounded-lg border ${exp.paid ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-950/50 border-slate-800'}">
        <div class="flex items-center space-x-3">
          <input type="checkbox" ${exp.paid ? 'checked' : ''} onchange="togglePaid('${exp.id}')" class="w-4 h-4 accent-emerald-500 cursor-pointer">
          <span class="text-xs ${exp.paid ? 'text-slate-400 line-through' : 'text-slate-200'}">${exp.name}</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-xs font-bold ${exp.paid ? 'text-emerald-500' : 'text-slate-300'}">S/ ${exp.amount.toFixed(2)}</span>
          <button onclick="deleteExpense('${exp.id}')" class="text-slate-600 hover:text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  // KPIs
  const surplus = Math.max(0, net - totalExp);
  const healthRatio = net > 0 ? ((net - totalExp) / net) * 100 : 0;
  
  dom.kpis.total.innerText = `S/ ${totalExp.toFixed(2)}`;
  dom.kpis.paid.innerText = `S/ ${paidExp.toFixed(2)}`;
  dom.kpis.surplus.innerText = `S/ ${surplus.toFixed(2)}`;
  dom.kpis.health.innerText = `${healthRatio.toFixed(1)}%`;
  dom.kpis.health.className = `text-xl font-bold mt-1 ${healthRatio < 20 ? 'text-rose-400' : 'text-emerald-400'}`;

  // 3. Metas (Alcancía)
  dom.goalsContainer.innerHTML = '';
  profile.goals.forEach(goal => {
    const monthsRequired = Math.ceil((goal.target - goal.current) / goal.monthly);
    const insight = getRecommendationInsight(monthsRequired);
    const progress = Math.min((goal.current / goal.target) * 100, 100);

    dom.goalsContainer.innerHTML += `
      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
        <button onclick="deleteGoal('${goal.id}')" class="absolute top-3 right-3 text-slate-600 hover:text-rose-500"><i class="fa-solid fa-xmark"></i></button>
        <div class="flex justify-between items-end mb-2">
          <div>
            <h4 class="text-sm font-bold text-white">${goal.name}</h4>
            <span class="text-xs text-slate-400">Meta: S/ ${goal.target.toFixed(2)}</span>
          </div>
          <div class="text-right">
            <span class="block text-xl font-black text-rose-400">${monthsRequired} <span class="text-xs text-slate-400 font-normal">meses</span></span>
            <span class="text-[10px] text-slate-500">Aporte: S/ ${goal.monthly.toFixed(2)}/mes</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full bg-slate-900 rounded-full h-1.5 mb-4">
          <div class="bg-rose-500 h-1.5 rounded-full" style="width: ${progress}%"></div>
        </div>

        <!-- AI Recommendation Insight -->
        <div class="bg-slate-900/50 p-3 rounded-lg border ${insight.color} text-xs">
          <strong class="block mb-1"><i class="fa-solid fa-bolt mr-1"></i>Estrategia: ${insight.type}</strong>
          ${insight.desc}
        </div>
      </div>
    `;
  });

  // 4. Gráfico
  renderChart(monthData.expenses);
}

function renderChart(expenses) {
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const grouped = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        data: Object.values(grouped),
        backgroundColor: ['#34d399', '#818cf8', '#fbbf24', '#f87171', '#c084fc', '#60a5fa'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
