import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function xirr(cashflows) {
  if (cashflows.length < 2) return null;
  const dates = cashflows.map(c => c.date);
  const amounts = cashflows.map(c => c.amount);
  const t0 = dates[0];
  const years = dates.map(d => (d - t0) / (365.25 * 24 * 3600 * 1000));
  let r = 0.1;
  for (let i = 0; i < 200; i++) {
    let f = 0, df = 0;
    for (let j = 0; j < amounts.length; j++) {
      f += amounts[j] / Math.pow(1 + r, years[j]);
      df -= years[j] * amounts[j] / Math.pow(1 + r, years[j] + 1);
    }
    const r1 = r - f / df;
    if (Math.abs(r1 - r) < 1e-6) return r1;
    r = r1;
  }
  return r;
}

function fmtINR(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return sign + "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return (n * 100).toFixed(2) + "%";
}

const CATEGORIES = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "Debt", "Gold/SGB", "ETF", "US Stock", "EPF", "Bond", "Other"];
const BROKERS = ["Zerodha", "Groww", "Upstox", "HDFC Securities", "ICICI Direct", "Angel One", "Paytm Money", "INDmoney", "EPFO", "Other"];
const ASSET_TYPES = ["Indian Stock", "Indian MF", "ETF", "US Stock", "SGB", "Bond", "EPF", "Other"];
const COLORS = ["#00d4aa", "#6c63ff", "#ff6b6b", "#ffd93d", "#4ecdc4", "#a8e6cf", "#ff8b94", "#c3b1e1", "#fddb92", "#b8f0e6"];

const EMPTY_HOLDING = {
  id: null, name: "", ticker: "", assetType: "Indian Stock", category: "Large Cap",
  broker: "Zerodha", units: "", avgCost: "", currentPrice: "", buyDate: "", notes: ""
};

const DEMO = [
  { id: 1, name: "Reliance Industries", ticker: "RELIANCE.NS", assetType: "Indian Stock", category: "Large Cap", broker: "Zerodha", units: 10, avgCost: 2400, currentPrice: 2850, buyDate: "2022-06-01", notes: "" },
  { id: 2, name: "Infosys", ticker: "INFY.NS", assetType: "Indian Stock", category: "Large Cap", broker: "Zerodha", units: 15, avgCost: 1450, currentPrice: 1620, buyDate: "2021-09-10", notes: "" },
  { id: 3, name: "HDFC Mid-Cap Opp Fund", ticker: "118989", assetType: "Indian MF", category: "Mid Cap", broker: "Groww", units: 500, avgCost: 48, currentPrice: 72, buyDate: "2021-03-15", notes: "" },
  { id: 4, name: "Parag Parikh Flexi Cap", ticker: "122639", assetType: "Indian MF", category: "Flexi Cap", broker: "Groww", units: 200, avgCost: 52, currentPrice: 80, buyDate: "2020-08-01", notes: "" },
  { id: 5, name: "Nifty 50 BeES", ticker: "NIFTYBEES.NS", assetType: "ETF", category: "ETF", broker: "Zerodha", units: 50, avgCost: 190, currentPrice: 230, buyDate: "2022-01-10", notes: "" },
  { id: 6, name: "Sovereign Gold Bond 2026", ticker: "", assetType: "SGB", category: "Gold/SGB", broker: "HDFC Securities", units: 5, avgCost: 5200, currentPrice: 7100, buyDate: "2021-11-05", notes: "Matures 2028" },
  { id: 7, name: "EPF Corpus", ticker: "", assetType: "EPF", category: "EPF", broker: "EPFO", units: 1, avgCost: 320000, currentPrice: 385000, buyDate: "2019-04-01", notes: "Updated quarterly" },
  { id: 8, name: "Apple Inc", ticker: "AAPL", assetType: "US Stock", category: "US Stock", broker: "INDmoney", units: 3, avgCost: 12450, currentPrice: 15390, buyDate: "2023-01-20", notes: "USD→INR" },
];

