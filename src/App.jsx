import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ───
const DEFAULT_RATE = 278;
const DEFAULT_SALARY_USD = 2300;

const DEFAULT_EXPENSE_CATS = [
  { id: "rent", name: "Rent", emoji: "🏠" },
  { id: "food", name: "Food & Groceries", emoji: "🛒" },
  { id: "transport", name: "Transport", emoji: "🚗" },
  { id: "utilities", name: "Utilities", emoji: "💡" },
  { id: "health", name: "Health", emoji: "🏥" },
  { id: "education", name: "Education", emoji: "📚" },
  { id: "entertainment", name: "Entertainment", emoji: "🎮" },
  { id: "shopping", name: "Shopping", emoji: "🛍️" },
  { id: "other", name: "Other", emoji: "📦" },
];

const DEFAULT_INCOME_CATS = [
  { id: "salary", name: "Salary", emoji: "💰" },
  { id: "freelance", name: "Freelance", emoji: "💻" },
  { id: "business", name: "Business", emoji: "🏢" },
  { id: "investment", name: "Investment", emoji: "📈" },
  { id: "rental", name: "Rental Income", emoji: "🏘️" },
  { id: "other_inc", name: "Other", emoji: "💵" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Storage helpers ───
const STORAGE_KEY = "rupeesave-data";

async function loadData() {
  try {
    if (window.storage) {
      const result = await window.storage.get(STORAGE_KEY);
      return result ? JSON.parse(result.value) : null;
    }
  } catch { }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveData(data) {
  const json = JSON.stringify(data);
  try {
    if (window.storage) { await window.storage.set(STORAGE_KEY, json); return; }
  } catch { }
  try { localStorage.setItem(STORAGE_KEY, json); } catch { }
}

// ─── Helpers ───
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) => "Rs " + Math.round(n).toLocaleString("en-PK");
const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function isExpenseActive(exp) {
  const em = Number(exp.endMonth);
  const ey = Number(exp.endYear);
  if (!em || !ey) return true;
  const now = new Date();
  const endDate = new Date(ey, em - 1, 28);
  return now <= endDate;
}

function daysUntilEnd(exp) {
  const em = Number(exp.endMonth);
  const ey = Number(exp.endYear);
  if (!em || !ey) return Infinity;
  const end = new Date(ey, em - 1, 28);
  return Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
}

function getMonthYear(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return { month: d.getMonth(), year: d.getFullYear() };
}

// ─── Styles ───
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";

const theme = {
  bg: "#0a0e1a",
  surface: "#111827",
  card: "#1a2035",
  cardHover: "#1e2640",
  border: "#2a3550",
  borderLight: "#374163",
  text: "#e2e8f0",
  textDim: "#8b95b0",
  textMuted: "#5a6580",
  accent: "#22d3ee",
  accentDark: "#0891b2",
  green: "#34d399",
  greenDark: "#059669",
  red: "#f87171",
  redDark: "#dc2626",
  yellow: "#fbbf24",
  yellowDark: "#d97706",
  purple: "#a78bfa",
  pink: "#f472b6",
  orange: "#fb923c",
  blue: "#60a5fa",
  gradient1: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
  gradient2: "linear-gradient(135deg, #34d399 0%, #22d3ee 100%)",
  gradient3: "linear-gradient(135deg, #f472b6 0%, #fb923c 100%)",
};

// ─── Main App ───
export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
  const [customExpCats, setCustomExpCats] = useState([]);
  const [customIncCats, setCustomIncCats] = useState([]);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const saveTimer = useRef(null);

  // Load data
  useEffect(() => {
    (async () => {
      const data = await loadData();
      if (data) {
        if (data.rate) setRate(data.rate);
        if (data.incomes) setIncomes(data.incomes);
        if (data.expenses) setExpenses(data.expenses);
        if (data.goals) setGoals(data.goals);
        if (data.customExpCats) setCustomExpCats(data.customExpCats);
        if (data.customIncCats) setCustomIncCats(data.customIncCats);
      }
      setLoading(false);
    })();
  }, []);

  // Auto-save
  const doSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveData({ rate, incomes, expenses, goals, customExpCats, customIncCats });
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    }, 500);
  }, [rate, incomes, expenses, goals, customExpCats, customIncCats]);

  useEffect(() => { if (!loading) doSave(); }, [rate, incomes, expenses, goals, customExpCats, customIncCats, loading, doSave]);

  // Calculations
  const totalIncomePKR = incomes.reduce((s, i) => s + (i.currency === "USD" ? i.amount * rate : i.amount), 0);
  const activeExpenses = expenses.filter(isExpenseActive);
  const expiredExpenses = expenses.filter(e => !isExpenseActive(e));
  const totalExpensePKR = activeExpenses.reduce((s, e) => s + (e.type === "onetime" ? 0 : e.amount), 0);
  const monthlySaving = totalIncomePKR - totalExpensePKR;
  const savingsRate = totalIncomePKR > 0 ? (monthlySaving / totalIncomePKR) * 100 : 0;
  const freedUpAmount = expiredExpenses.reduce((s, e) => s + (e.type === "monthly" ? e.amount : 0), 0);

  const allExpCats = [...DEFAULT_EXPENSE_CATS, ...customExpCats];
  const allIncCats = [...DEFAULT_INCOME_CATS, ...customIncCats];

  // ─── Tab navigation ───
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "income", label: "Income", icon: "💰" },
    { id: "expenses", label: "Expenses", icon: "💸" },
    { id: "goals", label: "Goals", icon: "🎯" },
    { id: "converter", label: "Converter", icon: "⇄" },
  ];

  if (loading) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <link href={FONT_LINK} rel="stylesheet" />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s infinite" }}>💰</div>
          <div style={{ color: theme.accent, fontSize: 20, fontWeight: 700 }}>Loading RupeeSave...</div>
        </div>
        <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", color: theme.text }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px ${theme.accent}33; } 50% { box-shadow: 0 0 20px ${theme.accent}55; } }
        @keyframes savedFlash { 0% { opacity: 0; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { font-family: inherit; }
        input:focus, select:focus { outline: none; border-color: ${theme.accent} !important; box-shadow: 0 0 0 3px ${theme.accent}22; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${theme.surface}; } ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
        .btn-hover:hover { transform: translateY(-1px); filter: brightness(1.1); }
      `}</style>

      {/* Header */}
      <header style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>💰</span>
          <span style={{ fontSize: 22, fontWeight: 800, background: theme.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RupeeSave</span>
          {savedIndicator && <span style={{ color: theme.green, fontSize: 13, fontWeight: 600, animation: "savedFlash 2s ease" }}>✓ Saved</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: theme.textDim }}>
            <span>1 USD =</span>
            <input type="number" value={rate} onChange={e => setRate(Number(e.target.value) || 1)} style={{ width: 70, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 8px", color: theme.accent, fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }} />
            <span>PKR</span>
          </div>
          <div style={{ fontSize: 14, color: theme.green, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
            Income: {fmt(totalIncomePKR)}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "0 16px", display: "flex", gap: 4, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn-hover" style={{
            padding: "12px 18px", background: "none", border: "none", color: tab === t.id ? theme.accent : theme.textDim,
            fontSize: 14, fontWeight: tab === t.id ? 700 : 500, cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${theme.accent}` : "2px solid transparent",
            transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontFamily: "inherit"
          }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "dashboard" && <DashboardTab {...{ totalIncomePKR, totalExpensePKR, monthlySaving, savingsRate, freedUpAmount, incomes, expenses, activeExpenses, expiredExpenses, allExpCats, allIncCats, rate, calMonth, calYear, setCalMonth, setCalYear }} />}
        {tab === "income" && <IncomeTab {...{ incomes, setIncomes, allIncCats, customIncCats, setCustomIncCats, rate }} />}
        {tab === "expenses" && <ExpenseTab {...{ expenses, setExpenses, activeExpenses, expiredExpenses, allExpCats, customExpCats, setCustomExpCats }} />}
        {tab === "goals" && <GoalsTab {...{ goals, setGoals, monthlySaving, expenses, totalIncomePKR }} />}
        {tab === "converter" && <ConverterTab rate={rate} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════
function DashboardTab({ totalIncomePKR, totalExpensePKR, monthlySaving, savingsRate, freedUpAmount, incomes, expenses, activeExpenses, expiredExpenses, allExpCats, allIncCats, rate, calMonth, calYear, setCalMonth, setCalYear }) {
  // Smart projection: month-by-month calculation considering end dates
  function calcSmartProjection(numMonths) {
    let totalSaved = 0;
    const now = new Date();
    for (let i = 1; i <= numMonths; i++) {
      const projMonth = now.getMonth() + i;
      const projDate = new Date(now.getFullYear(), projMonth, 1);
      const projM = projDate.getMonth() + 1; // 1-indexed
      const projY = projDate.getFullYear();
      // For this future month, which monthly expenses are still active?
      const monthExpenses = expenses.filter(e => {
        if (e.type !== "monthly") return false;
        const eEndMonth = Number(e.endMonth);
        const eEndYear = Number(e.endYear);
        // No end date = always active
        if (!eEndMonth || !eEndYear) return true;
        // End date check: expense is active if projMonth/projYear <= endMonth/endYear
        if (projY < eEndYear) return true;
        if (projY === eEndYear && projM <= eEndMonth) return true;
        return false;
      });
      const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
      totalSaved += (totalIncomePKR - monthTotal);
    }
    return totalSaved;
  }

  const projection3 = calcSmartProjection(3);
  const projection6 = calcSmartProjection(6);
  const projection12 = calcSmartProjection(12);

  // Category breakdowns
  const expByCat = {};
  activeExpenses.filter(e => e.type === "monthly").forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount; });
  const incByCat = {};
  incomes.forEach(i => { const a = i.currency === "USD" ? i.amount * rate : i.amount; incByCat[i.category] = (incByCat[i.category] || 0) + a; });

  // Calendar data
  const calDays = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  
  // Helper: is expense active during a specific calendar month?
  const isActiveInMonth = (e, m, y) => {
    // m is 0-indexed (JS month), y is full year
    const eEndMonth = Number(e.endMonth);
    const eEndYear = Number(e.endYear);
    if (!eEndMonth || !eEndYear) return true; // no end date = always active
    // convert calendar month to 1-indexed for comparison
    const calM1 = m + 1;
    if (y < eEndYear) return true;
    if (y === eEndYear && calM1 <= eEndMonth) return true;
    return false; // calendar month is after end date
  };

  const calExpenses = expenses.filter(e => {
    if (e.type === "monthly") return isActiveInMonth(e, calMonth, calYear);
    if (e.type === "onetime" && e.timestamp) {
      const d = new Date(e.timestamp);
      return d.getMonth() === calMonth && d.getFullYear() === calYear;
    }
    return false;
  });
  const calIncomes = incomes.filter(i => {
    if (i.timestamp) {
      const d = new Date(i.timestamp);
      return d.getMonth() === calMonth && d.getFullYear() === calYear;
    }
    return true; // recurring incomes always show
  });

  const calMonthExpenseTotal = expenses.reduce((s, e) => {
    if (e.type === "monthly" && isActiveInMonth(e, calMonth, calYear)) return s + e.amount;
    if (e.type === "onetime" && e.timestamp) {
      const d = new Date(e.timestamp);
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) return s + e.amount;
    }
    return s;
  }, 0);
  const calMonthIncomeTotal = incomes.reduce((s, i) => {
    const a = i.currency === "USD" ? i.amount * rate : i.amount;
    return s + a;
  }, 0);
  const calMonthSaving = calMonthIncomeTotal - calMonthExpenseTotal;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Total Income" value={fmt(totalIncomePKR)} color={theme.green} icon="💰" />
        <SummaryCard label="Active Expenses" value={fmt(totalExpensePKR)} color={theme.red} icon="💸" sub="/month" />
        <SummaryCard label="Monthly Saving" value={fmt(monthlySaving)} color={monthlySaving >= 0 ? theme.accent : theme.red} icon={monthlySaving >= 0 ? "📈" : "📉"} />
        <SummaryCard label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} color={savingsRate >= 20 ? theme.green : theme.yellow} icon="🎯" />
      </div>

      {freedUpAmount > 0 && (
        <div style={{ background: `${theme.green}15`, border: `1px solid ${theme.green}33`, borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <span style={{ color: theme.green, fontWeight: 600 }}>{fmt(freedUpAmount)}/mo freed up</span>
          <span style={{ color: theme.textDim }}>from completed installments</span>
        </div>
      )}

      {/* Projections */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        <SmartProjectionCard label="Quarterly" months={3} total={projection3} color={theme.green} monthlySaving={monthlySaving} />
        <SmartProjectionCard label="Half Year" months={6} total={projection6} color={theme.blue} monthlySaving={monthlySaving} />
        <SmartProjectionCard label="Yearly" months={12} total={projection12} color={theme.yellow} monthlySaving={monthlySaving} />
      </div>

      {/* Category Breakdowns - side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 28 }}>
        <CategoryBreakdown title="Income Sources" data={incByCat} cats={allIncCats} total={totalIncomePKR} color={theme.green} />
        <CategoryBreakdown title="Expense Breakdown" data={expByCat} cats={allExpCats} total={totalExpensePKR} color={theme.red} />
      </div>

      {/* Calendar */}
      <div style={{ background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}`, padding: 24, animation: "fadeIn 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📅</span> Monthly Calendar
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} style={{ ...navBtnStyle }}>◀</button>
            <span style={{ fontSize: 15, fontWeight: 700, minWidth: 120, textAlign: "center" }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} style={{ ...navBtnStyle }}>▶</button>
          </div>
        </div>

        {/* Calendar Month Summary */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 16px", background: `${theme.green}15`, borderRadius: 8, border: `1px solid ${theme.green}33` }}>
            <span style={{ color: theme.textDim, fontSize: 12 }}>Income</span>
            <div style={{ color: theme.green, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{fmt(calMonthIncomeTotal)}</div>
          </div>
          <div style={{ padding: "8px 16px", background: `${theme.red}15`, borderRadius: 8, border: `1px solid ${theme.red}33` }}>
            <span style={{ color: theme.textDim, fontSize: 12 }}>Expenses</span>
            <div style={{ color: theme.red, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{fmt(calMonthExpenseTotal)}</div>
          </div>
          <div style={{ padding: "8px 16px", background: `${calMonthSaving >= 0 ? theme.accent : theme.red}15`, borderRadius: 8, border: `1px solid ${calMonthSaving >= 0 ? theme.accent : theme.red}33` }}>
            <span style={{ color: theme.textDim, fontSize: 12 }}>Saving</span>
            <div style={{ color: calMonthSaving >= 0 ? theme.accent : theme.red, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{fmt(calMonthSaving)}</div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 12 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ textAlign: "center", padding: "8px 0", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: calDays }).map((_, i) => {
            const day = i + 1;
            const isToday = day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
            // Check for one-time expenses on this day
            const dayExpenses = calExpenses.filter(e => {
              if (e.type === "onetime" && e.timestamp) {
                const d = new Date(e.timestamp);
                return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
              }
              return false;
            });
            const dayIncomes = incomes.filter(inc => {
              if (inc.timestamp) {
                const d = new Date(inc.timestamp);
                return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
              }
              return false;
            });
            const hasEvents = dayExpenses.length > 0 || dayIncomes.length > 0;

            return (
              <div key={day} title={hasEvents ? [...dayIncomes.map(i => `+${fmt(i.currency === 'USD' ? i.amount * DEFAULT_RATE : i.amount)} (${i.name})`), ...dayExpenses.map(e => `-${fmt(e.amount)} (${e.name})`)].join('\n') : ''} style={{
                textAlign: "center", padding: "8px 4px", borderRadius: 8,
                background: isToday ? `${theme.accent}22` : hasEvents ? `${theme.purple}11` : "transparent",
                border: isToday ? `1px solid ${theme.accent}55` : hasEvents ? `1px solid ${theme.purple}22` : "1px solid transparent",
                cursor: hasEvents ? "help" : "default", position: "relative",
                transition: "all 0.15s"
              }}>
                <div style={{ fontWeight: isToday ? 700 : 500, color: isToday ? theme.accent : theme.text, fontSize: 13 }}>{day}</div>
                {hasEvents && (
                  <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}>
                    {dayIncomes.length > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: theme.green }} />}
                    {dayExpenses.length > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: theme.red }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend + Monthly Recurring List */}
        <div style={{ marginTop: 16, display: "flex", gap: 20, fontSize: 12, color: theme.textDim, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.green, display: "inline-block" }} /> Income</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.red, display: "inline-block" }} /> Expense</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: `${theme.accent}22`, border: `1px solid ${theme.accent}55`, display: "inline-block" }} /> Today</span>
        </div>

        {/* Recurring expenses for this month */}
        {calExpenses.filter(e => e.type === "monthly").length > 0 && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: `${theme.red}08`, borderRadius: 10, border: `1px solid ${theme.red}15` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Recurring this month</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {calExpenses.filter(e => e.type === "monthly").map(e => {
                const cat = allExpCats.find(c => c.id === e.category);
                return (
                  <span key={e.id} style={{ padding: "4px 10px", background: theme.surface, borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 4, border: `1px solid ${theme.border}` }}>
                    {cat?.emoji || "📦"} {e.name} <span style={{ color: theme.red, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(e.amount)}</span>
                    {e.endMonth && e.endYear && <span style={{ color: theme.textMuted, fontSize: 10 }}>→ {MONTHS[e.endMonth - 1]} {e.endYear}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 12px", color: theme.text, cursor: "pointer", fontSize: 12, fontFamily: "inherit", transition: "all 0.15s" };

function SummaryCard({ label, value, color, icon, sub }) {
  return (
    <div className="card-hover" style={{ background: theme.card, borderRadius: 14, padding: "18px 20px", border: `1px solid ${theme.border}`, borderLeft: `3px solid ${color}`, transition: "all 0.25s", animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: theme.textDim, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}{sub && <span style={{ fontSize: 12, fontWeight: 400, color: theme.textDim, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

function SmartProjectionCard({ label, months, total, color, monthlySaving }) {
  const naive = monthlySaving * months;
  const bonus = total - naive;
  return (
    <div className="card-hover" style={{ background: theme.card, borderRadius: 12, padding: "16px 20px", border: `1px solid ${theme.border}`, transition: "all 0.25s" }}>
      <div style={{ fontSize: 12, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{label} ({months}mo)</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(total)}</div>
      {bonus > 0 && (
        <div style={{ fontSize: 11, color: theme.green, marginTop: 4 }}>+{fmt(bonus)} from ending installments</div>
      )}
    </div>
  );
}

function CategoryBreakdown({ title, data, cats, total, color }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return (
    <div style={{ background: theme.card, borderRadius: 14, padding: 20, border: `1px solid ${theme.border}` }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>{title}</h3>
      <div style={{ color: theme.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>No data yet</div>
    </div>
  );
  return (
    <div style={{ background: theme.card, borderRadius: 14, padding: 20, border: `1px solid ${theme.border}` }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title}</h3>
      {sorted.map(([catId, amount]) => {
        const cat = cats.find(c => c.id === catId) || { emoji: "📦", name: catId };
        const pct = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={catId} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
              <span>{cat.emoji} {cat.name}</span>
              <span style={{ color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(amount)} <span style={{ color: theme.textMuted, fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
            </div>
            <div style={{ height: 6, background: `${color}15`, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════
// INCOME TAB
// ═══════════════════════════════════════════════
function IncomeTab({ incomes, setIncomes, allIncCats, customIncCats, setCustomIncCats, rate }) {
  const [form, setForm] = useState({ name: "", amount: "", category: "salary", currency: "PKR" });
  const [editId, setEditId] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);

  const handleSubmit = () => {
    if (!form.name || !form.amount) return;
    const entry = { ...form, amount: Number(form.amount), id: editId || uid(), timestamp: editId ? incomes.find(i => i.id === editId)?.timestamp || Date.now() : Date.now(), editedAt: editId ? Date.now() : null };
    if (editId) { setIncomes(incomes.map(i => i.id === editId ? entry : i)); setEditId(null); }
    else setIncomes([entry, ...incomes]);
    setForm({ name: "", amount: "", category: "salary", currency: "PKR" });
  };

  const pkrPreview = form.currency === "USD" && form.amount ? Number(form.amount) * rate : null;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Add Form */}
      <div style={{ background: theme.card, borderRadius: 16, padding: 24, border: `1px solid ${theme.border}`, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💰</span>{editId ? "Edit Income" : "Add Income"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <input placeholder="Income name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: 4 }}>
            <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setForm({ ...form, currency: form.currency === "PKR" ? "USD" : "PKR" })} style={{ ...inputStyle, width: 60, textAlign: "center", cursor: "pointer", background: form.currency === "USD" ? `${theme.accent}22` : theme.surface, color: form.currency === "USD" ? theme.accent : theme.text, fontWeight: 700, border: `1px solid ${form.currency === "USD" ? theme.accent : theme.border}` }}>
              {form.currency}
            </button>
          </div>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {allIncCats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        {pkrPreview && <div style={{ marginTop: 8, fontSize: 13, color: theme.accent }}>≈ {fmt(pkrPreview)}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={handleSubmit} className="btn-hover" style={primaryBtnStyle}>{editId ? "✓ Update" : "+ Add Income"}</button>
          <button onClick={() => setShowCatModal(true)} className="btn-hover" style={secondaryBtnStyle}>+ New Category</button>
          {editId && <button onClick={() => { setEditId(null); setForm({ name: "", amount: "", category: "salary", currency: "PKR" }); }} style={secondaryBtnStyle}>Cancel</button>}
        </div>
      </div>

      {/* Income List */}
      {incomes.length === 0 ? <EmptyState icon="💰" text="No income added yet" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incomes.map(inc => {
            const cat = allIncCats.find(c => c.id === inc.category) || { emoji: "💵", name: inc.category };
            const pkr = inc.currency === "USD" ? inc.amount * rate : inc.amount;
            return (
              <div key={inc.id} style={{ background: theme.card, borderRadius: 12, padding: "14px 18px", border: `1px solid ${theme.border}`, borderLeft: `3px solid ${theme.green}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.2s" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span>{cat.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{inc.name}</span>
                    <span style={{ fontSize: 11, color: theme.textMuted, background: `${theme.green}15`, padding: "2px 8px", borderRadius: 4 }}>{cat.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>
                    {timeAgo(inc.timestamp)}{inc.editedAt && " (edited)"}
                    {inc.currency === "USD" && <span style={{ marginLeft: 6, color: theme.accent }}>auto converted from {fmtUSD(inc.amount)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: theme.green, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(pkr)}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setEditId(inc.id); setForm({ name: inc.name, amount: String(inc.amount), category: inc.category, currency: inc.currency || "PKR" }); }} style={iconBtnStyle}>✏️</button>
                  <button onClick={() => setIncomes(incomes.filter(i => i.id !== inc.id))} style={iconBtnStyle}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && <CategoryModal onClose={() => setShowCatModal(false)} onAdd={(cat) => setCustomIncCats([...customIncCats, cat])} customCats={customIncCats} onDelete={(id) => setCustomIncCats(customIncCats.filter(c => c.id !== id))} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// EXPENSE TAB
// ═══════════════════════════════════════════════
function ExpenseTab({ expenses, setExpenses, activeExpenses, expiredExpenses, allExpCats, customExpCats, setCustomExpCats }) {
  const [form, setForm] = useState({ name: "", amount: "", category: "rent", type: "monthly", endMonth: "", endYear: "" });
  const [editId, setEditId] = useState(null);
  const [showCatModal, setShowCatModal] = useState(false);

  const handleSubmit = () => {
    if (!form.name || !form.amount) return;
    const entry = {
      ...form, amount: Number(form.amount),
      endMonth: form.endMonth ? Number(form.endMonth) : null,
      endYear: form.endYear ? Number(form.endYear) : null,
      id: editId || uid(),
      timestamp: editId ? expenses.find(e => e.id === editId)?.timestamp || Date.now() : Date.now(),
      editedAt: editId ? Date.now() : null
    };
    if (editId) { setExpenses(expenses.map(e => e.id === editId ? entry : e)); setEditId(null); }
    else setExpenses([entry, ...expenses]);
    setForm({ name: "", amount: "", category: "rent", type: "monthly", endMonth: "", endYear: "" });
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Add Form */}
      <div style={{ background: theme.card, borderRadius: 16, padding: 24, border: `1px solid ${theme.border}`, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💸</span>{editId ? "Edit Expense" : "Add Expense"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <input placeholder="Expense name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Amount (PKR)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {allExpCats.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
            <option value="monthly">Monthly</option>
            <option value="onetime">One-time</option>
          </select>
        </div>
        {form.type === "monthly" && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: theme.textDim }}>End Date (optional):</span>
            <select value={form.endMonth} onChange={e => setForm({ ...form, endMonth: e.target.value })} style={{ ...inputStyle, width: 100 }}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={form.endYear} onChange={e => setForm({ ...form, endYear: e.target.value })} style={{ ...inputStyle, width: 90 }}>
              <option value="">Year</option>
              {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={handleSubmit} className="btn-hover" style={primaryBtnStyle}>{editId ? "✓ Update" : "+ Add Expense"}</button>
          <button onClick={() => setShowCatModal(true)} className="btn-hover" style={secondaryBtnStyle}>+ New Category</button>
          {editId && <button onClick={() => { setEditId(null); setForm({ name: "", amount: "", category: "rent", type: "monthly", endMonth: "", endYear: "" }); }} style={secondaryBtnStyle}>Cancel</button>}
        </div>
      </div>

      {/* Active Expenses */}
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: theme.text }}>Active Expenses ({activeExpenses.length})</h3>
      {activeExpenses.length === 0 ? <EmptyState icon="💸" text="No active expenses" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {activeExpenses.map(exp => {
            const cat = allExpCats.find(c => c.id === exp.category) || { emoji: "📦", name: exp.category };
            const dLeft = daysUntilEnd(exp);
            const endingSoon = dLeft <= 60 && dLeft > 0;
            return (
              <div key={exp.id} style={{ background: theme.card, borderRadius: 12, padding: "14px 18px", border: `1px solid ${endingSoon ? theme.yellow + "55" : theme.border}`, borderLeft: `3px solid ${theme.red}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.2s" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span>{cat.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{exp.name}</span>
                    <span style={{ fontSize: 11, color: theme.textMuted, background: `${theme.red}15`, padding: "2px 8px", borderRadius: 4 }}>{exp.type === "monthly" ? "Monthly" : "One-time"}</span>
                    {exp.endMonth && exp.endYear && (
                      <span style={{ fontSize: 11, color: endingSoon ? theme.yellow : theme.textMuted, background: endingSoon ? `${theme.yellow}15` : `${theme.textMuted}15`, padding: "2px 8px", borderRadius: 4, fontWeight: endingSoon ? 600 : 400 }}>
                        {endingSoon ? `⚠ ${dLeft}d left` : `→ ${MONTHS[exp.endMonth - 1]} ${exp.endYear}`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(exp.timestamp)}{exp.editedAt && " (edited)"}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.red, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(exp.amount)}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setEditId(exp.id); setForm({ name: exp.name, amount: String(exp.amount), category: exp.category, type: exp.type, endMonth: exp.endMonth ? String(exp.endMonth) : "", endYear: exp.endYear ? String(exp.endYear) : "" }); }} style={iconBtnStyle}>✏️</button>
                  <button onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))} style={iconBtnStyle}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expired Expenses */}
      {expiredExpenses.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: theme.textMuted }}>✓ Completed ({expiredExpenses.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {expiredExpenses.map(exp => {
              const cat = allExpCats.find(c => c.id === exp.category) || { emoji: "📦", name: exp.category };
              return (
                <div key={exp.id} style={{ background: theme.card, borderRadius: 12, padding: "12px 18px", border: `1px solid ${theme.border}`, opacity: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{cat.emoji}</span>
                    <span style={{ textDecoration: "line-through", fontSize: 14 }}>{exp.name}</span>
                    <span style={{ fontSize: 11, color: theme.green }}>✓ ended {MONTHS[(exp.endMonth || 1) - 1]} {exp.endYear}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.textMuted, textDecoration: "line-through", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(exp.amount)}</span>
                    <button onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))} style={iconBtnStyle}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCatModal && <CategoryModal onClose={() => setShowCatModal(false)} onAdd={(cat) => setCustomExpCats([...customExpCats, cat])} customCats={customExpCats} onDelete={(id) => setCustomExpCats(customExpCats.filter(c => c.id !== id))} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// GOALS TAB
// ═══════════════════════════════════════════════
function GoalsTab({ goals, setGoals, monthlySaving, expenses, totalIncomePKR }) {
  const [mode, setMode] = useState("priority"); // priority | split
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  const moveGoal = (id, dir) => {
    const idx = goals.findIndex(g => g.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= goals.length) return;
    const arr = [...goals];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setGoals(arr);
  };

  const updateSplit = (id, pct) => {
    setGoals(goals.map(g => g.id === id ? { ...g, splitPct: pct } : g));
  };

  const totalSplit = goals.reduce((s, g) => s + (g.splitPct || 0), 0);

  // Helper: get monthly saving for a specific future month offset
  const getSavingForMonth = (offset) => {
    const now = new Date();
    const projDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const projM = projDate.getMonth() + 1;
    const projY = projDate.getFullYear();
    const monthExpenses = (expenses || []).filter(e => {
      if (e.type !== "monthly") return false;
      const eEndMonth = Number(e.endMonth);
      const eEndYear = Number(e.endYear);
      if (!eEndMonth || !eEndYear) return true;
      if (projY < eEndYear) return true;
      if (projY === eEndYear && projM <= eEndMonth) return true;
      return false;
    });
    const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
    return (totalIncomePKR || 0) - monthTotal;
  };

  // Priority mode: sequential goals, month-by-month
  const priorityCalc = () => {
    const results = [];
    let monthOffset = 1;
    let accumulated = 0;
    for (let gi = 0; gi < goals.length; gi++) {
      const g = goals[gi];
      const remaining = Math.max(0, g.target - (g.saved || 0));
      const startMonth = monthOffset - 1;
      let funded = 0;
      let months = 0;
      // walk forward month by month until this goal is funded
      while (funded < remaining && months < 600) {
        const savThisMonth = getSavingForMonth(monthOffset);
        funded += Math.max(0, savThisMonth);
        monthOffset++;
        months++;
      }
      const achieveDate = new Date();
      achieveDate.setMonth(achieveDate.getMonth() + startMonth + months);
      results.push({ ...g, startMonth, monthsNeeded: months, achieveDate });
    }
    return results;
  };

  // Split mode: each goal gets a % of each month's saving
  const splitCalc = () => {
    return goals.map(g => {
      const pct = g.splitPct || 0;
      const remaining = Math.max(0, g.target - (g.saved || 0));
      let funded = 0;
      let months = 0;
      while (funded < remaining && months < 600) {
        months++;
        const savThisMonth = getSavingForMonth(months);
        funded += Math.max(0, savThisMonth) * (pct / 100);
      }
      const monthlyAlloc = monthlySaving * (pct / 100);
      const achieveDate = new Date();
      achieveDate.setMonth(achieveDate.getMonth() + months);
      return { ...g, monthlyAlloc, monthsNeeded: pct > 0 ? months : Infinity, achieveDate: pct > 0 ? achieveDate : null };
    });
  };

  const computed = mode === "priority" ? priorityCalc() : splitCalc();

  const handleSave = (goal) => {
    if (editGoal) { setGoals(goals.map(g => g.id === editGoal.id ? { ...goal, id: editGoal.id } : g)); }
    else { setGoals([...goals, { ...goal, id: uid() }]); }
    setEditGoal(null);
    setShowModal(false);
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>🎯 Savings Goals</h2>
          <div style={{ display: "flex", background: theme.card, borderRadius: 8, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
            <button onClick={() => setMode("priority")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "priority" ? theme.accent : "transparent", color: mode === "priority" ? theme.bg : theme.textDim, transition: "all 0.2s" }}>Priority</button>
            <button onClick={() => setMode("split")} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "split" ? theme.accent : "transparent", color: mode === "split" ? theme.bg : theme.textDim, transition: "all 0.2s" }}>Split %</button>
          </div>
        </div>
        <button onClick={() => { setEditGoal(null); setShowModal(true); }} className="btn-hover" style={primaryBtnStyle}>+ Add Goal</button>
      </div>

      {/* Monthly savings info */}
      <div style={{ background: theme.card, borderRadius: 12, padding: "12px 18px", border: `1px solid ${theme.border}`, marginBottom: 20, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: theme.textDim }}>Available monthly:</span>
        <span style={{ color: monthlySaving >= 0 ? theme.green : theme.red, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(monthlySaving)}</span>
        {mode === "split" && (
          <span style={{ marginLeft: "auto", fontSize: 13, color: totalSplit > 100 ? theme.red : totalSplit === 100 ? theme.green : theme.yellow, fontWeight: 600 }}>
            Split: {totalSplit}% {totalSplit > 100 ? "⚠ Over!" : totalSplit === 100 ? "✓" : `(${100 - totalSplit}% unallocated)`}
          </span>
        )}
      </div>

      {/* Goals */}
      {goals.length === 0 ? <EmptyState icon="🎯" text="No goals yet. Add one to start tracking!" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {computed.map((goal, idx) => {
            const pct = goal.target > 0 ? Math.min(100, ((goal.saved || 0) / goal.target) * 100) : 0;
            const remaining = Math.max(0, goal.target - (goal.saved || 0));
            return (
              <div key={goal.id} className="card-hover" style={{ background: theme.card, borderRadius: 14, padding: 20, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${goal.color || theme.accent}`, transition: "all 0.25s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {mode === "priority" && <span style={{ background: `${theme.accent}22`, color: theme.accent, fontWeight: 800, fontSize: 12, padding: "2px 8px", borderRadius: 6 }}>#{idx + 1}</span>}
                      <span style={{ fontSize: 22 }}>{goal.emoji || "🎯"}</span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{goal.name}</span>
                    </div>
                    {mode === "priority" && goal.startMonth > 0 && (
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>Starts after month {goal.startMonth}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {mode === "priority" && (
                      <>
                        <button onClick={() => moveGoal(goal.id, -1)} disabled={idx === 0} style={{ ...iconBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                        <button onClick={() => moveGoal(goal.id, 1)} disabled={idx === goals.length - 1} style={{ ...iconBtnStyle, opacity: idx === goals.length - 1 ? 0.3 : 1 }}>▼</button>
                      </>
                    )}
                    <button onClick={() => { setEditGoal(goal); setShowModal(true); }} style={iconBtnStyle}>✏️</button>
                    <button onClick={() => setGoals(goals.filter(g => g.id !== goal.id))} style={iconBtnStyle}>🗑️</button>
                  </div>
                </div>

                {/* Progress */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: theme.textDim }}>Progress</span>
                    <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(goal.saved || 0)} / {fmt(goal.target)}</span>
                  </div>
                  <div style={{ height: 8, background: `${goal.color || theme.accent}15`, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: goal.color || theme.accent, borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                    <span>{pct.toFixed(1)}%</span>
                    <span>Remaining: {fmt(remaining)}</span>
                  </div>
                </div>

                {/* Split slider */}
                {mode === "split" && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: theme.textDim }}>Split allocation</span>
                      <span style={{ color: theme.accent, fontWeight: 700 }}>{goal.splitPct || 0}% → {fmt((monthlySaving * (goal.splitPct || 0)) / 100)}/mo</span>
                    </div>
                    <input type="range" min={0} max={100} value={goal.splitPct || 0} onChange={e => updateSplit(goal.id, Number(e.target.value))} style={{ width: "100%", accentColor: goal.color || theme.accent }} />
                  </div>
                )}

                {/* Timeline */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                  <div style={{ padding: "6px 12px", background: `${theme.accent}11`, borderRadius: 8, border: `1px solid ${theme.accent}22` }}>
                    <span style={{ color: theme.textDim }}>Months needed: </span>
                    <span style={{ color: theme.accent, fontWeight: 700 }}>{goal.monthsNeeded === Infinity ? "∞" : goal.monthsNeeded}</span>
                  </div>
                  {goal.achieveDate && goal.monthsNeeded !== Infinity && (
                    <div style={{ padding: "6px 12px", background: `${theme.green}11`, borderRadius: 8, border: `1px solid ${theme.green}22` }}>
                      <span style={{ color: theme.textDim }}>Achieve by: </span>
                      <span style={{ color: theme.green, fontWeight: 700 }}>{MONTHS[goal.achieveDate.getMonth()]} {goal.achieveDate.getFullYear()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline overview */}
      {goals.length > 1 && (
        <div style={{ background: theme.card, borderRadius: 14, padding: 20, border: `1px solid ${theme.border}`, marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📅 Timeline Overview</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {computed.map((g, i) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>{g.emoji || "🎯"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{g.name}</span>
                <div style={{ flex: 1, height: 6, background: `${g.color || theme.accent}15`, borderRadius: 3, overflow: "hidden", position: "relative" }}>
                  {mode === "priority" && g.startMonth > 0 && (
                    <div style={{ position: "absolute", left: 0, width: `${(g.startMonth / (g.startMonth + g.monthsNeeded)) * 100}%`, height: "100%", background: `${theme.textMuted}22` }} />
                  )}
                  <div style={{ height: "100%", width: g.monthsNeeded === Infinity ? "5%" : "100%", background: g.color || theme.accent, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: theme.textDim, minWidth: 80, textAlign: "right" }}>
                  {g.achieveDate && g.monthsNeeded !== Infinity ? `${MONTHS[g.achieveDate.getMonth()]} ${g.achieveDate.getFullYear()}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showModal && <GoalModal onClose={() => { setShowModal(false); setEditGoal(null); }} onSave={handleSave} editGoal={editGoal} />}
    </div>
  );
}

function GoalModal({ onClose, onSave, editGoal }) {
  const [form, setForm] = useState(editGoal ? { name: editGoal.name, target: String(editGoal.target), saved: String(editGoal.saved || 0), emoji: editGoal.emoji || "🎯", color: editGoal.color || theme.accent, splitPct: editGoal.splitPct || 20 } : { name: "", target: "", saved: "0", emoji: "🎯", color: theme.accent, splitPct: 20 });
  const emojis = ["🎯","🏠","🚗","✈️","💻","📱","💍","🎓","🏖️","💊","👶","🎸"];
  const colors = [theme.accent, theme.green, theme.blue, theme.purple, theme.pink, theme.orange, theme.yellow, theme.red];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: theme.card, borderRadius: 16, padding: 28, border: `1px solid ${theme.border}`, width: "100%", maxWidth: 440, animation: "fadeIn 0.3s ease" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>{editGoal ? "Edit Goal" : "New Goal"}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {emojis.map(e => <button key={e} onClick={() => setForm({ ...form, emoji: e })} style={{ fontSize: 22, padding: "4px 8px", background: form.emoji === e ? `${theme.accent}22` : "transparent", border: form.emoji === e ? `1px solid ${theme.accent}` : `1px solid transparent`, borderRadius: 8, cursor: "pointer" }}>{e}</button>)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {colors.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.color === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />)}
        </div>
        <input placeholder="Goal name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, width: "100%", marginBottom: 10 }} />
        <input type="number" placeholder="Target amount (PKR)" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} style={{ ...inputStyle, width: "100%", marginBottom: 10 }} />
        <input type="number" placeholder="Already saved (PKR)" value={form.saved} onChange={e => setForm({ ...form, saved: e.target.value })} style={{ ...inputStyle, width: "100%", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (form.name && form.target) onSave({ ...form, target: Number(form.target), saved: Number(form.saved), splitPct: Number(form.splitPct) }); }} className="btn-hover" style={{ ...primaryBtnStyle, flex: 1 }}>{editGoal ? "Update" : "Create"}</button>
          <button onClick={onClose} style={{ ...secondaryBtnStyle, flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CONVERTER TAB
// ═══════════════════════════════════════════════
function ConverterTab({ rate }) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("usd-pkr");

  const result = amount ? (direction === "usd-pkr" ? Number(amount) * rate : Number(amount) / rate) : 0;
  const quickRefs = [1, 10, 50, 100, 500, 1000, 5000];

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 500, margin: "0 auto" }}>
      <div style={{ background: theme.card, borderRadius: 16, padding: 28, border: `1px solid ${theme.border}`, marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, textAlign: "center" }}>⇄ Currency Converter</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: theme.textDim }}>
            {direction === "usd-pkr" ? "USD → PKR" : "PKR → USD"}
          </div>
          <input type="number" placeholder={direction === "usd-pkr" ? "Enter USD" : "Enter PKR"} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 24, fontWeight: 700, padding: "16px 20px", fontFamily: "'JetBrains Mono', monospace" }} />
          <button onClick={() => setDirection(d => d === "usd-pkr" ? "pkr-usd" : "usd-pkr")} className="btn-hover" style={{ background: `${theme.accent}22`, border: `1px solid ${theme.accent}44`, borderRadius: 50, padding: "10px 24px", color: theme.accent, fontWeight: 700, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>⇅ Swap</button>
          {amount && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <div style={{ fontSize: 14, color: theme.textDim }}>Result</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: theme.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                {direction === "usd-pkr" ? fmt(result) : fmtUSD(result)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <div style={{ background: theme.card, borderRadius: 16, padding: 24, border: `1px solid ${theme.border}` }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: theme.textDim }}>Quick Reference (1 USD = Rs {rate})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {quickRefs.map(v => (
            <div key={v} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: theme.surface, borderRadius: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{fmtUSD(v)}</span>
              <span style={{ color: theme.accent, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(v * rate)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════
function CategoryModal({ onClose, onAdd, customCats, onDelete }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const emojis = ["📦","🏠","🎓","🚌","💊","🎵","📱","🍕","☕","🎬","🐾","💇","🏋️","🎁","✈️","🛠️","📡","💸"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: theme.card, borderRadius: 16, padding: 28, border: `1px solid ${theme.border}`, width: "100%", maxWidth: 400, animation: "fadeIn 0.3s ease" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>New Category</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {emojis.map(e => <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 20, padding: "4px 8px", background: emoji === e ? `${theme.accent}22` : "transparent", border: emoji === e ? `1px solid ${theme.accent}` : `1px solid transparent`, borderRadius: 8, cursor: "pointer" }}>{e}</button>)}
        </div>
        <input placeholder="Category name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 14 }} />
        <button onClick={() => { if (name) { onAdd({ id: uid(), name, emoji }); setName(""); } }} className="btn-hover" style={{ ...primaryBtnStyle, width: "100%" }}>Add Category</button>

        {customCats.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>Custom categories:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {customCats.map(c => (
                <span key={c.id} style={{ padding: "4px 10px", background: `${theme.yellow}15`, borderRadius: 6, fontSize: 12, border: `1px solid ${theme.yellow}33`, display: "flex", alignItems: "center", gap: 4 }}>
                  {c.emoji} {c.name}
                  <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.red, fontSize: 12, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

// ─── Shared Styles ───
const inputStyle = {
  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
  padding: "10px 14px", color: theme.text, fontSize: 14, fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s"
};

const primaryBtnStyle = {
  background: theme.accent, color: theme.bg, border: "none", borderRadius: 10,
  padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  fontFamily: "inherit", transition: "all 0.2s"
};

const secondaryBtnStyle = {
  background: "transparent", color: theme.textDim, border: `1px solid ${theme.border}`,
  borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 14,
  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s"
};

const iconBtnStyle = {
  background: "none", border: "none", cursor: "pointer", fontSize: 14,
  padding: "4px 6px", borderRadius: 6, transition: "all 0.15s"
};
