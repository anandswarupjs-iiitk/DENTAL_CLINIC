"""Pydantic models for the dental clinic app."""
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- AUTH ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "receptionist"  # admin | doctor | receptionist


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


# ---------- PATIENT ----------
class PatientIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone: str
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    occupation: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    smoking: bool = False
    alcohol: bool = False
    diabetes: bool = False
    hypertension: bool = False
    previous_dental_history: Optional[str] = None
    notes: Optional[str] = None
    profile_photo: Optional[str] = None


# ---------- APPOINTMENT ----------
class AppointmentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    patient_id: str
    doctor_id: Optional[str] = None
    date: str  # ISO date
    time: str  # HH:MM
    reason: Optional[str] = None
    status: str = "booked"  # booked | completed | cancelled | no_show | rescheduled
    reminder: bool = True
    notes: Optional[str] = None


# ---------- VISIT / TREATMENT ----------
class VisitIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    patient_id: str
    doctor_id: Optional[str] = None
    visit_date: str
    visit_time: Optional[str] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    procedure_done: Optional[str] = None
    treatment_notes: Optional[str] = None
    prescription: Optional[str] = None
    amount_charged: float = 0
    discount: float = 0
    tax: float = 0
    final_amount: float = 0
    payment_status: str = "unpaid"
    payment_method: Optional[str] = None
    next_visit_date: Optional[str] = None
    next_visit_time: Optional[str] = None
    images: List[str] = []
    files: List[str] = []
    remarks: Optional[str] = None


class TreatmentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    patient_id: str
    doctor_id: Optional[str] = None
    procedure_name: str
    treatment_date: str
    procedure_cost: float = 0
    procedure_description: Optional[str] = None
    remarks: Optional[str] = None
    images: List[str] = []
    files: List[str] = []


# ---------- INVOICE / PAYMENT ----------
class InvoiceItem(BaseModel):
    procedure: str
    description: Optional[str] = ""
    quantity: int = 1
    rate: float = 0
    amount: float = 0


class InvoiceIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    patient_id: str
    doctor_id: Optional[str] = None
    invoice_date: str
    items: List[InvoiceItem]
    subtotal: float = 0
    discount: float = 0
    tax: float = 0
    grand_total: float = 0
    payment_method: Optional[str] = None
    payment_status: str = "unpaid"  # paid | unpaid | partial
    paid_amount: float = 0
    balance: float = 0
    notes: Optional[str] = None


class PaymentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: Optional[str] = None
    patient_id: str
    amount: float
    payment_method: str  # cash | upi | credit_card | debit_card | bank_transfer | cheque
    transaction_id: Optional[str] = None
    payment_date: str
    notes: Optional[str] = None


# ---------- DOCTOR ----------
class DoctorSchedule(BaseModel):
    """Weekly recurring schedule. Each day is a list of {start, end} in HH:MM."""
    mon: List[dict] = []
    tue: List[dict] = []
    wed: List[dict] = []
    thu: List[dict] = []
    fri: List[dict] = []
    sat: List[dict] = []
    sun: List[dict] = []


class DoctorIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    specialization: Optional[str] = "Orthodontist"
    phone: Optional[str] = None
    email: Optional[str] = None
    experience_years: Optional[int] = None
    qualification: Optional[str] = None
    active: bool = True
    slot_duration_minutes: int = 30
    schedule: DoctorSchedule = DoctorSchedule()


# ---------- PATIENT PORTAL ----------
class PatientSignupIn(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    age: int
    password: str


class PatientLoginIn(BaseModel):
    email: EmailStr
    password: str


class PatientBookIn(BaseModel):
    doctor_id: str
    date: str
    time: str
    reason: Optional[str] = None


# ---------- RESCHEDULE ----------
class RescheduleIn(BaseModel):
    date: str
    time: str


class RescheduleSmsIn(BaseModel):
    reason: str  # doctor_unavailable | specialist_different | patient_not_available


# ---------- SETTINGS ----------
class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    clinic_name: str = "ABC Dental Clinic"
    clinic_logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    gst_number: Optional[str] = None
    invoice_prefix: str = "INV"
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    doctor_name: str = "Avi B P"
    doctor_title: str = "Orthodontist"


class NotificationIn(BaseModel):
    title: str
    message: str
    type: str = "info"  # info | success | warning | danger
    target_role: Optional[str] = None
