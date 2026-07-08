import { useEffect, useState } from "react";
import { portalApi, formatApiError } from "@/api/client";
import { usePortal } from "@/context/PortalAuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Activity, LogOut, CalendarPlus, User, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const DAYS = [
  ["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]
];

export default function PortalHome() {
  const { patient, logout } = usePortal();
  const nav = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [appts, setAppts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bookDoc, setBookDoc] = useState(null);
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0,10));
  const [slots, setSlots] = useState(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!patient) return;
    portalApi.get("/portal/doctors").then(r=>setDoctors(r.data)).catch(()=>{});
    portalApi.get("/portal/appointments").then(r=>setAppts(r.data)).catch(()=>{});
    portalApi.get("/portal/invoices").then(r=>setInvoices(r.data)).catch(()=>{});
  }, [patient]);

  useEffect(() => {
    if (!bookDoc || !bookDate) return;
    setSlots(null); setSelected(null);
    portalApi.get(`/portal/doctors/${bookDoc.id}/slots?date=${bookDate}`).then(r=>setSlots(r.data));
  }, [bookDoc, bookDate]);

  const book = async () => {
    if (!selected) return toast.error("Pick a time slot");
    try {
      const { data } = await portalApi.post("/portal/book", {
        doctor_id: bookDoc.id, date: bookDate, time: selected, reason,
      });
      toast.success(`Booked! SMS confirmation sent to ${patient.phone || "your number"}`);
      setBookDoc(null); setSelected(null); setReason("");
      const r = await portalApi.get("/portal/appointments"); setAppts(r.data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const cancel = async (id) => {
    if (!confirm("Cancel this appointment?")) return;
    await portalApi.post(`/portal/appointments/${id}/cancel`);
    toast.success("Cancelled");
    const r = await portalApi.get("/portal/appointments"); setAppts(r.data);
  };

  const downloadPdf = async (inv) => {
    try {
      const r = await portalApi.get(`/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a"); a.href = url; a.download = `${inv.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const handleLogout = () => { logout(); nav("/portal/login"); };
  const upcoming = appts.filter(a => a.status !== "cancelled" && a.status !== "completed");
  const past = appts.filter(a => a.status === "completed" || a.status === "cancelled");

  if (patient === null) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!patient) { nav("/portal/login"); return null; }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="glass border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#1E3A8A] flex items-center justify-center"><Activity className="w-4 h-4 text-white"/></div>
            <div><div className="font-bold" style={{fontFamily:"Manrope"}}>ABC Dental Portal</div><div className="text-xs text-slate-500">Welcome, {patient.full_name}</div></div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="portal-logout"><LogOut size={14} className="mr-1"/>Logout</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-extrabold" style={{fontFamily:"Manrope"}}>Our Doctors</h2>
            <span className="text-sm text-slate-500">Pick a doctor to see their schedule & book</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {doctors.length === 0 && <div className="col-span-full text-slate-500 py-6 text-center">No doctors available. Please contact the clinic.</div>}
            {doctors.map(d => (
              <Card key={d.id} className="card-premium p-5" data-testid={`portal-doctor-${d.id}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#1E3A8A] flex items-center justify-center text-white font-bold">{d.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
                  <div><div className="font-bold" style={{fontFamily:"Manrope"}}>{d.name}</div><div className="text-xs text-[#0D9488] font-semibold">{d.specialization}</div></div>
                </div>
                <div className="text-xs text-slate-500 space-y-1 mb-4">
                  {d.qualification && <div>{d.qualification}</div>}
                  {d.experience_years ? <div>{d.experience_years} yrs experience</div> : null}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {DAYS.map(([k,l]) => {
                    const ranges = (d.schedule?.[k]) || [];
                    return (
                      <div key={k} className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{l}</div>
                        <div className={`text-[9px] mt-1 py-0.5 rounded ${ranges.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                          {ranges.length ? `${ranges.length}×` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={()=>setBookDoc(d)} data-testid={`portal-book-btn-${d.id}`} className="w-full bg-[#0D9488] hover:bg-[#0F766E]">
                  <CalendarPlus size={14} className="mr-1"/>Book Appointment
                </Button>
              </Card>
            ))}
          </div>
        </motion.section>

        <section>
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming" data-testid="portal-tab-upcoming">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="past" data-testid="portal-tab-past">Past ({past.length})</TabsTrigger>
              <TabsTrigger value="invoices" data-testid="portal-tab-invoices">Invoices ({invoices.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4 space-y-3">
              {upcoming.length === 0 && <div className="text-sm text-slate-500 text-center py-10">No upcoming appointments</div>}
              {upcoming.map(a => (
                <Card key={a.id} className="card-premium p-4 flex items-center gap-4" data-testid={`portal-appt-${a.id}`}>
                  <div className="w-16 text-center">
                    <div className="text-2xl font-extrabold text-[#0D9488]">{a.time}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{a.date}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{a.doctor_name || "Doctor"}</div>
                    <div className="text-sm text-slate-500">{a.reason || "Consultation"}</div>
                    {a.reminder_sent_at && <Badge className="mt-1 bg-emerald-100 text-emerald-700 text-[10px]"><CheckCircle size={10} className="mr-0.5"/>SMS reminder sent</Badge>}
                  </div>
                  <Badge className="capitalize">{a.status}</Badge>
                  <Button variant="outline" size="sm" onClick={()=>cancel(a.id)} data-testid={`portal-cancel-${a.id}`}>Cancel</Button>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="past" className="mt-4 space-y-3">
              {past.length === 0 && <div className="text-sm text-slate-500 text-center py-10">No past appointments</div>}
              {past.map(a => (
                <Card key={a.id} className="card-premium p-4 flex items-center gap-4 opacity-80">
                  <div className="w-16 text-center"><div className="text-xl font-bold">{a.time}</div><div className="text-[10px] text-slate-500 uppercase">{a.date}</div></div>
                  <div className="flex-1"><div className="font-semibold">{a.doctor_name}</div><div className="text-sm text-slate-500">{a.reason}</div></div>
                  <Badge className="capitalize">{a.status}</Badge>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="invoices" className="mt-4 space-y-3">
              {invoices.length === 0 && <div className="text-sm text-slate-500 text-center py-10">No invoices yet</div>}
              {invoices.map(i => (
                <Card key={i.id} className="card-premium p-4 flex items-center gap-4">
                  <div className="flex-1"><div className="font-mono text-xs font-bold">{i.invoice_number}</div><div className="text-xs text-slate-500">{i.invoice_date}</div></div>
                  <div className="text-right"><div className="font-extrabold">₹{i.grand_total}</div><Badge className="text-[10px]">{i.payment_status}</Badge></div>
                  <Button variant="outline" size="sm" onClick={()=>downloadPdf(i)} data-testid={`portal-inv-pdf-${i.id}`}>Download PDF</Button>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <Dialog open={!!bookDoc} onOpenChange={(o)=>!o && setBookDoc(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Book with {bookDoc?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Choose date</Label><Input type="date" data-testid="portal-book-date" min={new Date().toISOString().slice(0,10)} value={bookDate} onChange={e=>setBookDate(e.target.value)}/></div>
            <div>
              <Label>Available slots</Label>
              <div className="mt-2 flex flex-wrap gap-2 min-h-[60px]">
                {slots === null && <div className="text-sm text-slate-500">Loading…</div>}
                {slots && slots.slots.length === 0 && <div className="text-sm text-rose-500">No slots available. Try another date.</div>}
                {slots && slots.slots.map(t => (
                  <button key={t} data-testid={`portal-slot-${t}`}
                    onClick={()=>setSelected(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                      selected === t ? "bg-[#0D9488] text-white border-[#0D9488]" :
                      "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#0D9488]"
                    }`}>
                    <Clock size={11} className="inline mr-1"/>{t}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Reason for visit (optional)</Label><Textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Tooth pain, cleaning, check-up"/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setBookDoc(null)}>Close</Button>
            <Button onClick={book} disabled={!selected} data-testid="portal-confirm-book" className="bg-[#0D9488] hover:bg-[#0F766E]">Confirm Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
