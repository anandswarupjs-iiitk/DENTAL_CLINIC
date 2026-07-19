import { useEffect, useState } from "react";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [form, setForm] = useState({});
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [open, setOpen] = useState(false);
  const [openClinic, setOpenClinic] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  
  const [nu, setNu] = useState({ email:"", password:"", name:"", role:"receptionist", clinic_id:"" });
  const [nc, setNc] = useState({ 
    name: "", address: "", phone: "", email: "", 
    doctor_name: "", doctor_email: "", doctor_password: "" 
  });

  useEffect(() => {
    api.get("/users").then(r => setUsers(r.data));
    api.get("/clinics").then(r => setClinics(r.data));
  }, []);

  useEffect(() => {
    api.get(`/settings?clinic_id=${selectedClinicId}`).then(r => setForm(r.data || {})).catch(()=>{});
  }, [selectedClinicId]);

  const save = async () => {
    try { 
      await api.put(`/settings?clinic_id=${selectedClinicId}`, form); 
      toast.success("Settings saved"); 
      const r = await api.get("/clinics"); setClinics(r.data);
    }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const addUser = async () => {
    try {
      await api.post("/users", nu);
      toast.success("User created"); 
      setOpen(false); 
      setNu({ email:"", password:"", name:"", role:"receptionist", clinic_id:"" });
      const r = await api.get("/users"); setUsers(r.data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  
  const delUser = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/users/${id}`);
    const r = await api.get("/users"); setUsers(r.data);
  };

  const addClinic = async () => {
    try {
      await api.post("/clinics", nc);
      toast.success("Clinic and doctor created");
      setOpenClinic(false);
      setNc({ 
        name: "", address: "", phone: "", email: "", 
        doctor_name: "", doctor_email: "", doctor_password: "" 
      });
      const r = await api.get("/clinics"); setClinics(r.data);
      const ru = await api.get("/users"); setUsers(ru.data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  
  const delClinic = async (id) => {
    if (!confirm("Delete clinic?")) return;
    await api.delete(`/clinics/${id}`);
    const r = await api.get("/clinics"); setClinics(r.data);
  };

  const openAddUserForClinic = (clinic_id) => {
    setNu({ email:"", password:"", name:"", role:"receptionist", clinic_id });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Settings</h1>
      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global" data-testid="settings-tab-global">Global Settings</TabsTrigger>
          <TabsTrigger value="clinics" data-testid="settings-tab-clinics">Clinics</TabsTrigger>
          <TabsTrigger value="users" data-testid="settings-tab-users">All Users</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4">
          <Card className="card-premium p-6">
            <div className="mb-6 max-w-sm">
              <Label>Select Clinic to Manage Settings</Label>
              <Select value={selectedClinicId || "global"} onValueChange={(val) => setSelectedClinicId(val === "global" ? "" : val)}>
                <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="System Default (Global)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">System Default (Global)</SelectItem>
                  {clinics.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["clinic_name","System Name"],["invoice_prefix","Invoice Prefix"],
                ["phone","Phone"],["email","Email"],["website","Website"],["gst_number","GST Number"],
                ["currency","Currency"],["timezone","Timezone"],["doctor_name","Default Doctor"],["doctor_title","Default Title"],
              ].map(([k,l])=>(
                <div key={k}><Label>{l}</Label><Input value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})} data-testid={`settings-${k}`}/></div>
              ))}
              <div className="md:col-span-2"><Label>Default Address</Label><Textarea rows={2} value={form.address||""} onChange={e=>setForm({...form, address:e.target.value})}/></div>
            </div>
            <div className="mt-6"><Button onClick={save} data-testid="settings-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save Changes</Button></div>
          </Card>
        </TabsContent>

        <TabsContent value="clinics" className="mt-4 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Manage Clinics</h3>
            <Button onClick={()=>setOpenClinic(true)} size="sm" className="bg-[#1E3A8A]"><Plus size={14} className="mr-1"/>Add Clinic</Button>
          </div>
          {clinics.map(c => (
            <Card key={c.id} className="p-6 card-premium border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-xl flex items-center"><Building size={18} className="mr-2 text-blue-600"/> {c.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{c.address} | {c.phone} | {c.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={()=>openAddUserForClinic(c.id)}>
                    <Plus size={14} className="mr-1"/> Add User
                  </Button>
                  <Button variant="outline" size="sm" onClick={()=>delClinic(c.id)} className="text-rose-500 hover:text-rose-600">
                    <Trash2 size={14}/>
                  </Button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h5 className="text-sm font-semibold mb-2">Clinic Users</h5>
                {users.filter(u => u.clinic_id === c.id).length === 0 ? (
                  <p className="text-xs text-slate-400">No users assigned to this clinic.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {users.filter(u => u.clinic_id === c.id).map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div>
                          <div className="font-semibold text-sm">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-100 text-blue-700">{u.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
          {clinics.length === 0 && (
            <div className="text-center py-10 text-slate-500">No clinics found. Add one to get started.</div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="card-premium p-6">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">All Team Members</h3>
              <Button onClick={()=>{ setNu({email:"", password:"", name:"", role:"receptionist", clinic_id:""}); setOpen(true); }} size="sm" data-testid="settings-add-user" className="bg-[#1E3A8A]"><Plus size={14} className="mr-1"/>Add User</Button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b"><tr><th className="text-left py-2">Name</th><th className="text-left py-2">Email</th><th className="text-left py-2">Role</th><th className="text-left py-2">Clinic</th><th></th></tr></thead>
              <tbody>{users.map(u=>(
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800" data-testid={`user-row-${u.id}`}>
                  <td className="py-2 font-semibold">{u.name}</td><td className="py-2">{u.email}</td>
                  <td className="py-2 capitalize"><span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{u.role}</span></td>
                  <td className="py-2 text-xs text-slate-500">
                    {u.clinic_id ? clinics.find(c => c.id === u.clinic_id)?.name || "Unknown" : "Global"}
                  </td>
                  <td className="py-2 text-right"><button onClick={()=>delUser(u.id)} className="p-2 hover:bg-rose-50 rounded"><Trash2 size={14} className="text-rose-500"/></button></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* NEW USER DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Name</Label><Input value={nu.name} onChange={e=>setNu({...nu, name:e.target.value})} data-testid="new-user-name"/></div>
            <div><Label>Email</Label><Input type="email" value={nu.email} onChange={e=>setNu({...nu, email:e.target.value})} data-testid="new-user-email"/></div>
            <div><Label>Password</Label><Input type="password" value={nu.password} onChange={e=>setNu({...nu, password:e.target.value})} data-testid="new-user-password"/></div>
            <div><Label>Role</Label>
              <Select value={nu.role} onValueChange={v=>setNu({...nu, role:v})}>
                <SelectTrigger data-testid="new-user-role"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="doctor">Doctor</SelectItem><SelectItem value="receptionist">Receptionist</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Assign to Clinic</Label>
              <Select value={nu.clinic_id} onValueChange={v=>setNu({...nu, clinic_id:v})}>
                <SelectTrigger><SelectValue placeholder="Global (No Clinic)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Global (No Clinic)</SelectItem>
                  {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={addUser} data-testid="new-user-save" className="bg-[#1E3A8A]">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NEW CLINIC DIALOG */}
      <Dialog open={openClinic} onOpenChange={setOpenClinic}>
        <DialogContent className="rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Clinic</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Clinic Name</Label><Input value={nc.name} onChange={e=>setNc({...nc, name:e.target.value})} /></div>
            <div><Label>Address</Label><Input value={nc.address} onChange={e=>setNc({...nc, address:e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={nc.phone} onChange={e=>setNc({...nc, phone:e.target.value})} /></div>
            <div><Label>Email</Label><Input type="email" value={nc.email} onChange={e=>setNc({...nc, email:e.target.value})} /></div>
            
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-[#1E3A8A] mb-3">Primary Doctor Account</h4>
              <div className="space-y-3">
                <div><Label>Doctor Name</Label><Input value={nc.doctor_name || ""} onChange={e=>setNc({...nc, doctor_name:e.target.value})} /></div>
                <div><Label>Doctor Email (Username)</Label><Input type="email" value={nc.doctor_email || ""} onChange={e=>setNc({...nc, doctor_email:e.target.value})} /></div>
                <div><Label>Doctor Password</Label><Input type="password" value={nc.doctor_password || ""} onChange={e=>setNc({...nc, doctor_password:e.target.value})} /></div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={()=>setOpenClinic(false)}>Cancel</Button><Button onClick={addClinic} className="bg-[#1E3A8A]">Create Clinic</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
