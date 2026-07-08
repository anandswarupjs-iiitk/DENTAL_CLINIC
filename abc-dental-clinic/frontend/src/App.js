import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PortalAuthProvider } from "@/context/PortalAuthContext";
import { Toaster } from "sonner";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import PatientDetail from "@/pages/PatientDetail";
import Appointments from "@/pages/Appointments";
import Treatments from "@/pages/Treatments";
import Invoices from "@/pages/Invoices";
import Payments from "@/pages/Payments";
import Doctors from "@/pages/Doctors";
import Reports from "@/pages/Reports";
import Notifications from "@/pages/Notifications";
import SmsLogs from "@/pages/SmsLogs";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import PortalLogin from "@/pages/portal/PortalLogin";
import PortalHome from "@/pages/portal/PortalHome";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PortalAuthProvider>
          <BrowserRouter>
            <Toaster richColors position="top-right"/>
            <Routes>
              {/* Patient portal */}
              <Route path="/portal/login" element={<PortalLogin/>} />
              <Route path="/portal" element={<PortalHome/>} />

              {/* Staff */}
              <Route path="/login" element={<Login/>} />
              <Route element={<ProtectedRoute><Layout/></ProtectedRoute>}>
                <Route path="/" element={<Navigate to="/dashboard" replace/>} />
                <Route path="/dashboard" element={<Dashboard/>} />
                <Route path="/patients" element={<Patients/>} />
                <Route path="/patients/:id" element={<PatientDetail/>} />
                <Route path="/appointments" element={<Appointments/>} />
                <Route path="/treatments" element={<Treatments/>} />
                <Route path="/invoices" element={<Invoices/>} />
                <Route path="/payments" element={<Payments/>} />
                <Route path="/doctors" element={<ProtectedRoute roles={["admin"]}><Doctors/></ProtectedRoute>} />
                <Route path="/reports" element={<Reports/>} />
                <Route path="/notifications" element={<Notifications/>} />
                <Route path="/sms" element={<SmsLogs/>} />
                <Route path="/settings" element={<ProtectedRoute roles={["admin"]}><Settings/></ProtectedRoute>} />
                <Route path="/profile" element={<Profile/>} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace/>} />
            </Routes>
          </BrowserRouter>
        </PortalAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
