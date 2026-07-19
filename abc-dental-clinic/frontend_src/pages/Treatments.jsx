import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { patient_id: "", procedure_name: "", treatment_date: new Date().toISOString().slice(0,10), procedure_cost: 0, procedure_description: "", remarks: "" };

export default function Treatments() {
  const { activeClinicId } = useAuth();
  const [rows, setRows] = useState(null);
  const [patients, setPatients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => { const {data} = await api.get("/treatments"); setRows(data); };
  useEffect(() => { setRows(null); load(); api.get("/patients?limit=500").then(r=>setPatients(r.data.items)); }, [activeClinicId]);

  const save = async () => {
    try {
      await api.post("/treatments", {...form, procedure_cost: Number(form.procedure_cost)});
      toast.success("Treatment recorded"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Treatments</h1>
          <p className="text-slate-500 text-sm mt-1">Procedures performed for patients</p>
        </div>
        <Button onClick={()=>setOpen(true)} data-testid="treatment-add-btn" className="bg-[#1E3A8A] hover:bg-[#1E40AF]"><Plus size={16} className="mr-1"/>New Treatment</Button>
      </div>

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-6 py-3">Procedure</th>
                <th className="text-left px-6 py-3">Patient</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-right px-6 py-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-slate-500"><Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-40"/>No treatments</td></tr>}
              {rows && rows.map(t => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid={`treatment-row-${t.id}`}>
                  <td className="px-6 py-3 font-semibold">{t.procedure_name}</td>
                  <td className="px-6 py-3">{t.patient_name || "—"}</td>
                  <td className="px-6 py-3">{t.treatment_date}</td>
                  <td className="px-6 py-3 text-right font-bold">₹{t.procedure_cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>New Treatment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={v=>setForm({...form, patient_id:v})}>
                <SelectTrigger data-testid="treatment-form-patient"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Procedure Name</Label><Input data-testid="treatment-form-name" value={form.procedure_name} onChange={e=>setForm({...form, procedure_name:e.target.value})}/></div>
              <div><Label>Date</Label><Input type="date" value={form.treatment_date} onChange={e=>setForm({...form, treatment_date:e.target.value})}/></div>
            </div>
            <div><Label>Cost (₹)</Label><Input type="number" data-testid="treatment-form-cost" value={form.procedure_cost} onChange={e=>setForm({...form, procedure_cost:e.target.value})}/></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.procedure_description} onChange={e=>setForm({...form, procedure_description:e.target.value})}/></div>
            <div><Label>Remarks</Label><Textarea rows={2} value={form.remarks} onChange={e=>setForm({...form, remarks:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="treatment-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
