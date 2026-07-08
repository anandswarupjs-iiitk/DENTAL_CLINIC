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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [form, setForm] = useState({});
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [nu, setNu] = useState({ email:"", password:"", name:"", role:"receptionist" });

  useEffect(() => {
    api.get("/settings").then(r => setForm(r.data || {}));
    api.get("/users").then(r => setUsers(r.data));
  }, []);

  const save = async () => {
    try { await api.put("/settings", form); toast.success("Settings saved"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const addUser = async () => {
    try {
      await api.post("/users", nu);
      toast.success("User created"); setOpen(false); setNu({ email:"", password:"", name:"", role:"receptionist" });
      const r = await api.get("/users"); setUsers(r.data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const delUser = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/users/${id}`);
    const r = await api.get("/users"); setUsers(r.data);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Settings</h1>
      <Tabs defaultValue="clinic">
        <TabsList>
          <TabsTrigger value="clinic" data-testid="settings-tab-clinic">Clinic</TabsTrigger>
          <TabsTrigger value="users" data-testid="settings-tab-users">Users & Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic" className="mt-4">
          <Card className="card-premium p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["clinic_name","Clinic Name"],["invoice_prefix","Invoice Prefix"],
                ["phone","Phone"],["email","Email"],["website","Website"],["gst_number","GST Number"],
                ["currency","Currency"],["timezone","Timezone"],["doctor_name","Doctor Name"],["doctor_title","Doctor Title"],
              ].map(([k,l])=>(
                <div key={k}><Label>{l}</Label><Input value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})} data-testid={`settings-${k}`}/></div>
              ))}
              <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address||""} onChange={e=>setForm({...form, address:e.target.value})}/></div>
            </div>
            <div className="mt-6"><Button onClick={save} data-testid="settings-save" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Save Changes</Button></div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="card-premium p-6">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">Team Members</h3>
              <Button onClick={()=>setOpen(true)} size="sm" data-testid="settings-add-user" className="bg-[#1E3A8A]"><Plus size={14} className="mr-1"/>Add User</Button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500 border-b"><tr><th className="text-left py-2">Name</th><th className="text-left py-2">Email</th><th className="text-left py-2">Role</th><th></th></tr></thead>
              <tbody>{users.map(u=>(
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800" data-testid={`user-row-${u.id}`}>
                  <td className="py-2 font-semibold">{u.name}</td><td className="py-2">{u.email}</td>
                  <td className="py-2 capitalize"><span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{u.role}</span></td>
                  <td className="py-2 text-right"><button onClick={()=>delUser(u.id)} className="p-2 hover:bg-rose-50 rounded"><Trash2 size={14} className="text-rose-500"/></button></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

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
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button onClick={addUser} data-testid="new-user-save" className="bg-[#1E3A8A]">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
