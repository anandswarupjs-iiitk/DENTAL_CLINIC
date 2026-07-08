import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Mail, MapPin, Calendar as CalIcon, HeartPulse, FileText } from "lucide-react";
import { toast } from "sonner";

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [patient, setPatient] = useState(null);
  const [timeline, setTimeline] = useState(null);

  const reload = async () => {
    const r = await api.get(`/patients/${id}/timeline`); setTimeline(r.data);
  };
  useEffect(() => {
    api.get(`/patients/${id}`).then(r => setPatient(r.data)).catch(()=>{});
    reload();
    // eslint-disable-next-line
  }, [id]);

  const generateInvoice = async (visitId) => {
    try {
      const { data } = await api.post(`/visits/${visitId}/generate-invoice`);
      toast.success(data.existing ? "Invoice already exists" : `Invoice ${data.invoice_number} created`);
      reload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!patient) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl"/><Skeleton className="h-80 rounded-2xl"/></div>;

  return (
    <div className="space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><ArrowLeft size={14}/>Back to patients</Link>

      <Card className="card-premium p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
            {patient.full_name?.slice(0,2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>{patient.full_name}</h1>
              <Badge variant="secondary" className="font-mono">{patient.patient_id}</Badge>
              {patient.blood_group && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{patient.blood_group}</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2"><Phone size={14}/>{patient.phone}</div>
              <div className="flex items-center gap-2"><Mail size={14}/>{patient.email || "—"}</div>
              <div className="flex items-center gap-2"><CalIcon size={14}/>Age {patient.age || "—"} · {patient.gender || "—"}</div>
              <div className="flex items-center gap-2 md:col-span-3"><MapPin size={14}/>{[patient.address, patient.city, patient.state, patient.pincode].filter(Boolean).join(", ") || "—"}</div>
            </div>
          </div>
        </div>
        {(patient.medical_history || patient.allergies || patient.current_medications) && (
          <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-[#0D9488]"><HeartPulse size={14}/>Medical Notes</div>
            <div className="space-y-1 text-sm">
              {patient.medical_history && <div><span className="font-semibold">History:</span> {patient.medical_history}</div>}
              {patient.allergies && <div><span className="font-semibold">Allergies:</span> {patient.allergies}</div>}
              {patient.current_medications && <div><span className="font-semibold">Meds:</span> {patient.current_medications}</div>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {patient.smoking && <Badge variant="destructive">Smoker</Badge>}
                {patient.alcohol && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Alcohol</Badge>}
                {patient.diabetes && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Diabetes</Badge>}
                {patient.hypertension && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Hypertension</Badge>}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Tabs defaultValue="visits">
        <TabsList data-testid="patient-tabs">
          <TabsTrigger value="visits" data-testid="tab-visits">Visits ({timeline?.visits?.length || 0})</TabsTrigger>
          <TabsTrigger value="treatments" data-testid="tab-treatments">Treatments ({timeline?.treatments?.length || 0})</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments ({timeline?.appointments?.length || 0})</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices ({timeline?.invoices?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="visits" className="mt-4">
          <TimelineList items={timeline?.visits} render={(v) => (
            <div>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">{v.chief_complaint || "Visit"} · {v.visit_date}</div>
                  <div className="text-sm text-slate-500 mt-1">Diagnosis: {v.diagnosis || "—"}</div>
                  <div className="text-sm text-slate-500">Procedure: {v.procedure_done || "—"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-[#0D9488] font-semibold mb-2">₹{v.final_amount || v.amount_charged || 0}</div>
                  {v.invoice_id ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><FileText size={10} className="mr-0.5"/>Invoice created</Badge>
                  ) : (
                    <Button size="sm" onClick={()=>generateInvoice(v.id)} data-testid={`gen-invoice-${v.id}`} className="bg-[#0D9488] hover:bg-[#0F766E] text-xs h-7">
                      <FileText size={11} className="mr-1"/>Generate Invoice
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}/>
        </TabsContent>
        <TabsContent value="treatments" className="mt-4">
          <TimelineList items={timeline?.treatments} render={(t) => (
            <div>
              <div className="flex justify-between">
                <div className="font-semibold">{t.procedure_name}</div>
                <span className="text-sm text-slate-500">{t.treatment_date}</span>
              </div>
              <div className="text-sm text-slate-500 mt-1">{t.procedure_description || "—"}</div>
            </div>
          )}/>
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          <TimelineList items={timeline?.appointments} render={(a) => (
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{a.date} · {a.time}</div>
                <div className="text-sm text-slate-500">{a.reason || "—"}</div>
              </div>
              <Badge className="capitalize">{a.status}</Badge>
            </div>
          )}/>
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <TimelineList items={timeline?.invoices} render={(i) => (
            <div className="flex justify-between">
              <div>
                <div className="font-semibold font-mono text-sm">{i.invoice_number}</div>
                <div className="text-sm text-slate-500">{i.invoice_date}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">₹{i.grand_total}</div>
                <Badge className="capitalize" variant={i.payment_status==="paid"?"default":"secondary"}>{i.payment_status}</Badge>
              </div>
            </div>
          )}/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TimelineList({ items, render }) {
  if (!items) return <Skeleton className="h-40"/>;
  if (items.length === 0) return <div className="text-sm text-slate-500 py-8 text-center">No records yet</div>;
  return (
    <div className="space-y-3">
      {items.map(it => (
        <Card key={it.id} className="card-premium p-4">{render(it)}</Card>
      ))}
    </div>
  );
}
