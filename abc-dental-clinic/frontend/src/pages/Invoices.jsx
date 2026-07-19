import { useEffect, useState } from "react";
import { api, formatApiError, API_BASE } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const emptyItem = { procedure: "", description: "", quantity: 1, rate: 0, amount: 0 };
const emptyForm = {
  patient_id: "", invoice_date: new Date().toISOString().slice(0,10),
  items: [{...emptyItem}], subtotal: 0, discount: 0, tax: 0, grand_total: 0,
  payment_method: "cash", payment_status: "unpaid", paid_amount: 0, balance: 0, notes: "",
};

export default function Invoices() {
  const { activeClinicId } = useAuth();
  const [rows, setRows] = useState(null);
  const [patients, setPatients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => { const {data} = await api.get("/invoices"); setRows(data); };
  useEffect(() => { setRows(null); load(); api.get("/patients?limit=500").then(r=>setPatients(r.data.items)); }, [activeClinicId]);

  const recalc = (items, discount = form.discount, tax = form.tax, paid = form.paid_amount) => {
    const subtotal = items.reduce((s, it) => s + Number(it.amount || 0), 0);
    const grand_total = Math.max(subtotal - Number(discount||0) + Number(tax||0), 0);
    return { subtotal, grand_total, balance: Math.max(grand_total - Number(paid||0), 0) };
  };

  const updateItem = (idx, key, value) => {
    const items = form.items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [key]: value };
      next.amount = Number(next.quantity || 0) * Number(next.rate || 0);
      return next;
    });
    setForm({ ...form, items, ...recalc(items) });
  };
  const addItem = () => { const items = [...form.items, {...emptyItem}]; setForm({...form, items, ...recalc(items)}); };
  const removeItem = (i) => { const items = form.items.filter((_,j)=>j!==i); setForm({...form, items, ...recalc(items)}); };

  const save = async () => {
    try {
      const { subtotal, grand_total, balance } = recalc(form.items);
      const payload = { ...form, subtotal, grand_total, balance,
        payment_status: Number(form.paid_amount)>=grand_total && grand_total>0 ? "paid" : (Number(form.paid_amount)>0 ? "partial" : "unpaid") };
      await api.post("/invoices", payload);
      toast.success("Invoice created"); setOpen(false); setForm(emptyForm); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const downloadPdf = async (inv) => {
    try {
      const r = await api.get(`/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number || "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      let msg = "Download failed";
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          if (json?.detail) msg = formatApiError(json.detail);
        } catch (_) {}
      } else if (e?.response?.data?.detail) {
        msg = formatApiError(e.response.data.detail);
      }
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">Generate and manage patient bills</p>
        </div>
        <Button onClick={()=>{setForm(emptyForm); setOpen(true);}} data-testid="invoice-add-btn" className="bg-[#1E3A8A] hover:bg-[#1E40AF]"><Plus size={16} className="mr-1"/>New Invoice</Button>
      </div>

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left px-6 py-3">Invoice #</th>
                <th className="text-left px-6 py-3">Patient</th>
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-right px-6 py-3">Total</th>
                <th className="text-right px-6 py-3">Balance</th>
                <th className="text-center px-6 py-3">Status</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-slate-500"><FileText className="w-10 h-10 mx-auto mb-2 opacity-40"/>No invoices</td></tr>}
              {rows && rows.map(inv => (
                <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid={`invoice-row-${inv.id}`}>
                  <td className="px-6 py-3 font-mono text-xs font-semibold">{inv.invoice_number}</td>
                  <td className="px-6 py-3">{inv.patient_name || "—"}</td>
                  <td className="px-6 py-3">{inv.invoice_date}</td>
                  <td className="px-6 py-3 text-right font-bold">₹{inv.grand_total}</td>
                  <td className="px-6 py-3 text-right">₹{inv.balance}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge className={`capitalize ${inv.payment_status==="paid"?"bg-emerald-100 text-emerald-700":inv.payment_status==="partial"?"bg-amber-100 text-amber-700":"bg-rose-100 text-rose-700"}`}>{inv.payment_status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={()=>downloadPdf(inv)} data-testid={`invoice-pdf-${inv.id}`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><Download size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={v=>setForm({...form, patient_id:v})}>
                  <SelectTrigger data-testid="invoice-form-patient"><SelectValue placeholder="Select"/></SelectTrigger>
                  <SelectContent>{patients.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e=>setForm({...form, invoice_date:e.target.value})}/></div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Procedure</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2 w-20">Qty</th>
                    <th className="text-right px-3 py-2 w-28">Rate</th>
                    <th className="text-right px-3 py-2 w-28">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-1.5"><Input data-testid={`item-procedure-${i}`} value={it.procedure} onChange={e=>updateItem(i,"procedure",e.target.value)}/></td>
                      <td className="p-1.5"><Input value={it.description} onChange={e=>updateItem(i,"description",e.target.value)}/></td>
                      <td className="p-1.5"><Input type="number" className="text-right" value={it.quantity} onChange={e=>updateItem(i,"quantity",e.target.value)}/></td>
                      <td className="p-1.5"><Input type="number" className="text-right" value={it.rate} onChange={e=>updateItem(i,"rate",e.target.value)}/></td>
                      <td className="p-1.5 text-right font-semibold">₹{Number(it.amount||0).toFixed(2)}</td>
                      <td className="p-1.5"><button onClick={()=>removeItem(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addItem} data-testid="invoice-add-item" className="w-full text-sm py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0D9488] font-semibold border-t border-slate-100 dark:border-slate-800">+ Add Line Item</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Discount</Label><Input type="number" value={form.discount} onChange={e=>{const d=e.target.value; setForm({...form, discount:d, ...recalc(form.items, d, form.tax, form.paid_amount)});}}/></div>
              <div><Label>Tax</Label><Input type="number" value={form.tax} onChange={e=>{const t=e.target.value; setForm({...form, tax:t, ...recalc(form.items, form.discount, t, form.paid_amount)});}}/></div>
              <div><Label>Paid Amount</Label><Input type="number" data-testid="invoice-paid-amount" value={form.paid_amount} onChange={e=>{const p=e.target.value; setForm({...form, paid_amount:p, ...recalc(form.items, form.discount, form.tax, p)});}}/></div>
              <div><Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v=>setForm({...form, payment_method:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem><SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex justify-between text-sm">
              <div>Subtotal: <b>₹{Number(form.subtotal||0).toFixed(2)}</b></div>
              <div>Grand Total: <b className="text-[#1E3A8A] dark:text-blue-400 text-lg">₹{Number(form.grand_total||0).toFixed(2)}</b></div>
              <div>Balance: <b>₹{Number(form.balance||0).toFixed(2)}</b></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="invoice-form-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
