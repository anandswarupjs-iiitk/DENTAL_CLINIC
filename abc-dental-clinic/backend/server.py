"""ABC Dental Clinic Management System — FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import logging
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

import models as M
import auth as A
import storage as S
import email_service as N
import sms
from pdf_gen import generate_invoice_pdf
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("dental")

APP_NAME = os.environ.get("APP_NAME", "abc-dental-clinic")
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="ABC Dental Clinic API")
app.state.db = db
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def _clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


def _filter_clinic(q: dict, user: dict) -> dict:
    if user.get("role") != "admin":
        if user.get("clinic_id"):
            q["clinic_id"] = user["clinic_id"]
    else:
        active_id = user.get("_active_clinic_id")
        if active_id and active_id != "all":
            q["clinic_id"] = active_id
    return q


def _get_user_clinic_id(user: dict) -> Optional[str]:
    if user.get("role") == "admin":
        return user.get("_active_clinic_id") or user.get("clinic_id")
    return user.get("clinic_id")


# ---------------- STARTUP ----------------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.patients.create_index("patient_id", unique=True)
    await db.patients.create_index("phone")
    await db.appointments.create_index([("date", 1), ("time", 1)])
    await db.invoices.create_index("invoice_number", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    # Seed
    await seed_users()
    await seed_settings()
    await seed_clinics()
    # Storage
    try:
        S.init_storage()
    except Exception as e:
        log.warning(f"storage init: {e}")
    # Reminder scheduler
    try:
        tz = pytz.timezone(os.environ.get("REMINDER_TIMEZONE", "Asia/Kolkata"))
        sched = AsyncIOScheduler(timezone=tz)
        sched.add_job(
            _cron_send_tomorrow_reminders,
            CronTrigger(
                hour=int(os.environ.get("REMINDER_CRON_HOUR", "20")),
                minute=int(os.environ.get("REMINDER_CRON_MINUTE", "0")),
                timezone=tz,
            ),
            id="daily_reminders", replace_existing=True,
        )
        sched.start()
        app.state.scheduler = sched
        log.info(f"Reminder scheduler started (daily at {os.environ.get('REMINDER_CRON_HOUR','20')}:00 {tz})")
    except Exception as e:
        log.warning(f"scheduler init: {e}")
    # Test credentials file
    memdir = Path("memory")
    memdir.mkdir(exist_ok=True)
    (memdir / "test_credentials.md").write_text(f"""# ABC Dental Clinic — Test Credentials

## Admin
- Email: `{os.environ.get('ADMIN_EMAIL')}`
- Password: `{os.environ.get('ADMIN_PASSWORD')}`
- Role: admin

## Doctor
- Email: `{os.environ.get('DOCTOR_EMAIL')}`
- Password: `{os.environ.get('DOCTOR_PASSWORD')}`
- Role: doctor

## Receptionist
- Email: `{os.environ.get('RECEPTIONIST_EMAIL')}`
- Password: `{os.environ.get('RECEPTIONIST_PASSWORD')}`
- Role: receptionist

## Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
""")


async def seed_users():
    seeds = [
        (os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD"), "admin", "Clinic Admin"),
        (os.environ.get("DOCTOR_EMAIL"), os.environ.get("DOCTOR_PASSWORD"), "doctor", "Dr. Avi B P"),
        (os.environ.get("RECEPTIONIST_EMAIL"), os.environ.get("RECEPTIONIST_PASSWORD"), "receptionist", "Receptionist"),
    ]
    for email, pw, role, name in seeds:
        if not email or not pw:
            continue
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one({
                "email": email,
                "password_hash": A.hash_password(pw),
                "name": name,
                "role": role,
                "phone": None,
                "photo": None,
                "created_at": now_iso(),
            })
        elif not A.verify_password(pw, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": A.hash_password(pw)}})
    # Also create default doctor record
    if not await db.doctors.find_one({"name": "Dr. Avi B P"}):
        await db.doctors.insert_one({
            "name": "Dr. Avi B P",
            "specialization": "Orthodontist",
            "phone": "+91-9999999999",
            "email": "doctor@abcdental.com",
            "experience_years": 12,
            "qualification": "MDS Orthodontics",
            "active": True,
            "created_at": now_iso(),
        })


async def seed_settings():
    if not await db.settings.find_one({"_key": "clinic"}):
        await db.settings.insert_one({
            "_key": "clinic",
            "clinic_name": "ABC Dental Clinic",
            "clinic_logo": None,
            "address": "123 Smile Street, Bangalore, KA",
            "phone": "+91-9999999999",
            "email": "contact@abcdental.com",
            "website": "https://abcdental.com",
            "gst_number": "29ABCDE1234F1Z5",
            "invoice_prefix": "INV",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "doctor_name": "Avi B P",
            "doctor_title": "Orthodontist",
            "updated_at": now_iso(),
        })


async def seed_clinics():
    if await db.clinics.count_documents({}) == 0:
        res = await db.clinics.insert_one({
            "name": "ABC Dental Clinic",
            "address": "123 Smile Street, Bangalore, KA",
            "phone": "+91-9999999999",
            "email": "contact@abcdental.com",
            "created_at": now_iso()
        })
        cid = str(res.inserted_id)
        # Assign existing seeded doctor/receptionist to this clinic!
        await db.users.update_many({"role": {"$in": ["doctor", "receptionist"]}}, {"$set": {"clinic_id": cid}})
        await db.doctors.update_many({}, {"$set": {"clinic_id": cid}})
        # Initialize settings for this default clinic as well!
        await db.settings.update_one(
            {"clinic_id": cid},
            {"$set": {
                "clinic_name": "ABC Dental Clinic",
                "address": "123 Smile Street, Bangalore, KA",
                "phone": "+91-9999999999",
                "email": "contact@abcdental.com",
                "invoice_prefix": "INV",
                "currency": "INR",
                "timezone": "Asia/Kolkata",
                "doctor_name": "Dr. Avi B P",
                "doctor_title": "Orthodontist",
                "clinic_id": cid,
            }},
            upsert=True
        )


# ---------------- AUTH ----------------
def _set_auth_cookies(resp: Response, access: str, refresh: str, remember: bool = False):
    resp.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                    max_age=43200, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax",
                    max_age=604800 if remember else 86400, path="/")


@api.post("/auth/login")
async def login(payload: M.LoginIn, request: Request, response: Response):
    email = payload.email.lower()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    # brute-force
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("locked_until"):
        lu = datetime.fromisoformat(attempt["locked_until"])
        if lu > now:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not A.verify_password(payload.password, user["password_hash"]):
        fails = (attempt or {}).get("fails", 0) + 1
        upd = {"fails": fails, "last_at": now.isoformat()}
        if fails >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd, "$setOnInsert": {"identifier": ident}}, upsert=True)
        if fails >= 5:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": ident})
    access = A.create_access_token(str(user["_id"]), email, user["role"])
    refresh = A.create_refresh_token(str(user["_id"]))
    _set_auth_cookies(response, access, refresh, payload.remember_me)
    return {"user": _clean(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(A.get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = A.decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = A.create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
        return {"access_token": access}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh")


@api.post("/auth/forgot-password")
async def forgot(payload: M.ForgotIn):
    import secrets
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        return {"ok": True}  # do not reveal
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": str(user["_id"]),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False,
    })
    log.info(f"[RESET LINK] Send this to user: /reset-password?token={token}")
    return {"ok": True, "reset_token": token}  # returned for demo/testing


@api.post("/auth/reset-password")
async def reset(payload: M.ResetIn):
    doc = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"_id": ObjectId(doc["user_id"])},
                              {"$set": {"password_hash": A.hash_password(payload.new_password)}})
    await db.password_reset_tokens.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/change-password")
async def change_password(payload: M.ChangePasswordIn, user: dict = Depends(A.get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not A.verify_password(payload.current_password, u["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"password_hash": A.hash_password(payload.new_password)}})
    return {"ok": True}


# ---------------- USERS (admin) ----------------
@api.get("/users")
async def list_users(user: dict = Depends(A.require_roles("admin"))):
    users = await db.users.find({}).to_list(500)
    return [_clean(u) for u in users]


@api.post("/users")
async def create_user(payload: M.RegisterIn, user: dict = Depends(A.require_roles("admin"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "email": email,
        "password_hash": A.hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "created_at": now_iso(),
    }
    if payload.clinic_id:
        doc["clinic_id"] = payload.clinic_id
    r = await db.users.insert_one(doc)
    doc["_id"] = r.inserted_id
    
    if payload.role == "doctor":
        existing_dr = await db.doctors.find_one({"email": email})
        if not existing_dr:
            await db.doctors.insert_one({
                "name": payload.name,
                "email": email,
                "specialization": "General Dentist",
                "active": True,
                "clinic_id": payload.clinic_id,
                "created_at": now_iso(),
            })

    return _clean(doc)


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(A.require_roles("admin"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"_id": oid(uid)})
    return {"ok": True}


# ---------------- CLINICS ----------------
@api.get("/public/clinics")
async def list_public_clinics():
    clinics = await db.clinics.find({}).to_list(500)
    return [{"id": str(c["_id"]), "name": c["name"]} for c in clinics]


@api.get("/clinics")
async def list_clinics(user: dict = Depends(A.require_roles("admin"))):
    clinics = await db.clinics.find({}).to_list(500)
    return [_clean(c) for c in clinics]


@api.post("/clinics")
async def create_clinic(payload: M.ClinicIn, user: dict = Depends(A.require_roles("admin"))):
    doc = payload.model_dump()
    doctor_name = doc.pop("doctor_name", None)
    doctor_email = doc.pop("doctor_email", None)
    doctor_password = doc.pop("doctor_password", None)

    doc["created_at"] = now_iso()
    r = await db.clinics.insert_one(doc)
    doc["_id"] = r.inserted_id
    
    if doctor_email and doctor_password:
        await db.users.insert_one({
            "name": doctor_name or "Doctor",
            "email": doctor_email,
            "password_hash": A.hash_password(doctor_password),
            "role": "doctor",
            "clinic_id": str(doc["_id"])
        })
        
    return _clean(doc)


@api.delete("/clinics/{cid}")
async def delete_clinic(cid: str, user: dict = Depends(A.require_roles("admin"))):
    await db.clinics.delete_one({"_id": oid(cid)})
    # Also delete or unassign users from this clinic? We'll leave them for now or delete them.
    # Optionally: await db.users.delete_many({"clinic_id": cid})
    return {"ok": True}


# ---------------- PATIENTS ----------------
async def _next_patient_id() -> str:
    count = await db.patients.count_documents({})
    return f"PAT{(count + 1):05d}"


@api.get("/patients")
async def list_patients(search: Optional[str] = None, gender: Optional[str] = None,
                        limit: int = 100, skip: int = 0,
                        user: dict = Depends(A.get_current_user)):
    q = {"is_deleted": {"$ne": True}}
    _filter_clinic(q, user)
    if search:
        q["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"patient_id": {"$regex": search, "$options": "i"}},
        ]
    if gender:
        q["gender"] = gender
    cur = db.patients.find(q).sort("created_at", -1).skip(skip).limit(limit)
    items = [_clean(p) for p in await cur.to_list(limit)]
    total = await db.patients.count_documents(q)
    return {"items": items, "total": total}


@api.post("/patients")
async def create_patient(payload: M.PatientIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["patient_id"] = await _next_patient_id()
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    doc["is_deleted"] = False
    r = await db.patients.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _clean(doc)


@api.get("/patients/{pid}")
async def get_patient(pid: str, user: dict = Depends(A.get_current_user)):
    p = await db.patients.find_one({"_id": oid(pid)})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(p)


@api.put("/patients/{pid}")
async def update_patient(pid: str, payload: M.PatientIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    await db.patients.update_one({"_id": oid(pid)}, {"$set": doc})
    p = await db.patients.find_one({"_id": oid(pid)})
    return _clean(p)


@api.delete("/patients/{pid}")
async def delete_patient(pid: str, user: dict = Depends(A.require_roles("admin", "receptionist"))):
    await db.patients.update_one({"_id": oid(pid)}, {"$set": {"is_deleted": True, "deleted_at": now_iso()}})
    return {"ok": True}


@api.get("/patients/{pid}/timeline")
async def patient_timeline(pid: str, user: dict = Depends(A.get_current_user)):
    visits = [_clean(v) for v in await db.visits.find({"patient_id": pid}).sort("visit_date", -1).to_list(500)]
    treatments = [_clean(t) for t in await db.treatments.find({"patient_id": pid}).sort("treatment_date", -1).to_list(500)]
    appointments = [_clean(a) for a in await db.appointments.find({"patient_id": pid}).sort("date", -1).to_list(500)]
    invoices = [_clean(i) for i in await db.invoices.find({"patient_id": pid}).sort("invoice_date", -1).to_list(500)]
    return {"visits": visits, "treatments": treatments, "appointments": appointments, "invoices": invoices}


# ---------------- APPOINTMENTS ----------------
@api.get("/appointments")
async def list_appointments(date_from: Optional[str] = None, date_to: Optional[str] = None,
                            status: Optional[str] = None, doctor_id: Optional[str] = None,
                            patient_id: Optional[str] = None,
                            user: dict = Depends(A.get_current_user)):
    q = {}
    if date_from or date_to:
        q["date"] = {}
        if date_from: q["date"]["$gte"] = date_from
        if date_to: q["date"]["$lte"] = date_to
    if status: q["status"] = status
    if doctor_id: q["doctor_id"] = doctor_id
    if patient_id: q["patient_id"] = patient_id
    _filter_clinic(q, user)
    items = [_clean(a) for a in await db.appointments.find(q).sort([("date", 1), ("time", 1)]).to_list(1000)]
    # Enrich patient name
    pids = list({a["patient_id"] for a in items if a.get("patient_id")})
    pmap = {}
    if pids:
        for p in await db.patients.find({"_id": {"$in": [oid(x) for x in pids]}}).to_list(1000):
            pmap[str(p["_id"])] = p.get("full_name")
    for a in items:
        a["patient_name"] = pmap.get(a.get("patient_id"))
    return items


@api.post("/appointments")
async def create_appointment(payload: M.AppointmentIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    r = await db.appointments.insert_one(doc)
    doc["_id"] = r.inserted_id
    
    # Send WhatsApp Notification
    try:
        patient = await db.patients.find_one({"_id": oid(doc["patient_id"])})
        if patient and patient.get("phone"):
            doctor = await db.doctors.find_one({"_id": oid(doc["doctor_id"])}) if doc.get("doctor_id") else None
            clinic_name = await _get_clinic_name(doc.get("clinic_id"))
            wa_body = sms.build_appointment_booked_message(
                patient.get("full_name", "Patient"),
                (doctor or {}).get("name", "our doctor"),
                doc.get("date"),
                doc.get("time"),
                clinic_name
            )
            await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
                "appointment_id": str(doc["_id"]),
                "type": "appointment_booked"
            })
    except Exception as e:
        log.error(f"Failed to send booking WhatsApp: {e}")

    return _clean(doc)


@api.put("/appointments/{aid}")
async def update_appointment(aid: str, payload: M.AppointmentIn, user: dict = Depends(A.get_current_user)):
    old_appt = await db.appointments.find_one({"_id": oid(aid)})
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    
    # Check if rescheduling occurred
    rescheduled = False
    if old_appt:
        if (old_appt.get("date") != doc.get("date") or 
            old_appt.get("time") != doc.get("time") or 
            old_appt.get("doctor_id") != doc.get("doctor_id")):
            rescheduled = True
            doc["status"] = "rescheduled"
            doc["rescheduled_at"] = now_iso()
            doc["previous_slot"] = {"date": old_appt.get("date"), "time": old_appt.get("time")}
            doc["reminder_sent_at"] = None

    await db.appointments.update_one({"_id": oid(aid)}, {"$set": doc})
    a = await db.appointments.find_one({"_id": oid(aid)})
    
    if rescheduled and a:
        try:
            patient = await db.patients.find_one({"_id": oid(a["patient_id"])})
            if patient and patient.get("phone"):
                doctor = await db.doctors.find_one({"_id": oid(a["doctor_id"])}) if a.get("doctor_id") else None
                clinic_name = await _get_clinic_name(a.get("clinic_id"))
                wa_body = sms.build_reschedule_message(
                    patient.get("full_name", "Patient"),
                    (doctor or {}).get("name", "our doctor"),
                    a.get("date", ""),
                    a.get("time", ""),
                    clinic_name,
                    "general_reschedule" # defaults to "of scheduling changes"
                )
                await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
                    "appointment_id": str(a["_id"]),
                    "type": "reschedule"
                })
        except Exception as e:
            log.error(f"Failed to send reschedule WhatsApp: {e}")

    return _clean(a)


@api.patch("/appointments/{aid}/status")
async def update_appointment_status(aid: str, status: str, user: dict = Depends(A.get_current_user)):
    await db.appointments.update_one({"_id": oid(aid)}, {"$set": {"status": status, "updated_at": now_iso()}})
    return {"ok": True}


@api.delete("/appointments/{aid}")
async def delete_appointment(aid: str, user: dict = Depends(A.get_current_user)):
    await db.appointments.delete_one({"_id": oid(aid)})
    return {"ok": True}


# ---------------- VISITS ----------------
@api.get("/visits")
async def list_visits(patient_id: Optional[str] = None, user: dict = Depends(A.get_current_user)):
    q = {}
    if patient_id: q["patient_id"] = patient_id
    _filter_clinic(q, user)
    items = [_clean(v) for v in await db.visits.find(q).sort("visit_date", -1).to_list(1000)]
    return items


@api.post("/visits")
async def create_visit(payload: M.VisitIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    r = await db.visits.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _clean(doc)


@api.put("/visits/{vid}")
async def update_visit(vid: str, payload: M.VisitIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    await db.visits.update_one({"_id": oid(vid)}, {"$set": doc})
    return _clean(await db.visits.find_one({"_id": oid(vid)}))


@api.delete("/visits/{vid}")
async def delete_visit(vid: str, user: dict = Depends(A.get_current_user)):
    await db.visits.delete_one({"_id": oid(vid)})
    return {"ok": True}


# ---------------- TREATMENTS ----------------
@api.get("/treatments")
async def list_treatments(patient_id: Optional[str] = None, user: dict = Depends(A.get_current_user)):
    q = {}
    if patient_id: q["patient_id"] = patient_id
    _filter_clinic(q, user)
    items = [_clean(t) for t in await db.treatments.find(q).sort("treatment_date", -1).to_list(1000)]
    pids = list({t["patient_id"] for t in items if t.get("patient_id")})
    pmap = {}
    if pids:
        for p in await db.patients.find({"_id": {"$in": [oid(x) for x in pids]}}).to_list(1000):
            pmap[str(p["_id"])] = p.get("full_name")
    for t in items:
        t["patient_name"] = pmap.get(t.get("patient_id"))
    return items


@api.post("/treatments")
async def create_treatment(payload: M.TreatmentIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["created_at"] = now_iso()
    r = await db.treatments.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _clean(doc)


@api.delete("/treatments/{tid}")
async def delete_treatment(tid: str, user: dict = Depends(A.get_current_user)):
    await db.treatments.delete_one({"_id": oid(tid)})
    return {"ok": True}


# ---------------- INVOICES ----------------
async def _next_invoice_number(clinic_id: Optional[str] = None) -> str:
    settings = None
    if clinic_id:
        settings = await db.settings.find_one({"clinic_id": clinic_id})
    if not settings:
        settings = await db.settings.find_one({"_key": "clinic"}) or {}
    prefix = settings.get("invoice_prefix", "INV")
    year = datetime.now(timezone.utc).year
    inv_prefix = f"{prefix}-{year}-"
    
    # Search ALL invoices with this prefix pattern (ignore clinic_id filter)
    # to get the true highest number and avoid duplicates
    last_inv = await db.invoices.find(
        {"invoice_number": {"$regex": f"^{prefix}-{year}-"}}
    ).sort("invoice_number", -1).limit(1).to_list(1)
    
    last_count = 0
    if last_inv:
        last_num = last_inv[0].get("invoice_number", "")
        try:
            last_count = int(last_num.split("-")[-1])
        except Exception:
            last_count = await db.invoices.count_documents({})

    # Try incrementing; if there's still a collision, keep incrementing
    for attempt in range(10):
        candidate = f"{inv_prefix}{(last_count + 1 + attempt):05d}"
        existing = await db.invoices.find_one({"invoice_number": candidate})
        if not existing:
            return candidate
    
    # Fallback: use total count + timestamp to guarantee uniqueness
    total = await db.invoices.count_documents({})
    return f"{inv_prefix}{(total + 1):05d}"


@api.get("/invoices")
async def list_invoices(patient_id: Optional[str] = None, status: Optional[str] = None,
                        user: dict = Depends(A.get_current_user)):
    q = {}
    if patient_id: q["patient_id"] = patient_id
    if status: q["payment_status"] = status
    _filter_clinic(q, user)
    items = [_clean(i) for i in await db.invoices.find(q).sort("invoice_date", -1).to_list(1000)]
    pids = list({t["patient_id"] for t in items if t.get("patient_id")})
    pmap = {}
    if pids:
        for p in await db.patients.find({"_id": {"$in": [oid(x) for x in pids]}}).to_list(1000):
            pmap[str(p["_id"])] = p.get("full_name")
    for i in items:
        i["patient_name"] = pmap.get(i.get("patient_id"))
    return items


def _compute_invoice_totals(doc: dict) -> dict:
    # Recompute amount per item, then totals
    items = doc.get("items") or []
    subtotal = 0.0
    for it in items:
        qty = float(it.get("quantity", 1) or 0)
        rate = float(it.get("rate", 0) or 0)
        it["amount"] = round(qty * rate, 2)
        subtotal += it["amount"]
    discount = float(doc.get("discount", 0) or 0)
    tax = float(doc.get("tax", 0) or 0)
    grand_total = max(subtotal - discount + tax, 0)
    paid = float(doc.get("paid_amount", 0) or 0)
    balance = max(grand_total - paid, 0)
    if grand_total <= 0.001:
        status = "unpaid"
    elif paid >= grand_total - 0.01:
        status = "paid"
    elif paid > 0:
        status = "partial"
    else:
        status = "unpaid"
    doc.update({
        "items": items, "subtotal": round(subtotal, 2), "grand_total": round(grand_total, 2),
        "balance": round(balance, 2), "payment_status": status,
    })
    return doc


@api.post("/invoices")
async def create_invoice(payload: M.InvoiceIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    doc = _compute_invoice_totals(doc)
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["invoice_number"] = await _next_invoice_number(cid)
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    r = await db.invoices.insert_one(doc)
    doc["_id"] = r.inserted_id
    
    # Notify via WhatsApp
    try:
        await _notify_invoice_created(doc)
    except Exception as e:
        log.error(f"Failed to send invoice WhatsApp: {e}")
        
    return _clean(doc)


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, user: dict = Depends(A.get_current_user)):
    inv = await db.invoices.find_one({"_id": oid(iid)})
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(inv)


@api.put("/invoices/{iid}")
async def update_invoice(iid: str, payload: M.InvoiceIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    doc = _compute_invoice_totals(doc)
    doc["updated_at"] = now_iso()
    await db.invoices.update_one({"_id": oid(iid)}, {"$set": doc})
    return _clean(await db.invoices.find_one({"_id": oid(iid)}))


@api.delete("/invoices/{iid}")
async def delete_invoice(iid: str, user: dict = Depends(A.require_roles("admin"))):
    await db.invoices.delete_one({"_id": oid(iid)})
    return {"ok": True}


async def _get_clinic_for_invoice(inv: dict, patient: dict = None) -> dict:
    cid = inv.get("clinic_id") or (patient.get("clinic_id") if patient else None)
    
    clinic_doc = None
    setting_doc = None
    
    if cid:
        try:
            clinic_doc = await db.clinics.find_one({"_id": oid(cid)})
        except Exception:
            clinic_doc = await db.clinics.find_one({"_id": cid})
        setting_doc = await db.settings.find_one({"clinic_id": cid})

    if not clinic_doc and not setting_doc:
        setting_doc = await db.settings.find_one({"_key": "clinic"}) or {}
        clinic_doc = await db.clinics.find_one({}) or {}
    
    setting_doc = setting_doc or {}
    clinic_doc = clinic_doc or {}
    
    name = setting_doc.get("clinic_name") or clinic_doc.get("name") or "ABC Dental Clinic"
    address = setting_doc.get("address") or clinic_doc.get("address") or ""
    phone = setting_doc.get("phone") or clinic_doc.get("phone") or ""
    email = setting_doc.get("email") or clinic_doc.get("email") or ""
    gst = (
        setting_doc.get("gst_number")
        or setting_doc.get("gst")
        or clinic_doc.get("gst")
        or clinic_doc.get("gst_number")
        or clinic_doc.get("gstin")
        or "—"
    )
    doctor_name = setting_doc.get("doctor_name") or clinic_doc.get("doctor_name") or "Avi B P"
    doctor_title = setting_doc.get("doctor_title") or clinic_doc.get("doctor_title") or "Orthodontist"
    
    return {
        "name": name,
        "clinic_name": name,
        "address": address,
        "phone": phone,
        "email": email,
        "gst": gst,
        "gst_number": gst,
        "doctor_name": doctor_name,
        "doctor_title": doctor_title,
    }


@api.get("/invoices/{iid}/pdf")
async def invoice_pdf(iid: str, user: dict = Depends(A.get_current_user)):
    inv = await db.invoices.find_one({"_id": oid(iid)})
    if not inv:
        raise HTTPException(status_code=404, detail="Not found")
    inv = _clean(inv)
    patient = None
    if inv.get("patient_id"):
        try:
            patient = await db.patients.find_one({"_id": oid(inv["patient_id"])})
        except Exception:
            patient = await db.patients.find_one({"patient_id": inv["patient_id"]})
    patient = _clean(patient) if patient else {}
    clinic = await _get_clinic_for_invoice(inv, patient)
    pdf_bytes = generate_invoice_pdf(inv, patient, clinic)
    inv_num = inv.get("invoice_number", "invoice")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv_num}.pdf"'},
    )


# ---------------- PAYMENTS ----------------
@api.get("/payments")
async def list_payments(patient_id: Optional[str] = None, invoice_id: Optional[str] = None,
                        user: dict = Depends(A.get_current_user)):
    q = {}
    if patient_id: q["patient_id"] = patient_id
    if invoice_id: q["invoice_id"] = invoice_id
    _filter_clinic(q, user)
    items = [_clean(p) for p in await db.payments.find(q).sort("payment_date", -1).to_list(1000)]
    return items


@api.post("/payments")
async def create_payment(payload: M.PaymentIn, user: dict = Depends(A.get_current_user)):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    r = await db.payments.insert_one(doc)
    doc["_id"] = r.inserted_id
    # Update invoice paid_amount/balance/status if invoice_id present
    if doc.get("invoice_id"):
        inv = await db.invoices.find_one({"_id": oid(doc["invoice_id"])})
        if inv:
            paid = float(inv.get("paid_amount", 0)) + float(doc["amount"])
            total = float(inv.get("grand_total", 0))
            balance = max(total - paid, 0)
            status = "paid" if balance <= 0.01 else ("partial" if paid > 0 else "unpaid")
            await db.invoices.update_one({"_id": inv["_id"]}, {"$set": {
                "paid_amount": paid, "balance": balance, "payment_status": status,
                "payment_method": doc["payment_method"],
            }})
            
            # Send WhatsApp Notification
            patient = await db.patients.find_one({"_id": oid(inv["patient_id"])})
            if patient and patient.get("phone"):
                try:
                    clinic_name = await _get_clinic_name(inv.get("clinic_id"))
                    portal_url = os.environ.get("PORTAL_URL", "http://localhost:5173/portal")
                    wa_body = sms.build_payment_received_message(
                        patient.get("full_name", "Patient"),
                        inv.get("invoice_number", ""),
                        float(doc["amount"]),
                        clinic_name,
                        f"{portal_url}/invoices"
                    )
                    await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
                        "invoice_id": str(inv["_id"]),
                        "payment_id": str(doc["_id"]),
                        "type": "payment_received"
                    })
                except Exception as e:
                    log.error(f"Failed to send payment WhatsApp: {e}")
    return _clean(doc)


# ---------------- DOCTORS ----------------
@api.get("/doctors")
async def list_doctors(user: dict = Depends(A.get_current_user)):
    q = _filter_clinic({}, user)
    return [_clean(d) for d in await db.doctors.find(q).to_list(200)]


@api.post("/doctors")
async def create_doctor(payload: M.DoctorIn, user: dict = Depends(A.require_roles("admin"))):
    doc = payload.model_dump()
    cid = _get_user_clinic_id(user)
    if cid: doc["clinic_id"] = cid
    doc["created_at"] = now_iso()
    r = await db.doctors.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _clean(doc)


@api.put("/doctors/{did}")
async def update_doctor(did: str, payload: M.DoctorIn, user: dict = Depends(A.require_roles("admin"))):
    await db.doctors.update_one({"_id": oid(did)}, {"$set": payload.model_dump()})
    return _clean(await db.doctors.find_one({"_id": oid(did)}))


@api.delete("/doctors/{did}")
async def delete_doctor(did: str, user: dict = Depends(A.require_roles("admin"))):
    await db.doctors.delete_one({"_id": oid(did)})
    return {"ok": True}


# ---------------- DOCTOR SCHEDULE / SLOTS ----------------
_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


@api.get("/doctors/{did}/slots")
async def doctor_slots(did: str, date_str: str = Query(..., alias="date"),
                       user: dict = Depends(A.get_current_user)):
    """Return available slots for a doctor on a given date."""
    doc = await db.doctors.find_one({"_id": oid(did)})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    day_key = _DAY_KEYS[d.weekday()]
    schedule = (doc.get("schedule") or {}).get(day_key) or []
    dur = int(doc.get("slot_duration_minutes") or 30)

    # Build all candidate slots for the day
    candidates = []
    for rng in schedule:
        start, end = _minutes(rng["start"]), _minutes(rng["end"])
        t = start
        while t + dur <= end:
            candidates.append(_hhmm(t))
            t += dur

    # Filter out already-booked slots
    booked = await db.appointments.find({
        "doctor_id": did, "date": date_str,
        "status": {"$in": ["booked", "rescheduled"]},
    }).to_list(500)
    booked_times = {a["time"] for a in booked}
    available = [t for t in candidates if t not in booked_times]

    return {
        "date": date_str, "day": day_key,
        "slot_duration_minutes": dur,
        "slots": available,
        "booked": sorted(list(booked_times)),
    }


# ---------------- SETTINGS ----------------
@api.get("/settings")
async def get_settings(clinic_id: Optional[str] = None, user: dict = Depends(A.get_current_user)):
    cid = clinic_id or _get_user_clinic_id(user)
    if cid:
        s = await db.settings.find_one({"clinic_id": cid}) or {}
        if not s:
            clinic = await db.clinics.find_one({"_id": oid(cid)})
            s = {
                "clinic_name": clinic.get("name") if clinic else "Clinic Settings",
                "clinic_logo": None,
                "address": clinic.get("address") if clinic else None,
                "phone": clinic.get("phone") if clinic else None,
                "email": clinic.get("email") if clinic else None,
                "invoice_prefix": "INV",
                "currency": "INR",
                "timezone": "Asia/Kolkata",
            }
    else:
        s = await db.settings.find_one({"_key": "clinic"}) or {}
    s.pop("_id", None); s.pop("_key", None)
    return s


@api.put("/settings")
async def update_settings(payload: M.SettingsIn, clinic_id: Optional[str] = None, user: dict = Depends(A.require_roles("admin"))):
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    cid = clinic_id or _get_user_clinic_id(user)
    if cid:
        doc["clinic_id"] = cid
        await db.settings.update_one({"clinic_id": cid}, {"$set": doc}, upsert=True)
        await db.clinics.update_one({"_id": oid(cid)}, {"$set": {
            "name": doc.get("clinic_name"),
            "address": doc.get("address"),
            "phone": doc.get("phone"),
            "email": doc.get("email"),
        }})
    else:
        await db.settings.update_one({"_key": "clinic"}, {"$set": doc}, upsert=True)
    return doc


# ---------------- NOTIFICATIONS ----------------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(A.get_current_user)):
    q = {"$or": [{"target_role": None}, {"target_role": user["role"]}, {"user_id": user["id"]}]}
    items = [_clean(n) for n in await db.notifications.find(q).sort("created_at", -1).to_list(200)]
    return items


@api.post("/notifications")
async def create_notification(payload: M.NotificationIn, user: dict = Depends(A.require_roles("admin"))):
    doc = payload.model_dump()
    doc["created_at"] = now_iso()
    doc["read"] = False
    r = await db.notifications.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _clean(doc)


@api.patch("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(A.get_current_user)):
    await db.notifications.update_one({"_id": oid(nid)}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/mark-all-read")
async def mark_all_read(user: dict = Depends(A.get_current_user)):
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- DASHBOARD / REPORTS ----------------
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(A.get_current_user)):
    today = date.today().isoformat()
    month_start = date.today().replace(day=1).isoformat()
    year_start = date.today().replace(month=1, day=1).isoformat()

    base_q = _filter_clinic({}, user)

    total_patients = await db.patients.count_documents({"is_deleted": {"$ne": True}, **base_q})
    today_appts = await db.appointments.count_documents({"date": today, **base_q})
    upcoming_appts = await db.appointments.count_documents({"date": {"$gt": today}, "status": "booked", **base_q})
    cancelled_appts = await db.appointments.count_documents({"status": "cancelled", **base_q})
    completed_treatments = await db.treatments.count_documents(base_q)

    async def sum_revenue(match):
        match.update(base_q)
        pipe = [{"$match": match}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]
        r = await db.payments.aggregate(pipe).to_list(1)
        return r[0]["s"] if r else 0

    revenue_today = await sum_revenue({"payment_date": today})
    revenue_month = await sum_revenue({"payment_date": {"$gte": month_start}})
    revenue_year = await sum_revenue({"payment_date": {"$gte": year_start}})

    pending_match = {"payment_status": {"$in": ["unpaid", "partial"]}}
    pending_match.update(base_q)
    pending_pipe = [{"$match": pending_match},
                    {"$group": {"_id": None, "s": {"$sum": "$balance"}}}]
    pending_r = await db.invoices.aggregate(pending_pipe).to_list(1)
    pending_payments = pending_r[0]["s"] if pending_r else 0

    recent_patients = [_clean(p) for p in await db.patients.find({"is_deleted": {"$ne": True}, **base_q}).sort("created_at", -1).limit(5).to_list(5)]
    recent_bills = [_clean(i) for i in await db.invoices.find(base_q).sort("created_at", -1).limit(5).to_list(5)]

    # Today's schedule
    today_schedule_raw = await db.appointments.find({"date": today, **base_q}).sort("time", 1).to_list(50)
    today_schedule = []
    for a in today_schedule_raw:
        a = _clean(a)
        if a.get("patient_id"):
            p = await db.patients.find_one({"_id": oid(a["patient_id"])})
            a["patient_name"] = p.get("full_name") if p else None
        today_schedule.append(a)

    # Revenue over last 12 months
    revenue_chart = []
    for i in range(11, -1, -1):
        d = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
        # simpler: compute month offset
    from calendar import monthrange
    today_d = date.today()
    rev_by_month = []
    for i in range(11, -1, -1):
        year = today_d.year
        month = today_d.month - i
        while month <= 0:
            month += 12
            year -= 1
        first = date(year, month, 1).isoformat()
        last_day = monthrange(year, month)[1]
        last = date(year, month, last_day).isoformat()
        m_q = {"payment_date": {"$gte": first, "$lte": last}}
        m_q.update(base_q)
        pipe = [{"$match": m_q},
                {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]
        r = await db.payments.aggregate(pipe).to_list(1)
        rev_by_month.append({"month": f"{year}-{month:02d}", "revenue": r[0]["s"] if r else 0})

    # Patients per month
    patients_by_month = []
    for i in range(11, -1, -1):
        year = today_d.year
        month = today_d.month - i
        while month <= 0:
            month += 12
            year -= 1
        first = date(year, month, 1).isoformat()
        last_day = monthrange(year, month)[1]
        last = date(year, month, last_day).isoformat() + "T23:59:59"
        p_q = {"created_at": {"$gte": first, "$lte": last}, "is_deleted": {"$ne": True}}
        p_q.update(base_q)
        c = await db.patients.count_documents(p_q)
        patients_by_month.append({"month": f"{year}-{month:02d}", "count": c})

    # Procedure stats
    proc_pipe = [{"$match": base_q},
                 {"$group": {"_id": "$procedure_name", "count": {"$sum": 1}}},
                 {"$sort": {"count": -1}}, {"$limit": 10}]
    procs = [{"name": p["_id"] or "Unknown", "count": p["count"]}
             for p in await db.treatments.aggregate(proc_pipe).to_list(10)]

    return {
        "total_patients": total_patients,
        "today_appointments": today_appts,
        "upcoming_appointments": upcoming_appts,
        "cancelled_appointments": cancelled_appts,
        "completed_treatments": completed_treatments,
        "revenue_today": revenue_today,
        "revenue_month": revenue_month,
        "revenue_year": revenue_year,
        "pending_payments": pending_payments,
        "recent_patients": recent_patients,
        "recent_bills": recent_bills,
        "today_schedule": today_schedule,
        "revenue_chart": rev_by_month,
        "patients_chart": patients_by_month,
        "procedure_stats": procs,
    }


@api.get("/reports/revenue")
async def report_revenue(date_from: str, date_to: str, user: dict = Depends(A.get_current_user)):
    match_q = {"payment_date": {"$gte": date_from, "$lte": date_to}}
    _filter_clinic(match_q, user)
    pipe = [
        {"$match": match_q},
        {"$group": {"_id": "$payment_date", "revenue": {"$sum": "$amount"}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.payments.aggregate(pipe).to_list(1000)
    return [{"date": r["_id"], "revenue": r["revenue"]} for r in rows]


@api.get("/reports/outstanding")
async def report_outstanding(user: dict = Depends(A.get_current_user)):
    q = {"payment_status": {"$in": ["unpaid", "partial"]}}
    _filter_clinic(q, user)
    invs = await db.invoices.find(q).to_list(1000)
    out = []
    for inv in invs:
        inv = _clean(inv)
        p = await db.patients.find_one({"_id": oid(inv["patient_id"])}) if inv.get("patient_id") else None
        inv["patient_name"] = p.get("full_name") if p else None
        out.append(inv)
    return out


# ---------------- GLOBAL SEARCH ----------------
@api.get("/search")
async def global_search(q: str, user: dict = Depends(A.get_current_user)):
    rx = {"$regex": q, "$options": "i"}
    pat_q = {"$or": [
        {"full_name": rx}, {"phone": rx}, {"email": rx}, {"patient_id": rx}
    ]}
    _filter_clinic(pat_q, user)
    patients = [_clean(p) for p in await db.patients.find(pat_q).limit(10).to_list(10)]
    
    inv_q = {"invoice_number": rx}
    _filter_clinic(inv_q, user)
    invoices = [_clean(i) for i in await db.invoices.find(inv_q).limit(10).to_list(10)]
    
    appt_q = {"reason": rx}
    _filter_clinic(appt_q, user)
    appts_docs = await db.appointments.find(appt_q).limit(10).to_list(10)
    appts = [_clean(a) for a in appts_docs]
    return {"patients": patients, "invoices": invoices, "appointments": appts}


# ---------------- FILE UPLOADS ----------------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), folder: str = "uploads",
                      user: dict = Depends(A.get_current_user)):
    data = await file.read()
    path = S.build_path(APP_NAME, f"{folder}/{user['id']}", file.filename or "file.bin")
    try:
        result = S.put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    fid = str(uuid.uuid4())
    await db.files.insert_one({
        "id": fid,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "folder": folder,
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"id": fid, "path": result["path"], "url": f"/api/files/{fid}"}


@api.get("/files/{fid}")
async def get_file(fid: str, request: Request, auth: Optional[str] = Query(None)):
    # Allow either cookie auth OR ?auth=<token> for <img src>
    try:
        await A.get_current_user(request)
    except HTTPException:
        if not auth:
            raise
        try:
            payload = A.decode_token(auth)
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid")
        except Exception:
            raise HTTPException(status_code=401, detail="Not authenticated")

    rec = await db.files.find_one({"id": fid, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, ct = S.get_object(rec["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch failed: {e}")
    return Response(content=data, media_type=rec.get("content_type") or ct)


# ---------------- PATIENT PORTAL (self-signup) ----------------
async def get_current_patient(request: Request) -> dict:
    """Auth guard for patients (role=patient)."""
    token = request.cookies.get("access_token") or ""
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = A.decode_token(token)
        if payload.get("role") != "patient":
            raise HTTPException(status_code=403, detail="Not a patient account")
        p = await db.patients.find_one({"_id": oid(payload["sub"])})
        if not p:
            raise HTTPException(status_code=401, detail="Patient not found")
        p["id"] = str(p.pop("_id"))
        p.pop("password_hash", None)
        return p
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@api.get("/portal/clinics")
async def portal_list_clinics():
    clinics = await db.clinics.find({}).to_list(500)
    return [{"id": str(c["_id"]), "name": c["name"], "address": c.get("address"), "phone": c.get("phone")} for c in clinics]


@api.post("/portal/signup")
async def portal_signup(payload: M.PatientSignupIn, response: Response):
    email = payload.email.lower()
    if await db.patients.find_one({"email": email, "password_hash": {"$exists": True}}):
        raise HTTPException(status_code=400, detail="Account with this email already exists")
    # Try to reuse an existing patient record (created by receptionist) matching phone/email
    existing = await db.patients.find_one({"$or": [{"phone": payload.phone}, {"email": email}], "is_deleted": {"$ne": True}})
    doc = {
        "full_name": payload.full_name,
        "phone": payload.phone,
        "email": email,
        "age": payload.age,
        "password_hash": A.hash_password(payload.password),
        "self_registered": True,
        "created_at": now_iso(),
        "is_deleted": False,
        "clinic_id": payload.clinic_id,
    }
    if existing:
        doc["clinic_id"] = existing.get("clinic_id") or payload.clinic_id
        await db.patients.update_one({"_id": existing["_id"]}, {"$set": doc})
        pid = existing["_id"]
    else:
        doc["patient_id"] = await _next_patient_id()
        r = await db.patients.insert_one(doc)
        pid = r.inserted_id

    token = A.create_access_token(str(pid), email, "patient")
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    p = await db.patients.find_one({"_id": pid})
    p["id"] = str(p.pop("_id")); p.pop("password_hash", None)
    return {"patient": p, "access_token": token}


@api.post("/portal/login")
async def portal_login(payload: M.PatientLoginIn, response: Response):
    p = await db.patients.find_one({"email": payload.email.lower()})
    if not p or not p.get("password_hash") or not A.verify_password(payload.password, p["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = A.create_access_token(str(p["_id"]), p["email"], "patient")
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    p["id"] = str(p.pop("_id")); p.pop("password_hash", None)
    return {"patient": p, "access_token": token}


@api.get("/portal/me")
async def portal_me(patient: dict = Depends(get_current_patient)):
    if patient.get("clinic_id"):
        clinic = await db.clinics.find_one({"_id": oid(patient["clinic_id"])})
        if clinic:
            patient["clinic_name"] = clinic.get("name")
    return patient


@api.get("/portal/doctors")
async def portal_doctors(patient: dict = Depends(get_current_patient)):
    q = {"active": {"$ne": False}}
    if patient.get("clinic_id"):
        q["clinic_id"] = patient["clinic_id"]
    docs = await db.doctors.find(q).to_list(200)
    return [_clean(d) for d in docs]


@api.get("/portal/doctors/{did}/slots")
async def portal_slots(did: str, date_str: str = Query(..., alias="date"),
                       patient: dict = Depends(get_current_patient)):
    # Reuse the staff slots logic
    doc = await db.doctors.find_one({"_id": oid(did)})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_key = _DAY_KEYS[d.weekday()]
    schedule = (doc.get("schedule") or {}).get(day_key) or []
    dur = int(doc.get("slot_duration_minutes") or 30)
    candidates = []
    for rng in schedule:
        start, end = _minutes(rng["start"]), _minutes(rng["end"])
        t = start
        while t + dur <= end:
            candidates.append(_hhmm(t)); t += dur
    booked = await db.appointments.find({
        "doctor_id": did, "date": date_str,
        "status": {"$in": ["booked", "rescheduled"]},
    }).to_list(500)
    booked_times = {a["time"] for a in booked}
    return {
        "date": date_str, "day": day_key,
        "slot_duration_minutes": dur,
        "slots": [t for t in candidates if t not in booked_times],
    }


@api.post("/portal/book")
async def portal_book(payload: M.PatientBookIn, patient: dict = Depends(get_current_patient)):
    # Ensure slot is still free
    exists = await db.appointments.find_one({
        "doctor_id": payload.doctor_id, "date": payload.date, "time": payload.time,
        "status": {"$in": ["booked", "rescheduled"]},
    })
    if exists:
        raise HTTPException(status_code=409, detail="This slot is no longer available")

    doc = {
        "patient_id": patient["id"],
        "doctor_id": payload.doctor_id,
        "date": payload.date,
        "time": payload.time,
        "reason": payload.reason or "General consultation",
        "status": "booked",
        "reminder": True,
        "self_booked": True,
        "created_at": now_iso(),
        "created_by": patient["id"],
    }
    if patient.get("clinic_id"):
        doc["clinic_id"] = patient["clinic_id"]
    r = await db.appointments.insert_one(doc)
    doc["_id"] = r.inserted_id
    # Send instant confirmation email
    doctor = await db.doctors.find_one({"_id": oid(payload.doctor_id)})
    clinic_name = await _get_clinic_name(patient.get("clinic_id"))
    if patient.get("email"):
        subject, html, text = N.build_confirmation_email(
            patient.get("full_name", "there"),
            (doctor or {}).get("name", "our doctor"),
            payload.date, payload.time, clinic_name,
        )
        await N.send_email(db, patient["email"], subject, html, text, meta={
            "appointment_id": str(doc["_id"]),
            "type": "confirmation",
        })
        
    # Send instant WhatsApp confirmation
    if patient.get("phone"):
        try:
            wa_body = sms.build_appointment_booked_message(
                patient.get("full_name", "Patient"),
                (doctor or {}).get("name", "our doctor"),
                payload.date, payload.time, clinic_name
            )
            await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
                "appointment_id": str(doc["_id"]),
                "type": "appointment_booked"
            })
        except Exception as e:
            log.error(f"Failed to send portal booking WhatsApp: {e}")

    return _clean(doc)


@api.get("/portal/appointments")
async def portal_appointments(patient: dict = Depends(get_current_patient)):
    items = await db.appointments.find({"patient_id": patient["id"]}).sort([("date", -1), ("time", -1)]).to_list(500)
    result = []
    doctor_ids = list({a.get("doctor_id") for a in items if a.get("doctor_id")})
    dmap = {}
    for d in await db.doctors.find({"_id": {"$in": [oid(x) for x in doctor_ids]}}).to_list(200):
        dmap[str(d["_id"])] = d.get("name")
    for a in items:
        a = _clean(a)
        a["doctor_name"] = dmap.get(a.get("doctor_id"))
        result.append(a)
    return result


@api.post("/portal/appointments/{aid}/cancel")
async def portal_cancel(aid: str, patient: dict = Depends(get_current_patient)):
    r = await db.appointments.update_one(
        {"_id": oid(aid), "patient_id": patient["id"]},
        {"$set": {"status": "cancelled", "updated_at": now_iso()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"ok": True}


@api.get("/portal/invoices")
async def portal_invoices(patient: dict = Depends(get_current_patient)):
    items = await db.invoices.find({"patient_id": patient["id"]}).sort("invoice_date", -1).to_list(500)
    return [_clean(i) for i in items]


@api.get("/portal/invoices/{iid}/pdf")
async def portal_invoice_pdf(iid: str, patient: dict = Depends(get_current_patient)):
    """Download invoice PDF — patient portal (only their own invoices)."""
    inv = await db.invoices.find_one({"_id": oid(iid)})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv = _clean(inv)
    # Security: ensure the invoice belongs to the authenticated patient
    if inv.get("patient_id") != patient["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    pat_doc = None
    if inv.get("patient_id"):
        try:
            pat_doc = await db.patients.find_one({"_id": oid(inv["patient_id"])})
        except Exception:
            pat_doc = await db.patients.find_one({"patient_id": inv["patient_id"]})
    pat_doc = _clean(pat_doc) if pat_doc else {}
    clinic = await _get_clinic_for_invoice(inv, pat_doc)
    pdf_bytes = generate_invoice_pdf(inv, pat_doc, clinic)
    inv_num = inv.get("invoice_number", "invoice")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv_num}.pdf"'},
    )


# ---------------- RESCHEDULE + REASON SMS ----------------
@api.post("/appointments/{aid}/reschedule")
async def reschedule_appointment(aid: str, payload: M.RescheduleIn,
                                 user: dict = Depends(A.require_roles("admin", "receptionist"))):
    appt = await db.appointments.find_one({"_id": oid(aid)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await db.appointments.update_one({"_id": oid(aid)}, {"$set": {
        "date": payload.date, "time": payload.time,
        "status": "rescheduled",
        "rescheduled_at": now_iso(),
        "previous_slot": {"date": appt.get("date"), "time": appt.get("time")},
        "reminder_sent_at": None,  # reset badge — new slot needs a new reminder
    }})
    return _clean(await db.appointments.find_one({"_id": oid(aid)}))


@api.post("/appointments/{aid}/send-reschedule-whatsapp")
async def send_reschedule_whatsapp(aid: str, payload: M.RescheduleSmsIn,
                               user: dict = Depends(A.require_roles("admin", "receptionist"))):
    if payload.reason not in N.RESCHEDULE_REASONS:
        raise HTTPException(status_code=400, detail="Invalid reason")
    appt = await db.appointments.find_one({"_id": oid(aid)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    patient = await db.patients.find_one({"_id": oid(appt["patient_id"])})
    if not patient or not patient.get("email"):
        raise HTTPException(status_code=400, detail="Patient missing email")
    doctor = await db.doctors.find_one({"_id": oid(appt["doctor_id"])}) if appt.get("doctor_id") else None
    clinic_name = await _get_clinic_name(appt.get("clinic_id") or patient.get("clinic_id"))
    
    # Email
    subject, html, text = N.build_reschedule_email(
        patient.get("full_name", "there"),
        (doctor or {}).get("name", "your doctor"),
        appt.get("date"), appt.get("time"),
        clinic_name, payload.reason,
    )
    result = await N.send_email(db, patient["email"], subject, html, text, meta={
        "appointment_id": str(appt["_id"]),
        "type": "reschedule",
        "reason": payload.reason,
    })
    
    # WhatsApp
    if patient.get("phone"):
        wa_body = sms.build_reschedule_message(
            patient.get("full_name", "there"),
            (doctor or {}).get("name", "your doctor"),
            appt.get("date", ""), appt.get("time", ""),
            clinic_name, payload.reason,
        )
        await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
            "appointment_id": str(appt["_id"]),
            "type": "reschedule",
            "reason": payload.reason,
        })

    await db.appointments.update_one({"_id": appt["_id"]}, {"$set": {
        "reschedule_whatsapp_sent_at": now_iso(),
        "reschedule_whatsapp_reason": payload.reason,
    }})
    return result

# ---------------- VISIT → INVOICE ----------------
@api.post("/visits/{vid}/generate-invoice")
async def generate_invoice_from_visit(vid: str, user: dict = Depends(A.require_roles("admin", "receptionist"))):
    v = await db.visits.find_one({"_id": oid(vid)})
    if not v:
        raise HTTPException(status_code=404, detail="Visit not found")
    if v.get("invoice_id"):
        return {"ok": True, "invoice_id": v["invoice_id"], "existing": True}
    amount = float(v.get("amount_charged", 0) or 0)
    inv_doc = {
        "patient_id": v["patient_id"],
        "doctor_id": v.get("doctor_id"),
        "invoice_date": v.get("visit_date") or date.today().isoformat(),
        "items": [{
            "procedure": v.get("procedure_done") or "Consultation",
            "description": v.get("diagnosis") or "",
            "quantity": 1, "rate": amount, "amount": amount,
        }],
        "discount": float(v.get("discount", 0) or 0),
        "tax": float(v.get("tax", 0) or 0),
        "paid_amount": 0,
        "payment_method": v.get("payment_method"),
        "notes": f"Generated from visit on {v.get('visit_date')}",
    }
    clinic_id = v.get("clinic_id") or _get_user_clinic_id(user)
    if clinic_id:
        inv_doc["clinic_id"] = clinic_id
    inv_doc = _compute_invoice_totals(inv_doc)
    inv_doc["invoice_number"] = await _next_invoice_number(clinic_id)
    inv_doc["created_at"] = now_iso()
    inv_doc["created_by"] = user["id"]
    inv_doc["visit_id"] = str(v["_id"])
    r = await db.invoices.insert_one(inv_doc)
    await db.visits.update_one({"_id": v["_id"]}, {"$set": {"invoice_id": str(r.inserted_id)}})
    inv_doc["_id"] = r.inserted_id
    
    # Notify via WhatsApp
    try:
        await _notify_invoice_created(inv_doc)
    except Exception as e:
        log.error(f"Failed to send invoice WhatsApp: {e}")
        
    return _clean(inv_doc)


# ---------------- SMS REMINDERS ----------------
async def _get_clinic_name(clinic_id: Optional[str] = None) -> str:
    if clinic_id:
        c = await db.clinics.find_one({"_id": oid(clinic_id)})
        if c and c.get("name"):
            return c["name"]
        s = await db.settings.find_one({"clinic_id": clinic_id})
        if s and s.get("clinic_name"):
            return s["clinic_name"]
    s = await db.settings.find_one({"_key": "clinic"}) or {}
    return s.get("clinic_name", "ABC Dental Clinic")


async def _notify_invoice_created(inv: dict):
    patient = await db.patients.find_one({"_id": oid(inv["patient_id"])})
    if not patient or not patient.get("phone"):
        return
    clinic_name = await _get_clinic_name(inv.get("clinic_id"))
    portal_url = os.environ.get("PORTAL_URL", "http://localhost:5173/portal")
    wa_body = sms.build_invoice_whatsapp_message(
        patient.get("full_name", "Patient"),
        inv.get("invoice_number", ""),
        float(inv.get("net_amount", 0)),
        inv.get("invoice_date", date.today().isoformat()),
        clinic_name,
        f"{portal_url}/invoices"
    )
    await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
        "invoice_id": str(inv["_id"]),
        "patient_id": str(patient["_id"]),
        "type": "invoice_created"
    })


async def _send_appointment_reminder(appt: dict, force: bool = False) -> dict:
    if not appt.get("patient_id"):
        return {"ok": False, "error": "no patient"}
    # Idempotency: skip if reminder already sent within last 20 hours
    if not force and appt.get("reminder_sent_at"):
        try:
            last = datetime.fromisoformat(appt["reminder_sent_at"])
            if (datetime.now(timezone.utc) - last).total_seconds() < 20 * 3600:
                return {"ok": True, "skipped": True, "reason": "reminder already sent recently"}
        except Exception:
            pass
    patient = await db.patients.find_one({"_id": oid(appt["patient_id"])})
    if not patient or not patient.get("email"):
        return {"ok": False, "error": "patient missing email"}
    clinic_name = await _get_clinic_name(appt.get("clinic_id") or patient.get("clinic_id"))
    subject, html, text = N.build_reminder_email(
        patient.get("full_name", "Patient"),
        appt.get("date", ""), appt.get("time", ""),
        clinic_name,
    )
    result = await N.send_email(db, patient["email"], subject, html, text, meta={
        "appointment_id": str(appt["_id"]) if "_id" in appt else appt.get("id"),
        "patient_id": str(patient["_id"]),
        "type": "reminder",
    })
    
    # WhatsApp Reminder
    if patient.get("phone"):
        wa_body = sms.build_reminder_message(
            patient.get("full_name", "Patient"),
            appt.get("date", ""), appt.get("time", ""),
            clinic_name,
        )
        await sms.send_whatsapp(db, patient["phone"], wa_body, meta={
            "appointment_id": str(appt["_id"]) if "_id" in appt else appt.get("id"),
            "patient_id": str(patient["_id"]),
            "type": "reminder",
        })

    # Track on appointment doc when actually sent (or simulated)
    if result.get("status") in ("sent", "simulated"):
        await db.appointments.update_one(
            {"_id": appt["_id"] if "_id" in appt else oid(appt.get("id"))},
            {"$set": {
                "reminder_sent_at": datetime.now(timezone.utc).isoformat(),
                "reminder_status": result.get("status"),
            }},
        )
    return result


async def _cron_send_tomorrow_reminders():
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    log.info(f"[CRON] Sending reminders for {tomorrow}")
    appts = await db.appointments.find({"date": tomorrow, "status": "booked", "reminder": True}).to_list(1000)
    sent = 0
    for a in appts:
        r = await _send_appointment_reminder(a)
        if r.get("ok"): sent += 1
    log.info(f"[CRON] Sent {sent}/{len(appts)} reminders")


@api.post("/appointments/{aid}/send-reminder")
async def send_appointment_reminder(aid: str, force: bool = False, user: dict = Depends(A.get_current_user)):
    appt = await db.appointments.find_one({"_id": oid(aid)})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    result = await _send_appointment_reminder(appt, force=force)
    if result.get("skipped"):
        return {"ok": True, "skipped": True, "message": "Reminder already sent recently. Pass ?force=true to resend."}
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Email failed"))
    return result


@api.post("/reminders/send-tomorrow")
async def send_tomorrow_reminders(user: dict = Depends(A.require_roles("admin", "receptionist"))):
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    appts = await db.appointments.find({"date": tomorrow, "status": "booked", "reminder": True}).to_list(1000)
    results = []
    sent = 0
    for a in appts:
        r = await _send_appointment_reminder(a)
        results.append({"appointment_id": str(a["_id"]), **r})
        if r.get("ok"): sent += 1
    return {"date": tomorrow, "total": len(appts), "sent": sent, "results": results}


@api.get("/sms/logs")
async def sms_logs(limit: int = 100, user: dict = Depends(A.get_current_user)):
    """Legacy alias — returns email logs now."""
    logs = await db.email_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    for lg in logs:
        lg["id"] = str(lg.pop("_id"))
    return logs


@api.get("/email/logs")
async def email_logs(limit: int = 100, user: dict = Depends(A.get_current_user)):
    logs = await db.email_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    for lg in logs:
        lg["id"] = str(lg.pop("_id"))
    return logs


# ---------------- DOWNLOAD SOURCE BUNDLE ----------------
@api.get("/download/bundle")
async def download_bundle():
    """Public: download the full source as a single markdown file."""
    p = Path("/app/dental-clinic-bundle.md")
    if not p.exists():
        raise HTTPException(status_code=404, detail="Bundle not generated")
    return StreamingResponse(
        io.BytesIO(p.read_bytes()),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="dental-clinic-bundle.md"'},
    )


@api.get("/download/tarball")
async def download_tarball():
    """Public: download the full source as a tar.gz archive."""
    p = Path("/app/dental-clinic-code.tar.gz")
    if not p.exists():
        raise HTTPException(status_code=404, detail="Tarball not generated")
    return StreamingResponse(
        io.BytesIO(p.read_bytes()),
        media_type="application/gzip",
        headers={"Content-Disposition": 'attachment; filename="dental-clinic-code.tar.gz"'},
    )


@api.get("/download/zip")
async def download_zip():
    """Public: download the full source as a zip (Windows-friendly)."""
    p = Path("/app/dental-clinic-code.zip")
    if not p.exists():
        raise HTTPException(status_code=404, detail="Zip not generated")
    return StreamingResponse(
        io.BytesIO(p.read_bytes()),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="abc-dental-clinic.zip"'},
    )


# ---------------- HEALTH ----------------
@api.get("/")
async def root():
    return {"ok": True, "service": "ABC Dental Clinic API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
