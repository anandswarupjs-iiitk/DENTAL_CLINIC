"""Email notification helpers via SMTP. Simulates when creds are missing."""
import os
import ssl
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def _smtp_config():
    host = os.environ.get("EMAIL_HOST")
    port = int(os.environ.get("EMAIL_PORT") or 587)
    user = os.environ.get("EMAIL_USER")
    pw = os.environ.get("EMAIL_PASS")
    frm = os.environ.get("EMAIL_FROM") or user
    return host, port, user, pw, frm


def _configured() -> bool:
    host, _, user, pw, _ = _smtp_config()
    return bool(host and user and pw)


def _send_via_smtp(to_email: str, subject: str, html: str, text: str) -> None:
    host, port, user, pw, frm = _smtp_config()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = frm
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))
    context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls(context=context)
        server.login(user, pw)
        server.sendmail(frm, [to_email], msg.as_string())


async def send_email(db, to_email: str, subject: str, html: str, text: str,
                     meta: dict | None = None) -> dict:
    """Send email via SMTP if configured, else simulate. Always logs to db.email_logs."""
    entry = {
        "to": to_email,
        "subject": subject,
        "body_text": text,
        "body_html": html,
        "status": "queued",
        "provider": "smtp",
        "error": None,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if not to_email:
        entry["status"] = "failed"
        entry["error"] = "Recipient email missing"
        await db.email_logs.insert_one(entry)
        entry.pop("_id", None)
        return {"ok": False, **entry}

    if not _configured():
        entry["status"] = "simulated"
        entry["error"] = "SMTP credentials missing — email not actually sent"
        log.warning(f"[SIMULATED EMAIL] to={to_email} subject={subject}")
        await db.email_logs.insert_one(entry)
        entry.pop("_id", None)
        return {"ok": True, "simulated": True, **entry}

    try:
        _send_via_smtp(to_email, subject, html, text)
        entry["status"] = "sent"
    except smtplib.SMTPAuthenticationError as e:
        entry["status"] = "failed"
        entry["error"] = f"SMTP auth failed: {e}"
        log.error(entry["error"])
    except Exception as e:
        entry["status"] = "failed"
        entry["error"] = str(e)
        log.error(f"Email send failed: {e}")

    await db.email_logs.insert_one(entry)
    entry.pop("_id", None)
    return {"ok": entry["status"] == "sent", **entry}


# ---------- Formatters ----------
def format_date_display(iso_date: str) -> str:
    """Convert 'YYYY-MM-DD' → 'DD-MM-YYYY'. Returns input unchanged if unparseable."""
    if not iso_date or len(iso_date) < 10:
        return iso_date or ""
    try:
        y, m, d = iso_date[:10].split("-")
        return f"{d}-{m}-{y}"
    except Exception:
        return iso_date


def format_time_display(hhmm: str) -> str:
    """Convert 'HH:MM' 24h → 'H:MM AM/PM'. Returns input unchanged if unparseable."""
    if not hhmm or ":" not in hhmm:
        return hhmm or ""
    try:
        h, m = hhmm.split(":")[:2]
        h_int = int(h); m_int = int(m)
        am_pm = "AM" if h_int < 12 else "PM"
        h12 = h_int % 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m_int:02d} {am_pm}"
    except Exception:
        return hhmm


