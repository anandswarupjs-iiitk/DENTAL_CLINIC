import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Edit, Trash2, User } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const emptyPatient = {
  full_name: "", age: "", gender: "", phone: "",
  email: "", address: "", city: "", state: "", pincode: "",
  blood_group: "", allergies: "",
  smoking: false, alcohol: false, diabetes: false, hypertension: false,
  previous_dental_history: "",
};

export default function Patients() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPatient);

  const load = async () => {
    const { data } = await api.get(`/patients?search=${encodeURIComponent(q)}&limit=100`);
    setRows(data.items); setTotal(data.total);
  };
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [q]);

  const openNew = () => { setEditing(null); setForm(emptyPatient); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({...emptyPatient, ...p, age: p.age || ""}); setOpen(true); };

  const save = async () => {
    try {
      const payload = {...form, age: form.age ? Number(form.age) : null};
      if (editing) {
        await api.put(`/patients/${editing.id}`, payload);
        toast.success("Patient updated");
      } else {
        await api.post("/patients", payload);
        toast.success("Patient created");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete patient?")) return;
    await api.delete(`/patients/${id}`);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Patients</h1>
          <p className="text-slate-500 text-sm mt-1">{total} total · manage patient records</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <Input data-testid="patients-search" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search name, phone, email…"
              className="pl-9 h-11 w-full md:w-72 rounded-lg bg-white dark:bg-slate-900"/>
          </div>
          <Button onClick={openNew} data-testid="patients-add-btn" className="h-11 bg-[#1E3A8A] hover:bg-[#1E40AF] rounded-lg"><Plus size={16} className="mr-1"/>New Patient</Button>
        </div>
      </div>

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-6 py-3">Patient</th>
                <th className="text-left px-6 py-3">ID</th>
                <th className="text-left px-6 py-3">Phone</th>
                <th className="text-left px-6 py-3">Age / Gender</th>
                <th className="text-left px-6 py-3">City</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && Array.from({length:5}).map((_,i)=>(
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-10 rounded-lg"/></td></tr>
              ))}
              {rows && rows.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500"><User className="w-10 h-10 mx-auto mb-2 opacity-40"/>No patients found</td></tr>
              )}
              {rows && rows.map((p,idx) => (
                <motion.tr key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:idx*0.02}}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid={`patient-row-${p.id}`}>
                  <td className="px-6 py-3">
                    <Link to={`/patients/${p.id}`} className="flex items-center gap-3 group">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] text-white flex items-center justify-center text-xs font-bold">
                        {p.full_name?.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold group-hover:text-[#1E3A8A] dark:group-hover:text-blue-400">{p.full_name}</div>
                        <div className="text-xs text-slate-500">{p.email || "—"}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-500 font-mono text-xs">{p.patient_id}</td>
                  <td className="px-6 py-3">{p.phone}</td>
                  <td className="px-6 py-3">{p.age || "—"} · {p.gender || "—"}</td>
                  <td className="px-6 py-3">{p.city || "—"}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={()=>openEdit(p)} data-testid={`patient-edit-${p.id}`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 mr-1"><Edit size={16}/></button>
                    <button onClick={()=>remove(p.id)} data-testid={`patient-delete-${p.id}`} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle style={{fontFamily:"Manrope"}}>{editing ? "Edit Patient" : "New Patient"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <Field label="Full Name *"><Input data-testid="patient-form-fullname" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})}/></Field>
            <Field label="Phone *"><Input data-testid="patient-form-phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></Field>
            <Field label="Age"><Input type="number" value={form.age} onChange={e=>setForm({...form, age:e.target.value})}/></Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v)=>setForm({...form, gender:v})}>
                <SelectTrigger data-testid="patient-form-gender"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></Field>
            <Field label="Blood Group"><Input value={form.blood_group} onChange={e=>setForm({...form, blood_group:e.target.value})}/></Field>
            <Field label="Address" wide><Input value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></Field>
            <Field label="City"><Input value={form.city} onChange={e=>setForm({...form, city:e.target.value})}/></Field>
            <Field label="State"><Input value={form.state} onChange={e=>setForm({...form, state:e.target.value})}/></Field>
            <Field label="Pincode"><Input value={form.pincode} onChange={e=>setForm({...form, pincode:e.target.value})}/></Field>
            <Field label="Allergies"><Input value={form.allergies} onChange={e=>setForm({...form, allergies:e.target.value})}/></Field>
            <Field label="Previous Dental History" wide><Textarea rows={2} value={form.previous_dental_history} onChange={e=>setForm({...form, previous_dental_history:e.target.value})}/></Field>
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {["smoking","alcohol","diabetes","hypertension"].map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form[k]} onCheckedChange={(v)=>setForm({...form, [k]:!!v})} data-testid={`patient-form-${k}`}/>
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)} data-testid="patient-form-cancel">Cancel</Button>
            <Button onClick={save} data-testid="patient-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({label, children, wide}) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
