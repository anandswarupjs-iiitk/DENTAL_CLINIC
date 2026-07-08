import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [rows, setRows] = useState([]);

  const load = async () => { const {data} = await api.get("/notifications"); setRows(data); };
  useEffect(() => { load(); }, []);

  const markAll = async () => { await api.post("/notifications/mark-all-read"); toast.success("Marked all as read"); load(); };
  const markOne = async (id) => { await api.patch(`/notifications/${id}/read`); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Notifications</h1><p className="text-slate-500 text-sm mt-1">Alerts, reminders and clinic activity</p></div>
        {rows.length > 0 && <Button variant="outline" onClick={markAll} data-testid="notif-mark-all"><CheckCheck size={14} className="mr-1"/>Mark all read</Button>}
      </div>
      <div className="space-y-3">
        {rows.length === 0 && (
          <Card className="card-premium p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40"/>
            <div className="text-slate-500">You're all caught up!</div>
          </Card>
        )}
        {rows.map(n => (
          <Card key={n.id} className={`card-premium p-5 ${n.read ? "opacity-70" : ""}`} data-testid={`notif-${n.id}`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                n.type==="danger"?"bg-rose-100 text-rose-600":
                n.type==="warning"?"bg-amber-100 text-amber-600":
                n.type==="success"?"bg-emerald-100 text-emerald-600":"bg-blue-100 text-blue-600"
              }`}><Bell size={18}/></div>
              <div className="flex-1">
                <div className="font-bold">{n.title}</div>
                <div className="text-sm text-slate-500 mt-1">{n.message}</div>
                <div className="text-xs text-slate-400 mt-2">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <button onClick={()=>markOne(n.id)} className="text-xs text-[#1E3A8A] hover:underline font-semibold">Mark read</button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
