import docx
from docx.shared import Cm, Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def set_cell_border(cell, **kwargs):
    """
    Set cell margins and borders.
    """
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = 'w:{}'.format(edge)
            element = OxmlElement(tag)
            for key in ["sz", "val", "color", "space", "shadow"]:
                if key in edge_data:
                    element.set(qn('w:{}'.format(key)), str(edge_data[key]))
            tcBorders.append(element)
    tcPr.append(tcBorders)

class DocxReportGenerator:
    """
    Generates strict format reports procedurally matching the exact layout of the legacy LaTeX report_template.tex.
    """
    def __init__(self, template_path: Optional[Path] = None):
        pass

    def _add_bold_line(self, doc, label, value):
        p = doc.add_paragraph()
        run = p.add_run(f"{label} ")
        run.bold = True
        run.font.size = Pt(13)
        run_val = p.add_run(str(value))
        run_val.font.size = Pt(13)
        return p

    def generate_report(self, data: Dict[str, Any], output_path: Path, charts: Dict[str, Path]):
        logger.info(f"Generating procedural DOCX report to: {output_path}")
        doc = docx.Document()
        
        # Set default font to Liberation Serif or Times New Roman
        style = doc.styles['Normal']
        font = style.font
        font.name = 'Times New Roman'
        font.size = Pt(12)

        # ------------------- HEADER -------------------
        # 3 Column table for Top Header: [Logo] [Institute Name] [Club Logo]
        header_table = doc.add_table(rows=1, cols=3)
        header_table.allow_autofit = True
        
        # Left Logo
        if charts.get('logo') and Path(charts['logo']).exists():
            p_logo1 = header_table.cell(0, 0).paragraphs[0]
            p_logo1.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p_logo1.add_run()
            run.add_picture(charts['logo'], width=Cm(1.8), height=Cm(1.8))
        
        # Center Text
        p_center = header_table.cell(0, 1).paragraphs[0]
        p_center.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        r1 = p_center.add_run("The Bombay Salesian Society's\n")
        r1.bold = True
        r1.font.size = Pt(11)
        
        r2 = p_center.add_run("DON BOSCO INSTITUTE OF TECHNOLOGY\n")
        r2.bold = True
        r2.font.size = Pt(14)
        
        r3 = p_center.add_run("Premier Automobiles Road, Kurla West, Mumbai - 400070")
        r3.bold = True
        r3.font.size = Pt(10)

        # Right Logo (if exists, usually there is club logo)
        # charts dict can map 'club_logo'
        # We check if club_logo is passed, else leave empty
        if charts.get('club_logo') and Path(charts['club_logo']).exists():
            p_logo2 = header_table.cell(0, 2).paragraphs[0]
            p_logo2.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_logo2.add_run().add_picture(charts['club_logo'], width=Cm(1.8), height=Cm(1.8))

        # Add bottom border rule manually as a line
        p_rule = doc.add_paragraph()
        p_rule.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # Not perfect, but a line of underscores is closest without complex borders
        p_rule.add_run("_"*85).bold = True
        doc.add_paragraph() # Spacing

        # ------------------- TITLES -------------------
        p_dept = doc.add_paragraph()
        p_dept.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_dept = p_dept.add_run(str(data.get('institution_name', 'DEPARTMENT NAME')))
        r_dept.bold = True
        r_dept.font.size = Pt(15)

        p_type = doc.add_paragraph()
        p_type.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_type = p_type.add_run(f"Report on - {data.get('event_type', data.get('event_name', 'EVENT TITLE'))}")
        r_type.bold = True
        r_type.font.size = Pt(14)
        
        doc.add_paragraph()

        # ------------------- BASIC INFO -------------------
        self._add_bold_line(doc, "Title:", data.get('event_title', data.get('event_name', '')))
        self._add_bold_line(doc, "Date:", data.get('date', ''))
        self._add_bold_line(doc, "Time:", data.get('time', ''))
        self._add_bold_line(doc, "Venue:", data.get('venue', ''))
        doc.add_paragraph()
        self._add_bold_line(doc, "Target Audience:", data.get('target_audience', ''))
        doc.add_paragraph()
        self._add_bold_line(doc, "No. of Participants Present:", data.get('total_participants', 0))
        doc.add_paragraph()
        self._add_bold_line(doc, "No. of Girl Participants Present:", data.get('female_count', 0))
        doc.add_paragraph()
        self._add_bold_line(doc, "No. of Boy Participants Present:", data.get('male_count', 0))
        doc.add_paragraph()
        self._add_bold_line(doc, "Resource Person:", data.get('resource_person', ''))
        self._add_bold_line(doc, "Organization of Resource Person:", data.get('rp_org', ''))
        self._add_bold_line(doc, "Organizing Department / Committee / Authority:", data.get('department', ''))
        self._add_bold_line(doc, "Faculty Coordinator:", data.get('coordinator', ''))
        doc.add_paragraph()

        # ------------------- OBJECTIVES -------------------
        p_obj = doc.add_paragraph("Objectives:")
        p_obj.runs[0].bold = True
        p_obj.runs[0].font.size = Pt(12)
        for obj in data.get('objectives', []):
            if obj:
                doc.add_paragraph(f"❖ {obj}")
        doc.add_paragraph()

        # ------------------- OUTCOMES -------------------
        p_out = doc.add_paragraph("Outcomes:")
        p_out.runs[0].bold = True
        p_out.runs[0].font.size = Pt(12)
        for out in data.get('outcomes', []):
            if out:
                doc.add_paragraph(f"❖ {out}")
        doc.add_paragraph()

        # ------------------- DETAILED REPORT -------------------
        p_det = doc.add_paragraph("Detailed Report:")
        p_det.runs[0].bold = True
        p_det.runs[0].font.size = Pt(12)
        p_det_content = doc.add_paragraph(str(data.get('detailed_report', '')))
        p_det_content.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        doc.add_paragraph()

        # ------------------- SNAPSHOTS -------------------
        p_snap = doc.add_paragraph("Snapshot of the Event:")
        p_snap.runs[0].bold = True
        p_snap.runs[0].font.size = Pt(12)
        doc.add_paragraph()
        
        if charts.get('snapshot') and Path(charts['snapshot']).exists():
            doc.add_picture(charts['snapshot'], width=Inches(5))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        photos = charts.get('photos', [])
        for photo_path in photos:
            if Path(photo_path).exists():
                doc.add_picture(str(photo_path), width=Inches(5))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

        doc.add_paragraph()

        # ------------------- FEEDBACK ANALYSIS -------------------
        p_feed = doc.add_paragraph("Feedback Analysis:")
        p_feed.runs[0].bold = True
        p_feed.runs[0].font.size = Pt(12)
        
        feedback_summary = data.get('feedback_summary_text', '')
        if feedback_summary:
            p_feed_content = doc.add_paragraph(str(feedback_summary))
            p_feed_content.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        doc.add_paragraph()

        if charts.get('ratings_chart') and Path(charts['ratings_chart']).exists():
            doc.add_picture(charts['ratings_chart'], width=Inches(5))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

        doc.add_paragraph()

        # ------------------- POSTER -------------------
        p_post = doc.add_paragraph("Event Poster:")
        p_post.runs[0].bold = True
        p_post.runs[0].font.size = Pt(12)
        doc.add_paragraph()

        if charts.get('poster') and Path(charts['poster']).exists():
            doc.add_picture(charts['poster'], width=Inches(4))
            doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

        doc.add_paragraph()

        # ------------------- SOCIAL MEDIA -------------------
        p_soc = doc.add_paragraph("Social Media Links:")
        p_soc.runs[0].bold = True
        p_soc.runs[0].font.size = Pt(12)
        doc.add_paragraph()
        
        # Build Facebook / Instagram formatting exactly
        p_soc_l = doc.add_paragraph()
        p_soc_l.add_run(f"Facebook: {data.get('facebook_link', 'N/A')}\n")
        p_soc_l.add_run(f"Instagram: {data.get('instagram_link', 'N/A')}\n")
        p_soc_l.add_run(f"LinkedIn: {data.get('linkedin_link', 'N/A')}")
        doc.add_paragraph()

        # ------------------- REGISTRATION -------------------
        p_reg = doc.add_paragraph("Registration Details:")
        p_reg.runs[0].bold = True
        p_reg.runs[0].font.size = Pt(12)
        doc.add_paragraph()
        doc.add_paragraph(f"No. of DBIT Students: {data.get('dbit_students', 0)}")
        doc.add_paragraph(f"No. of non-DBIT students: {data.get('non_dbit_students', 0)}")
        doc.add_paragraph()

        # ------------------- STUDENT TABLE -------------------
        p_att = doc.add_paragraph("List of Students Who Attended the Event")
        p_att.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_att.runs[0].bold = True
        p_att.runs[0].font.size = Pt(12)
        doc.add_paragraph()

        students = data.get('student_list_table', [])
        if students:
            table = doc.add_table(rows=1, cols=3)
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = 'S. No.'
            hdr_cells[1].text = 'Name'
            hdr_cells[2].text = 'Branch'
            for idx, student in enumerate(students):
                row_cells = table.add_row().cells
                row_cells[0].text = str(student.get('s_no', idx + 1))
                row_cells[1].text = str(student.get('name', 'N/A'))
                row_cells[2].text = str(student.get('branch', 'N/A'))
        doc.add_paragraph()

        # ------------------- SIGNATURE BOXES -------------------
        sig_table = doc.add_table(rows=1, cols=2)
        sig_table.allow_autofit = True
        sig_table.autofit = False

        border_dict = {"sz": 12, "val": "single", "color": "000000"}

        # Cell 0 (Prepared By)
        cell_prep = sig_table.cell(0, 0)
        set_cell_border(cell_prep, top=border_dict, bottom=border_dict, left=border_dict, right=border_dict)
        
        p = cell_prep.add_paragraph("Report Prepared By:")
        p.runs[0].bold = True
        cell_prep.add_paragraph()
        cell_prep.add_paragraph(f"Name of the Student: {data.get('preparer_1_name', '')}").runs[0].bold = True
        cell_prep.add_paragraph()
        cell_prep.add_paragraph(f"Post of the Student: {data.get('preparer_1_post', '')}").runs[0].bold = True
        cell_prep.add_paragraph()
        cell_prep.add_paragraph("In the Student Council / Student Club /\nChapter / Professional Body")

        # Cell 1 (Approved By)
        cell_app = sig_table.cell(0, 1)
        set_cell_border(cell_app, top=border_dict, bottom=border_dict, left=border_dict, right=border_dict)
        
        p2 = cell_app.add_paragraph("Report Approved By:")
        p2.runs[0].bold = True
        cell_app.add_paragraph()
        cell_app.add_paragraph(f"Name of the Faculty: {data.get('approver_1_name', '')}").runs[0].bold = True
        cell_app.add_paragraph()
        cell_app.add_paragraph(f"Post of the Faculty: {data.get('approver_1_post', '')}").runs[0].bold = True
        cell_app.add_paragraph()
        cell_app.add_paragraph("In Institute / Department / Student Club /\nChapter / Professional Body")

        doc.save(output_path)
        return True
