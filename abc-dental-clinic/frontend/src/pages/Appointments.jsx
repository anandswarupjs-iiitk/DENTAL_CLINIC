import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  booked: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  no_show: "bg-slate-100 text-slate-700 border-slate-200",
  rescheduled: "bg-amber-100 text-amber-700 border-amber-200",
};

const emptyAppt = { patient_id: "", date: "", time: "09:00", reason: "", status: "booked", notes: "" };
const RESCHEDULE_REASONS = [
  { key: "doctor_unavailable", label: "Doctor unavailable" },
  { key: "specialist_different", label: "Different specialist required" },
  { key: "patient_not_available", label: "Patient not available at earlier time" },
];

export default function Appointments() {
  const [appts, setAppts] = useState(null);
  const [patients, setPatients] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAppt);
  const [refDate, setRefDate] = useState(new Date());
  const [view, setView] = useState("day");
  const [reasonModal, setReasonModal] = useState(null); // appt object to send SMS for
  const [reasonPick, setReasonPick] = useState("");

  const load = async () => {
    // window depending on view
    const start = new Date(refDate); start.setHours(0,0,0,0);
    let end = new Date(start);
    if (view === "day") end = start;
    else if (view === "week") { start.setDate(start.getDate() - start.getDay()); end = new Date(start); end.setDate(end.getDate()+6); }
    else if (view === "month") { start.setDate(1); end = new Date(start); end.setMonth(end.getMonth()+1); end.setDate(0); }
    const f = start.toISOString().slice(0,10), t = end.toISOString().slice(0,10);
    const { data } = await api.get(`/appointments?date_from=${f}&date_to=${t}`);
    setAppts(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [refDate, view]);
  useEffect(() => { api.get("/patients?limit=500").then(r => setPatients(r.data.items)).catch(()=>{}); }, []);

  const openNew = () => { setEditing(null); setForm({...emptyAppt, date: refDate.toISOString().slice(0,10)}); setOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({patient_id:a.patient_id, date:a.date, time:a.time, reason:a.reason||"", status:a.status, notes:a.notes||""}); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        // Detect date/time change → use reschedule endpoint so we can prompt for SMS
        const changed = editing.date !== form.date || editing.time !== form.time;
        if (changed) {
          await api.post(`/appointments/${editing.id}/reschedule`, { date: form.date, time: form.time });
          // preserve other edits
          await api.put(`/appointments/${editing.id}`, form);
          toast.success("Rescheduled. Send email to inform patient →");
          setOpen(false);
          // Auto-open reason picker
          const updated = { ...editing, ...form, status: "rescheduled" };
          setReasonModal(updated); setReasonPick("");
        } else {
          await api.put(`/appointments/${editing.id}`, form);
          toast.success("Saved"); setOpen(false);
        }
      } else {
        await api.post("/appointments", form);
        toast.success("Booked"); setOpen(false);
      }
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const setStatus = async (a, s) => {
    await api.patch(`/appointments/${a.id}/status?status=${s}`);
    toast.success("Status updated"); load();
  };
  const sendRescheduleSms = async () => {
    if (!reasonPick) return toast.error("Please select a reason (required)");
    try {
      await api.post(`/appointments/${reasonModal.id}/send-reschedule-sms`, { reason: reasonPick });
      toast.success("SMS sent to patient with the reason");
      setReasonModal(null); setReasonPick(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const shift = (dir) => {
    const d = new Date(refDate);
    if (view==="day") d.setDate(d.getDate()+dir);
    else if (view==="week") d.setDate(d.getDate()+7*dir);
    else d.setMonth(d.getMonth()+dir);
    setRefDate(d);
  };

  const byDay = useMemo(() => {
    const m = new Map();
    (appts||[]).forEach(a => { if (!m.has(a.date)) m.set(a.date, []); m.get(a.date).push(a); });
    return m;
  }, [appts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">Schedule and manage patient bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>shift(-1)} data-testid="appt-prev"><ChevronLeft size={16}/></Button>
          <Button variant="outline" onClick={()=>setRefDate(new Date())} data-testid="appt-today">Today</Button>
          <Button variant="outline" onClick={()=>shift(1)} data-testid="appt-next"><ChevronRight size={16}/></Button>
          <Button variant="outline" data-testid="appt-send-tomorrow" onClick={async()=>{
            try {
              const r = await api.post("/reminders/send-tomorrow");
              toast.success(`Sent ${r.data.sent}/${r.data.total} reminders for ${r.data.date}`);
            } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
          }} className="hidden md:inline-flex">✉️ Send Tomorrow's Emails</Button>
          <Button onClick={openNew} data-testid="appt-new" className="bg-[#1E3A8A] hover:bg-[#1E40AF]"><Plus size={16} className="mr-1"/>New</Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList data-testid="appt-view-tabs">
          <TabsTrigger value="day" data-testid="appt-view-day">Day</TabsTrigger>
          <TabsTrigger value="week" data-testid="appt-view-week">Week</TabsTrigger>
          <TabsTrigger value="month" data-testid="appt-view-month">Month</TabsTrigger>
        </TabsList>
        <TabsContent value={view}>
          <Card className="card-premium p-4 md:p-6 mt-3">
            <div className="text-sm font-semibold text-slate-500 mb-4">
              {view==="day" && refDate.toDateString()}
              {view==="week" && `Week of ${refDate.toDateString()}`}
              {view==="month" && refDate.toLocaleDateString(undefined,{month:"long",year:"numeric"})}
            </div>
            {appts === null && <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>}
            {appts && appts.length === 0 && <div className="text-sm text-slate-500 py-12 text-center">No appointments in this range</div>}
            <div className="space-y-4">
              {[...byDay.entries()].map(([day, list]) => (
                <div key={day}>
                  <div className="text-xs font-semibold text-[#1E3A8A] dark:text-blue-400 uppercase tracking-wider mb-2">{day}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map(a => (
                      <div key={a.id} className={`p-4 rounded-xl border ${STATUS_COLORS[a.status] || "bg-slate-50 border-slate-200"} dark:bg-slate-800 dark:border-slate-700`} data-testid={`appt-card-${a.id}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-lg">{a.time}</div>
                          <div className="flex items-center gap-1.5">
                            {a.reminder_sent_at && (
                              <span title={`Email sent ${new Date(a.reminder_sent_at).toLocaleString()}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                data-testid={`appt-reminder-badge-${a.id}`}>
                                <Check size={9}/> Email
                              </span>
                            )}
                            <Badge className="capitalize text-[10px]">{a.status}</Badge>
                          </div>
                        </div>
                        <div className="font-semibold text-sm">{a.patient_name || "—"}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{a.reason || "—"}</div>
                        <div className="flex gap-2 mt-3 text-xs flex-wrap">
                          <button onClick={()=>openEdit(a)} className="text-slate-700 hover:text-[#1E3A8A] font-semibold" data-testid={`appt-edit-${a.id}`}>Edit</button>
                          {a.status !== "completed" && <button onClick={()=>setStatus(a,"completed")} className="text-emerald-700 hover:underline font-semibold" data-testid={`appt-complete-${a.id}`}>Complete</button>}
                          {a.status !== "cancelled" && <button onClick={()=>setStatus(a,"cancelled")} className="text-rose-700 hover:underline font-semibold" data-testid={`appt-cancel-${a.id}`}>Cancel</button>}
                          <button onClick={async()=>{
                            try {
                              const url = a.reminder_sent_at ? `/appointments/${a.id}/send-reminder?force=true` : `/appointments/${a.id}/send-reminder`;
                              const r = await api.post(url);
                              if (r.data?.skipped) toast.info(r.data.message || "Already sent recently");
                              else toast.success("Email reminder sent");
                              load();
                            } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
                          }} className="text-[#0D9488] hover:underline font-semibold" data-testid={`appt-sms-${a.id}`}>{a.reminder_sent_at ? "Resend Email" : "Email"}</button>
                          {a.status === "rescheduled" && !a.reschedule_sms_sent_at && (
                            <button onClick={()=>{setReasonModal(a); setReasonPick("");}} className="text-amber-700 hover:underline font-bold" data-testid={`appt-inform-${a.id}`}>Slot changed — Inform patient</button>
                          )}
                          {a.reschedule_sms_sent_at && (
                            <span className="text-emerald-600 text-[10px] font-bold uppercase">✓ Patient informed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>{editing?"Edit / Reschedule":"New"} Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs uppercase text-slate-500 font-semibold">Patient</Label>
              <Select value={form.patient_id} onValueChange={v=>setForm({...form, patient_id:v})}>
                <SelectTrigger data-testid="appt-form-patient" className="mt-1.5"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name} · {p.phone}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" data-testid="appt-form-date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})}/></div>
              <div><Label className="text-xs">Time</Label><Input type="time" data-testid="appt-form-time" value={form.time} onChange={e=>setForm({...form, time:e.target.value})}/></div>
            </div>
            <div>
              <Label className="text-xs">Reason</Label><Input data-testid="appt-form-reason" value={form.reason} onChange={e=>setForm({...form, reason:e.target.value})}/>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v=>setForm({...form, status:v})}>
                <SelectTrigger data-testid="appt-form-status"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="appt-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reasonModal} onOpenChange={(o)=>!o && setReasonModal(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Inform Patient — New Slot</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="text-sm">
              An email will be sent to <b>{reasonModal?.patient_name || "the patient"}</b> about the new slot{" "}
              <b>{reasonModal?.date} at {reasonModal?.time}</b>. Select a reason (mandatory):
            </div>
            <div className="space-y-2">
              {RESCHEDULE_REASONS.map(r => (
                <label key={r.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  reasonPick===r.key ? "border-[#0D9488] bg-[#0D9488]/5" : "border-slate-200 dark:border-slate-800"
                }`}>
                  <input type="radio" name="reason" checked={reasonPick===r.key} onChange={()=>setReasonPick(r.key)} data-testid={`reason-${r.key}`}/>
                  <span className="text-sm font-medium">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setReasonModal(null)}>Cancel</Button>
            <Button onClick={sendRescheduleSms} disabled={!reasonPick} data-testid="send-reschedule-sms" className="bg-[#0D9488] hover:bg-[#0F766E]">Send Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
