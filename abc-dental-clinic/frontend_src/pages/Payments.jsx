import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const empty = { patient_id: "", invoice_id: "", amount: 0, payment_method: "cash", transaction_id: "", payment_date: new Date().toISOString().slice(0,10), notes: "" };

export default function Payments() {
  const { activeClinicId } = useAuth();
  const [rows, setRows] = useState(null);
  const [patients, setPatients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => { const {data} = await api.get("/payments"); setRows(data); };
  useEffect(() => {
    setRows(null);
    load();
    api.get("/patients?limit=500").then(r=>setPatients(r.data.items));
    api.get("/invoices").then(r=>setInvoices(r.data));
  }, [activeClinicId]);

  const save = async () => {
    try {
      const payload = {...form, amount: Number(form.amount), invoice_id: form.invoice_id || null};
      await api.post("/payments", payload);
      toast.success("Payment recorded"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Payments</h1>
          <p className="text-slate-500 text-sm mt-1">Collect and track patient payments</p>
        </div>
        <Button onClick={()=>setOpen(true)} data-testid="payment-add-btn" className="bg-[#1E3A8A] hover:bg-[#1E40AF]"><Plus size={16} className="mr-1"/>New Payment</Button>
      </div>

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Method</th>
                <th className="text-left px-6 py-3">Transaction ID</th>
                <th className="text-right px-6 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-slate-500"><CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40"/>No payments</td></tr>}
              {rows && rows.map(p => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800" data-testid={`payment-row-${p.id}`}>
                  <td className="px-6 py-3">{p.payment_date}</td>
                  <td className="px-6 py-3 capitalize">{p.payment_method.replace("_"," ")}</td>
                  <td className="px-6 py-3 font-mono text-xs">{p.transaction_id || "—"}</td>
                  <td className="px-6 py-3 text-right font-bold text-emerald-600">₹{p.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Patient</Label>
              <Select value={form.patient_id} onValueChange={v=>setForm({...form, patient_id:v})}>
                <SelectTrigger data-testid="payment-form-patient"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Invoice (optional)</Label>
              <Select value={form.invoice_id} onValueChange={v=>setForm({...form, invoice_id:v})}>
                <SelectTrigger><SelectValue placeholder="Link to invoice"/></SelectTrigger>
                <SelectContent>{invoices.filter(i=>!form.patient_id||i.patient_id===form.patient_id).map(i=><SelectItem key={i.id} value={i.id}>{i.invoice_number} · ₹{i.balance}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" data-testid="payment-form-amount" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})}/></div>
              <div><Label>Date</Label><Input type="date" value={form.payment_date} onChange={e=>setForm({...form, payment_date:e.target.value})}/></div>
            </div>
            <div><Label>Method</Label>
              <Select value={form.payment_method} onValueChange={v=>setForm({...form, payment_method:v})}>
                <SelectTrigger data-testid="payment-form-method"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Transaction ID</Label><Input value={form.transaction_id} onChange={e=>setForm({...form, transaction_id:e.target.value})}/></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="payment-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
