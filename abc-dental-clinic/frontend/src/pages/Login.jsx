import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Activity, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password, remember);
    setLoading(false);
    if (res.ok) {
      toast.success("Welcome back!");
      nav(from, { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#0D9488]" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xl flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg" style={{fontFamily:"Manrope"}}>Your Dental</div>
              <div className="text-xs opacity-80">Clinic Management Suite</div>
            </div>
          </div>
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}}>
            <h1 className="text-5xl font-extrabold leading-[1.05] mb-6" style={{fontFamily:"Manrope"}}>
              Precision care.<br/>
              <span className="text-teal-200">Elegant workflow.</span>
            </h1>
            <p className="text-lg opacity-90 max-w-md">
              Manage patients, appointments, treatments and billing — all in one calm, modern workspace.
            </p>
          </motion.div>
          <div className="text-xs opacity-70">© {new Date().getFullYear()} Your Dental · All rights reserved</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="w-full max-w-md">
          <Card className="p-8 rounded-3xl border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#0D9488] flex items-center justify-center">
                <Activity className="w-5 h-5 text-white"/>
              </div>
              <div className="font-bold" style={{fontFamily:"Manrope"}}>Your Dental</div>
            </div>
            <h2 className="text-3xl font-extrabold" style={{fontFamily:"Manrope"}}>Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8">Sign in to continue to your dashboard.</p>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</Label>
                <Input id="email" data-testid="login-email-input" type="email" required
                  value={email} onChange={(e)=>setEmail(e.target.value)}
                  className="h-12 mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800"
                  placeholder="admin@abcdental.com" />
              </div>
              <div>
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</Label>
                <div className="relative">
                  <Input id="password" data-testid="login-password-input" type={showPw?"text":"password"} required
                    value={password} onChange={(e)=>setPassword(e.target.value)}
                    className="h-12 mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 pr-10"
                    placeholder="••••••••" />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} data-testid="login-toggle-password"
                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={setRemember} data-testid="login-remember-me"/>
                  Remember me
                </label>
                <button type="button" onClick={()=>toast.info("Contact admin for password reset")}
                  className="text-sm text-[#1E3A8A] dark:text-blue-400 hover:underline" data-testid="login-forgot-link">
                  Forgot password?
                </button>
              </div>
              <Button type="submit" disabled={loading} data-testid="login-submit-btn"
                className="w-full h-12 bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-base font-semibold rounded-lg active:scale-[0.98] transition">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
