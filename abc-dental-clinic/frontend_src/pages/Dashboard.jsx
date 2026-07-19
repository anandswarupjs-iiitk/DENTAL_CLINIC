import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, TrendingUp, AlertCircle, CheckCircle, DollarSign, XCircle, Clock } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const fmtINR = (n) => `₹${Number(n||0).toLocaleString("en-IN", {maximumFractionDigits:0})}`;

function StatCard({ icon: Icon, label, value, color, i }) {
  return (
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay: i*0.05}}>
      <Card className="p-5 card-premium">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
            <div className="text-3xl font-extrabold mt-2" style={{fontFamily:"Manrope"}} data-testid={`stat-${label.toLowerCase().replace(/\s+/g,'-')}-value`}>{value}</div>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white"/>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

const CHART_COLORS = ["#1E3A8A","#0D9488","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#EC4899","#10B981","#F97316","#06B6D4"];

export default function Dashboard() {
  const { user, activeClinicId } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get("/dashboard/summary").then(r => setData(r.data)).catch(()=>{});
  }, [activeClinicId]);

  if (!data) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-28 rounded-2xl"/>)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold" style={{fontFamily:"Manrope"}}>Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, {user?.name}. Here's what's happening today.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard i={0} icon={Users} label="Total Patients" value={data.total_patients} color="bg-[#1E3A8A]"/>
        <StatCard i={1} icon={Calendar} label="Today's Appts" value={data.today_appointments} color="bg-[#0D9488]"/>
        <StatCard i={2} icon={Clock} label="Upcoming Appts" value={data.upcoming_appointments} color="bg-[#3B82F6]"/>
        <StatCard i={3} icon={CheckCircle} label="Completed Treatments" value={data.completed_treatments} color="bg-emerald-600"/>
        <StatCard i={4} icon={TrendingUp} label="Revenue Today" value={fmtINR(data.revenue_today)} color="bg-emerald-500"/>
        <StatCard i={5} icon={DollarSign} label="Revenue This Month" value={fmtINR(data.revenue_month)} color="bg-[#0D9488]"/>
        <StatCard i={6} icon={AlertCircle} label="Pending Payments" value={fmtINR(data.pending_payments)} color="bg-amber-500"/>
        <StatCard i={7} icon={XCircle} label="Cancelled Appts" value={data.cancelled_appointments} color="bg-rose-500"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 card-premium">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold" style={{fontFamily:"Manrope"}}>Revenue (Last 12 Months)</h3>
              <p className="text-sm text-slate-500">Payment collection trend</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase font-semibold">This Year</div>
              <div className="text-xl font-bold text-[#0D9488]">{fmtINR(data.revenue_year)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.revenue_chart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E3A8A" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5}/>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip contentStyle={{backdropFilter:"blur(12px)", background:"rgba(255,255,255,0.9)", border:"1px solid #E2E8F0", borderRadius:12}} />
              <Area type="monotone" dataKey="revenue" stroke="#1E3A8A" strokeWidth={2.5} fill="url(#revGrad)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 card-premium">
          <h3 className="text-lg font-bold mb-4" style={{fontFamily:"Manrope"}}>Top Procedures</h3>
          {data.procedure_stats.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No procedures yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.procedure_stats} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                  {data.procedure_stats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip/>
                <Legend wrapperStyle={{fontSize:11}}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 card-premium">
          <h3 className="text-lg font-bold mb-4" style={{fontFamily:"Manrope"}}>New Patients / Month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.patients_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5}/>
              <XAxis dataKey="month" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Bar dataKey="count" fill="#0D9488" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 card-premium">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{fontFamily:"Manrope"}}>Today's Schedule</h3>
            <Link to="/appointments" className="text-sm text-[#1E3A8A] dark:text-blue-400 hover:underline" data-testid="dashboard-view-appointments">View all</Link>
          </div>
          <div className="space-y-3 max-h-[220px] overflow-y-auto no-scrollbar">
            {data.today_schedule.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">No appointments today</div>}
            {data.today_schedule.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="w-14 text-center">
                  <div className="text-sm font-bold text-[#1E3A8A] dark:text-blue-400">{a.time}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.patient_name || "—"}</div>
                  <div className="text-xs text-slate-500 truncate">{a.reason || "No reason"}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                  a.status==="completed" ? "bg-emerald-100 text-emerald-700" :
                  a.status==="cancelled" ? "bg-rose-100 text-rose-700" :
                  "bg-blue-100 text-blue-700"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 card-premium">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{fontFamily:"Manrope"}}>Recent Patients</h3>
            <Link to="/patients" className="text-sm text-[#1E3A8A] dark:text-blue-400 hover:underline" data-testid="dashboard-view-patients">View all</Link>
          </div>
          <div className="space-y-2.5">
            {data.recent_patients.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">No patients yet</div>}
            {data.recent_patients.map(p => (
              <Link key={p.id} to={`/patients/${p.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" data-testid={`recent-patient-${p.id}`}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center text-white text-xs font-bold">
                  {p.full_name?.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.full_name}</div>
                  <div className="text-xs text-slate-500">{p.patient_id} · {p.phone}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
