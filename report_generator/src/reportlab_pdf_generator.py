"""
PDF Report Generator — DBIT ACM Event Report
Matches the exact layout seen in the sample PDFs.
"""

import os
import logging

logger = logging.getLogger(__name__)
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph,
    Spacer, Table, TableStyle, Image, HRFlowable,
    KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas
from PIL import Image as PILImage

PAGE_W, PAGE_H = A4
BORDER_MARGIN = 10 * mm
LEFT_MARGIN = 20 * mm
RIGHT_MARGIN = 20 * mm
TOP_MARGIN = 38 * mm
BOTTOM_MARGIN = 15 * mm

# ── Colors ────────────────────────────────────────────────────────────────────
BLACK = colors.black
WHITE = colors.white
DARK = colors.HexColor("#1a1a1a")

# ── Styles ────────────────────────────────────────────────────────────────────
def make_styles():
    return {
        'dept': ParagraphStyle('dept', fontName='Times-Bold', fontSize=15,
                               leading=18, alignment=TA_CENTER, textColor=DARK),
        'report_title': ParagraphStyle('report_title', fontName='Times-Bold', fontSize=14,
                                       leading=17, alignment=TA_CENTER, textColor=DARK),
        'field_label': ParagraphStyle('field_label', fontName='Times-Bold', fontSize=13,
                                      leading=16, textColor=DARK),
        'field_value': ParagraphStyle('field_value', fontName='Times-Roman', fontSize=13,
                                      leading=16, textColor=DARK),
        'section_head': ParagraphStyle('section_head', fontName='Times-Bold', fontSize=12,
                                       leading=15, textColor=DARK),
        'body': ParagraphStyle('body', fontName='Times-Roman', fontSize=12,
                               leading=16, alignment=TA_JUSTIFY, textColor=DARK),
        'bullet': ParagraphStyle('bullet', fontName='Times-Roman', fontSize=12,
                                 leading=16, leftIndent=15, textColor=DARK),
        'small': ParagraphStyle('small', fontName='Times-Roman', fontSize=10,
                                leading=13, textColor=DARK),
        'sig_label': ParagraphStyle('sig_label', fontName='Times-Bold', fontSize=12,
                                    leading=15, textColor=DARK),
        'sig_value': ParagraphStyle('sig_value', fontName='Times-Roman', fontSize=12,
                                    leading=15, textColor=DARK),
        'sig_note': ParagraphStyle('sig_note', fontName='Times-Roman', fontSize=9,
                                   leading=12, textColor=DARK),
        'link': ParagraphStyle('link', fontName='Times-Roman', fontSize=11,
                               leading=14, textColor=colors.HexColor("#0000EE")),
    }


