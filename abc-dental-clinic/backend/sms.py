"""Twilio SMS helpers. Simulates when creds are missing."""
import os
import logging
from datetime import datetime, timezone
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

log = logging.getLogger(__name__)


def _client():
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    tok = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not tok or not sid.startswith("AC"):
        return None
    return Client(sid, tok)


def _from_number() -> str | None:
    return os.environ.get("TWILIO_FROM_NUMBER")


def _normalize(phone: str) -> str:
    p = (phone or "").strip().replace(" ", "").replace("-", "")
    if not p:
        return p
    if p.startswith("+"):
        return p
    # naive: assume India if 10 digits
    if len(p) == 10:
        return "+91" + p
    return "+" + p


async def send_sms(db, to_phone: str, body: str, meta: dict | None = None) -> dict:
    """Send SMS via Twilio if configured, else log as simulated. Always writes to db.sms_logs."""
    to = _normalize(to_phone)
    entry = {
        "to": to,
        "body": body,
        "status": "queued",
        "provider": "twilio",
        "provider_sid": None,
        "error": None,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    client = _client()
    from_number = _from_number()
    if not client or not from_number:
        entry["status"] = "simulated"
        entry["error"] = "Twilio credentials missing — SMS not actually sent"
        log.warning(f"[SIMULATED SMS] to={to} body={body[:80]}")
        await db.sms_logs.insert_one(entry)
        return {"ok": True, "simulated": True, **entry}

    try:
        msg = client.messages.create(body=body, from_=from_number, to=to)
        entry["status"] = msg.status or "sent"
        entry["provider_sid"] = msg.sid
    except TwilioRestException as e:
        entry["status"] = "failed"
        entry["error"] = str(e)
        log.error(f"Twilio send failed to {to}: {e}")
    except Exception as e:
        entry["status"] = "failed"
        entry["error"] = str(e)

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
