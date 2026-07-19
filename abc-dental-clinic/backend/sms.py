"""WhatsApp helpers for local Node.js microservice."""
import os
import logging
from datetime import datetime, timezone
import requests

log = logging.getLogger(__name__)

def _normalize(phone: str) -> str:
    p = (phone or "").strip().replace(" ", "").replace("-", "")
    if not p:
        return p
    if p.startswith("+"):
        return p.replace("+", "")
    # naive: assume India if 10 digits
    if len(p) == 10:
        return "91" + p
    return p

async def send_whatsapp(db, to_phone: str, body: str, meta: dict | None = None) -> dict:
    """Send WhatsApp message via local Node.js microservice."""
    raw_to = _normalize(to_phone)
    if not raw_to:
        return {"ok": False, "error": "Invalid phone number"}
    
    to = f"{raw_to}@c.us"
    entry = {
        "to": to,
        "body": body,
        "status": "queued",
        "provider": "local_whatsapp",
        "provider_sid": None,
        "error": None,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    url = "http://localhost:3000/api/sendText"
    payload = {
        "chatId": to,
        "text": body
    }
    
    try:
        # We use a timeout to avoid blocking the async event loop indefinitely if service is down
        response = requests.post(url, json=payload, timeout=5)
        data = response.json()
        if data.get("success"):
            entry["status"] = "sent"
        else:
            entry["status"] = "failed"
            entry["error"] = data.get("error", "Unknown error from Node service")
            log.error(f"Local WhatsApp send failed to {to}: {entry['error']}")
    except Exception as e:
        entry["status"] = "failed"
        entry["error"] = str(e)
        log.error(f"Could not connect to local WhatsApp service at {url}: {e}")

    await db.sms_logs.insert_one(entry)
    return {"ok": entry["status"] not in ("failed",), **entry}


def build_reminder_message(patient_name: str, date: str, time: str, clinic_name: str) -> str:
    return (
        f"Hi {patient_name}, this is a reminder for your appointment at {clinic_name} "
        f"on {date} at {time}. Reply CANCEL to cancel. Thank you."
    )


def build_confirmation_message(patient_name: str, doctor_name: str, date: str, time: str, clinic_name: str) -> str:
    return (
        f"Hi {patient_name}, your appointment with {doctor_name} at {clinic_name} "
        f"is confirmed for {date} at {time}. See you soon!"
    )


RESCHEDULE_REASONS = {
    "doctor_unavailable": "the doctor is unavailable",
    "specialist_different": "a different specialist is required for your case",
    "patient_not_available": "you were noted as unavailable at the earlier time",
}


def build_reschedule_message(patient_name: str, doctor_name: str, date: str, time: str,
                             clinic_name: str, reason_key: str) -> str:
    reason_text = RESCHEDULE_REASONS.get(reason_key, "of scheduling changes")
    return (
        f"Hi {patient_name}, your appointment at {clinic_name} with {doctor_name} "
        f"has been rescheduled to {date} at {time} because {reason_text}. "
        f"Sorry for the inconvenience. Reply CANCEL to cancel."
    )


def build_invoice_whatsapp_message(patient_name: str, invoice_number: str, amount: float, date: str, clinic_name: str, portal_link: str) -> str:
    return (
        f"Hi {patient_name},\n\n"
        f"Thank you for visiting {clinic_name}. Your invoice #{invoice_number} dated {date} for the amount of Rs. {amount:,.2f} is ready.\n\n"
        f"You can view and download your full invoice securely from our patient portal: {portal_link}\n\n"
        f"Regards,\n{clinic_name}"
    )

def build_payment_received_message(patient_name: str, invoice_number: str, paid_amount: float, clinic_name: str, portal_link: str) -> str:
    return (
        f"Hi {patient_name},\n\n"
        f"We have received your payment of Rs. {paid_amount:,.2f} for Invoice #{invoice_number} at {clinic_name}.\n\n"
        f"You can view your updated invoice and receipt here: {portal_link}\n\n"
        f"Thank you!"
    )

def build_appointment_booked_message(patient_name: str, doctor_name: str, date: str, time: str, clinic_name: str) -> str:
    return (
        f"Hi {patient_name},\n\n"
        f"Your appointment at {clinic_name} with {doctor_name} has been successfully booked for {date} at {time}.\n\n"
        f"We look forward to seeing you!"
    )
