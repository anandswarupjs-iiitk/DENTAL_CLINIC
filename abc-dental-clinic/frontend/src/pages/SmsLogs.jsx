import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR = {
  simulated: "bg-slate-100 text-slate-700",
  queued: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

export default function SmsLogs() {
  const [logs, setLogs] = useState(null);

  const load = async () => { const {data} = await api.get("/email/logs?limit=200"); setLogs(data); };
  useEffect(() => { load(); }, []);

  const sendTomorrow = async () => {
    try { const r = await api.post("/reminders/send-tomorrow"); toast.success(`Sent ${r.data.sent}/${r.data.total} for ${r.data.date}`); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Email Reminders</h1><p className="text-slate-500 text-sm mt-1">Delivery logs & manual trigger. Auto-scheduler runs daily at 20:00 IST.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} data-testid="sms-refresh"><RefreshCw size={14} className="mr-1"/>Refresh</Button>
          <Button onClick={sendTomorrow} data-testid="sms-send-tomorrow" className="bg-[#0D9488] hover:bg-[#0F766E]"><Send size={14} className="mr-1"/>Send Tomorrow's Reminders</Button>
        </div>
      </div>

      {logs && logs.length > 0 && logs.some(l => l.status === "simulated") && (
        <Card className="card-premium p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <b>SMTP credentials not configured.</b> Emails running in simulated mode. Add <code>EMAIL_HOST</code>, <code>EMAIL_PORT</code>, <code>EMAIL_USER</code>, <code>EMAIL_PASS</code>, <code>EMAIL_FROM</code> to <code>backend/.env</code> and restart backend to enable real email.
          </div>
        </Card>
      )}

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-6 py-3">When</th>
                <th className="text-left px-6 py-3">To</th>
                <th className="text-left px-6 py-3">Subject</th>
                <th className="text-center px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs && logs.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-slate-500"><Mail className="w-10 h-10 mx-auto mb-2 opacity-40"/>No emails sent yet</td></tr>}
              {logs && logs.map(l => (
                <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800" data-testid={`sms-log-${l.id}`}>
                  <td className="px-6 py-3 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-6 py-3 font-mono text-xs">{l.to}</td>
                  <td className="px-6 py-3 max-w-md truncate">{l.subject}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge className={`capitalize ${STATUS_COLOR[l.status] || "bg-slate-100 text-slate-700"}`}>{l.status}</Badge>
                    {l.error && <div className="text-[10px] text-rose-600 mt-1">{l.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