# ---------- Templates ----------
def _wrap_html(inner: str, clinic_name: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#1E3A8A 0%,#0D9488 100%);padding:24px;color:#fff;">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.01em;">{clinic_name}</div>
      <div style="opacity:.9;font-size:13px;margin-top:2px;">Clinic Management Suite</div>
    </div>
    <div style="padding:28px;color:#0F172A;font-size:15px;line-height:1.55;">{inner}</div>
    <div style="padding:16px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;text-align:center;">
      This is an automated message from {clinic_name}. Please do not reply.
    </div>
  </div>
</body></html>"""


def build_reminder_email(patient_name: str, date: str, time: str, clinic_name: str):
    d, t = format_date_display(date), format_time_display(time)
    subject = f"Appointment Reminder — {d} at {t}"
    text = (
        f"Hi {patient_name},\n\nThis is a reminder for your appointment at {clinic_name} "
        f"on {d} at {t}.\n\nSee you soon!\n\n— {clinic_name}"
    )
    html = _wrap_html(
        f"<p>Hi <b>{patient_name}</b>,</p>"
        f"<p>This is a friendly reminder for your appointment at <b>{clinic_name}</b>:</p>"
        f"<div style='padding:16px;background:#F0FDFA;border-left:4px solid #0D9488;border-radius:8px;margin:12px 0;'>"
        f"<div style='font-size:22px;font-weight:800;color:#0D9488;'>{t}</div>"
        f"<div style='color:#64748B;font-size:13px;'>{d}</div></div>"
        f"<p>See you soon! If you can't make it, please contact the clinic to reschedule.</p>",
        clinic_name,
    )
    return subject, html, text


def build_confirmation_email(patient_name: str, doctor_name: str, date: str, time: str, clinic_name: str):
    d, t = format_date_display(date), format_time_display(time)
    subject = f"Appointment Confirmed — {d} at {t}"
    text = (
        f"Hi {patient_name},\n\nYour appointment with {doctor_name} at {clinic_name} "
        f"is confirmed for {d} at {t}.\n\nSee you soon!\n\n— {clinic_name}"
    )
    html = _wrap_html(
        f"<p>Hi <b>{patient_name}</b>,</p>"
        f"<p>Your appointment has been <b style='color:#059669;'>confirmed</b>.</p>"
        f"<div style='padding:16px;background:#F0FDFA;border-left:4px solid #0D9488;border-radius:8px;margin:12px 0;'>"
        f"<div style='font-size:13px;color:#64748B;'>With</div>"
        f"<div style='font-size:18px;font-weight:700;color:#1E3A8A;'>{doctor_name}</div>"
        f"<div style='font-size:22px;font-weight:800;color:#0D9488;margin-top:8px;'>{t}</div>"
        f"<div style='color:#64748B;font-size:13px;'>{d}</div></div>"
        f"<p>We look forward to seeing you at {clinic_name}.</p>",
        clinic_name,
    )
    return subject, html, text


RESCHEDULE_REASONS = {
    "doctor_unavailable": "the doctor is unavailable at your original time",
    "specialist_different": "a different specialist is required for your case",
    "patient_not_available": "you were noted as unavailable at the earlier time",
}


def build_reschedule_email(patient_name: str, doctor_name: str, date: str, time: str,
                           clinic_name: str, reason_key: str):
    d, t = format_date_display(date), format_time_display(time)
    reason_text = RESCHEDULE_REASONS.get(reason_key, "of scheduling changes")
    subject = f"Appointment Rescheduled — {d} at {t}"
    text = (
        f"Hi {patient_name},\n\nYour appointment at {clinic_name} with {doctor_name} "
        f"has been rescheduled to {d} at {t} because {reason_text}.\n\n"
        f"Sorry for the inconvenience.\n\n— {clinic_name}"
    )
    html = _wrap_html(
        f"<p>Hi <b>{patient_name}</b>,</p>"
        f"<p>Your appointment has been <b style='color:#D97706;'>rescheduled</b>.</p>"
        f"<div style='padding:16px;background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:8px;margin:12px 0;'>"
        f"<div style='font-size:13px;color:#64748B;'>New time with {doctor_name}</div>"
        f"<div style='font-size:22px;font-weight:800;color:#D97706;margin-top:6px;'>{t}</div>"
        f"<div style='color:#64748B;font-size:13px;'>{d}</div></div>"
        f"<p><b>Reason:</b> {reason_text}.</p>"
        f"<p>We apologise for the inconvenience. Please contact us if this new time doesn't work for you.</p>",
        clinic_name,
    )
    return subject, html, text
