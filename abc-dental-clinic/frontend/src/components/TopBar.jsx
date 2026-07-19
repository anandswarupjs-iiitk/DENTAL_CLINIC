import { useEffect, useState } from "react";
import { Menu, Sun, Moon, Search, Bell } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api/client";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TopBar({ onOpenSidebar }) {
  const { theme, toggle } = useTheme();
  const { user, logout, activeClinicId, setActiveClinicId } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [clinics, setClinics] = useState([]);
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    if (user?.role === "admin") {
      api.get("/clinics").then(r => setClinics(r.data)).catch(()=>{});
    }
  }, [user]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q || q.length < 2) { setRes(null); return; }
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setRes(data);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api.get("/notifications").then(r => setNotifs(r.data)).catch(()=>{});
  }, []);

  return (
    <header className="sticky top-0 z-30 glass border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3 px-4 md:px-8 h-16">
        <button onClick={onOpenSidebar} data-testid="topbar-open-sidebar" className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <Menu size={20}/>
        </button>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients, invoices, appointments…"
            className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
          />
          {res && (q.length >= 2) && (
            <div className="absolute mt-2 w-full glass rounded-xl shadow-xl overflow-hidden">
              {["patients","invoices","appointments"].map((k)=> (
                res[k]?.length > 0 && (
                  <div key={k} className="p-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-1">{k}</div>
                    {res[k].slice(0,5).map((it) => (
                      <button key={it.id} data-testid={`search-result-${k}-${it.id}`}
                        onClick={()=>{
                          setQ(""); setRes(null);
                          if (k==="patients") nav(`/patients/${it.id}`);
                          if (k==="invoices") nav(`/invoices`);
                          if (k==="appointments") nav(`/appointments`);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
                        {it.full_name || it.invoice_number || `${it.date} · ${it.time}`}
                      </button>
                    ))}
                  </div>
                )
              ))}
              {(!res.patients?.length && !res.invoices?.length && !res.appointments?.length) && (
                <div className="p-4 text-sm text-slate-500">No results</div>
              )}
            </div>
          )}
        </div>

        {user?.role === "admin" && (
          <div className="w-56 mr-2">
            <Select value={activeClinicId || "global"} onValueChange={(val) => setActiveClinicId(val === "global" ? "" : val)}>
              <SelectTrigger data-testid="topbar-clinic-select" className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectValue placeholder="All Clinics (Global)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">All Clinics (Global)</SelectItem>
                {clinics.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <button onClick={toggle} data-testid="theme-toggle" className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
        </button>

        <Link to="/notifications" className="relative p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="topbar-notifications-btn">
          <Bell size={18}/>
          {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"/>}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="topbar-user-menu" className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] text-white text-xs font-bold">
                  {(user?.name || user?.email || "?").slice(0,2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-sm font-semibold leading-tight">{user?.name}</div>
                <div className="text-xs text-slate-500 capitalize">{user?.role}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator/>
            <DropdownMenuItem onClick={()=>nav("/profile")} data-testid="menu-profile">Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={()=>nav("/settings")} data-testid="menu-settings">Settings</DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuItem onClick={async()=>{await logout(); nav("/login");}} data-testid="menu-logout">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