class BorderCanvas(pdfcanvas.Canvas):
    """Draws the page border and header on every page."""

    def __init__(self, *args, college_logo=None, club_logo=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._college_logo = college_logo
        self._club_logo = club_logo

    def showPage(self):
        self._draw_border_and_header()
        super().showPage()

    def save(self):
        self._draw_border_and_header()
        super().save()

    def _draw_border_and_header(self):
        w, h = A4
        bm = BORDER_MARGIN

        # ── outer border ──
        self.setStrokeColor(BLACK)
        self.setLineWidth(1.2)
        self.rect(bm, bm, w - 2 * bm, h - 2 * bm, stroke=1, fill=0)

        # ── header area ──
        header_top = h - bm - 2 * mm
        header_bottom = h - TOP_MARGIN + 2 * mm
        center_x = w / 2

        logo_size = 18 * mm
        logo_y = header_bottom + (header_top - header_bottom - logo_size) / 2

        # college logo
        if self._college_logo and os.path.exists(self._college_logo):
            try:
                self.drawImage(self._college_logo,
                               bm + 4 * mm, logo_y,
                               width=logo_size, height=logo_size,
                               preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

        # club logo
        if self._club_logo and os.path.exists(self._club_logo):
            try:
                self.drawImage(self._club_logo,
                               w - bm - 4 * mm - logo_size, logo_y,
                               width=logo_size, height=logo_size,
                               preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

        # institute name (centred)
        self.setFillColor(BLACK)
        text_cx = center_x
        line1_y = header_top - 7 * mm
        self.setFont("Times-Bold", 11)
        self.drawCentredString(text_cx, line1_y, "The Bombay Salesian Society's")
        self.setFont("Times-Bold", 14)
        self.drawCentredString(text_cx, line1_y - 6 * mm, "DON BOSCO INSTITUTE OF TECHNOLOGY")
        self.setFont("Times-Bold", 10)
        self.drawCentredString(text_cx, line1_y - 12 * mm,
                               "Premier Automobiles Road, Kurla West, Mumbai - 400070")

        # separator line
        self.setLineWidth(0.6)
        self.line(bm + 2 * mm, header_bottom, w - bm - 2 * mm, header_bottom)


def _safe_image(path, max_w, max_h):
    """Return a ReportLab Image scaled to fit max_w × max_h, or None."""
    if not path or not os.path.exists(path):
        return None
    try:
        pil = PILImage.open(path)
        iw, ih = pil.size
        ratio = min(max_w / iw, max_h / ih)
        return Image(path, width=iw * ratio, height=ih * ratio)
    except Exception:
        return None


def _two_images_side_by_side(path1, path2, usable_w):
    """Return a Table with two photos side by side."""
    half = (usable_w - 5 * mm) / 2
    img1 = _safe_image(path1, half, 7 * cm)
    img2 = _safe_image(path2, half, 7 * cm)
    if img1 and img2:
        t = Table([[img1, img2]], colWidths=[half, half])
        t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        return t
    return img1 or img2


def _field_row(label, value, styles):
    """Bold label + normal value as a single Paragraph."""
    return Paragraph(f"<b>{label}</b> {value}", styles['field_value'])


def generate_report_pdf(data: dict, output_path: str):
    S = make_styles()
    usable_w = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

    college_logo = _resolve_upload(data.get('college_logo', ''))
    club_logo    = _resolve_upload(data.get('club_logo', ''))

    def make_canvas(filename, **kwargs):
        c = BorderCanvas(filename,
                         college_logo=college_logo,
                         club_logo=club_logo,
                         **kwargs)
        return c

    doc = BaseDocTemplate(
        output_path, pagesize=A4,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
    )
    frame = Frame(LEFT_MARGIN, BOTTOM_MARGIN,
                  usable_w, PAGE_H - TOP_MARGIN - BOTTOM_MARGIN,
                  id='main', leftPadding=0, rightPadding=0,
                  topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id='main', frames=[frame],
                                       onPage=lambda c, d: None)])

    story = []
    sp = lambda n=0.3: story.append(Spacer(1, n * cm))

    # ── Dept & Title ──────────────────────────────────────────────────────────
    story.append(Paragraph(data.get('department', 'Department'), S['dept']))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"Report on \u2013 {data.get('event_type', '')}", S['report_title']))
    sp(0.5)

    # ── Event Details ─────────────────────────────────────────────────────────
    def field(label, key, default=''):
        val = data.get(key, default)
        story.append(_field_row(f"{label}:", val, S))

    field("Title",   "title")
    field("Date",    "date")
    field("Time",    "time")
    field("Venue",   "venue")
    sp(0.45)
    field("Target Audience", "target_audience")
    sp(0.2)
    field("No. of Participants Present",      "total_participants")
    sp(0.2)
    field("No. of Girl Participants Present", "girl_participants")
    sp(0.2)
    field("No. of Boy Participants Present",  "boy_participants")
    sp(0.45)
    field("Resource Person",                               "resource_person")
    field("Organization of Resource Person",               "resource_organization")
    field("Organizing Department / Committee / Authority", "organizing_body")
    field("Faculty Coordinator",                           "faculty_coordinator")
    sp(0.6)

    # ── Objectives ────────────────────────────────────────────────────────────
    story.append(Paragraph("Objectives:", S['section_head']))
    sp(0.1)
    for obj in data.get('objectives', []):
        story.append(Paragraph(f"\u2666 {obj}", S['bullet']))
    sp(0.5)

    # ── Outcomes ─────────────────────────────────────────────────────────────
    story.append(Paragraph("Outcomes:", S['section_head']))
    sp(0.1)
    for out in data.get('outcomes', []):
        story.append(Paragraph(f"\u2666 {out}", S['bullet']))
    sp(0.5)

    # ── Detailed Report ───────────────────────────────────────────────────────
    story.append(Paragraph("Detailed Report:", S['section_head']))
    sp(0.3)
    for para in _split_paragraphs(data.get('detailed_report', '')):
        story.append(Paragraph(para, S['body']))
        sp(0.15)
    sp(0.4)

    # ── Snapshot of Event ─────────────────────────────────────────────────────
    story.append(Paragraph("Snapshot of the Event:", S['section_head']))
    sp(0.3)

    snapshot_desc = data.get('snapshot_description', '')
    if snapshot_desc:
        story.append(Paragraph(snapshot_desc, S['body']))
        sp(0.2)

    event_photos = data.get('event_photos', [])
    _add_photo_grid(story, event_photos, usable_w)
    sp(0.5)

    # ── Feedback Analysis ─────────────────────────────────────────────────────
    story.append(Paragraph("Feedback Analysis:", S['section_head']))
    sp(0.3)
    for para in _split_paragraphs(data.get('feedback_text', '')):
        story.append(Paragraph(para, S['body']))
        sp(0.15)
    sp(0.2)

    feedback_images = data.get('feedback_images', [])
    _add_photo_grid(story, feedback_images, usable_w)

    # Analytics charts from quantitative analyzer
    ratings_chart = data.get('ratings_chart', '')
    demographics_chart = data.get('demographics_chart', '')
    if ratings_chart or demographics_chart:
        sp(0.3)
        story.append(Paragraph("Analytics Charts:", S['section_head']))
        sp(0.2)
    if ratings_chart and os.path.exists(ratings_chart):
        img = _safe_image(ratings_chart, usable_w, 10 * cm)
        if img:
            story.append(img)
            sp(0.3)
    if demographics_chart and os.path.exists(demographics_chart):
        img = _safe_image(demographics_chart, usable_w, 12 * cm)
        if img:
            story.append(img)
            sp(0.3)
    sp(0.3)

    # ── Event Poster ──────────────────────────────────────────────────────────
    story.append(Paragraph("Event Poster:", S['section_head']))
    sp(0.2)
    poster_path = _resolve_upload(data.get('poster_image', ''))
    if poster_path:
        img = _safe_image(poster_path, usable_w, 18 * cm)
        if img:
            story.append(img)
    sp(0.5)

    # ── Social Media ──────────────────────────────────────────────────────────
    story.append(Paragraph("Social Media Links:", S['section_head']))
    sp(0.2)
    social = data.get('social_media', {})
    org_name = data.get('social_org_name', 'ACM-DBIT')
    story.append(Paragraph(f"<b>{org_name}:</b>", S['body']))
    for platform, url in social.items():
        if url:
            story.append(Paragraph(
                f"<b>{platform}:</b> <a href='{url}' color='blue'>{url}</a>", S['small']))
    sp(0.6)

    # ── Registration Details ──────────────────────────────────────────────────
    story.append(Paragraph("Registration Details:", S['section_head']))
    sp(0.3)
    story.append(Paragraph(
        f"No. of DBIT Students: {data.get('dbit_students', '')}", S['body']))
    story.append(Paragraph(
        f"No. of non-DBIT students: {data.get('non_dbit_students', '')}", S['body']))
    sp(0.5)

    # ── Attendance Table ──────────────────────────────────────────────────────
    story.append(Paragraph("List of Students Who Attended the Event", S['section_head']))
    sp(0.3)

    students = data.get('students', [])
    table_data = [
        [Paragraph('<b>S. No.</b>', S['sig_label']),
         Paragraph('<b>Name</b>', S['sig_label']),
         Paragraph('<b>Branch</b>', S['sig_label'])]
    ]
    for i, s in enumerate(students, 1):
        table_data.append([
            Paragraph(str(i), S['body']),
            Paragraph(s.get('name', ''), S['body']),
            Paragraph(s.get('branch', ''), S['body']),
        ])

    col_w = [1.5 * cm, 9 * cm, 4 * cm]
    t = Table(table_data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ('GRID',        (0, 0), (-1, -1), 0.5, BLACK),
        ('BACKGROUND',  (0, 0), (-1, 0),  colors.HexColor("#f0f0f0")),
        ('ALIGN',       (0, 0), (0, -1),  'CENTER'),
        ('ALIGN',       (2, 0), (2, -1),  'CENTER'),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, colors.HexColor("#fafafa")]),
        ('TOPPADDING',  (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    sp(0.6)

    # ── Signature Boxes ───────────────────────────────────────────────────────
    half_w = (usable_w - 5 * mm) / 2

    def sig_box(title, name_label, name_val, post_label, post_val, note):
        items = [
            Paragraph(f"<b>{title}</b>", S['sig_label']),
            Spacer(1, 0.4 * cm),
            Paragraph(f"<b>{name_label}:</b> {name_val}", S['sig_value']),
            Spacer(1, 0.2 * cm),
            Paragraph(f"<b>{post_label}:</b> {post_val}", S['sig_value']),
            Spacer(1, 0.2 * cm),
            Paragraph(note, S['sig_note']),
            Spacer(1, 0.4 * cm),
        ]
        inner = Table([[item] for item in items],
                      colWidths=[half_w - 8 * mm])
        inner.setStyle(TableStyle([
            ('LEFTPADDING',  (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING',   (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        outer = Table([[inner]], colWidths=[half_w])
        outer.setStyle(TableStyle([
            ('BOX',          (0, 0), (-1, -1), 0.8, BLACK),
            ('LEFTPADDING',  (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING',   (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        return outer

    left_box = sig_box(
        "Report Prepared By:",
        "Name of the Student", data.get('prepared_name', ''),
        "Post of the Student", data.get('prepared_post', ''),
        "In the Student Council / Student Club / Chapter / Professional Body"
    )
    right_box = sig_box(
        "Report Approved By:",
        "Name of the Faculty", data.get('approved_name', ''),
        "Post of the Faculty", data.get('approved_post', ''),
        "In Institute / Department / Student Club / Chapter / Professional Body"
    )

    sig_table = Table([[left_box, right_box]],
                      colWidths=[half_w, half_w])
    sig_table.setStyle(TableStyle([
        ('ALIGN',  (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('COLPADDING', (0, 0), (0, -1), 0),
    ]))
    story.append(sig_table)

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, canvasmaker=make_canvas)


# ── Helpers ───────────────────────────────────────────────────────────────────

# Base directory of this file — used for reliable path resolution regardless of CWD
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_THIS_DIR)  # report_generator/


def _resolve_upload(filename):
    if not filename:
        return None

    # 1) Already an absolute path that exists on disk — trust it directly (set by api.py)
    if os.path.isabs(filename) and os.path.exists(filename):
        logger.info(f"✅ Image resolved (absolute): {filename}")
        return filename

    # 2) Strip leading /static/uploads/ prefix if present
    if filename.startswith('/static/uploads/'):
        filename = filename[len('/static/uploads/'):]

    # 3) Look in static/uploads/ relative to the repo root
    path = os.path.join(_REPO_ROOT, 'static', 'uploads', filename)
    if os.path.exists(path):
        logger.info(f"✅ Image resolved (static/uploads): {path}")
        return path

    # 4) Look in data/ directory (legacy fallback)
    path = os.path.join(_REPO_ROOT, 'data', filename)
    if os.path.exists(path):
        logger.info(f"✅ Image resolved (data/): {path}")
        return path

    logger.warning(f"⚠️ Image not found: {filename}")
    return None


def _split_paragraphs(text):
    """Split text on double newlines; return list of non-empty strings."""
    parts = [p.strip() for p in text.replace('\r\n', '\n').split('\n\n')]
    return [p for p in parts if p]


def _add_photo_grid(story, photo_filenames, usable_w):
    """Add photos in a 2-column grid."""
    paths = [_resolve_upload(f) for f in photo_filenames if f]
    paths = [p for p in paths if p]

    if not paths:
        return

    half = (usable_w - 5 * mm) / 2
    max_h = 7 * cm

    row = []
    for path in paths:
        img = _safe_image(path, half, max_h)
        if img is None:
            continue
        row.append(img)
        if len(row) == 2:
            t = Table([row], colWidths=[half, half])
            t.setStyle(TableStyle([
                ('ALIGN',  (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.3 * cm))
            row = []
    if row:  # odd one out — full width
        img = _safe_image(paths[len(paths) - 1], usable_w, 10 * cm)
        if img:
            story.append(img)
            story.append(Spacer(1, 0.3 * cm))
