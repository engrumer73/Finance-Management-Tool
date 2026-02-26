import { useState, useMemo, useCallback, useEffect } from "react";

const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS         = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const DEFAULT_EXP_CATS = ["🏠 Housing","🍔 Food","🚗 Transport","💊 Health","🎮 Entertainment","👗 Clothing","📱 Subscriptions","🎓 Education","💡 Utilities","📦 Other"];
const DEFAULT_INC_CATS = ["💼 Salary","💻 Freelance","📈 Investment","🎁 Bonus","🏦 Business","📦 Other Income"];
const ALL_EMOJIS       = ["✨","🌟","💼","🎯","🏋️","🧴","🎨","🍕","☕","🎵","📚","🌿","🐾","💻","🏖️","🎁","🧾","🏦","💈","🎪","💵","📊","🤝","🚀","🎓","🔑","🌐","💡","🛒","⚡"];
const GOAL_EMOJIS      = ["🎯","🏠","🚗","✈️","💻","📱","💍","🎓","🏖️","🛡️","💊","🏋️","🌍","🎸","📷","👶","🐶","🏦","🎁","🌟"];
const GOAL_COLORS      = ["#00d4aa","#4f8ef7","#ff6b6b","#ffd166","#a78bfa","#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6"];

const TABS = [
  { id:0, icon:"◈", label:"Dashboard" },
  { id:1, icon:"↑", label:"Income" },
  { id:2, icon:"↓", label:"Expenses" },
  { id:3, icon:"◎", label:"Goals" },
  { id:4, icon:"⇄", label:"Converter" },
];

const fmtPKR = (n) => "Rs\u00A0" + Math.abs(Math.round(n)).toLocaleString("en-PK");
const fmtUSD = (n) => "$" + Math.abs(n).toFixed(2);

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts), now = new Date(), diff = now - d;
  const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days < 7)  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTimeFull(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()} · ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

// ── Storage ──────────────────────────────────────────────────────────────
const STORE_KEY = "rupeeave_v3";
async function saveData(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch(e){} }
async function loadData() { try { const r = localStorage.getItem(STORE_KEY); if(r) return JSON.parse(r); } catch(e){} return null; }

// ── Default data ──────────────────────────────────────────────────────────
const _now = Date.now();
const DEFAULT_DATA = {
  rate:278, incCats:DEFAULT_INC_CATS, expCats:DEFAULT_EXP_CATS,
  goalMode:"priority", // "priority" | "split"
  incomes:[
    {id:1,name:"Main Salary", amountRaw:2300,currency:"USD",category:"💼 Salary",   type:"monthly",createdAt:_now-86400000},
    {id:2,name:"Freelance",   amountRaw:200, currency:"USD",category:"💻 Freelance",type:"monthly",createdAt:_now-3600000},
  ],
  expenses:[
    {id:1,name:"Kiraya (Rent)",amount:45000,category:"🏠 Housing",type:"monthly",endDate:"",createdAt:_now-7200000},
    {id:2,name:"Groceries",    amount:25000,category:"🍔 Food",   type:"monthly",endDate:"",createdAt:_now-1800000},
    {id:3,name:"Car Installment",amount:15000,category:"🚗 Transport",type:"monthly",endDate:"2025-06-30",createdAt:_now-3600000},
  ],
  goals:[
    {id:1,name:"Emergency Fund",target:500000,saved:50000, emoji:"🛡️",color:"#00d4aa",priority:1,split:50,createdAt:_now-86400000*3},
    {id:2,name:"New Laptop",    target:150000,saved:20000, emoji:"💻",color:"#4f8ef7",priority:2,split:30,createdAt:_now-86400000},
    {id:3,name:"Vacation",      target:200000,saved:5000,  emoji:"✈️",color:"#ffd166",priority:3,split:20,createdAt:_now-86400000/2},
  ],
};

// ── Priority calculation ──────────────────────────────────────────────────
// Returns array of {goal, monthsFromNow, achieveDate, monthlyAllocation, startMonth}
// In priority mode: savings go fully to #1 until done, then #2, etc.
function calcPrioritySchedule(goals, monthlySavings) {
  if (monthlySavings <= 0) return goals.map(g => ({goal:g, monthsFromNow:null, achieveDate:null, monthlyAllocation:0, startMonth:0}));
  const sorted = [...goals].filter(g=>g.target-g.saved>0).sort((a,b)=>a.priority-b.priority);
  const results = {};
  let cursor = 0; // months elapsed so far

  for (const g of sorted) {
    const remaining = g.target - g.saved;
    const months = Math.ceil(remaining / monthlySavings);
    const startMonth = cursor;
    const endMonth = cursor + months;
    const achieveDate = new Date(new Date().getFullYear(), new Date().getMonth() + endMonth, 1);
    results[g.id] = { goal:g, monthsFromNow:endMonth, achieveDate, monthlyAllocation:monthlySavings, startMonth };
    cursor = endMonth;
  }
  // Completed goals
  goals.filter(g=>g.target-g.saved<=0).forEach(g=>{
    results[g.id] = {goal:g, monthsFromNow:0, achieveDate:null, monthlyAllocation:0, startMonth:0};
  });
  return goals.map(g => results[g.id] || {goal:g, monthsFromNow:null, achieveDate:null, monthlyAllocation:0, startMonth:0});
}

// In split mode: each goal gets its % slice, calculated independently
function calcSplitSchedule(goals, monthlySavings) {
  const totalSplit = goals.reduce((s,g)=>s+(g.split||0),0);
  return goals.map(g => {
    const remaining = g.target - g.saved;
    if (remaining <= 0) return {goal:g, monthsFromNow:0, achieveDate:null, monthlyAllocation:0, startMonth:0};
    if (monthlySavings <= 0 || !g.split) return {goal:g, monthsFromNow:null, achieveDate:null, monthlyAllocation:0, startMonth:0};
    const alloc = monthlySavings * (g.split / 100);
    if (alloc <= 0) return {goal:g, monthsFromNow:null, achieveDate:null, monthlyAllocation:0, startMonth:0};
    const months = Math.ceil(remaining / alloc);
    const achieveDate = new Date(new Date().getFullYear(), new Date().getMonth() + months, 1);
    return {goal:g, monthsFromNow:months, achieveDate, monthlyAllocation:alloc, startMonth:0};
  });
}

