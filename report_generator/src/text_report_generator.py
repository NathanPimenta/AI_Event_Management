from pathlib import Path
from typing import Dict, Any
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TextReportGenerator:
    """
    Generates a text report using the strict_template.txt file.
    """
    def __init__(self, template_path: Path = None):
        if template_path is None:
            template_path = Path(__file__).parent / "strict_template.txt"
        self.template_path = template_path

    def _build_list(self, items: list) -> str:
        if not items:
            return "❖ No information provided"
        return "\n".join(f"❖ {item}" for item in items if item and str(item).strip())

    def _build_student_table(self, students: list) -> str:
        if not students:
            return "| - | No students recorded | - |"
        rows = []
        for i, s in enumerate(students, 1):
            name = s.get('name', '')
            branch = s.get('branch', '')
            rows.append(f"| {i} | {name} | {branch} |")
        return "\n".join(rows)

    def generate_report(self, data: Dict[str, Any], output_path: Path) -> bool:
        logger.info(f"Generating strict text report to: {output_path}")
        
        if not self.template_path.exists():
            logger.error(f"Template not found at {self.template_path}")
            return False

        tmpl = self.template_path.read_text(encoding="utf-8")

        subs = {
            "{{DEPARTMENT_NAME}}": data.get('department_name', data.get('department', '')),
            "{{EVENT_NAME}}": data.get('event_name', data.get('title', '')),
            "{{EVENT_TITLE}}": data.get('event_title', data.get('title', '')),
            "{{EVENT_DATE}}": data.get('date', ''),
            "{{EVENT_TIME}}": data.get('time', ''),
            "{{EVENT_VENUE}}": data.get('venue', ''),
            "{{TARGET_AUDIENCE}}": data.get('target_audience', ''),
            "{{TOTAL_PARTICIPANTS}}": str(data.get('total_participants', '')),
            "{{GIRL_PARTICIPANTS}}": str(data.get('girl_participants', data.get('female_count', ''))),
            "{{BOY_PARTICIPANTS}}": str(data.get('boy_participants', data.get('male_count', ''))),
            "{{RESOURCE_PERSON_NAME}}": data.get('resource_person', ''),
            "{{RESOURCE_PERSON_ORGANIZATION}}": data.get('resource_org', data.get('rp_org', '')),
            "{{ORGANIZING_BODY}}": data.get('organizing_body', data.get('department', '')),
            "{{FACULTY_COORDINATOR_NAME}}": data.get('faculty_coordinator', data.get('coordinator', '')),
            
            # For lists, we replace the entire block if possible, but the template already has:
            # ❖ {{OBJECTIVE_1}}
            # ❖ {{OBJECTIVE_2}}
            # ❖ {{OBJECTIVE_3}}
            # We can map them individually
        }
        
        # Handle Objectives and Outcomes which are 1, 2, 3 in the template
        objectives = data.get('objectives', [])
        for i in range(3):
            val = objectives[i] if i < len(objectives) else ""
            subs[f"{{{{OBJECTIVE_{i+1}}}}}"] = val

        outcomes = data.get('outcomes', [])
        for i in range(3):
            val = outcomes[i] if i < len(outcomes) else ""
            subs[f"{{{{OUTCOME_{i+1}}}}}"] = val

        subs.update({
            "{{DETAILED_REPORT_PARAGRAPH_GENERATED_FROM_USER_INPUT}}": data.get('detailed_report', ''),
            "{{FEEDBACK_SUMMARY_TEXT}}": data.get('feedback_summary_text', data.get('feedback_text', '')),
            "{{FACEBOOK_LINK}}": data.get('facebook_link', 'N/A'),
            "{{INSTAGRAM_LINK}}": data.get('instagram_link', 'N/A'),
            "{{LINKEDIN_LINK}}": data.get('linkedin_link', 'N/A'),
            "{{DBIT_STUDENTS_COUNT}}": str(data.get('dbit_students', '')),
            "{{NON_DBIT_STUDENTS_COUNT}}": str(data.get('non_dbit_students', '')),
            "{{STUDENT_TABLE_ROWS_GENERATED_FROM_USER_DATA}}": self._build_student_table(data.get('student_list_table', [])),
            "{{APPROVER_1_NAME}}": data.get('approver_1_name', ''),
            "{{APPROVER_1_POST}}": data.get('approver_1_post', ''),
            "{{APPROVER_2_NAME}}": data.get('approver_2_name', ''),
            "{{APPROVER_2_POST}}": data.get('approver_2_post', ''),
            "{{PREPARER_1_NAME}}": data.get('preparer_1_name', ''),
            "{{PREPARER_1_POST}}": data.get('preparer_1_post', ''),
            "{{PREPARER_2_NAME}}": data.get('preparer_2_name', ''),
            "{{PREPARER_2_POST}}": data.get('preparer_2_post', ''),
        })

        for var, val in subs.items():
            tmpl = tmpl.replace(var, str(val))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(tmpl, encoding="utf-8")
        logger.info(f"✅ Text report generated successfully: {output_path}")
        return True
