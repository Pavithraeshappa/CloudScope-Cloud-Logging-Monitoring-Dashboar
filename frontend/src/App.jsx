import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = "http://localhost:5000/api";

const LEVEL_COLORS = {
  INFO:    { bg: "#0ea5e9", dim: "#0c4a6e" },
  WARNING: { bg: "#f59e0b", dim: "#78350f" },
  ERROR:   { bg: "#ef4444", dim: "#7f1d1d" },
  DEBUG:   { bg: "#8b5cf6", dim: "#4c1d95" },
};
const ALERT_COLORS = { CRITICAL:"#ef4444", WARNING:"#f59e0b", INFO:"#0ea5e9" };
const STATUS_COLORS = { SUCCESS:"#22c55e", FAILED:"#f59e0b", BLOCKED:"#ef4444" };

// ── UI Helpers ─────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:20, ...style }}>{children}</div>;
}
function CardTitle({ children }) {
  return <p style={{ margin:"0 0 14px", color:"#64748b", fontSize:11, letterSpacing:2, textTransform:"uppercase", fontFamily:"monospace", fontWeight:600 }}>{children}</p>;
}
function Badge({ level }) {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS.INFO;
  return <span style={{ background:c.dim, color:c.bg, border:`1px solid ${c.bg}`, borderRadius:4, padding:"1px 7px", fontSize:10, fontFamily:"monospace", fontWeight:700, minWidth:54, display:"inline-block", textAlign:"center" }}>{level}</span>;
}
function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return <span style={{ background:color+"22", color, border:`1px solid ${color}55`, borderRadius:4, padding:"1px 8px", fontSize:10, fontFamily:"monospace", fontWeight:700 }}>{status}</span>;
}
function Input({ label, type="text", value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11, color:"#64748b", marginBottom:5, fontFamily:"monospace", letterSpacing:1 }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width:"100%", background:"#020817", border:"1px solid #1e293b", borderRadius:8, padding:"11px 14px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"monospace", boxSizing:"border-box" }} />
    </div>
  );
}
function Btn({ children, onClick, color="#0ea5e9", disabled=false, full=true }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:full?"100%":"auto", padding:"12px 20px", borderRadius:8, border:"none",
      background: disabled ? "#1e293b" : `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: disabled ? "#475569" : "#fff", fontWeight:700, fontSize:14,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily:"monospace",
      letterSpacing:0.5, transition:"opacity 0.2s",
    }}>{children}</button>
  );
}
function Gauge({ value, label, color }) {
  const pct=Math.min(value/100,1), angle=pct*180, r=54, cx=70, cy=70;
  const toXY=deg=>({ x:cx+r*Math.cos((Math.PI*(180+deg))/180), y:cy+r*Math.sin((Math.PI*(180+deg))/180) });
  const end=toXY(angle), large=angle>180?1:0;
  return (
    <div style={{ textAlign:"center" }}>
      <svg width="140" height="90" viewBox="0 0 140 90">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"/>
        <text x={cx} y={cy+8} textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="700" fontFamily="monospace">{value}%</text>
      </svg>
      <p style={{ margin:0, color:"#94a3b8", fontSize:11, letterSpacing:2, textTransform:"uppercase", fontFamily:"monospace" }}>{label}</p>
    </div>
  );
}

// ── SIGNUP PAGE ────────────────────────────────────────────────────
function SignupPage({ onSwitch, onSuccess }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [msg, setMsg]           = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirm) return setMsg({ type:"error", text:"Please fill all fields!" });
    if (password !== confirm) return setMsg({ type:"error", text:"Passwords do not match!" });
    if (password.length < 6) return setMsg({ type:"error", text:"Password must be at least 6 characters!" });
    setLoading(true);
    try {
      const res  = await fetch(`${API}/signup`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (data.success) {
        setMsg({ type:"success", text:data.message });
        setTimeout(() => onSwitch(), 2000);
      } else {
        setMsg({ type:"error", text:data.message });
      }
    } catch { setMsg({ type:"error", text:"Cannot connect to server!" }); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#020817", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#0ea5e9,#6366f1)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:12 }}>☁</div>
          <h1 style={{ margin:0, color:"#f1f5f9", fontSize:24, fontWeight:800 }}>CloudScope</h1>
          <p style={{ margin:"4px 0 0", color:"#475569", fontSize:13 }}>Cloud Logging & Monitoring</p>
        </div>

        <Card>
          <h2 style={{ margin:"0 0 20px", color:"#f1f5f9", fontSize:18, fontWeight:700 }}>Create Account</h2>
          <Input label="FULL NAME"        value={name}     onChange={e=>setName(e.target.value)}     placeholder="Enter your name" />
          <Input label="EMAIL ADDRESS"    value={email}    onChange={e=>setEmail(e.target.value)}    placeholder="Enter your email" />
          <Input label="PASSWORD"         type="password"  value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" />
          <Input label="CONFIRM PASSWORD" type="password"  value={confirm}  onChange={e=>setConfirm(e.target.value)}  placeholder="Re-enter password" />

          {msg && (
            <div style={{ padding:"10px 14px", borderRadius:8, marginBottom:14, background:msg.type==="success"?"#22c55e18":"#ef444418", border:`1px solid ${msg.type==="success"?"#22c55e44":"#ef444444"}`, color:msg.type==="success"?"#22c55e":"#ef4444", fontSize:13, fontFamily:"monospace" }}>
              {msg.text}
            </div>
          )}

          <Btn onClick={handleSignup} disabled={loading}>{loading ? "Creating Account..." : "SIGN UP →"}</Btn>

          <p style={{ margin:"16px 0 0", textAlign:"center", color:"#475569", fontSize:13 }}>
            Already have an account?{" "}
            <span onClick={onSwitch} style={{ color:"#0ea5e9", cursor:"pointer", fontWeight:600 }}>Login here</span>
          </p>
        </Card>
      </div>
      <style>{`input::placeholder{color:#334155} *{box-sizing:border-box}`}</style>
    </div>
  );
}

