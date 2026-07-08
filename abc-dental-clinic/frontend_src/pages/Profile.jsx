import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const change = async () => {
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password updated"); setCurrent(""); setNext("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!user) return null;
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Profile</h1>
      <Card className="card-premium p-8">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center text-white text-2xl font-extrabold">
            {(user.name || user.email)?.slice(0,2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{fontFamily:"Manrope"}}>{user.name}</h2>
            <div className="text-slate-500">{user.email}</div>
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase">{user.role}</div>
          </div>
        </div>
      </Card>

      <Card className="card-premium p-8">
        <h3 className="text-lg font-bold mb-4" style={{fontFamily:"Manrope"}}>Change Password</h3>
        <div className="space-y-4 max-w-md">
          <div><Label>Current Password</Label><Input type="password" value={current} onChange={e=>setCurrent(e.target.value)} data-testid="profile-current-pw"/></div>
          <div><Label>New Password</Label><Input type="password" value={next} onChange={e=>setNext(e.target.value)} data-testid="profile-new-pw"/></div>
          <Button onClick={change} data-testid="profile-change-pw-btn" className="bg-[#1E3A8A] hover:bg-[#1E40AF]">Update Password</Button>
        </div>
      </Card>
    </div>
  );
}
