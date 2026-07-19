import { useEffect, useState, useCallback } from "react";
import { api } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { useAuth } from "@/context/AuthContext";

const iso = (d) => d.toISOString().slice(0,10);

export default function Reports() {
  const { activeClinicId } = useAuth();
  const today = new Date();
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate()-30);
  const [df, setDf] = useState(iso(monthAgo));
  const [dt, setDt] = useState(iso(today));
  const [revenue, setRevenue] = useState([]);
  const [outstanding, setOutstanding] = useState([]);

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      api.get(`/reports/revenue?date_from=${df}&date_to=${dt}`),
      api.get("/reports/outstanding"),
    ]);
    setRevenue(r1.data); setOutstanding(r2.data);
  }, [df, dt]);
  useEffect(() => { load(); }, [load, activeClinicId]);

  const exportCsv = (rows, name) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const total = revenue.reduce((s,r) => s + Number(r.revenue||0), 0);
  const outstandingTotal = outstanding.reduce((s,i) => s + Number(i.balance||0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Financial and operational insights</p>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue" data-testid="report-tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="outstanding" data-testid="report-tab-outstanding">Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4 space-y-4">
          <Card className="card-premium p-6">
            <div className="flex flex-col md:flex-row items-end gap-3 mb-6">
              <div><Label>From</Label><Input type="date" value={df} onChange={e=>setDf(e.target.value)} data-testid="report-from"/></div>
              <div><Label>To</Label><Input type="date" value={dt} onChange={e=>setDt(e.target.value)} data-testid="report-to"/></div>
              <Button onClick={load} data-testid="report-apply" className="bg-[#1E3A8A]">Apply</Button>
              <Button variant="outline" onClick={()=>exportCsv(revenue, `revenue_${df}_${dt}`)} data-testid="report-export-csv">Export CSV</Button>
              <div className="ml-auto text-right">
                <div className="text-xs uppercase text-slate-500 font-semibold">Total</div>
                <div className="text-2xl font-extrabold text-[#0D9488]">₹{total.toLocaleString("en-IN")}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5}/>
                <XAxis dataKey="date" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip/>
                <Line type="monotone" dataKey="revenue" stroke="#1E3A8A" strokeWidth={3} dot={{r:4, fill:"#0D9488"}}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding" className="mt-4">
          <Card className="card-premium p-6">
            <div className="flex justify-between mb-4">
              <div><div className="text-xs uppercase text-slate-500 font-semibold">Total Outstanding</div><div className="text-2xl font-extrabold text-rose-600">₹{outstandingTotal.toLocaleString("en-IN")}</div></div>
              <Button variant="outline" onClick={()=>exportCsv(outstanding, `outstanding_${iso(new Date())}`)}>Export CSV</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800"><tr>
                  <th className="text-left px-3 py-2">Invoice</th><th className="text-left px-3 py-2">Patient</th><th className="text-left px-3 py-2">Date</th>
                  <th className="text-right px-3 py-2">Total</th><th className="text-right px-3 py-2">Balance</th>
                </tr></thead>
                <tbody>
                  {outstanding.length===0 && <tr><td colSpan={5} className="text-center py-12 text-slate-500">No outstanding invoices 🎉</td></tr>}
                  {outstanding.map(i => (
                    <tr key={i.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                      <td className="px-3 py-2">{i.patient_name}</td>
                      <td className="px-3 py-2">{i.invoice_date}</td>
                      <td className="px-3 py-2 text-right">₹{i.grand_total}</td>
                      <td className="px-3 py-2 text-right font-bold text-rose-600">₹{i.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
