import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, UserCog, Edit, Clock } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  ["mon","Monday"],["tue","Tuesday"],["wed","Wednesday"],["thu","Thursday"],
  ["fri","Friday"],["sat","Saturday"],["sun","Sunday"]
];

const emptySchedule = { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] };
const emptyDoc = {
  name: "", specialization: "Orthodontist", phone: "", email: "",
  experience_years: 0, qualification: "", active: true,
  slot_duration_minutes: 30, schedule: {...emptySchedule},
};

export default function Doctors() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDoc);
  const [editing, setEditing] = useState(null);

  const load = async () => { const {data} = await api.get("/doctors"); setRows(data); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({...emptyDoc, schedule: {...emptySchedule}}); setOpen(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({...emptyDoc, ...d, schedule: {...emptySchedule, ...(d.schedule || {})}, slot_duration_minutes: d.slot_duration_minutes || 30});
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {...form, experience_years: Number(form.experience_years), slot_duration_minutes: Number(form.slot_duration_minutes)};
      if (editing) await api.put(`/doctors/${editing.id}`, payload);
      else await api.post("/doctors", payload);
      toast.success("Saved"); setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete doctor?")) return;
    await api.delete(`/doctors/${id}`); toast.success("Deleted"); load();
  };

  const addRange = (day) => {
    const s = {...form.schedule};
    s[day] = [...(s[day] || []), { start: "09:00", end: "13:00" }];
    setForm({...form, schedule: s});
  };
  const removeRange = (day, idx) => {
    const s = {...form.schedule};
    s[day] = s[day].filter((_,i)=>i!==idx);
    setForm({...form, schedule: s});
  };
  const updateRange = (day, idx, key, value) => {
    const s = {...form.schedule};
    s[day] = s[day].map((r,i) => i===idx ? {...r, [key]: value} : r);
    setForm({...form, schedule: s});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Doctors</h1><p className="text-slate-500 text-sm mt-1">Manage doctors, consultation days & slot times</p></div>
        <Button onClick={openNew} data-testid="doctor-add-btn" className="bg-[#1E3A8A] hover:bg-[#1E40AF]"><Plus size={16} className="mr-1"/>New Doctor</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows && rows.length===0 && <div className="col-span-full text-center py-12 text-slate-500"><UserCog className="w-10 h-10 mx-auto mb-2 opacity-40"/>No doctors</div>}
        {rows && rows.map(d => (
          <Card key={d.id} className="card-premium p-5" data-testid={`doctor-card-${d.id}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center text-white font-bold">{d.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
              <div className="flex-1"><div className="font-bold">{d.name}</div><div className="text-xs text-[#0D9488] font-semibold">{d.specialization}</div></div>
              <button onClick={()=>openEdit(d)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded" data-testid={`doctor-edit-${d.id}`}><Edit size={14}/></button>
              <button onClick={()=>remove(d.id)} className="p-2 hover:bg-rose-50 rounded"><Trash2 size={14} className="text-rose-500"/></button>
            </div>
            <div className="text-xs text-slate-500 space-y-1 mb-3">
              <div>{d.qualification || "—"}</div>
              <div>{d.experience_years ? `${d.experience_years} yrs experience` : ""}</div>
              <div>Slot: {d.slot_duration_minutes || 30} min</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(([k,l]) => {
                const rngs = (d.schedule?.[k]) || [];
                return (
                  <div key={k} className="text-center" title={rngs.map(r=>`${r.start}-${r.end}`).join(", ")}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{l.slice(0,3)}</div>
                    <div className={`text-[9px] mt-1 py-1 rounded ${rngs.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {rngs.length ? `${rngs.length}×` : "off"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>{editing?"Edit":"New"} Doctor</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div><Label>Name</Label><Input data-testid="doctor-form-name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
            <div><Label>Specialization</Label><Input value={form.specialization} onChange={e=>setForm({...form, specialization:e.target.value})}/></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
            <div><Label>Qualification</Label><Input value={form.qualification} onChange={e=>setForm({...form, qualification:e.target.value})}/></div>
            <div><Label>Experience (yrs)</Label><Input type="number" value={form.experience_years} onChange={e=>setForm({...form, experience_years:e.target.value})}/></div>
            <div><Label>Slot Duration (minutes)</Label><Input type="number" min={5} step={5} data-testid="doctor-form-slot-duration" value={form.slot_duration_minutes} onChange={e=>setForm({...form, slot_duration_minutes:e.target.value})}/></div>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-[#0D9488]"/>
              <h4 className="font-bold" style={{fontFamily:"Manrope"}}>Consultation Schedule</h4>
              <span className="text-xs text-slate-500">— add time ranges per day</span>
            </div>
            <div className="space-y-3">
              {DAYS.map(([k,l]) => (
                <div key={k} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{l}</div>
                    <Button size="sm" variant="outline" onClick={()=>addRange(k)} data-testid={`doctor-add-range-${k}`}><Plus size={12} className="mr-1"/>Add slot</Button>
                  </div>
                  {(form.schedule[k] || []).length === 0 && <div className="text-xs text-slate-400 italic">Day off</div>}
                  {(form.schedule[k] || []).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <Input type="time" value={r.start} onChange={e=>updateRange(k, i, "start", e.target.value)} className="w-32" data-testid={`doctor-range-${k}-${i}-start`}/>
                      <span className="text-slate-400">to</span>
                      <Input type="time" value={r.end} onChange={e=>updateRange(k, i, "end", e.target.value)} className="w-32" data-testid={`doctor-range-${k}-${i}-end`}/>
                      <button onClick={()=>removeRange(k, i)} className="p-2 hover:bg-rose-50 rounded text-rose-500"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="doctor-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