async function fetchYahooPrice(ticker) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`);
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch { return null; }
}

async function fetchMFPrice(schemeCode) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    const data = await res.json();
    const nav = data?.data?.[0]?.nav;
    return nav ? parseFloat(nav) : null;
  } catch { return null; }
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0d1530, #111827)", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "#4a6080", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "#e0e8f0", lineHeight: 1.2, wordBreak: "break-all" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#4a6080", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function HoldingMiniRow({ h }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a2640" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
        <div style={{ fontSize: 11, color: "#4a6080" }}>{h.broker} · {h.units} units</div>
      </div>
      <div style={{ textAlign: "right", marginLeft: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtINR(h.value)}</div>
        <div style={{ fontSize: 12, color: h.gain >= 0 ? "#00d4aa" : "#ff6b6b", fontWeight: 600 }}>
          {h.gain >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(h.gainPct))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [holdings, setHoldings] = useState(() => {
    try { const s = localStorage.getItem("pf_v2"); return s ? JSON.parse(s) : DEMO; }
    catch { return DEMO; }
  });
  const [tab, setTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_HOLDING);
  const [editId, setEditId] = useState(null);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [filterBroker, setFilterBroker] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [csvError, setCsvError] = useState("");

  useEffect(() => { localStorage.setItem("pf_v2", JSON.stringify(holdings)); }, [holdings]);

  const enriched = holdings.map(h => {
    const cost = h.units * h.avgCost;
    const value = h.units * h.currentPrice;
    const gain = value - cost;
    const gainPct = cost > 0 ? gain / cost : 0;
    const buyDate = h.buyDate ? new Date(h.buyDate) : new Date();
    const xirrVal = xirr([{ amount: -cost, date: buyDate }, { amount: value, date: new Date() }]);
    return { ...h, cost, value, gain, gainPct, xirr: xirrVal };
  });

  const filtered = enriched
    .filter(h => filterBroker === "All" || h.broker === filterBroker)
    .filter(h => filterType === "All" || h.assetType === filterType)
    .filter(h => filterCat === "All" || h.category === filterCat)
    .sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      return typeof av === "number" ? (av - bv) * sortDir : String(av).localeCompare(String(bv)) * sortDir;
    });

  const totalCost = enriched.reduce((s, h) => s + h.cost, 0);
  const totalValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? totalGain / totalCost : 0;
  const allCashflows = enriched.flatMap(h => [{ amount: -h.cost, date: new Date(h.buyDate || Date.now()) }]).concat([{ amount: totalValue, date: new Date() }]);
  const portfolioXirr = xirr(allCashflows);

  const stocks = enriched.filter(h => ["Indian Stock", "US Stock", "ETF"].includes(h.assetType));
  const mfs = enriched.filter(h => h.assetType === "Indian MF");
  const others = enriched.filter(h => !["Indian Stock", "US Stock", "ETF", "Indian MF"].includes(h.assetType));

  const catMap = {}; enriched.forEach(h => { catMap[h.category] = (catMap[h.category] || 0) + h.value; });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));
  const brokerMap = {}; enriched.forEach(h => { brokerMap[h.broker] = (brokerMap[h.broker] || 0) + h.value; });
  const brokerData = Object.entries(brokerMap).map(([name, value]) => ({ name, value: Math.round(value) }));

  const handleSort = (key) => { if (sortKey === key) setSortDir(d => -d); else { setSortKey(key); setSortDir(1); } };

  const handleRefresh = async () => {
    setRefreshing(true); setRefreshMsg("Fetching live prices…");
    let updated = [...holdings]; let count = 0;
    for (let i = 0; i < updated.length; i++) {
      const h = updated[i]; if (!h.ticker) continue;
      const price = h.assetType === "Indian MF" ? await fetchMFPrice(h.ticker) : await fetchYahooPrice(h.ticker);
      if (price) { updated[i] = { ...h, currentPrice: price }; count++; }
    }
    setHoldings(updated);
    setRefreshMsg(`✓ Updated ${count} price(s). ${updated.length - count} skipped (no ticker / manual).`);
    setRefreshing(false); setTimeout(() => setRefreshMsg(""), 6000);
  };

  const handleSave = () => {
    const h = { ...form, id: editId || Date.now(), units: parseFloat(form.units) || 0, avgCost: parseFloat(form.avgCost) || 0, currentPrice: parseFloat(form.currentPrice) || 0 };
    if (editId) setHoldings(prev => prev.map(x => x.id === editId ? h : x));
    else setHoldings(prev => [...prev, h]);
    setShowForm(false); setEditId(null); setForm(EMPTY_HOLDING);
  };

  const handleEdit = (h) => { setForm({ ...h, units: String(h.units), avgCost: String(h.avgCost), currentPrice: String(h.currentPrice) }); setEditId(h.id); setShowForm(true); };
  const handleDelete = (id) => { if (confirm("Delete this holding?")) setHoldings(prev => prev.filter(x => x.id !== id)); };

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(","); const obj = {}; headers.forEach((h, i) => obj[h] = vals[i]?.trim() || "");
          return { id: Date.now() + Math.random(), name: obj.name, ticker: obj.ticker || "", assetType: obj.assettype || "Indian Stock", category: obj.category || "Other", broker: obj.broker || "Other", units: parseFloat(obj.units) || 0, avgCost: parseFloat(obj.avgcost) || 0, currentPrice: parseFloat(obj.currentprice) || 0, buyDate: obj.buydate || "", notes: obj.notes || "" };
        });
        setHoldings(prev => [...prev, ...rows]); setCsvError(""); e.target.value = "";
      } catch (err) { setCsvError("Parse error: " + err.message); }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const headers = "name,ticker,assetType,category,broker,units,avgCost,currentPrice,buyDate,notes";
    const rows = holdings.map(h => [h.name, h.ticker, h.assetType, h.category, h.broker, h.units, h.avgCost, h.currentPrice, h.buyDate, h.notes].join(","));
    const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "portfolio.csv"; a.click();
  };

  const SortTh = ({ label, k }) => (
    <th onClick={() => handleSort(k)} style={{ cursor: "pointer", padding: "10px 14px", textAlign: "left", color: sortKey === k ? "#00d4aa" : "#8899aa", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap", userSelect: "none" }}>
      {label}{sortKey === k ? (sortDir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );

  const Field = ({ k, label, type = "text", full = false }) => (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <label style={{ fontSize: 11, color: "#4a6080", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        placeholder={k === "ticker" ? "e.g. RELIANCE.NS / 118989 / AAPL" : ""}
        style={{ width: "100%", background: "#080d1a", border: "1px solid #1e2d45", color: "#e0e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );

  const Select = ({ k, label, opts }) => (
    <div>
      <label style={{ fontSize: 11, color: "#4a6080", fontWeight: 700, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <select value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        style={{ width: "100%", background: "#080d1a", border: "1px solid #1e2d45", color: "#e0e8f0", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  const sectionValue = (arr) => arr.reduce((s, h) => s + h.value, 0);
  const sectionGain = (arr) => arr.reduce((s, h) => s + h.gain, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#080d1a", color: "#e0e8f0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #0d1530 0%, #080d1a 100%)", borderBottom: "1px solid #1e2d45", padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #00d4aa, #6c63ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📈</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>FolioTrack</div>
              <div style={{ fontSize: 10, color: "#3a5070", letterSpacing: 1 }}>PORTFOLIO TRACKER</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ background: "#00d4aa18", border: "1px solid #00d4aa44", color: "#00d4aa", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              {refreshing ? "⟳ Refreshing…" : "⟳ Refresh Prices"}
            </button>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_HOLDING); }}
              style={{ background: "linear-gradient(135deg, #6c63ff, #4ecdc4)", border: "none", color: "#fff", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              + Add Holding
            </button>
          </div>
        </div>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 2 }}>
          {[["dashboard", "🏠 Dashboard"], ["holdings", "📋 Holdings"], ["charts", "📊 Charts"]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: "none", border: "none", color: tab === t ? "#00d4aa" : "#3a5070", padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, borderBottom: tab === t ? "2px solid #00d4aa" : "2px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {refreshMsg && <div style={{ background: "#00d4aa18", borderBottom: "1px solid #00d4aa33", padding: "8px 24px", color: "#00d4aa", fontSize: 12, textAlign: "center" }}>{refreshMsg}</div>}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
              <StatCard icon="💰" label="Total Invested" value={fmtINR(totalCost)} color="#e0e8f0" />
              <StatCard icon="📈" label="Current Value" value={fmtINR(totalValue)} color="#00d4aa" />
              <StatCard icon={totalGain >= 0 ? "🟢" : "🔴"} label="Total Gain / Loss" value={fmtINR(totalGain)} sub={fmtPct(totalGainPct) + " overall"} color={totalGain >= 0 ? "#00d4aa" : "#ff6b6b"} />
              <StatCard icon="⚡" label="Portfolio XIRR" value={fmtPct(portfolioXirr)} color="#ffd93d" />
              <StatCard icon="🗂️" label="Holdings" value={`${holdings.length} assets`} color="#6c63ff" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { title: "🏭 Stocks & ETFs", items: stocks, color: "#00d4aa", emptyMsg: "No stocks or ETFs added yet" },
                { title: "🏦 Mutual Funds", items: mfs, color: "#6c63ff", emptyMsg: "No mutual funds added yet" },
                { title: "💼 Others (SGB, EPF, Bonds…)", items: others, color: "#ffd93d", emptyMsg: "No other assets added yet" },
              ].map(({ title, items, color, emptyMsg }) => (
                <div key={title} style={{ background: "#0d1530", border: "1px solid #1e2d45", borderRadius: 14, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                    <span style={{ fontSize: 11, color: "#4a6080" }}>{items.length} holdings</span>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: "#4a6080", marginBottom: 2 }}>Current Value</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color }}>{fmtINR(sectionValue(items))}</div>
                    <div style={{ fontSize: 12, color: sectionGain(items) >= 0 ? "#00d4aa" : "#ff6b6b" }}>
                      {sectionGain(items) >= 0 ? "▲" : "▼"} {fmtINR(Math.abs(sectionGain(items)))} gain
                    </div>
                  </div>
                  <div style={{ borderTop: "1px solid #1a2640", paddingTop: 12 }}>
                    {items.length === 0
                      ? <div style={{ color: "#3a5070", fontSize: 13 }}>{emptyMsg}</div>
                      : items.map(h => <HoldingMiniRow key={h.id} h={h} />)
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HOLDINGS ── */}
        {tab === "holdings" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              {[[filterBroker, setFilterBroker, ["All", ...BROKERS]], [filterType, setFilterType, ["All", ...ASSET_TYPES]], [filterCat, setFilterCat, ["All", ...CATEGORIES]]].map(([val, setter, opts], i) => (
                <select key={i} value={val} onChange={e => setter(e.target.value)}
                  style={{ background: "#0d1530", border: "1px solid #1e2d45", color: "#e0e8f0", padding: "7px 12px", borderRadius: 8, fontSize: 12 }}>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              ))}
              <label style={{ marginLeft: "auto", background: "#1e2d45", border: "1px solid #2e3d55", color: "#00d4aa", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                ↑ Import CSV <input type="file" accept=".csv" onChange={handleCSV} style={{ display: "none" }} />
              </label>
              <button onClick={handleExport} style={{ background: "#1e2d45", border: "1px solid #2e3d55", color: "#6c63ff", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>↓ Export CSV</button>
            </div>
            {csvError && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 10 }}>⚠ {csvError}</div>}
            <div style={{ fontSize: 11, color: "#3a5070", marginBottom: 12 }}>
              CSV columns: <code style={{ color: "#6c63ff" }}>name, ticker, assetType, category, broker, units, avgCost, currentPrice, buyDate, notes</code>
            </div>

            <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #1e2d45" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d1530" }}>
                <thead style={{ background: "#080d1a" }}>
                  <tr>
                    <SortTh label="Name" k="name" /><SortTh label="Type" k="assetType" /><SortTh label="Category" k="category" />
                    <SortTh label="Broker" k="broker" /><SortTh label="Units" k="units" /><SortTh label="Avg Cost" k="avgCost" />
                    <SortTh label="Cur. Price" k="currentPrice" /><SortTh label="Invested" k="cost" /><SortTh label="Value" k="value" />
                    <SortTh label="Gain/Loss" k="gain" /><SortTh label="Gain %" k="gainPct" /><SortTh label="XIRR" k="xirr" />
                    <th style={{ padding: "10px 14px", color: "#3a5070", fontSize: 11 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h, i) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #1a2640", background: i % 2 === 0 ? "#0d1530" : "#080d1a" }}>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{h.name}</div>
                        {h.ticker && <div style={{ fontSize: 11, color: "#3a5070" }}>{h.ticker}</div>}
                        {h.notes && <div style={{ fontSize: 11, color: "#6c63ff", marginTop: 2 }}>{h.notes}</div>}
                      </td>
                      <td style={{ padding: "11px 14px" }}><span style={{ background: "#1a2640", padding: "2px 8px", borderRadius: 20, fontSize: 11 }}>{h.assetType}</span></td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#8899aa" }}>{h.category}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#8899aa" }}>{h.broker}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>{h.units.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>₹{h.avgCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>₹{h.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>{fmtINR(h.cost)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "#00d4aa" }}>{fmtINR(h.value)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: h.gain >= 0 ? "#00d4aa" : "#ff6b6b" }}>{fmtINR(h.gain)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: h.gainPct >= 0 ? "#00d4aa" : "#ff6b6b" }}>{fmtPct(h.gainPct)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#ffd93d" }}>{fmtPct(h.xirr)}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleEdit(h)} style={{ background: "#1a2640", border: "none", color: "#6c63ff", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Edit</button>
                          <button onClick={() => handleDelete(h.id)} style={{ background: "#2d1520", border: "none", color: "#ff6b6b", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #2e3d55", background: "#080d1a" }}>
                    <td colSpan={7} style={{ padding: "12px 14px", fontWeight: 700, color: "#4a6080", fontSize: 12 }}>TOTAL — {filtered.length} holdings</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13 }}>{fmtINR(filtered.reduce((s, h) => s + h.cost, 0))}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: "#00d4aa" }}>{fmtINR(filtered.reduce((s, h) => s + h.value, 0))}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: filtered.reduce((s, h) => s + h.gain, 0) >= 0 ? "#00d4aa" : "#ff6b6b" }}>{fmtINR(filtered.reduce((s, h) => s + h.gain, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── CHARTS ── */}
        {tab === "charts" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "#0d1530", border: "1px solid #1e2d45", borderRadius: 14, padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 14 }}>📊 Allocation by Category</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" outerRadius={95} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtINR(v)} contentStyle={{ background: "#0a0f1e", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#0d1530", border: "1px solid #1e2d45", borderRadius: 14, padding: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 14 }}>🏦 Value by Broker</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={brokerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2640" />
                  <XAxis type="number" tick={{ fill: "#4a6080", fontSize: 11 }} tickFormatter={v => "₹" + (v / 1000).toFixed(0) + "k"} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#8899aa", fontSize: 11 }} width={90} />
                  <Tooltip formatter={v => fmtINR(v)} contentStyle={{ background: "#0a0f1e", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{brokerData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#0d1530", border: "1px solid #1e2d45", borderRadius: 14, padding: 24, gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 14 }}>📈 Gain / Loss per Holding</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={enriched.map(h => ({ name: h.name.length > 15 ? h.name.slice(0, 15) + "…" : h.name, gain: Math.round(h.gain) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2640" />
                  <XAxis dataKey="name" tick={{ fill: "#4a6080", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#4a6080", fontSize: 11 }} tickFormatter={v => fmtINR(v)} />
                  <Tooltip formatter={v => fmtINR(v)} contentStyle={{ background: "#0a0f1e", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="gain" radius={[4, 4, 0, 0]}>{enriched.map((h, i) => <Cell key={i} fill={h.gain >= 0 ? "#00d4aa" : "#ff6b6b"} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#0d1530", border: "1px solid #2e3d55", borderRadius: 18, padding: 28, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{editId ? "✏️ Edit Holding" : "➕ Add Holding"}</div>
            <div style={{ fontSize: 12, color: "#3a5070", marginBottom: 20 }}>Ticker is optional but needed for auto price refresh.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field k="name" label="Name *" type="text" full />
              <Field k="ticker" label="Ticker / Scheme Code" type="text" full />
              <Select k="assetType" label="Asset Type" opts={ASSET_TYPES} />
              <Select k="category" label="Category" opts={CATEGORIES} />
              <Select k="broker" label="Broker / Platform" opts={BROKERS} />
              <Field k="buyDate" label="Buy Date" type="date" />
              <Field k="units" label="Units / Quantity *" type="number" />
              <Field k="avgCost" label="Avg Buy Price (₹) *" type="number" />
              <Field k="currentPrice" label="Current Price (₹) *" type="number" />
              <Field k="notes" label="Notes" type="text" full />
            </div>

            <div style={{ marginTop: 16, background: "#080d1a", border: "1px solid #1a2640", borderRadius: 10, padding: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#4a6080", marginBottom: 8 }}>📌 Ticker Guide for Auto Price Refresh</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, color: "#8899aa", lineHeight: 1.8 }}>
                <div>🇮🇳 Indian Stock → <code style={{ color: "#00d4aa" }}>RELIANCE.NS</code></div>
                <div>🇮🇳 Indian MF → <code style={{ color: "#6c63ff" }}>118989</code> (MFAPI code)</div>
                <div>📦 ETF → <code style={{ color: "#ffd93d" }}>NIFTYBEES.NS</code></div>
                <div>🇺🇸 US Stock → <code style={{ color: "#4ecdc4" }}>AAPL</code></div>
                <div style={{ gridColumn: "1 / -1" }}>🥇 SGB / EPF / Bond → leave blank, update manually</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_HOLDING); }}
                style={{ background: "#1a2640", border: "none", color: "#8899aa", padding: "10px 22px", borderRadius: 9, cursor: "pointer", fontWeight: 700 }}>Cancel</button>
              <button onClick={handleSave} disabled={!form.name || !form.units || !form.avgCost}
                style={{ background: form.name && form.units && form.avgCost ? "linear-gradient(135deg, #6c63ff, #4ecdc4)" : "#1a2640", border: "none", color: "#fff", padding: "10px 26px", borderRadius: 9, cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
                {editId ? "Save Changes" : "Add Holding"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
