// ==========================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ==========================================
const UIT = 5350; // UIT 2026 (Proyectada)
let chartInstance = null;
let currentMonth = new Date().toISOString().slice(0, 7); // Formato YYYY-MM
let store = JSON.parse(localStorage.getItem('finops_db')) || {};

// ==========================================
// REFERENCIAS DOM
// ==========================================
const dom = {
  monthSelector: document.getElementById('monthSelector'),
  grossInput: document.getElementById('grossInput'),
  pensionType: document.getElementById('pensionType'),
  healthType: document.getElementById('healthType'),
  expForm: document.getElementById('expenseForm'),
  expList: document.getElementById('expenseList'),
  chartFilter: document.getElementById('chartFilter'),
  labels: {
    deductions: document.getElementById('lblDeductions'),
    net: document.getElementById('lblNet'),
    cts: document.getElementById('lblCts'),
    grati: document.getElementById('lblGrati')
  },
  kpis: {
    total: document.getElementById('kpiTotalExp'),
    paid: document.getElementById('kpiPaid'),
    surplus: document.getElementById('kpiSurplus'),
    health: document.getElementById('kpiHealth')
  }
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
function init() {
  dom.monthSelector.value = currentMonth;
  ensureMonthExists(currentMonth);
  
  // Event Listeners
  dom.monthSelector.addEventListener('change', (e) => {
    currentMonth = e.target.value;
    ensureMonthExists(currentMonth);
    renderAll();
  });

  dom.grossInput.addEventListener('input', updateIncomeData);
  dom.pensionType.addEventListener('change', updateIncomeData);
  dom.healthType.addEventListener('change', updateIncomeData);
  dom.chartFilter.addEventListener('change', renderChart);
  dom.expForm.addEventListener('submit', addExpense);

  renderAll();
}

// ==========================================
// LÓGICA DE NEGOCIO Y MODELO DE DATOS
// ==========================================
function ensureMonthExists(month) {
  if (!store[month]) {
    store[month] = {
      gross: 0,
      pension: 'AFP',
      health: 'ESSALUD',
      expenses: []
    };
    saveData();
  }
}

function saveData() {
  localStorage.setItem('finops_db', JSON.stringify(store));
}

function calculatePayroll(gross, pension, health) {
  const pensionRate = (pension === "AFP") ? 0.125 : 0.13;
  const healthRate = (health === "ESSALUD") ? 0.09 : 0.0675;
  
  const pensionDeduction = gross * pensionRate;
  
  // Renta 5ta Categoría Simplificada
  const annualGross = gross * 14;
  let annualTax = 0;
  if (annualGross > (7 * UIT)) {
    const taxable = annualGross - (7 * UIT);
    annualTax = taxable * 0.08; // Primer tramo simplificado para el ejemplo
  }
  
  const taxDeduction = annualTax / 12;
  const totalDeductions = pensionDeduction + taxDeduction;
  const net = gross - totalDeductions;
  
  // Beneficios sociales
  const grati = gross + (gross * healthRate);
  const cts = (gross + (grati / 6)) / 2;

  return { deductions: totalDeductions, net, grati, cts };
}

// ==========================================
// CONTROLADORES DE EVENTOS
// ==========================================
function updateIncomeData() {
  const data = store[currentMonth];
  data.gross = parseFloat(dom.grossInput.value) || 0;
  data.pension = dom.pensionType.value;
  data.health = dom.healthType.value;
  saveData();
  renderAll();
}

function addExpense(e) {
  e.preventDefault();
  const name = document.getElementById('expName').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;

  if (name && amount > 0) {
    store[currentMonth].expenses.push({
      id: Date.now().toString(),
      name, amount, category, paid: false
    });
    saveData();
    dom.expForm.reset();
    renderAll();
  }
}

window.togglePaid = function(id) {
  const exp = store[currentMonth].expenses.find(x => x.id === id);
  if (exp) {
    exp.paid = !exp.paid;
    saveData();
    renderAll();
  }
};

window.deleteExpense = function(id) {
  store[currentMonth].expenses = store[currentMonth].expenses.filter(x => x.id !== id);
  saveData();
  renderAll();
};

// ==========================================
// RENDERIZADO UI (VISTA)
// ==========================================
function renderAll() {
  const data = store[currentMonth];
  
  // 1. Inputs
  dom.grossInput.value = data.gross > 0 ? data.gross : '';
  dom.pensionType.value = data.pension;
  dom.healthType.value = data.health;

  // 2. Cálculos Planilla
  const payroll = calculatePayroll(data.gross, data.pension, data.health);
  dom.labels.deductions.innerText = `S/ ${payroll.deductions.toFixed(2)}`;
  dom.labels.net.innerText = `S/ ${payroll.net.toFixed(2)}`;
  dom.labels.cts.innerText = `S/ ${payroll.cts.toFixed(2)}`;
  dom.labels.grati.innerText = `S/ ${payroll.grati.toFixed(2)}`;

  // 3. Cálculos de Gastos
  let totalExp = 0, paidExp = 0;
  dom.expList.innerHTML = '';
  
  if (data.expenses.length === 0) {
    dom.expList.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Sin gastos registrados en este mes.</p>';
  }

  data.expenses.forEach(exp => {
    totalExp += exp.amount;
    if (exp.paid) paidExp += exp.amount;

    dom.expList.innerHTML += `
      <div class="expense-item flex justify-between items-center p-3 rounded-lg border ${exp.paid ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-slate-950/50 border-slate-800'}">
        <div class="flex items-center space-x-3">
          <input type="checkbox" ${exp.paid ? 'checked' : ''} onchange="togglePaid('${exp.id}')" class="w-4 h-4 accent-emerald-500 cursor-pointer">
          <div>
            <div class="text-sm font-medium ${exp.paid ? 'text-slate-400 line-through' : 'text-slate-200'}">${exp.name}</div>
            <div class="text-[10px] text-slate-500">${exp.category}</div>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="text-sm font-bold ${exp.paid ? 'text-emerald-500' : 'text-slate-300'}">S/ ${exp.amount.toFixed(2)}</div>
          <button onclick="deleteExpense('${exp.id}')" class="text-slate-600 hover:text-rose-500 transition"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  // 4. Actualizar KPIs
  const surplus = Math.max(0, payroll.net - totalExp);
  const healthRatio = payroll.net > 0 ? (totalExp / payroll.net) * 100 : 0;

  dom.kpis.total.innerText = `S/ ${totalExp.toFixed(2)}`;
  dom.kpis.paid.innerText = `S/ ${paidExp.toFixed(2)}`;
  dom.kpis.surplus.innerText = `S/ ${surplus.toFixed(2)}`;
  
  dom.kpis.health.innerText = `${healthRatio.toFixed(1)}%`;
  dom.kpis.health.className = `text-xl font-bold mt-1 ${healthRatio > 50 ? 'text-rose-400' : 'text-emerald-400'}`;

  // 5. Actualizar Gráfico
  renderChart();
}

function renderChart() {
  const data = store[currentMonth];
  const type = dom.chartFilter.value;
  const ctx = document.getElementById('mainChart').getContext('2d');

  if (chartInstance) chartInstance.destroy();

  // Agrupar gastos por categoría
  const grouped = data.expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  const colors = ['#34d399', '#818cf8', '#fbbf24', '#f87171', '#c084fc', '#60a5fa', '#94a3b8'];

  chartInstance = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: 'Monto Ejecutado (S/)',
        data: values,
        backgroundColor: colors.map(c => type === 'bar' ? c + '80' : c),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: type === 'bar' ? 4 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } },
      scales: type === 'bar' ? {
        x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10 } } },
        y: { grid: { color: '#1e293b' }, ticks: { color: '#cbd5e1', font: { size: 10 } } }
      } : {}
    }
  });
}

// Inicializar app al cargar
document.addEventListener('DOMContentLoaded', init);
