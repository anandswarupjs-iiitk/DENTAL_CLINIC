import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Calendar, Stethoscope, FileText, Receipt,
  CreditCard, UserCog, BarChart3, Bell, Settings, User, LogOut, Activity, MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin","doctor","receptionist"] },
  { to: "/patients", icon: Users, label: "Patients", roles: ["admin","doctor","receptionist"] },
  { to: "/appointments", icon: Calendar, label: "Appointments", roles: ["admin","doctor","receptionist"] },
  { to: "/treatments", icon: Stethoscope, label: "Treatments", roles: ["admin","doctor","receptionist"] },
  { to: "/invoices", icon: FileText, label: "Invoices", roles: ["admin","receptionist"] },
  { to: "/payments", icon: CreditCard, label: "Payments", roles: ["admin","receptionist"] },
  { to: "/doctors", icon: UserCog, label: "Doctors", roles: ["admin"] },
  { to: "/reports", icon: BarChart3, label: "Reports", roles: ["admin","doctor"] },
  { to: "/notifications", icon: Bell, label: "Notifications", roles: ["admin","doctor","receptionist"] },
  { to: "/sms", icon: MessageSquare, label: "Email Reminders", roles: ["admin","receptionist"] },
  { to: "/settings", icon: Settings, label: "Settings", roles: ["admin"] },
  { to: "/profile", icon: User, label: "Profile", roles: ["admin","doctor","receptionist"] },
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => { await logout(); nav("/login"); };

  return (
    <aside className="h-full w-64 shrink-0 flex flex-col glass border-r border-slate-200 dark:border-slate-800">
      <div className="px-6 py-6 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight" style={{fontFamily:"Manrope"}}>ABC Dental</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Clinic Suite</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-1">
        {items.filter(i => !i.roles || i.roles.includes(user?.role)).map((item, idx) => (
          <motion.div key={item.to} initial={{opacity:0, x:-6}} animate={{opacity:1, x:0}} transition={{delay: idx*0.03}}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({isActive}) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#1E3A8A] text-white shadow-md dark:bg-blue-600"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5" size={18} />
              <span>{item.label}</span>
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70">
        <button
          onClick={handleLogout}
          data-testid="sidebar-logout-btn"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
