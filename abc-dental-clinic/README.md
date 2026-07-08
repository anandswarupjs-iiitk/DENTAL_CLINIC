# ABC Dental Clinic Management System

Production-ready dental clinic app with patient portal, doctor scheduling, appointments, invoices, PDF, email reminders (Gmail SMTP), and reports.

## Stack
- Backend: FastAPI + MongoDB (Motor) + JWT + bcrypt + ReportLab + SMTP + APScheduler
- Frontend: React 19 + Tailwind + shadcn/ui + Recharts + Framer Motion + Sonner

## Local Setup (VS Code)

### Backend
```powershell
# Windows
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env    # edit .env with your keys
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
npx shadcn@latest init
npx shadcn@latest add button card dialog input label select textarea checkbox tabs badge avatar dropdown-menu skeleton sheet sonner
yarn start
```

## Deploy to Production
See `DEPLOYMENT.md` — full step-by-step (Atlas + Render + Vercel).

## Default Login (CHANGE AFTER FIRST LOGIN)
- Admin: admin@abcdental.com / Admin@123
- Doctor: doctor@abcdental.com / Doctor@123
- Receptionist: reception@abcdental.com / Reception@123
- Patient portal: /portal/login (self-signup)

## Email Reminders
Uses Gmail SMTP by default (App Password required — not your Gmail login password).
Get an App Password: https://myaccount.google.com/apppasswords