// ── Goal Card ─────────────────────────────────────────────────────────────
function GoalCard({ goal, schedule, rank, goalMode, totalGoals, onDelete, onMoveUp, onMoveDown, onEditSplit }) {
  const { monthsFromNow, achieveDate, monthlyAllocation, startMonth } = schedule;
  const remaining = goal.target - goal.saved;
  const progress  = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
  const done = remaining <= 0;

  return (
    <div className="goal-card" style={{"--gc":goal.color}}>
      <div className="goal-top-line"/>

      {/* Priority badge / split badge */}
      <div className="goal-mode-badge">
        {goalMode==="priority" ? (
          <div className="priority-badge">
            <span className="pri-num">#{rank}</span>
            <div className="pri-arrows">
              <button className="pri-arrow" onClick={onMoveUp}   disabled={rank===1}>▲</button>
              <button className="pri-arrow" onClick={onMoveDown} disabled={rank===totalGoals}>▼</button>
            </div>
          </div>
        ) : (
          <div className="split-badge-wrap">
            <div className="split-pct" style={{color:"var(--gc)"}}>{goal.split||0}%</div>
            <div className="split-amt">{fmtPKR(monthlyAllocation)}/mo</div>
          </div>
        )}
      </div>

      <div className="goal-header">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="goal-emoji-wrap">{goal.emoji}</div>
          <div>
            <div className="goal-name">{goal.name}</div>
            <div className="goal-sub">Added {fmtTime(goal.createdAt)}</div>
          </div>
        </div>
        <button className="del-btn" onClick={()=>onDelete(goal.id)}>✕</button>
      </div>

      <div className="goal-progress-wrap">
        <div className="goal-prog-labels"><span>Saved: {fmtPKR(goal.saved)}</span><span>{progress.toFixed(0)}%</span></div>
        <div className="goal-prog-track"><div className="goal-prog-fill" style={{width:`${progress}%`}}/></div>
        <div className="goal-prog-labels" style={{marginTop:4}}>
          <span style={{color:"var(--muted)"}}>Target</span>
          <span style={{color:"var(--text-dim)"}}>{fmtPKR(goal.target)}</span>
        </div>
      </div>

      {done ? (
        <div className="goal-achieved">🎉 Goal Achieved!</div>
      ) : monthsFromNow===null ? (
        <div className="goal-warn">
          {goalMode==="split" && goal.split===0 ? "⚠ Split is 0% — assign some % to this goal." : "⚠ Not enough savings to calculate."}
        </div>
      ) : (
        <>
          <div className="goal-stats">
            <div className="goal-stat">
              <div className="stat-l">Remaining</div>
              <div className="stat-v" style={{color:"var(--text)"}}>{fmtPKR(remaining)}</div>
            </div>
            <div className="goal-stat-divider"/>
            <div className="goal-stat">
              <div className="stat-l">{goalMode==="priority"?"Starts After":"Monthly"}</div>
              <div className="stat-v" style={{color:"var(--gc)",fontSize:".85rem"}}>
                {goalMode==="priority" ? (startMonth===0?"Now":`Mo. ${startMonth}`) : fmtPKR(monthlyAllocation)}
              </div>
            </div>
            <div className="goal-stat-divider"/>
            <div className="goal-stat">
              <div className="stat-l">Done By</div>
              <div className="stat-v" style={{color:"var(--gc)",fontSize:".85rem"}}>
                {achieveDate ? `${MONTHS_SHORT[achieveDate.getMonth()]} ${achieveDate.getFullYear()}` : "—"}
              </div>
            </div>
          </div>
          {goalMode==="priority" && startMonth>0 && (
            <div className="goal-queue-note">⏳ Starts after month {startMonth} — when higher priority goals finish.</div>
          )}
          {goalMode==="split" && (
            <div className="split-slider-wrap">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span className="fl">Split: <strong style={{color:"var(--gc)"}}>{goal.split||0}%</strong></span>
                <span style={{fontSize:".58rem",color:"var(--muted)"}}>{monthsFromNow} months needed</span>
              </div>
              <input type="range" min={0} max={100} value={goal.split||0} onChange={e=>onEditSplit(goal.id,+e.target.value)} className="split-range" style={{"--gc":goal.color}}/>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,   setActiveTab]   = useState(0);
  const [loaded,      setLoaded]      = useState(false);
  const [savingBlink, setSavingBlink] = useState(false);

  const [rate,         setRate]        = useState(278);
  const [rateStatus,   setRateStatus]  = useState("manual");
  const [fetchingRate, setFetchingRate]= useState(false);

  const [incCats,  setIncCats]  = useState(DEFAULT_INC_CATS);
  const [expCats,  setExpCats]  = useState(DEFAULT_EXP_CATS);
  const [incomes,  setIncomes]  = useState(DEFAULT_DATA.incomes);
  const [expenses, setExpenses] = useState(DEFAULT_DATA.expenses);
  const [goals,    setGoals]    = useState(DEFAULT_DATA.goals);
  const [goalMode, setGoalMode] = useState("priority"); // "priority" | "split"

  const [incForm,  setIncForm]  = useState({name:"",amountRaw:"",currency:"PKR",category:DEFAULT_INC_CATS[0],type:"monthly"});
  const [incEditId,setIncEditId]= useState(null);
  const [showIncCatModal,setShowIncCatModal]= useState(false);
  const [newIncCatName,  setNewIncCatName]  = useState("");
  const [newIncCatEmoji, setNewIncCatEmoji] = useState("💵");

  const [expForm,  setExpForm]  = useState({name:"",amount:"",category:DEFAULT_EXP_CATS[0],type:"monthly",endDate:""});
  const [expEditId,setExpEditId]= useState(null);
  const [showExpCatModal,setShowExpCatModal]= useState(false);
  const [newExpCatName,  setNewExpCatName]  = useState("");
  const [newExpCatEmoji, setNewExpCatEmoji] = useState("✨");

  const [goalForm, setGoalForm] = useState({name:"",target:"",saved:"",emoji:"🎯",color:"#00d4aa",split:20});
  const [showGoalForm,setShowGoalForm]= useState(false);

  const [convInput,setConvInput]= useState("");
  const [convDir,  setConvDir]  = useState("usd2pkr");

  // ── Load ──
  useEffect(()=>{
    loadData().then(d=>{
      if(d){
        if(d.rate)     setRate(d.rate);
        if(d.incCats)  setIncCats(d.incCats);
        if(d.expCats)  setExpCats(d.expCats);
        if(d.incomes)  setIncomes(d.incomes);
        if(d.expenses) setExpenses(d.expenses);
        if(d.goals)    setGoals(d.goals);
        if(d.goalMode) setGoalMode(d.goalMode);
      }
      setLoaded(true);
    });
  },[]);

  // ── Auto-save ──
  useEffect(()=>{
    if(!loaded) return;
    setSavingBlink(true);
    saveData({rate,incCats,expCats,incomes,expenses,goals,goalMode}).then(()=>setTimeout(()=>setSavingBlink(false),900));
  },[rate,incCats,expCats,incomes,expenses,goals,goalMode,loaded]);

  // ── Derived ──
  const totalIncomePKR  = useMemo(()=>incomes.reduce((s,i)=>s+(i.currency==="USD"?i.amountRaw*rate:i.amountRaw),0),[incomes,rate]);
  // Only count active expenses (no endDate, or endDate in future)
  const today = new Date(); today.setHours(0,0,0,0);
  const activeExpenses  = useMemo(()=>expenses.filter(e=>{ if(!e.endDate) return true; return new Date(e.endDate) >= today; }),[expenses]);
  const expiredExpenses = useMemo(()=>expenses.filter(e=>{ if(!e.endDate) return false; return new Date(e.endDate) < today; }),[expenses]);
  const totalExpensePKR = useMemo(()=>activeExpenses.reduce((s,e)=>s+e.amount,0),[activeExpenses]);
  const monthlySavings  = totalIncomePKR - totalExpensePKR;
  const savingsPercent  = totalIncomePKR>0?Math.max(0,Math.min(100,(monthlySavings/totalIncomePKR)*100)):0;
  const totalSplitPct   = useMemo(()=>goals.reduce((s,g)=>s+(g.split||0),0),[goals]);

  const projections = [
    {label:"Quarterly",months:3, color:"#00d4aa"},
    {label:"Half Year",months:6, color:"#4f8ef7"},
    {label:"Yearly",   months:12,color:"#ffd166"},
  ];

  const byExpCat = useMemo(()=>{const m={};activeExpenses.forEach(e=>{m[e.category]=(m[e.category]||0)+e.amount;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[activeExpenses]);
  const byIncCat = useMemo(()=>{const m={};incomes.forEach(i=>{const p=i.currency==="USD"?i.amountRaw*rate:i.amountRaw;m[i.category]=(m[i.category]||0)+p;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[incomes,rate]);
  const convResult = useMemo(()=>{const n=parseFloat(convInput);if(isNaN(n))return null;return convDir==="usd2pkr"?n*rate:n/rate;},[convInput,convDir,rate]);

  // ── Goal schedule computation ──
  const goalSchedule = useMemo(()=>{
    return goalMode==="priority" ? calcPrioritySchedule(goals,monthlySavings) : calcSplitSchedule(goals,monthlySavings);
  },[goals,goalMode,monthlySavings]);

  const sortedGoals = useMemo(()=>[...goals].sort((a,b)=>a.priority-b.priority),[goals]);

  // ── Live rate ──
  const fetchLiveRate = useCallback(async()=>{
    setFetchingRate(true);setRateStatus("fetching");
    try{
      const res=await fetch("https://open.er-api.com/v6/latest/USD");
      if(res.ok){const d=await res.json();if(d.rates?.PKR){setRate(parseFloat(d.rates.PKR.toFixed(2)));setRateStatus("live");}else setRateStatus("error");}
      else setRateStatus("error");
    }catch{setRateStatus("error");}
    setFetchingRate(false);
  },[]);

  // ── Income handlers ──
  const handleAddIncome=()=>{
    if(!incForm.name||!incForm.amountRaw||isNaN(incForm.amountRaw)||+incForm.amountRaw<=0)return;
    const ts=Date.now();
    if(incEditId!==null){setIncomes(incomes.map(i=>i.id===incEditId?{...i,...incForm,amountRaw:+incForm.amountRaw,updatedAt:ts}:i));setIncEditId(null);}
    else setIncomes([...incomes,{id:ts,...incForm,amountRaw:+incForm.amountRaw,createdAt:ts}]);
    setIncForm({name:"",amountRaw:"",currency:"PKR",category:incCats[0],type:"monthly"});
  };
  const handleEditIncome  =(inc)=>{setIncForm({name:inc.name,amountRaw:inc.amountRaw,currency:inc.currency,category:inc.category,type:inc.type});setIncEditId(inc.id);};
  const handleDeleteIncome=(id)=>{setIncomes(incomes.filter(i=>i.id!==id));if(incEditId===id){setIncEditId(null);setIncForm({name:"",amountRaw:"",currency:"PKR",category:incCats[0],type:"monthly"});}};
  const handleAddIncCat   =()=>{const t=newIncCatName.trim();if(!t)return;const f=`${newIncCatEmoji} ${t}`;if(!incCats.includes(f))setIncCats([...incCats,f]);setNewIncCatName("");setNewIncCatEmoji("💵");setShowIncCatModal(false);};
  const handleDeleteIncCat=(cat)=>{if(DEFAULT_INC_CATS.includes(cat))return;setIncCats(incCats.filter(c=>c!==cat));if(incForm.category===cat)setIncForm(f=>({...f,category:incCats[0]}));};

  // ── Expense handlers ──
  const handleAddExpense  =()=>{
    if(!expForm.name||!expForm.amount||isNaN(expForm.amount)||+expForm.amount<=0)return;
    const ts=Date.now();
    if(expEditId!==null){setExpenses(expenses.map(e=>e.id===expEditId?{...e,...expForm,amount:+expForm.amount,updatedAt:ts}:e));setExpEditId(null);}
    else setExpenses([...expenses,{id:ts,...expForm,amount:+expForm.amount,createdAt:ts}]);
    setExpForm({name:"",amount:"",category:expCats[0],type:"monthly",endDate:""});
  };
  const handleEditExpense  =(e)=>{setExpForm({name:e.name,amount:e.amount,category:e.category,type:e.type,endDate:e.endDate||""});setExpEditId(e.id);};
  const handleDeleteExpense=(id)=>{setExpenses(expenses.filter(e=>e.id!==id));if(expEditId===id){setExpEditId(null);setExpForm({name:"",amount:"",category:expCats[0],type:"monthly"});}};
  const handleAddExpCat   =()=>{const t=newExpCatName.trim();if(!t)return;const f=`${newExpCatEmoji} ${t}`;if(!expCats.includes(f))setExpCats([...expCats,f]);setNewExpCatName("");setNewExpCatEmoji("✨");setShowExpCatModal(false);};
  const handleDeleteExpCat=(cat)=>{if(DEFAULT_EXP_CATS.includes(cat))return;setExpCats(expCats.filter(c=>c!==cat));if(expForm.category===cat)setExpForm(f=>({...f,category:expCats[0]}));};

  // ── Goal handlers ──
  const handleAddGoal=()=>{
    if(!goalForm.name||!goalForm.target||+goalForm.target<=0)return;
    const maxPri=goals.reduce((m,g)=>Math.max(m,g.priority),0);
    setGoals([...goals,{id:Date.now(),name:goalForm.name,target:+goalForm.target,saved:+goalForm.saved||0,emoji:goalForm.emoji,color:goalForm.color,priority:maxPri+1,split:+goalForm.split||20,createdAt:Date.now()}]);
    setGoalForm({name:"",target:"",saved:"",emoji:"🎯",color:"#00d4aa",split:20});
    setShowGoalForm(false);
  };
  const handleDeleteGoal=(id)=>{
    const filtered=goals.filter(g=>g.id!==id);
    // re-index priorities
    const sorted=[...filtered].sort((a,b)=>a.priority-b.priority).map((g,i)=>({...g,priority:i+1}));
    setGoals(sorted);
  };
  const handleMoveUp=(id)=>{
    const sorted=[...goals].sort((a,b)=>a.priority-b.priority);
    const idx=sorted.findIndex(g=>g.id===id);
    if(idx<=0)return;
    const newArr=[...sorted];
    [newArr[idx-1],newArr[idx]]=[newArr[idx],newArr[idx-1]];
    setGoals(newArr.map((g,i)=>({...g,priority:i+1})));
  };
  const handleMoveDown=(id)=>{
    const sorted=[...goals].sort((a,b)=>a.priority-b.priority);
    const idx=sorted.findIndex(g=>g.id===id);
    if(idx>=sorted.length-1)return;
    const newArr=[...sorted];
    [newArr[idx],newArr[idx+1]]=[newArr[idx+1],newArr[idx]];
    setGoals(newArr.map((g,i)=>({...g,priority:i+1})));
  };
  const handleEditSplit=(id,val)=>{setGoals(goals.map(g=>g.id===id?{...g,split:val}:g));};

  // ── Loading ──
  if(!loaded)return(
    <div style={{minHeight:"100vh",background:"#080c14",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{fontSize:"2.5rem"}}>💰</div>
      <div style={{color:"#00d4aa",fontSize:"1.1rem",fontWeight:700}}>RupeeSave</div>
      <div style={{color:"#3d5a80",fontSize:"0.74rem",letterSpacing:2}}>Loading your data…</div>
      <div style={{width:110,height:3,background:"#1e2d47",borderRadius:2,overflow:"hidden",marginTop:6}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,#00d4aa,#4f8ef7)",borderRadius:2,animation:"ld 1s ease-in-out infinite alternate",width:"60%"}}/>
      </div>
      <style>{`@keyframes ld{from{transform:translateX(-30px)}to{transform:translateX(40px)}}`}</style>
    </div>
  );

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        :root{
          --bg:#080c14;--surface:#0e1520;--surface2:#131c2e;
          --border:#1e2d47;--border-bright:#2a3f60;
          --accent:#00d4aa;--accent2:#4f8ef7;--accent3:#ffd166;
          --inc:#22c55e; --text:#e8f0fe;--text-dim:#8ba3c7;--muted:#3d5a80;
          --danger:#ff6b6b;--success:#00d4aa;
          --fh:'Plus Jakarta Sans',sans-serif;--fb:'Inter',sans-serif;
          --r:14px;--rs:8px;--shad:0 8px 32px rgba(0,0,0,.4);
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:var(--bg);}
        .app{min-height:100vh;background:var(--bg);font-family:var(--fb);color:var(--text);
          background-image:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(79,142,247,.07) 0%,transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 110%,rgba(0,212,170,.05) 0%,transparent 60%);}

        /* Header */
        .hdr{background:rgba(14,21,32,.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;padding:0 20px;}
        .hdr-in{max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:58px;gap:10px;flex-wrap:wrap;}
        .logo{font-family:var(--fh);font-size:1.2rem;font-weight:800;background:linear-gradient(135deg,#00d4aa,#4f8ef7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap;}
        .hr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .pill{display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:5px 11px;font-size:.65rem;}
        .rdot{width:6px;height:6px;border-radius:50%;}
        .rdot.live{background:#00d4aa;box-shadow:0 0 6px #00d4aa;animation:pulse 2s infinite;}
        .rdot.manual{background:var(--muted);}.rdot.fetching{background:var(--accent3);animation:pulse .6s infinite;}.rdot.error{background:var(--danger);}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .live-btn{background:transparent;border:1px solid var(--border-bright);color:var(--text-dim);border-radius:20px;padding:5px 11px;font-family:var(--fb);font-size:.64rem;cursor:pointer;transition:all .2s;}
        .live-btn:hover{border-color:var(--accent);color:var(--accent);}
        .inc-pill{background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(0,212,170,.1));border:1px solid rgba(34,197,94,.25);border-radius:20px;padding:5px 13px;font-size:.65rem;color:var(--inc);font-weight:600;}
        .save-ind{font-size:.59rem;color:var(--success);background:rgba(0,212,170,.08);border:1px solid rgba(0,212,170,.2);border-radius:20px;padding:4px 9px;}

        /* Layout */
        .lay{max-width:1120px;margin:0 auto;padding:24px 18px 80px;}

        /* Tabs */
        .tabs{display:flex;gap:3px;margin-bottom:24px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:4px;width:fit-content;}
        .tb{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:9px;border:none;background:transparent;color:var(--muted);font-family:var(--fb);font-size:.69rem;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .tb .ti{font-size:.93rem;}
        .tb.act{background:var(--surface2);color:var(--text);border:1px solid var(--border-bright);}
        .tb:hover:not(.act){color:var(--text-dim);}
        .tb.inc-t.act{border-color:rgba(34,197,94,.4);color:var(--inc);}
        @media(max-width:640px){
          .tabs{width:100%;}
          .tb{flex:1;justify-content:center;padding:8px 4px;font-size:.59rem;}
          .tl{display:none;}
          .g3,.pg,.gg,.db{grid-template-columns:1fr!important;}
        }

        /* Sections */
        .sec{font-size:.59rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}

        /* Cards */
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;}
        .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:26px;}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden;transition:border-color .3s,transform .2s;}
        .card:hover{border-color:var(--border-bright);transform:translateY(-1px);}
        .cglow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at top left,rgba(255,255,255,.02),transparent 60%);}
        .cl{font-size:.57rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
        .cv{font-family:var(--fh);font-size:1.45rem;font-weight:800;line-height:1.1;}
        .cv.pos{color:var(--success);}.cv.neg{color:var(--danger);}.cv.inc{color:var(--inc);}
        .cs{font-size:.6rem;color:var(--muted);margin-top:6px;}
        .pb{height:4px;background:var(--border);border-radius:2px;margin-top:11px;overflow:hidden;}
        .pbf{height:100%;border-radius:2px;transition:width .6s cubic-bezier(.4,0,.2,1);}
        .pc{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:15px 18px;position:relative;overflow:hidden;transition:border-color .3s,transform .2s;}
        .pc:hover{transform:translateY(-2px);}
        .pa{position:absolute;top:0;left:0;right:0;height:2px;}
        .pl{font-size:.57rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
        .ps{font-size:.57rem;color:var(--muted);margin-bottom:8px;opacity:.6;}
        .pv{font-family:var(--fh);font-size:1.2rem;font-weight:800;}
        .db{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
        .br-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.67rem;}
        .brl{width:140px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .brt{flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;}
        .brf{height:100%;border-radius:3px;transition:width .5s;}
        .bra{width:100px;text-align:right;color:var(--text-dim);font-size:.62rem;}

        /* Form */
        .fgi{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr 1fr auto;gap:9px;margin-bottom:22px;align-items:end;}
        .fge{display:grid;grid-template-columns:2fr 1fr 1.5fr 1fr auto;gap:9px;margin-bottom:22px;align-items:end;}
        @media(max-width:820px){.fgi,.fge{grid-template-columns:1fr 1fr;}}
        .fg{display:flex;flex-direction:column;gap:5px;}
        .fl{font-size:.57rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
        input,select{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:var(--rs);font-family:var(--fb);font-size:.75rem;width:100%;outline:none;transition:border-color .2s,box-shadow .2s;}
        input:focus,select:focus{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(79,142,247,.1);}
        input::placeholder{color:var(--muted);}
        select option{background:var(--surface2);}
        .ciw{display:flex;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;transition:border-color .2s,box-shadow .2s;}
        .ciw:focus-within{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(79,142,247,.1);}
        .ciw input{border:none!important;box-shadow:none!important;background:transparent;border-radius:0;}
        .ctog{display:flex;border-left:1px solid var(--border);flex-shrink:0;}
        .cbtn{background:transparent;border:none;cursor:pointer;padding:0 9px;height:100%;font-size:.65rem;font-family:var(--fb);transition:all .2s;color:var(--muted);}
        .cbtn.act{background:var(--accent2);color:#fff;font-weight:600;}
        .cbtn:hover:not(.act){color:var(--text);}
        .aconv{font-size:.58rem;color:var(--inc);margin-top:3px;min-height:12px;}

        /* Buttons */
        .btn{padding:9px 15px;border-radius:var(--rs);border:none;font-family:var(--fb);font-size:.69rem;cursor:pointer;transition:all .2s;white-space:nowrap;font-weight:600;}
        .btn-p{background:linear-gradient(135deg,#00d4aa,#00b896);color:#080c14;box-shadow:0 4px 14px rgba(0,212,170,.25);}
        .btn-p:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,212,170,.35);}
        .btn-i{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 14px rgba(34,197,94,.25);}
        .btn-i:hover{transform:translateY(-1px);}
        .btn-o{background:transparent;color:var(--text-dim);border:1px solid var(--border-bright);}
        .btn-o:hover{border-color:var(--accent);color:var(--accent);}
        .btn-g{background:transparent;color:var(--muted);border:1px solid var(--border);}
        .btn-g:hover{border-color:var(--muted);color:var(--text-dim);}
        .del-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:.75rem;padding:4px 7px;border-radius:6px;transition:all .2s;}
        .del-btn:hover{color:var(--danger);background:rgba(255,107,107,.1);}

        /* List */
        .list{display:flex;flex-direction:column;gap:6px;margin-bottom:22px;}
        .li{display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--rs);padding:11px 15px;transition:all .2s;gap:9px;}
        .li:hover{border-color:var(--border-bright);background:var(--surface2);}
        .li.inc-li{border-left:2px solid rgba(34,197,94,.4);}
        .iname{font-size:.79rem;color:var(--text);margin-bottom:1px;font-weight:500;}
        .icat{font-size:.6rem;color:var(--muted);}
        .ts-badge{font-size:.56rem;color:var(--muted);white-space:nowrap;display:flex;align-items:center;gap:3px;}
        .ts-badge::before{content:"🕐";font-size:.63rem;}
        .badge{font-size:.55rem;letter-spacing:1.5px;padding:2px 7px;border-radius:20px;text-transform:uppercase;font-weight:600;}
        .bm{background:rgba(0,212,170,.1);color:#00d4aa;border:1px solid rgba(0,212,170,.2);}
        .bo{background:rgba(255,209,102,.1);color:#ffd166;border:1px solid rgba(255,209,102,.2);}
        .iamt{font-family:var(--fh);font-size:.93rem;color:var(--text);white-space:nowrap;text-align:right;}
        .iamt-sub{font-size:.56rem;color:var(--inc);text-align:right;margin-top:1px;}
        .bsm{background:transparent;border:none;cursor:pointer;font-size:.63rem;color:var(--muted);font-family:var(--fb);padding:3px 7px;border-radius:4px;transition:all .2s;}
        .bsm:hover{color:var(--text);background:var(--surface2);}
        .bsm.d:hover{color:var(--danger);background:rgba(255,107,107,.1);}

        /* Chips */
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;}
        .chip{display:flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:4px 11px;font-size:.62rem;color:var(--text-dim);}
        .chip.cst{border-color:rgba(255,209,102,.3);color:#ffd166;}
        .chip.ic{border-color:rgba(34,197,94,.3);color:var(--inc);}
        .chip-x{background:none;border:none;cursor:pointer;color:var(--muted);font-size:.61rem;padding:0 0 0 2px;transition:color .2s;}
        .chip-x:hover{color:var(--danger);}

        /* Strips */
        .inc-strip{background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(0,212,170,.05));border:1px solid rgba(34,197,94,.2);border-radius:var(--r);padding:14px 20px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;}
        .si{flex:1;min-width:90px;padding:0 14px;}
        .si:first-child{padding-left:0;}
        .si+.si{border-left:1px solid var(--border);}
        .sl{font-size:.54rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;}
        .sv{font-family:var(--fh);font-size:1.1rem;font-weight:800;}

        /* ══ GOALS STYLES ══ */
        .gg{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:22px;}

        /* Mode toggle */
        .mode-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px 20px;margin-bottom:22px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
        .mode-toggle{display:flex;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:3px;gap:2px;}
        .mt-btn{padding:7px 16px;border-radius:7px;border:none;font-family:var(--fb);font-size:.68rem;cursor:pointer;transition:all .2s;color:var(--muted);background:transparent;font-weight:500;}
        .mt-btn.act-pri{background:linear-gradient(135deg,#4f8ef7,#3b7de8);color:#fff;}
        .mt-btn.act-spl{background:linear-gradient(135deg,#a78bfa,#8b5cf6);color:#fff;}
        .mode-info{font-size:.62rem;color:var(--muted);line-height:1.6;flex:1;min-width:200px;}
        .mode-info strong{color:var(--text-dim);}

        /* Split total bar */
        .split-total{background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;}
        .split-track{flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;}
        .split-fill{height:100%;border-radius:4px;transition:width .4s;background:linear-gradient(90deg,#a78bfa,#8b5cf6);}
        .split-fill.over{background:linear-gradient(90deg,#ff6b6b,#ff4444);}
        .split-text{font-size:.7rem;font-family:var(--fh);font-weight:700;white-space:nowrap;}

        /* Goal card */
        .goal-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden;transition:border-color .3s,transform .2s;}
        .goal-card:hover{border-color:var(--border-bright);transform:translateY(-2px);}
        .goal-top-line{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gc),transparent);}
        .goal-mode-badge{position:absolute;top:14px;right:14px;}
        .priority-badge{display:flex;align-items:center;gap:5px;}
        .pri-num{font-family:var(--fh);font-size:1.1rem;font-weight:800;color:var(--gc);line-height:1;}
        .pri-arrows{display:flex;flex-direction:column;gap:1px;}
        .pri-arrow{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:3px;width:18px;height:16px;font-size:.55rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0;}
        .pri-arrow:hover:not(:disabled){background:var(--accent2);border-color:var(--accent2);color:#fff;}
        .pri-arrow:disabled{opacity:.25;cursor:not-allowed;}
        .split-badge-wrap{text-align:right;}
        .split-pct{font-family:var(--fh);font-size:1.1rem;font-weight:800;line-height:1;}
        .split-amt{font-size:.57rem;color:var(--muted);}
        .goal-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-right:48px;}
        .goal-emoji-wrap{width:38px;height:38px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;}
        .goal-name{font-family:var(--fh);font-size:.9rem;font-weight:700;color:var(--text);}
        .goal-sub{font-size:.54rem;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-top:2px;}
        .goal-progress-wrap{margin-bottom:12px;}
        .goal-prog-labels{display:flex;justify-content:space-between;font-size:.58rem;color:var(--text-dim);margin-bottom:5px;}
        .goal-prog-track{height:7px;background:var(--border);border-radius:4px;overflow:hidden;}
        .goal-prog-fill{height:100%;background:var(--gc);border-radius:4px;transition:width .6s cubic-bezier(.4,0,.2,1);}
        .goal-stats{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;background:var(--surface2);border-radius:var(--rs);padding:10px 12px;}
        .goal-stat{text-align:center;}
        .goal-stat-divider{width:1px;height:26px;background:var(--border);}
        .stat-l{font-size:.51rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
        .stat-v{font-family:var(--fh);font-size:.92rem;font-weight:700;}
        .goal-achieved{background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.25);border-radius:var(--rs);padding:10px;text-align:center;color:var(--success);font-size:.78rem;letter-spacing:1px;}
        .goal-warn{background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:var(--rs);padding:10px;color:var(--danger);font-size:.68rem;}
        .goal-queue-note{font-size:.6rem;color:var(--accent3);margin-top:8px;padding:6px 10px;background:rgba(255,209,102,.06);border:1px solid rgba(255,209,102,.15);border-radius:6px;}

        /* Split slider */
        .split-slider-wrap{margin-top:10px;}
        .split-range{-webkit-appearance:none;width:100%;height:6px;border-radius:3px;background:var(--border);outline:none;padding:0;border:none;box-shadow:none;cursor:pointer;}
        .split-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--gc);cursor:pointer;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);}
        .split-range:focus{box-shadow:none;}

        /* Goals summary */
        .goals-sum{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:13px 20px;margin-bottom:18px;display:flex;gap:0;flex-wrap:wrap;}
        .tl-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--rs);padding:11px 15px;display:flex;align-items:center;gap:13px;flex-wrap:wrap;transition:border-color .2s;}
        .tl-item:hover{border-color:var(--border-bright);}
        .tl-pri{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;font-family:var(--fh);flex-shrink:0;}

        /* Converter */
        .conv-wrap{max-width:680px;}
        .conv-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:26px;margin-bottom:16px;}
        .conv-title{font-family:var(--fh);font-size:1.45rem;font-weight:800;margin-bottom:4px;}
        .conv-sub{font-size:.65rem;color:var(--muted);margin-bottom:24px;letter-spacing:1px;}
        .conv-row{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end;margin-bottom:15px;}
        @media(max-width:500px){.conv-row{grid-template-columns:1fr;}.conv-swap{margin:0 auto!important;}}
        .ciwrap{display:flex;flex-direction:column;gap:6px;}
        .cclabel{font-size:.57rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);}
        .cirow{display:flex;align-items:center;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;transition:border-color .2s,box-shadow .2s;}
        .cirow:focus-within{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(79,142,247,.1);}
        .cflag{padding:9px 12px;font-size:1rem;background:rgba(255,255,255,.03);border-right:1px solid var(--border);}
        .cirow input{border:none!important;box-shadow:none!important;background:transparent;flex:1;font-size:1rem;font-family:var(--fh);font-weight:700;}
        .conv-swap{width:38px;height:38px;background:var(--surface2);border:1px solid var(--border-bright);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:all .3s;flex-shrink:0;}
        .conv-swap:hover{background:var(--accent);border-color:var(--accent);color:#080c14;transform:rotate(180deg);}
        .conv-res{background:linear-gradient(135deg,rgba(0,212,170,.08),rgba(79,142,247,.06));border:1px solid rgba(0,212,170,.2);border-radius:var(--rs);padding:15px 18px;text-align:center;}
        .crl{font-size:.58rem;color:var(--muted);letter-spacing:2px;margin-bottom:7px;text-transform:uppercase;}
        .crv{font-family:var(--fh);font-size:1.75rem;font-weight:800;background:linear-gradient(135deg,#00d4aa,#4f8ef7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .creq{font-size:.65rem;color:var(--muted);margin-top:4px;}
        .rate-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 22px;}
        .rbt{font-size:.64rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:11px;}
        .rrow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
        .rrow input{max-width:115px;}
        .rstxt{font-size:.6rem;padding:4px 9px;border-radius:20px;}
        .rstxt.live{background:rgba(0,212,170,.1);color:#00d4aa;}
        .rstxt.manual{background:rgba(61,90,128,.2);color:var(--muted);}
        .rstxt.error{background:rgba(255,107,107,.1);color:var(--danger);}
        .qref{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:13px;}
        .qri{background:var(--surface2);border:1px solid var(--border);border-radius:var(--rs);padding:9px 11px;}
        .qrl{font-size:.56rem;color:var(--muted);margin-bottom:3px;}
        .qrv{font-family:var(--fh);font-size:.85rem;color:var(--accent);font-weight:700;}

        /* Modal */
        .mov{position:fixed;inset:0;background:rgba(0,0,0,.76);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
        .modal{background:var(--surface);border:1px solid var(--border-bright);border-radius:var(--r);padding:24px;width:100%;max-width:430px;max-height:90vh;overflow-y:auto;box-shadow:var(--shad);}
        .mt2{font-family:var(--fh);font-size:1.18rem;font-weight:800;margin-bottom:15px;color:var(--text);}
        .eg{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-bottom:11px;}
        .eb{background:var(--surface2);border:1px solid transparent;border-radius:6px;padding:6px 3px;cursor:pointer;font-size:.9rem;text-align:center;transition:all .15s;}
        .eb:hover{background:var(--border);}
        .eb.sel{border-color:var(--accent);background:rgba(0,212,170,.1);}
        .cg{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px;}
        .cb{width:23px;height:23px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .15s;}
        .cb.sel{border-color:#fff;transform:scale(1.2);}
        .mig{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;}
        .ml{font-size:.57rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
        .macts{display:flex;gap:9px;margin-top:11px;}
        .end-badge{font-size:.56rem;color:var(--muted);display:flex;align-items:center;gap:3px;}
        .li-warn{border-color:rgba(255,209,102,.35)!important;background:rgba(255,209,102,.03)!important;}
        .divider{border:none;border-top:1px solid var(--border);margin:22px 0 18px;}
        .empty{text-align:center;padding:32px 18px;color:var(--muted);font-size:.7rem;letter-spacing:2px;}
      `}</style>

      {/* ── HEADER ── */}
      <header className="hdr">
        <div className="hdr-in">
          <div className="logo">💰 RupeeSave</div>
          <div className="hr">
            {savingBlink && <div className="save-ind">✓ Saved</div>}
            <div className="inc-pill">Income: {fmtPKR(totalIncomePKR)}/mo</div>
            <div className="pill"><div className={`rdot ${rateStatus}`}/><span style={{color:"var(--text-dim)"}}>1 USD = Rs {rate}</span></div>
            <button className="live-btn" onClick={fetchLiveRate} disabled={fetchingRate}>{fetchingRate?"…":"⟳ Live Rate"}</button>
          </div>
        </div>
      </header>

      <main className="lay">
        <div className="tabs">
          {TABS.map(t=>(
            <button key={t.id} className={`tb ${activeTab===t.id?"act":""} ${t.id===1?"inc-t":""}`} onClick={()=>setActiveTab(t.id)}>
              <span className="ti">{t.icon}</span><span className="tl">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ════ DASHBOARD ════ */}
        {activeTab===0&&<>
          <div className="g3">
            {[
              {label:"Total Income",    value:fmtPKR(totalIncomePKR),    cls:"inc", bar:100, bc:"linear-gradient(90deg,#22c55e,#4ade80)", sub:`≈ ${fmtUSD(totalIncomePKR/rate)} USD`},
              {label:"Total Expenses",  value:fmtPKR(totalExpensePKR),   cls:"neg", bar:Math.min(100,(totalExpensePKR/totalIncomePKR)*100||0), bc:"linear-gradient(90deg,#ff6b6b,#ff9f9f)", sub:`${((totalExpensePKR/totalIncomePKR)*100||0).toFixed(1)}% of income`},
              {label:"Monthly Savings", value:(monthlySavings<0?"- ":"")+fmtPKR(monthlySavings), cls:monthlySavings>=0?"pos":"neg", bar:savingsPercent, bc:"linear-gradient(90deg,#00d4aa,#00f5c4)", sub:savingsPercent>=20?"✓ On track":savingsPercent>0?"⚠ Below 20%":"✗ Over budget"},
            ].map((c,i)=>(
              <div key={i} className="card"><div className="cglow"/><div className="cl">{c.label}</div>
                <div className={`cv ${c.cls}`}>{c.value}</div>{c.sub&&<div className="cs">{c.sub}</div>}
                <div className="pb"><div className="pbf" style={{width:`${c.bar}%`,background:c.bc}}/></div>
              </div>
            ))}
          </div>
          <div className="pg">
            {projections.map(p=>(
              <div key={p.label} className="pc">
                <div className="pa" style={{background:`linear-gradient(90deg,${p.color},transparent)`}}/>
                <div className="pl">{p.label}</div><div className="ps">{p.months} months</div>
                <div className="pv" style={{color:(monthlySavings*p.months)<0?"var(--danger)":p.color}}>
                  {(monthlySavings*p.months)<0?"- ":""}{fmtPKR(monthlySavings*p.months)}
                </div>
                <div style={{fontSize:".58rem",color:"var(--muted)",marginTop:4}}>≈ {fmtUSD(Math.abs(monthlySavings*p.months)/rate)}</div>
              </div>
            ))}
          </div>
          <div className="db">
            {byIncCat.length>0&&<div>
              <div className="sec" style={{marginBottom:9}}><span>Income Sources</span></div>
              {byIncCat.map(([cat,amt],i)=>{
                const cs=["#22c55e","#00d4aa","#4ade80","#86efac","#16a34a","#15803d"];
                return(<div key={cat} className="br-row"><div className="brl">{cat}</div><div className="brt"><div className="brf" style={{width:`${(amt/totalIncomePKR)*100}%`,background:cs[i%cs.length]}}/></div><div className="bra">{fmtPKR(amt)}</div></div>);
              })}
            </div>}
            {byExpCat.length>0&&<div>
              <div className="sec" style={{marginBottom:9}}><span>Expense Breakdown</span></div>
              {byExpCat.map(([cat,amt],i)=>{
                const cs=["#4f8ef7","#00d4aa","#ffd166","#a78bfa","#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6","#f59e0b"];
                return(<div key={cat} className="br-row"><div className="brl">{cat}</div><div className="brt"><div className="brf" style={{width:`${(amt/totalExpensePKR)*100}%`,background:cs[i%cs.length]}}/></div><div className="bra">{fmtPKR(amt)}</div></div>);
              })}
            </div>}
          </div>
        </>}

        {/* ════ INCOME ════ */}
        {activeTab===1&&<>
          <div className="inc-strip">
            {[
              {label:"Total Monthly",  value:fmtPKR(totalIncomePKR),      color:"var(--inc)"},
              {label:"In USD",         value:fmtUSD(totalIncomePKR/rate),  color:"var(--accent2)"},
              {label:"Sources",        value:incomes.length,               color:"var(--text)"},
              {label:"Categories",     value:incCats.length,               color:"var(--text)"},
            ].map((s,i)=>(
              <div key={i} className="si"><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.value}</div></div>
            ))}
          </div>
          <div className="sec"><span>{incEditId?"Edit Income":"Add Income Source"}</span></div>
          <div className="fgi">
            <div className="fg"><div className="fl">Source Name</div><input placeholder="e.g. Client Project…" value={incForm.name} onChange={e=>setIncForm({...incForm,name:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAddIncome()}/></div>
            <div className="fg">
              <div className="fl">Amount</div>
              <div className="ciw">
                <input type="number" placeholder="0" value={incForm.amountRaw} onChange={e=>setIncForm({...incForm,amountRaw:e.target.value})} style={{minWidth:0}}/>
                <div className="ctog">
                  <button className={`cbtn ${incForm.currency==="PKR"?"act":""}`} onClick={()=>setIncForm(f=>({...f,currency:"PKR"}))}>PKR</button>
                  <button className={`cbtn ${incForm.currency==="USD"?"act":""}`} onClick={()=>setIncForm(f=>({...f,currency:"USD"}))}>USD</button>
                </div>
              </div>
              {incForm.currency==="USD"&&incForm.amountRaw&&!isNaN(incForm.amountRaw)&&<div className="aconv">→ {fmtPKR(+incForm.amountRaw*rate)} auto-converted</div>}
            </div>
            <div className="fg"><div className="fl">Category</div><select value={incForm.category} onChange={e=>setIncForm({...incForm,category:e.target.value})}>{incCats.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><div className="fl">Type</div><select value={incForm.type} onChange={e=>setIncForm({...incForm,type:e.target.value})}><option value="monthly">Monthly</option><option value="onetime">One-time</option></select></div>
            <div className="fg" style={{flexDirection:"row",alignItems:"flex-end",gap:6}}>
              <button className="btn btn-i" onClick={handleAddIncome}>{incEditId?"Update":"Add"}</button>
              {incEditId&&<button className="btn btn-g" onClick={()=>{setIncEditId(null);setIncForm({name:"",amountRaw:"",currency:"PKR",category:incCats[0],type:"monthly"});}}>✕</button>}
            </div>
          </div>
          <div className="sec" style={{marginBottom:8}}><span>Income Categories</span><button className="btn btn-o" style={{fontSize:".6rem",padding:"5px 11px"}} onClick={()=>setShowIncCatModal(true)}>+ New</button></div>
          <div className="chips">{incCats.map(cat=><div key={cat} className={`chip ${DEFAULT_INC_CATS.includes(cat)?"":"ic"}`}><span>{cat}</span>{!DEFAULT_INC_CATS.includes(cat)&&<button className="chip-x" onClick={()=>handleDeleteIncCat(cat)}>✕</button>}</div>)}</div>
          <div className="sec"><span>Income Entries — {incomes.length}</span></div>
          <div className="list">
            {incomes.length===0&&<div className="empty">No income entries yet</div>}
            {[...incomes].reverse().map(inc=>{
              const pkr=inc.currency==="USD"?inc.amountRaw*rate:inc.amountRaw;
              return(<div key={inc.id} className="li inc-li">
                <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",flex:1,minWidth:0}}>
                  <span style={{fontSize:"1.05rem",flexShrink:0}}>{inc.category.split(" ")[0]}</span>
                  <div style={{minWidth:0}}>
                    <div className="iname">{inc.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <div className="icat">{inc.category}</div>
                      <div className="ts-badge" title={fmtTimeFull(inc.createdAt)}>{fmtTime(inc.updatedAt||inc.createdAt)}{inc.updatedAt&&" (edited)"}</div>
                    </div>
                  </div>
                  <span className={`badge ${inc.type==="monthly"?"bm":"bo"}`}>{inc.type}</span>
                  {inc.currency==="USD"&&<span style={{fontSize:".54rem",background:"rgba(79,142,247,.1)",color:"var(--accent2)",border:"1px solid rgba(79,142,247,.2)",padding:"1px 6px",borderRadius:20}}>USD</span>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div><div className="iamt" style={{color:"var(--inc)"}}>{fmtPKR(pkr)}</div>{inc.currency==="USD"&&<div className="iamt-sub">{fmtUSD(inc.amountRaw)} auto-converted</div>}</div>
                    <button className="bsm" onClick={()=>handleEditIncome(inc)}>edit</button>
                    <button className="bsm d" onClick={()=>handleDeleteIncome(inc.id)}>✕</button>
                  </div>
                </div>
              </div>);
            })}
          </div>
        </>}

        {/* ════ EXPENSES ════ */}
        {activeTab===2&&<>
          {/* Active/Expired summary strip */}
          <div className="inc-strip" style={{background:"linear-gradient(135deg,rgba(255,107,107,.07),rgba(79,142,247,.05))",borderColor:"rgba(255,107,107,.2)"}}>
            {[
              {label:"Active Expenses",   value:fmtPKR(totalExpensePKR),          color:"var(--danger)"},
              {label:"Active Count",      value:activeExpenses.length,             color:"var(--text)"},
              {label:"Expired/Completed", value:expiredExpenses.length,            color:"var(--muted)"},
              {label:"Freed Up",          value:fmtPKR(expiredExpenses.reduce((s,e)=>s+e.amount,0)), color:"var(--success)"},
            ].map((s,i)=>(
              <div key={i} className="si"><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.value}</div></div>
            ))}
          </div>

          <div className="sec"><span>{expEditId?"Edit Expense":"Add Expense"}</span></div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1.2fr 1fr 1.1fr auto",gap:9,marginBottom:22,alignItems:"end"}}>
            <div className="fg"><div className="fl">Name</div><input placeholder="e.g. Car Installment, Bijli…" value={expForm.name} onChange={e=>setExpForm({...expForm,name:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAddExpense()}/></div>
            <div className="fg"><div className="fl">Amount (Rs)</div><input type="number" placeholder="0" value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAddExpense()}/></div>
            <div className="fg"><div className="fl">Category</div><select value={expForm.category} onChange={e=>setExpForm({...expForm,category:e.target.value})}>{expCats.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><div className="fl">Type</div><select value={expForm.type} onChange={e=>setExpForm({...expForm,type:e.target.value})}><option value="monthly">Monthly</option><option value="onetime">One-time</option></select></div>
            <div className="fg">
              <div className="fl">End Date <span style={{color:"var(--muted)",fontSize:".5rem"}}>(optional)</span></div>
              <input type="month" value={expForm.endDate||""} onChange={e=>setExpForm({...expForm,endDate:e.target.value})}
                style={{colorScheme:"dark"}}/>
            </div>
            <div className="fg" style={{flexDirection:"row",alignItems:"flex-end",gap:6}}>
              <button className="btn btn-p" onClick={handleAddExpense}>{expEditId?"Update":"Add"}</button>
              {expEditId&&<button className="btn btn-g" onClick={()=>{setExpEditId(null);setExpForm({name:"",amount:"",category:expCats[0],type:"monthly",endDate:""});}}>✕</button>}
            </div>
          </div>

          <div className="sec" style={{marginBottom:8}}><span>Expense Categories</span><button className="btn btn-o" style={{fontSize:".6rem",padding:"5px 11px"}} onClick={()=>setShowExpCatModal(true)}>+ New</button></div>
          <div className="chips">{expCats.map(cat=><div key={cat} className={`chip ${DEFAULT_EXP_CATS.includes(cat)?"":"cst"}`}><span>{cat}</span>{!DEFAULT_EXP_CATS.includes(cat)&&<button className="chip-x" onClick={()=>handleDeleteExpCat(cat)}>✕</button>}</div>)}</div>

          {/* Active expenses */}
          <div className="sec"><span>Active Expenses — {activeExpenses.length}</span></div>
          <div className="list">
            {activeExpenses.length===0&&<div className="empty">No active expenses</div>}
            {[...activeExpenses].reverse().map(e=>{
              const hasEnd = !!e.endDate;
              const endD   = hasEnd ? new Date(e.endDate) : null;
              const nowD   = new Date(); nowD.setHours(0,0,0,0);
              const msLeft = endD ? endD - nowD : null;
              const daysLeft = msLeft ? Math.ceil(msLeft/86400000) : null;
              const endingSoon = daysLeft !== null && daysLeft <= 60;
              return(
              <div key={e.id} className={`li ${endingSoon?"li-warn":""}`}>
                <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",flex:1,minWidth:0}}>
                  <span style={{fontSize:"1.05rem",flexShrink:0}}>{e.category.split(" ")[0]}</span>
                  <div style={{minWidth:0}}>
                    <div className="iname">{e.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <div className="icat">{e.category}</div>
                      <div className="ts-badge" title={fmtTimeFull(e.createdAt)}>{fmtTime(e.updatedAt||e.createdAt)}{e.updatedAt&&" (edited)"}</div>
                      {hasEnd&&<div className="end-badge" style={{color:endingSoon?"var(--accent3)":"var(--muted)"}}>
                        📅 ends {endD.toLocaleDateString("en-PK",{month:"short",year:"numeric"})}
                        {endingSoon&&<span style={{color:"var(--accent3)",fontWeight:600}}> · {daysLeft}d left</span>}
                      </div>}
                    </div>
                  </div>
                  <span className={`badge ${e.type==="monthly"?"bm":"bo"}`}>{e.type}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                  <div className="iamt">{fmtPKR(e.amount)}</div>
                  <button className="bsm" onClick={()=>handleEditExpense(e)}>edit</button>
                  <button className="bsm d" onClick={()=>handleDeleteExpense(e.id)}>✕</button>
                </div>
              </div>);
            })}
          </div>

          {/* Expired / completed expenses */}
          {expiredExpenses.length>0&&<>
            <div className="sec" style={{marginBottom:8}}>
              <span style={{color:"var(--muted)"}}>Expired / Completed — {expiredExpenses.length}</span>
              <span style={{fontSize:".6rem",color:"var(--success)"}}>+{fmtPKR(expiredExpenses.reduce((s,e)=>s+e.amount,0))}/mo freed</span>
            </div>
            <div className="list">
              {[...expiredExpenses].reverse().map(e=>(
                <div key={e.id} className="li" style={{opacity:.5,borderStyle:"dashed"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",flex:1,minWidth:0}}>
                    <span style={{fontSize:"1.05rem",flexShrink:0,filter:"grayscale(1)"}}>{e.category.split(" ")[0]}</span>
                    <div style={{minWidth:0}}>
                      <div className="iname" style={{textDecoration:"line-through",color:"var(--muted)"}}>{e.name}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div className="icat">{e.category}</div>
                        <div className="end-badge">✓ ended {new Date(e.endDate).toLocaleDateString("en-PK",{month:"short",year:"numeric"})}</div>
                      </div>
                    </div>
                    <span className="badge" style={{background:"rgba(61,90,128,.2)",color:"var(--muted)",border:"none"}}>expired</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <div className="iamt" style={{color:"var(--muted)",textDecoration:"line-through"}}>{fmtPKR(e.amount)}</div>
                    <button className="bsm d" onClick={()=>handleDeleteExpense(e.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </>}

        {/* ════ GOALS ════ */}
        {activeTab===3&&<>
          {/* Summary strip */}
          <div className="goals-sum">
            {[
              {label:"Monthly Savings", value:fmtPKR(monthlySavings),   color:monthlySavings>=0?"var(--success)":"var(--danger)"},
              {label:"Active Goals",    value:goals.length,              color:"var(--text)"},
              {label:"Total Target",    value:fmtPKR(goals.reduce((s,g)=>s+g.target,0)), color:"#ffd166"},
              {label:"Total Saved",     value:fmtPKR(goals.reduce((s,g)=>s+g.saved,0)),  color:"#a78bfa"},
            ].map((s,i)=>(
              <div key={i} className="si"><div className="sl">{s.label}</div><div className="sv" style={{color:s.color}}>{s.value}</div></div>
            ))}
          </div>

          {/* ── Mode selector ── */}
          <div className="mode-bar">
            <div>
              <div style={{fontSize:".58rem",letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginBottom:8}}>Allocation Strategy</div>
              <div className="mode-toggle">
                <button className={`mt-btn ${goalMode==="priority"?"act-pri":""}`} onClick={()=>setGoalMode("priority")}>
                  🏆 Priority Mode
                </button>
                <button className={`mt-btn ${goalMode==="split"?"act-spl":""}`} onClick={()=>setGoalMode("split")}>
                  ✂️ Split % Mode
                </button>
              </div>
            </div>
            <div className="mode-info">
              {goalMode==="priority"
                ? <><strong>Priority Mode:</strong> Full savings ({fmtPKR(monthlySavings)}/mo) goes to Goal #1 first. Once done, it flows to #2, then #3 — giving you exact sequential completion dates. Use ▲▼ to reorder.</>
                : <><strong>Split % Mode:</strong> Divide your savings across all goals simultaneously. Drag each slider to set what % goes to each goal. Total must be ≤ 100%. Unallocated {Math.max(0,100-totalSplitPct)}% stays unassigned.</>
              }
            </div>
          </div>

          {/* Split total bar */}
          {goalMode==="split"&&(
            <div className="split-total">
              <span style={{fontSize:".6rem",color:"var(--muted)",whiteSpace:"nowrap"}}>Total Split</span>
              <div className="split-track"><div className={`split-fill ${totalSplitPct>100?"over":""}`} style={{width:`${Math.min(totalSplitPct,100)}%`}}/></div>
              <span className="split-text" style={{color:totalSplitPct>100?"var(--danger)":totalSplitPct===100?"var(--success)":"var(--text-dim)"}}>
                {totalSplitPct}%{totalSplitPct>100?" ⚠ over!":totalSplitPct===100?" ✓":""}
              </span>
              <span style={{fontSize:".6rem",color:"var(--muted)",whiteSpace:"nowrap"}}>{fmtPKR(monthlySavings*totalSplitPct/100)}/mo allocated</span>
            </div>
          )}

          <div className="sec">
            <span>Goals ({goals.length}){goalMode==="priority"?" — drag to reprioritize":""}</span>
            <button className="btn btn-o" style={{fontSize:".6rem",padding:"5px 11px"}} onClick={()=>setShowGoalForm(true)}>+ Add Goal</button>
          </div>
          {goals.length===0&&<div className="empty" style={{marginBottom:22}}>No goals yet — add one!</div>}

          <div className="gg">
            {sortedGoals.map((g,idx)=>{
              const sch = goalSchedule.find(s=>s.goal.id===g.id) || {goal:g,monthsFromNow:null,achieveDate:null,monthlyAllocation:0,startMonth:0};
              return(
                <GoalCard key={g.id} goal={g} schedule={sch} rank={idx+1} goalMode={goalMode}
                  totalGoals={goals.length} onDelete={handleDeleteGoal}
                  onMoveUp={()=>handleMoveUp(g.id)} onMoveDown={()=>handleMoveDown(g.id)}
                  onEditSplit={handleEditSplit}/>
              );
            })}
          </div>

          {/* Timeline */}
          {monthlySavings>0&&goals.length>0&&<>
            <hr className="divider"/>
            <div className="sec"><span>📅 Sequential Timeline</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {sortedGoals.map((g,idx)=>{
                const sch=goalSchedule.find(s=>s.goal.id===g.id);
                if(!sch||g.target-g.saved<=0) return null;
                const prog=Math.min(100,(g.saved/g.target)*100);
                const isActive = goalMode==="priority" ? sch.startMonth===0 : true;
                return(
                  <div key={g.id} className="tl-item" style={{borderLeft:`2px solid ${isActive?g.color:"var(--border)"}`}}>
                    <div className="tl-pri" style={{background:isActive?g.color:"var(--border)",color:isActive?"#080c14":"var(--muted)"}}>{idx+1}</div>
                    <span style={{fontSize:"1.25rem"}}>{g.emoji}</span>
                    <div style={{flex:1,minWidth:100}}>
                      <div style={{fontSize:".78rem",color:"var(--text)",marginBottom:3,fontWeight:500}}>{g.name}</div>
                      <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${prog}%`,background:g.color,borderRadius:2}}/>
                      </div>
                      {goalMode==="split"&&<div style={{fontSize:".57rem",color:"var(--muted)",marginTop:2}}>{g.split||0}% split · {fmtPKR(sch.monthlyAllocation)}/mo</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"var(--fh)",fontSize:".95rem",color:g.color,fontWeight:700}}>
                        {sch.monthsFromNow!=null?`${sch.monthsFromNow} mo`:"—"}
                      </div>
                      <div style={{fontSize:".58rem",color:"var(--muted)",marginTop:1}}>
                        {sch.achieveDate?`${MONTHS_FULL[sch.achieveDate.getMonth()].slice(0,3)} ${sch.achieveDate.getFullYear()}`:""}
                      </div>
                      {goalMode==="priority"&&sch.startMonth>0&&<div style={{fontSize:".55rem",color:"var(--accent3)",marginTop:1}}>starts mo.{sch.startMonth}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>}
        </>}

        {/* ════ CONVERTER ════ */}
        {activeTab===4&&(
          <div className="conv-wrap">
            <div className="conv-card">
              <div className="conv-title">Currency Converter</div>
              <div className="conv-sub">USD ⇄ PKR · Rate: Rs {rate}/USD</div>
              <div className="conv-row">
                <div className="ciwrap">
                  <div className="cclabel">{convDir==="usd2pkr"?"From — US Dollar":"From — Pakistani Rupee"}</div>
                  <div className="cirow">
                    <div className="cflag">{convDir==="usd2pkr"?"🇺🇸":"🇵🇰"}</div>
                    <input type="number" placeholder="0.00" value={convInput} onChange={e=>setConvInput(e.target.value)}/>
                    <span style={{paddingRight:11,color:"var(--muted)",fontSize:".68rem"}}>{convDir==="usd2pkr"?"USD":"PKR"}</span>
                  </div>
                </div>
                <button className="conv-swap" onClick={()=>setConvDir(d=>d==="usd2pkr"?"pkr2usd":"usd2pkr")}>⇄</button>
                <div className="ciwrap">
                  <div className="cclabel">{convDir==="usd2pkr"?"To — Pakistani Rupee":"To — US Dollar"}</div>
                  <div className="cirow" style={{opacity:.6,pointerEvents:"none"}}>
                    <div className="cflag">{convDir==="usd2pkr"?"🇵🇰":"🇺🇸"}</div>
                    <input readOnly value={convResult!==null?convResult.toFixed(convDir==="usd2pkr"?0:4):""} placeholder="—"/>
                    <span style={{paddingRight:11,color:"var(--muted)",fontSize:".68rem"}}>{convDir==="usd2pkr"?"PKR":"USD"}</span>
                  </div>
                </div>
              </div>
              {convResult!==null&&<div className="conv-res">
                <div className="crl">Result</div>
                <div className="crv">{convDir==="usd2pkr"?fmtPKR(convResult):`$${convResult.toFixed(4)}`}</div>
                <div className="creq">{convInput} {convDir==="usd2pkr"?"USD":"PKR"} = {convDir==="usd2pkr"?fmtPKR(convResult):`$${convResult.toFixed(4)}`} at Rs {rate}/USD</div>
              </div>}
            </div>
            <div className="rate-box">
              <div className="rbt">Exchange Rate Settings</div>
              <div className="rrow">
                <span className="fl" style={{whiteSpace:"nowrap"}}>1 USD =</span>
                <input type="number" value={rate} onChange={e=>{setRate(+e.target.value||1);setRateStatus("manual");}} style={{maxWidth:115}}/>
                <span className="fl">PKR</span>
                <button className="btn btn-p" onClick={fetchLiveRate} disabled={fetchingRate}>{fetchingRate?"Fetching…":"⟳ Live Rate"}</button>
                <span className={`rstxt ${rateStatus==="live"?"live":rateStatus==="error"?"error":"manual"}`}>{rateStatus==="live"?"● Live":rateStatus==="fetching"?"⟳":"○ Manual"}</span>
              </div>
              <div style={{marginTop:9,fontSize:".6rem",color:"var(--muted)",lineHeight:1.7}}>
                <p>• Click <strong style={{color:"var(--text)"}}>Live Rate</strong> to auto-fetch real-time USD/PKR rate.</p>
                <p>• Rate applies everywhere — income, goals &amp; converter.</p>
              </div>
              <hr className="divider" style={{margin:"13px 0 11px"}}/>
              <div className="fl" style={{marginBottom:9}}>Quick Reference</div>
              <div className="qref">{[1,5,10,50,100,500].map(v=><div key={v} className="qri"><div className="qrl">${v} USD</div><div className="qrv">{fmtPKR(v*rate)}</div></div>)}</div>
            </div>
          </div>
        )}

        <div style={{marginTop:48,paddingTop:15,borderTop:"1px solid var(--border)",fontSize:".55rem",color:"var(--muted)",letterSpacing:"2px",textAlign:"center",display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          <span>💰 RupeeSave</span><span>Income {fmtPKR(totalIncomePKR)}/mo</span><span>Savings {fmtPKR(monthlySavings)}/mo</span><span>Rate Rs {rate}/USD</span>
        </div>
      </main>

      {/* ── Income Category Modal ── */}
      {showIncCatModal&&<div className="mov" onClick={e=>e.target===e.currentTarget&&setShowIncCatModal(false)}>
        <div className="modal"><div className="mt2">New Income Category</div>
          <div className="ml" style={{marginBottom:7}}>Pick an Emoji</div>
          <div className="eg">{ALL_EMOJIS.map(em=><button key={em} className={`eb ${newIncCatEmoji===em?"sel":""}`} onClick={()=>setNewIncCatEmoji(em)}>{em}</button>)}</div>
          <div className="mig"><div className="ml">Category Name</div><input placeholder="e.g. Rental Income, Dividends…" value={newIncCatName} onChange={e=>setNewIncCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddIncCat()}/></div>
          <div className="macts"><button className="btn btn-i" style={{flex:1}} onClick={handleAddIncCat}>Add</button><button className="btn btn-g" onClick={()=>{setShowIncCatModal(false);setNewIncCatName("");}}>Cancel</button></div>
        </div>
      </div>}

      {/* ── Expense Category Modal ── */}
      {showExpCatModal&&<div className="mov" onClick={e=>e.target===e.currentTarget&&setShowExpCatModal(false)}>
        <div className="modal"><div className="mt2">New Expense Category</div>
          <div className="ml" style={{marginBottom:7}}>Pick an Emoji</div>
          <div className="eg">{ALL_EMOJIS.map(em=><button key={em} className={`eb ${newExpCatEmoji===em?"sel":""}`} onClick={()=>setNewExpCatEmoji(em)}>{em}</button>)}</div>
          <div className="mig"><div className="ml">Category Name</div><input placeholder="e.g. Pet Care, Travel…" value={newExpCatName} onChange={e=>setNewExpCatName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddExpCat()}/></div>
          <div className="macts"><button className="btn btn-p" style={{flex:1}} onClick={handleAddExpCat}>Add</button><button className="btn btn-g" onClick={()=>{setShowExpCatModal(false);setNewExpCatName("");}}>Cancel</button></div>
        </div>
      </div>}

      {/* ── Goal Modal ── */}
      {showGoalForm&&<div className="mov" onClick={e=>e.target===e.currentTarget&&setShowGoalForm(false)}>
        <div className="modal"><div className="mt2">New Savings Goal</div>
          <div className="ml" style={{marginBottom:7}}>Emoji</div>
          <div className="eg">{GOAL_EMOJIS.map(em=><button key={em} className={`eb ${goalForm.emoji===em?"sel":""}`} onClick={()=>setGoalForm(f=>({...f,emoji:em}))}>{em}</button>)}</div>
          <div className="ml" style={{marginBottom:7}}>Color</div>
          <div className="cg">{GOAL_COLORS.map(c=><button key={c} className={`cb ${goalForm.color===c?"sel":""}`} style={{background:c}} onClick={()=>setGoalForm(f=>({...f,color:c}))}/>)}</div>
          <div className="mig"><div className="ml">Goal Name</div><input placeholder="e.g. New Car, House Down Payment…" value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))}/></div>
          <div className="mig"><div className="ml">Target Amount (Rs)</div><input type="number" placeholder="500000" value={goalForm.target} onChange={e=>setGoalForm(f=>({...f,target:e.target.value}))}/></div>
          <div className="mig"><div className="ml">Already Saved (Rs) — optional</div><input type="number" placeholder="0" value={goalForm.saved} onChange={e=>setGoalForm(f=>({...f,saved:e.target.value}))}/></div>
          <div className="mig">
            <div className="ml">Initial Split % (for Split Mode)</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="range" min={0} max={100} value={goalForm.split} onChange={e=>setGoalForm(f=>({...f,split:+e.target.value}))} className="split-range" style={{"--gc":"#a78bfa"}}/>
              <span style={{fontFamily:"var(--fh)",fontWeight:700,color:"#a78bfa",minWidth:36,fontSize:".9rem"}}>{goalForm.split}%</span>
            </div>
          </div>
          <div className="macts"><button className="btn btn-p" style={{flex:1}} onClick={handleAddGoal}>Add Goal</button><button className="btn btn-g" onClick={()=>setShowGoalForm(false)}>Cancel</button></div>
        </div>
      </div>}
    </div>
  );
}
