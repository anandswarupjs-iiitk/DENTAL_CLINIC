import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePortal } from "@/context/PortalAuthContext";
import { portalApi } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function PortalLogin() {
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", age: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [clinicSearch, setClinicSearch] = useState("");
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [signupStep, setSignupStep] = useState(1); // 1: select clinic, 2: details
  const { login, signup } = usePortal();
  const nav = useNavigate();

  useEffect(() => {
    portalApi.get("/portal/clinics").then(r => setClinics(r.data)).catch(()=>{});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signup" && !selectedClinic) {
      return toast.error("Please select a clinic");
    }
    setLoading(true);
    const res = mode === "login"
      ? await login(form.email, form.password)
      : await signup({ ...form, age: Number(form.age), clinic_id: selectedClinic.id });
    setLoading(false);
    if (res.ok) { toast.success(mode === "login" ? "Welcome back!" : "Account created"); nav("/portal"); }
    else toast.error(res.error);
  };

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(clinicSearch.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(clinicSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#1E3A8A]"/>
        <div className="absolute inset-0 bg-grid opacity-30"/>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xl flex items-center justify-center"><Activity className="w-5 h-5"/></div>
            <div><div className="font-bold text-lg" style={{fontFamily:"Manrope"}}>Your Dental</div><div className="text-xs opacity-80">Patient Portal</div></div>
          </div>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.15}}>
            <h1 className="text-5xl font-extrabold leading-[1.05] mb-6" style={{fontFamily:"Manrope"}}>Book your visit<br/><span className="text-blue-200">in seconds.</span></h1>
            <p className="text-lg opacity-90 max-w-md">Choose your doctor, pick a slot, and get an instant SMS confirmation. Simple, transparent, and always on your schedule.</p>
          </motion.div>
          <div className="text-xs opacity-70">© {new Date().getFullYear()} Your Dental</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="w-full max-w-md">
          <Card className="p-8 rounded-3xl shadow-xl">
            <h2 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>{mode==="login" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-slate-500 mt-2 mb-8">{mode==="login" ? "Sign in to book & manage appointments." : "Fill in a few details to get started."}</p>
            <form onSubmit={submit} className="space-y-4">
              {mode === "login" && (
                <>
                  <div><Label>Email</Label><Input required type="email" data-testid="portal-email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
                  <div><Label>Password</Label><Input required type="password" data-testid="portal-password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/></div>
                  <Button type="submit" disabled={loading} data-testid="portal-submit" className="w-full h-11 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg">
                    {loading ? "Please wait…" : "Sign in"}
                  </Button>
                </>
              )}

              {mode === "signup" && signupStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label>Search & Select Clinic</Label>
                    <Input 
                      placeholder="Type clinic name or location..." 
                      value={clinicSearch} 
                      onChange={e => setClinicSearch(e.target.value)} 
                      className="mb-2"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1">
                    {filteredClinics.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClinic(c)}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-all ${
                          selectedClinic?.id === c.id 
                            ? "bg-[#0D9488]/15 border border-[#0D9488] text-[#0F766E] font-semibold" 
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="font-bold">{c.name}</div>
                        <div className="text-xs opacity-85">{c.address || "No address listed"}</div>
                      </button>
                    ))}
                    {filteredClinics.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500">No clinics matched your search.</div>
                    )}
                  </div>
                  <Button 
                    type="button"
                    disabled={!selectedClinic}
                    onClick={() => setSignupStep(2)}
                    className="w-full h-11 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg"
                  >
                    Next: Account Details
                  </Button>
                </div>
              )}

              {mode === "signup" && signupStep === 2 && (
                <>
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl mb-4 border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-xs text-slate-400 block">Selected Clinic</span>
                      <span className="text-sm font-bold text-[#0F766E]">{selectedClinic?.name}</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <div><Label>Full Name</Label><Input required data-testid="portal-signup-name" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Mobile</Label><Input required data-testid="portal-signup-phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
                    <div><Label>Age</Label><Input required type="number" data-testid="portal-signup-age" value={form.age} onChange={e=>setForm({...form, age:e.target.value})}/></div>
                  </div>
                  <div><Label>Email</Label><Input required type="email" data-testid="portal-email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
                  <div><Label>Password</Label><Input required type="password" data-testid="portal-password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/></div>
                  <Button type="submit" disabled={loading} data-testid="portal-submit" className="w-full h-11 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold rounded-lg">
                    {loading ? "Please wait…" : "Create account"}
                  </Button>
                </>
              )}
            </form>
            <div className="mt-6 text-center text-sm">
              {mode==="login" ? (
                <button onClick={()=>{ setMode("signup"); setSignupStep(1); }} data-testid="portal-goto-signup" className="text-[#0D9488] hover:underline font-semibold">New patient? Create an account →</button>
              ) : (
                <button onClick={()=>setMode("login")} data-testid="portal-goto-login" className="text-[#0D9488] hover:underline font-semibold">← Already have an account? Sign in</button>
              )}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
              Are you a clinic staff member? <Link to="/login" className="text-[#1E3A8A] font-semibold hover:underline">Staff login →</Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
