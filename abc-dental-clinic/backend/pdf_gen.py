"""ReportLab PDF generation for invoices."""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
)


BLUE = colors.HexColor("#1E3A8A")
TEAL = colors.HexColor("#0D9488")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F1F5F9")


def _safe_float(val) -> float:
    try:
        return float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def generate_invoice_pdf(invoice: dict, patient: dict, clinic: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=BLUE, fontSize=22,
                        spaceAfter=6, alignment=0)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=MUTED)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=10)
    right = ParagraphStyle("right", parent=styles["Normal"], fontSize=10, alignment=2)

    story = []

    # Header
    clinic = clinic or {}
    patient = patient or {}
    invoice = invoice or {}

    header_data = [[
        Paragraph(f"<b>{clinic.get('name') or clinic.get('clinic_name') or 'ABC Dental Clinic'}</b>", h1),
        Paragraph(f"<b>INVOICE</b>", ParagraphStyle("inv", parent=h1, alignment=2, textColor=TEAL)),
    ]]
    story.append(Table(header_data, colWidths=[100*mm, 70*mm]))
    story.append(Spacer(1, 4))

    gst_val = clinic.get('gst') or clinic.get('gst_number') or clinic.get('gstin') or '—'
    clinic_info = (
        f"{clinic.get('address', '')}<br/>"
        f"Phone: {clinic.get('phone', '')} · Email: {clinic.get('email', '')}<br/>"
        f"GST: {gst_val}"
    )
    meta_info = (
        f"<b>Invoice #:</b> {invoice.get('invoice_number','')}<br/>"
        f"<b>Date:</b> {invoice.get('invoice_date','')}<br/>"
        f"<b>Status:</b> {str(invoice.get('payment_status','')).upper()}"
    )
    story.append(Table([[Paragraph(clinic_info, small), Paragraph(meta_info, right)]],
                       colWidths=[100*mm, 70*mm]))
    story.append(Spacer(1, 12))

    # Patient Information
    story.append(Paragraph("<b>PATIENT INFORMATION</b>", ParagraphStyle("bt", parent=body, textColor=TEAL)))
    story.append(Spacer(1, 3))

    habits = []
    if patient.get("smoking"): habits.append("Smoking")
    if patient.get("alcohol"): habits.append("Alcohol")
    if patient.get("diabetes"): habits.append("Diabetes")
    if patient.get("hypertension"): habits.append("Hypertension")
    if patient.get("habits") and isinstance(patient.get("habits"), str):
        habits.append(patient.get("habits"))
    habits_str = ", ".join(habits) if habits else "None reported"

    addr_parts = [patient.get("address"), patient.get("city"), patient.get("state"), patient.get("pincode")]
    addr_str = ", ".join([str(p).strip() for p in addr_parts if p and str(p).strip()]) or "N/A"

    age_gender = []
    if patient.get("age"): age_gender.append(f"{patient.get('age')} Yrs")
    if patient.get("gender"): age_gender.append(str(patient.get("gender")).capitalize())
    age_gender_str = " / ".join(age_gender) if age_gender else "N/A"

    pat_left = (
        f"<b>Name:</b> {patient.get('full_name', '')}<br/>"
        f"<b>Patient ID:</b> {patient.get('patient_id', 'N/A')}<br/>"
        f"<b>Age / Gender:</b> {age_gender_str}<br/>"
        f"<b>Phone:</b> {patient.get('phone', 'N/A')}{' / ' + str(patient.get('alt_phone')) if patient.get('alt_phone') else ''}<br/>"
        f"<b>Email:</b> {patient.get('email') or 'N/A'}<br/>"
        f"<b>Address:</b> {addr_str}"
    )

    pat_right = (
        f"<b>Blood Group:</b> {patient.get('blood_group') or 'N/A'}<br/>"
        f"<b>Allergies:</b> {patient.get('allergies') or 'None'}<br/>"
        f"<b>Medical History:</b> {patient.get('medical_history') or 'None'}<br/>"
        f"<b>Current Meds:</b> {patient.get('current_medications') or 'None'}<br/>"
        f"<b>Habits & Health:</b> {habits_str}"
    )

    pat_table = Table([[Paragraph(pat_left, body), Paragraph(pat_right, body)]],
                      colWidths=[90*mm, 80*mm])
    pat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(pat_table)
    story.append(Spacer(1, 12))

    # Items
    items = invoice.get("items") or []
    data = [["#", "Procedure", "Description", "Qty", "Rate", "Amount"]]
    for i, it in enumerate(items, 1):
        if not isinstance(it, dict):
            continue
        rate = _safe_float(it.get("rate"))
        amount = _safe_float(it.get("amount"))
        data.append([
            str(i),
            str(it.get("procedure", "")),
            str(it.get("description", "")),
            str(it.get("quantity", 1)),
            f"Rs. {rate:.2f}",
            f"Rs. {amount:.2f}",
        ])
    tbl = Table(data, colWidths=[10*mm, 45*mm, 55*mm, 15*mm, 22*mm, 25*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 12))

    # Totals
    subtotal = _safe_float(invoice.get("subtotal"))
    discount = _safe_float(invoice.get("discount"))
    tax = _safe_float(invoice.get("tax"))
    grand_total = _safe_float(invoice.get("grand_total"))

    tot = [
        ["Subtotal", f"Rs. {subtotal:.2f}"],
        ["Discount", f"- Rs. {discount:.2f}"],
        ["Tax", f"Rs. {tax:.2f}"],
        ["Grand Total", f"Rs. {grand_total:.2f}"],
    ]
    totals = Table(tot, colWidths=[35*mm, 35*mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.5, BLUE),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), BLUE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals)
    story.append(Spacer(1, 20))

    # Payment Info
    paid_amount = _safe_float(invoice.get("paid_amount"))
    balance = _safe_float(invoice.get("balance"))
    story.append(Paragraph(
        f"<b>Payment Method:</b> {invoice.get('payment_method') or '—'}<br/>"
        f"<b>Paid:</b> Rs. {paid_amount:.2f} · "
        f"<b>Balance:</b> Rs. {balance:.2f}",
        body,
    ))
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"Thank you for choosing {clinic.get('name') or clinic.get('clinic_name') or 'ABC Dental Clinic'}. "
        f"For any questions about this invoice, please contact us.",
        small,
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        f"<i>Dr. {clinic.get('doctor_name','Avi B P')} — {clinic.get('doctor_title','Orthodontist')}</i>",
        small,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