// ── LOGIN PAGE ─────────────────────────────────────────────────────
function LoginPage({ onSwitch, onSuccess }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg]           = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return setMsg({ type:"error", text:"Please enter email and password!" });
    setLoading(true);
    try {
      const res  = await fetch(`${API}/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.success) {
        setMsg({ type:"success", text:data.message });
        setTimeout(() => onSuccess(data.user), 800);
      } else {
        setMsg({ type:"error", text:data.message, status:data.status });
      }
    } catch { setMsg({ type:"error", text:"Cannot connect to server. Is backend running?" }); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#020817", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:420 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#0ea5e9,#6366f1)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:12 }}>☁</div>
          <h1 style={{ margin:0, color:"#f1f5f9", fontSize:24, fontWeight:800 }}>CloudScope</h1>
          <p style={{ margin:"4px 0 0", color:"#475569", fontSize:13 }}>Cloud Logging & Monitoring</p>
        </div>

        <Card>
          <h2 style={{ margin:"0 0 20px", color:"#f1f5f9", fontSize:18, fontWeight:700 }}>Login to Dashboard</h2>

          <Input label="EMAIL ADDRESS" value={email}    onChange={e=>setEmail(e.target.value)}    placeholder="Enter your email" />
          <Input label="PASSWORD"      type="password"  value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" />

          {msg && (
            <div style={{ padding:"10px 14px", borderRadius:8, marginBottom:14, background:msg.type==="success"?"#22c55e18":msg.status==="BLOCKED"?"#ef444418":"#f59e0b18", border:`1px solid ${msg.type==="success"?"#22c55e44":msg.status==="BLOCKED"?"#ef444444":"#f59e0b44"}`, color:msg.type==="success"?"#22c55e":msg.status==="BLOCKED"?"#ef4444":"#f59e0b", fontSize:12, fontFamily:"monospace", lineHeight:1.6 }}>
              {msg.text}
            </div>
          )}

          <Btn onClick={handleLogin} disabled={loading}>
            {loading ? "Checking..." : "LOGIN →"}
          </Btn>

          <p style={{ margin:"16px 0 0", textAlign:"center", color:"#475569", fontSize:13 }}>
            Don't have an account?{" "}
            <span onClick={onSwitch} style={{ color:"#0ea5e9", cursor:"pointer", fontWeight:600 }}>Sign up here</span>
          </p>
        </Card>

        {/* Security note */}
        <p style={{ textAlign:"center", color:"#1e293b", fontSize:11, marginTop:16, fontFamily:"monospace" }}>
          3 wrong attempts = account blocked + email alert sent
        </p>
      </div>
      <style>{`input::placeholder{color:#334155} *{box-sizing:border-box}`}</style>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [tab, setTab]         = useState("overview");
  const [logs, setLogs]       = useState([]);
  const [metrics, setMetrics] = useState({ current:{}, history:[] });
  const [alerts, setAlerts]   = useState([]);
  const [health, setHealth]   = useState({});
  const [summary, setSummary] = useState({});
  const [users, setUsers]     = useState([]);
  const [history, setHistory] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [filter, setFilter]   = useState("ALL");
  const [search, setSearch]   = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [l,m,a,h,s,u,lh,b,el] = await Promise.all([
        fetch(`${API}/logs`).then(r=>r.json()),
        fetch(`${API}/metrics`).then(r=>r.json()),
        fetch(`${API}/alerts`).then(r=>r.json()),
        fetch(`${API}/health`).then(r=>r.json()),
        fetch(`${API}/summary`).then(r=>r.json()),
        fetch(`${API}/users`).then(r=>r.json()),
        fetch(`${API}/login/history`).then(r=>r.json()),
        fetch(`${API}/blocked-accounts`).then(r=>r.json()),
        fetch(`${API}/email-logs`).then(r=>r.json()),
      ]);
      setLogs(l.logs||[]);
      setMetrics(m);
      setAlerts(a.alerts||[]);
      setHealth(h);
      setSummary(s);
      setUsers(u.users||[]);
      setHistory(lh.history||[]);
      setBlocked(b.blocked||[]);
      setEmailLogs(el.email_logs||[]);
    } catch(e){ console.error(e); }
  }, []);

  useEffect(() => { fetchAll(); const id=setInterval(fetchAll,1500); return()=>clearInterval(id); }, [fetchAll]);

  const resolveAlert = async(id) => { await fetch(`${API}/alerts/${id}/resolve`,{method:"POST"}); fetchAll(); };
  const unblockAccount = async(email) => { await fetch(`${API}/unblock/${email}`,{method:"POST"}); fetchAll(); };

  const filteredLogs = logs.filter(l=>(filter==="ALL"||l.level===filter)&&(search===""||l.message.toLowerCase().includes(search.toLowerCase())||l.service.toLowerCase().includes(search.toLowerCase())));
  const cur=metrics.current||{};
  const hist=[...(metrics.history||[])].reverse();
  const lc=summary.log_counts||{};
  const activeAlerts=alerts.filter(a=>!a.resolved);
  const healthStatus=health.status||"HEALTHY";
  const healthColor=healthStatus==="HEALTHY"?"#22c55e":healthStatus==="WARNING"?"#f59e0b":"#ef4444";

  const navItems=[
    {id:"overview", label:"Overview",   icon:"⬡"},
    {id:"security", label:"Security",   icon:"🔐", badge:blocked.filter(b=>b.active).length},
    {id:"logs",     label:"Live Logs",  icon:"≡"},
    {id:"metrics",  label:"Metrics",    icon:"∿"},
    {id:"alerts",   label:"Alerts",     icon:"⚠", badge:activeAlerts.length},
    {id:"services", label:"Services",   icon:"◈"},
    {id:"emails",   label:"Emails",     icon:"📧"},
  ];

  return (
    <div style={{ display:"flex", height:"100vh", background:"#020817", color:"#e2e8f0", fontFamily:"'Inter','Segoe UI',sans-serif", overflow:"hidden" }}>

      {/* Sidebar */}
      <aside style={{ width:220, background:"#080f1f", borderRight:"1px solid #1e293b", display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 }}>
        <div style={{ padding:"0 20px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:"linear-gradient(135deg,#0ea5e9,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>☁</div>
            <div>
              <p style={{ margin:0, fontWeight:800, fontSize:14, color:"#f1f5f9" }}>CloudScope</p>
              <p style={{ margin:0, fontSize:10, color:"#334155", letterSpacing:1, textTransform:"uppercase" }}>Monitor</p>
            </div>
          </div>
          {/* Health */}
          <div style={{ marginTop:12, padding:"4px 10px", borderRadius:20, background:`${healthColor}18`, border:`1px solid ${healthColor}40`, display:"inline-flex", alignItems:"center", gap:6 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:healthColor, boxShadow:`0 0 8px ${healthColor}` }}/>
            <span style={{ fontSize:11, color:healthColor, fontFamily:"monospace", fontWeight:700 }}>{healthStatus}</span>
          </div>
          {/* User */}
          <div style={{ marginTop:12, padding:"8px 10px", borderRadius:8, background:"#1e293b" }}>
            <p style={{ margin:0, color:"#0ea5e9", fontSize:11, fontFamily:"monospace" }}>👤 {user.name}</p>
            <p style={{ margin:"2px 0 0", color:"#334155", fontSize:10, fontFamily:"monospace" }}>{user.email}</p>
          </div>
        </div>

        <nav style={{ flex:1 }}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              width:"100%", textAlign:"left", background:tab===n.id?"#0f172a":"transparent",
              border:"none", borderLeft:tab===n.id?"2px solid #0ea5e9":"2px solid transparent",
              color:tab===n.id?"#e2e8f0":"#475569", cursor:"pointer", padding:"11px 20px",
              display:"flex", alignItems:"center", gap:10, fontSize:13,
              fontWeight:tab===n.id?600:400, transition:"all 0.15s",
            }}>
              <span style={{ fontSize:16 }}>{n.icon}</span>
              {n.label}
              {n.badge>0&&<span style={{ marginLeft:"auto", background:"#ef4444", color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding:"12px 20px", borderTop:"1px solid #1e293b" }}>
          <button onClick={onLogout} style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", color:"#94a3b8", borderRadius:8, padding:"8px", cursor:"pointer", fontSize:12, fontFamily:"monospace" }}>
            Logout
          </button>
          <p style={{ margin:"8px 0 0", fontSize:10, color:"#1e293b", fontFamily:"monospace" }}>MMC452 · RVITM</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:"auto", padding:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:"#f1f5f9" }}>{navItems.find(n=>n.id===tab)?.label}</h1>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#475569" }}>Real-time cloud observability dashboard</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px #22c55e", display:"inline-block" }}/>
            <span style={{ fontSize:12, color:"#22c55e", fontFamily:"monospace" }}>LIVE</span>
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
              {[["Total Logs",logs.length,"#0ea5e9","Last 200"],["Active Alerts",activeAlerts.length,"#ef4444","Unresolved"],["Total Users",health.total_users||0,"#22c55e","Registered"],["Req/sec",cur.requests_per_sec||0,"#a855f7","Live"]].map(([label,value,color,sub])=>(
                <Card key={label}>
                  <p style={{ margin:"0 0 4px", color:"#475569", fontSize:11, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"monospace" }}>{label}</p>
                  <p style={{ margin:"0 0 2px", color, fontSize:28, fontWeight:800, fontFamily:"monospace" }}>{value}</p>
                  <p style={{ margin:0, color:"#475569", fontSize:11 }}>{sub}</p>
                </Card>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:16, marginBottom:20 }}>
              <Card style={{ display:"flex", gap:24, alignItems:"center", padding:"20px 28px" }}>
                <Gauge value={cur.cpu||0}    label="CPU"    color="#0ea5e9"/>
                <Gauge value={cur.memory||0} label="Memory" color="#a855f7"/>
                <Gauge value={cur.disk||0}   label="Disk"   color="#f59e0b"/>
              </Card>
              <Card>
                <CardTitle>CPU & Memory — Last 20s</CardTitle>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={hist} margin={{top:5,right:5,left:-20,bottom:0}}>
                    <defs>
                      <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                    <XAxis dataKey="timestamp" tick={{fill:"#334155",fontSize:10}}/>
                    <YAxis domain={[0,100]} tick={{fill:"#334155",fontSize:10}}/>
                    <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,fontSize:12}}/>
                    <Area type="monotone" dataKey="cpu"    stroke="#0ea5e9" fill="url(#gC)" strokeWidth={2} name="CPU %"/>
                    <Area type="monotone" dataKey="memory" stroke="#a855f7" fill="url(#gM)" strokeWidth={2} name="Memory %"/>
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:16 }}>
              <Card>
                <CardTitle>Log Breakdown</CardTitle>
                {Object.entries(lc).map(([level,count])=>(
                  <div key={level} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <Badge level={level}/>
                      <span style={{ fontSize:12, color:"#94a3b8", fontFamily:"monospace" }}>{count}</span>
                    </div>
                    <div style={{ height:4, background:"#1e293b", borderRadius:2 }}>
                      <div style={{ height:4, borderRadius:2, background:LEVEL_COLORS[level]?.bg||"#0ea5e9", width:`${Math.min((count/(logs.length||1))*100,100)}%`, transition:"width 0.5s" }}/>
                    </div>
                  </div>
                ))}
              </Card>
              <Card>
                <CardTitle>Recent Logs</CardTitle>
                <div style={{ maxHeight:200, overflowY:"auto" }}>
                  {logs.slice(0,8).map(log=>(
                    <div key={log.id} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom:"1px solid #0f172a", fontSize:12 }}>
                      <Badge level={log.level}/>
                      <span style={{ color:"#0ea5e9", fontFamily:"monospace", flexShrink:0 }}>[{log.service}]</span>
                      <span style={{ color:"#94a3b8", flex:1 }}>{log.message}</span>
                      <span style={{ color:"#334155", fontFamily:"monospace", flexShrink:0, fontSize:10 }}>{log.timestamp.slice(11)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab==="security"&&(
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {/* Registered Users */}
            <Card>
              <CardTitle>Registered Users ({users.length})</CardTitle>
              {users.length===0?<p style={{ color:"#334155", fontSize:12, fontFamily:"monospace" }}>No users registered yet.</p>:
                users.map((u,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1e293b", fontSize:12 }}>
                    <div>
                      <p style={{ margin:0, color:"#e2e8f0", fontWeight:600 }}>{u.name}</p>
                      <p style={{ margin:"2px 0 0", color:"#0ea5e9", fontFamily:"monospace", fontSize:11 }}>{u.email}</p>
                    </div>
                    <span style={{ color:"#334155", fontSize:10, fontFamily:"monospace" }}>{u.created_at.slice(11)}</span>
                  </div>
                ))
              }
            </Card>

            {/* Blocked Accounts */}
            <Card>
              <CardTitle>Blocked Accounts (Admin Panel)</CardTitle>
              {blocked.filter(b=>b.active).length===0?
                <p style={{ color:"#22c55e", fontSize:12, fontFamily:"monospace" }}>✅ No accounts currently blocked</p>:
                blocked.filter(b=>b.active).map((b,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:8, marginBottom:8, background:"#ef444411", border:"1px solid #ef444433" }}>
                    <span style={{ fontSize:20 }}>🚫</span>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, color:"#ef4444", fontFamily:"monospace", fontWeight:700, fontSize:13 }}>{b.name}</p>
                      <p style={{ margin:"2px 0 0", color:"#64748b", fontSize:11 }}>{b.email} | Blocked at: {b.blocked_at}</p>
                      <p style={{ margin:"2px 0 0", color:"#ef4444", fontSize:11, fontWeight:600 }}>⚠️ Permanently blocked — only admin can unblock</p>
                    </div>
                    <button onClick={()=>unblockAccount(b.email)} style={{ background:"#22c55e22", border:"1px solid #22c55e55", color:"#22c55e", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}>Unblock</button>
                  </div>
                ))
              }
            </Card>

            {/* Login History */}
            <Card style={{ gridColumn:"1/-1" }}>
              <CardTitle>Login Attempt History</CardTitle>
              {history.length===0?<p style={{ color:"#334155", fontSize:12, fontFamily:"monospace" }}>No login attempts yet.</p>:
                <div style={{ maxHeight:300, overflowY:"auto" }}>
                  {history.map((h,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"100px 80px 120px 150px 1fr", gap:8, padding:"8px 0", borderBottom:"1px solid #0a0f1e", alignItems:"center", fontSize:12 }}>
                      <span style={{ color:"#334155", fontFamily:"monospace", fontSize:10 }}>{h.timestamp.slice(11)}</span>
                      <StatusBadge status={h.status}/>
                      <span style={{ color:"#e2e8f0", fontWeight:600 }}>{h.name}</span>
                      <span style={{ color:"#0ea5e9", fontFamily:"monospace", fontSize:11 }}>{h.email}</span>
                      <span style={{ color:"#475569" }}>{h.message}</span>
                    </div>
                  ))}
                </div>
              }
            </Card>
          </div>
        )}

        {/* ── LIVE LOGS ── */}
        {tab==="logs"&&(
          <div>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs..."
                style={{ flex:1, background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"9px 14px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"monospace" }}/>
              {["ALL","INFO","WARNING","ERROR","DEBUG"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?(LEVEL_COLORS[f]?.dim||"#1e293b"):"#0f172a", border:`1px solid ${filter===f?(LEVEL_COLORS[f]?.bg||"#0ea5e9"):"#1e293b"}`, color:filter===f?(LEVEL_COLORS[f]?.bg||"#e2e8f0"):"#475569", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:11, fontFamily:"monospace", fontWeight:700 }}>{f}</button>
              ))}
            </div>
            <Card style={{ padding:0 }}>
              <div style={{ display:"grid", gridTemplateColumns:"60px 80px 130px 160px 1fr", padding:"10px 16px", borderBottom:"1px solid #1e293b", color:"#334155", fontSize:10, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"monospace" }}>
                <span>ID</span><span>Level</span><span>Time</span><span>Service</span><span>Message</span>
              </div>
              <div style={{ maxHeight:"calc(100vh - 260px)", overflowY:"auto" }}>
                {filteredLogs.map((log,i)=>(
                  <div key={log.id} style={{ display:"grid", gridTemplateColumns:"60px 80px 130px 160px 1fr", padding:"9px 16px", borderBottom:"1px solid #0a0f1e", background:i%2===0?"transparent":"#0a0f1e", alignItems:"center", fontSize:12 }}>
                    <span style={{ color:"#334155", fontFamily:"monospace" }}>#{log.id}</span>
                    <Badge level={log.level}/>
                    <span style={{ color:"#475569", fontFamily:"monospace", fontSize:11 }}>{log.timestamp.slice(11)}</span>
                    <span style={{ color:"#0ea5e9", fontFamily:"monospace" }}>{log.service}</span>
                    <span style={{ color:"#94a3b8" }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── METRICS ── */}
        {tab==="metrics"&&(
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {[["Requests Per Second","requests_per_sec","#22c55e","gR",[0,400]],["Error Rate (%)","error_rate","#ef4444","gE",[0,20]],["CPU Usage (%)","cpu","#0ea5e9","gU",[0,100]],["Memory Usage (%)","memory","#a855f7","gV",[0,100]]].map(([title,key,color,gid,domain])=>(
              <Card key={title}>
                <CardTitle>{title}</CardTitle>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={hist}>
                    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                    <XAxis dataKey="timestamp" tick={{fill:"#334155",fontSize:10}}/>
                    <YAxis domain={domain} tick={{fill:"#334155",fontSize:10}}/>
                    <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,fontSize:12}}/>
                    <Area type="monotone" dataKey={key} stroke={color} fill={`url(#${gid})`} strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            ))}
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab==="alerts"&&(
          alerts.length===0?
          <Card style={{ textAlign:"center", padding:60 }}>
            <p style={{ color:"#22c55e", fontSize:32 }}>✓</p>
            <p style={{ color:"#22c55e", fontFamily:"monospace" }}>No alerts — system healthy</p>
          </Card>:
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {alerts.map(alert=>(
              <div key={alert.id} style={{ background:"#0f172a", border:`1px solid ${alert.resolved?"#1e293b":ALERT_COLORS[alert.type]+"55"}`, borderLeft:`4px solid ${alert.resolved?"#334155":ALERT_COLORS[alert.type]}`, borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, opacity:alert.resolved?0.5:1 }}>
                <span style={{ fontSize:20 }}>{alert.type==="CRITICAL"?"🔴":alert.type==="WARNING"?"🟡":"🔵"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontWeight:700, color:"#f1f5f9", fontSize:13 }}>{alert.title}</span>
                    <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:700, color:ALERT_COLORS[alert.type], background:ALERT_COLORS[alert.type]+"22", padding:"1px 7px", borderRadius:4 }}>{alert.type}</span>
                    {alert.resolved&&<span style={{ fontSize:10, color:"#22c55e", fontFamily:"monospace" }}>✓ RESOLVED</span>}
                  </div>
                  <p style={{ margin:0, color:"#64748b", fontSize:12 }}>{alert.message}</p>
                  <p style={{ margin:"4px 0 0", color:"#334155", fontSize:10, fontFamily:"monospace" }}>{alert.timestamp}</p>
                </div>
                {!alert.resolved&&<button onClick={()=>resolveAlert(alert.id)} style={{ background:"#1e293b", border:"1px solid #334155", color:"#94a3b8", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:12 }}>Resolve</button>}
              </div>
            ))}
          </div>
        )}

        {/* ── SERVICES ── */}
        {tab==="services"&&(
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {Object.entries(health.services||{}).map(([name,status])=>(
              <Card key={name}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:status==="UP"?"#22c55e":"#f59e0b", boxShadow:`0 0 6px ${status==="UP"?"#22c55e":"#f59e0b"}`, display:"inline-block" }}/>
                  <span style={{ fontSize:10, fontFamily:"monospace", fontWeight:700, color:status==="UP"?"#22c55e":"#f59e0b", background:status==="UP"?"#22c55e22":"#f59e0b22", padding:"2px 8px", borderRadius:4 }}>{status}</span>
                </div>
                <p style={{ margin:0, fontWeight:700, color:"#e2e8f0", fontSize:14 }}>{name}</p>
                <p style={{ margin:"4px 0 0", color:"#475569", fontSize:11 }}>Uptime: {health.uptime||"99.98%"}</p>
                <div style={{ marginTop:12, height:3, background:"#1e293b", borderRadius:2 }}>
                  <div style={{ height:3, borderRadius:2, background:status==="UP"?"#22c55e":"#f59e0b", width:status==="UP"?"98%":"72%" }}/>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── EMAILS ── */}
        {tab==="emails"&&(
          <Card>
            <CardTitle>Email Notification Logs</CardTitle>
            {emailLogs.length===0?
              <p style={{ color:"#334155", fontSize:12, fontFamily:"monospace" }}>No emails sent yet. Try logging in with wrong password!</p>:
              emailLogs.map((e,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"130px 200px 1fr 80px", gap:8, padding:"9px 0", borderBottom:"1px solid #1e293b", alignItems:"center", fontSize:12 }}>
                  <span style={{ color:"#334155", fontFamily:"monospace", fontSize:10 }}>{e.timestamp.slice(11)}</span>
                  <span style={{ color:"#0ea5e9", fontFamily:"monospace", fontSize:11 }}>{e.to}</span>
                  <span style={{ color:"#94a3b8" }}>{e.subject}</span>
                  <span style={{ color:e.status==="SENT"?"#22c55e":"#ef4444", fontFamily:"monospace", fontWeight:700, fontSize:11 }}>{e.status}</span>
                </div>
              ))
            }
          </Card>
        )}

      </main>
      <style>{`::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#020817} ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px} *{box-sizing:border-box} input::placeholder{color:#334155}`}</style>
    </div>
  );
}

// ── ROOT APP ───────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]   = useState("login"); // login | signup
  const [user, setUser]   = useState(null);

  if (user) return <Dashboard user={user} onLogout={()=>setUser(null)}/>;
  if (page==="signup") return <SignupPage onSwitch={()=>setPage("login")} onSuccess={()=>setPage("login")}/>;
  return <LoginPage onSwitch={()=>setPage("signup")} onSuccess={(u)=>setUser(u)}/>;
}