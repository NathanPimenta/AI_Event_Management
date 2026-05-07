"""Email outreach agent stub for future implementation."""

from typing import List, Dict, Any, Protocol, Optional
import os
import time
import json

class EmailTransport(Protocol):
    """Interface for email sending."""
    
    def send_email(self, to_address: str, subject: str, body: str) -> None:
        """Send an email."""
        ...

class FileLogTransport:
    """Simulates email sending by logging to a file."""
    
    def __init__(self, log_path: str = None, drafts_path: str = None, clear_old_drafts: bool = True):
        # Save files in scraper_module directory
        import os
        scraper_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        self.log_path = log_path or os.path.join(scraper_dir, "sent_emails.log")
        self.drafts_path = drafts_path or os.path.join(scraper_dir, "email_drafts.json")
        # Create one session-specific drafts file that stays consistent for this session
        self.session_drafts_file = os.path.join(scraper_dir, f"email_drafts_session_{time.strftime('%Y%m%d_%H%M%S')}.json")
        self.latest_file = os.path.join(scraper_dir, "email_drafts_latest.json")
        self._scraper_dir = scraper_dir
        
        # Clear old draft files at the start of each new session
        if clear_old_drafts:
            self.clear_drafts()
        
    def clear_drafts(self) -> int:
        """Delete all existing email draft files (latest + all session files). Returns the count removed."""
        import glob
        removed = 0
        
        # Remove email_drafts_latest.json
        if os.path.exists(self.latest_file):
            os.remove(self.latest_file)
            removed += 1
            print(f"   🗑️  Cleared: {self.latest_file}")
        
        # Remove all session draft files
        pattern = os.path.join(self._scraper_dir, "email_drafts_session_*.json")
        for f in glob.glob(pattern):
            os.remove(f)
            removed += 1
            print(f"   🗑️  Cleared: {f}")
        
        if removed:
            print(f"   ✅ Cleared {removed} old draft file(s).")
        else:
            print("   ℹ️  No old draft files to clear.")
        
        return removed

    def send_email(self, to_address: str, subject: str, body: str) -> None:
        """Log the email to a file."""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry = (
            f"--- EMAIL SENT AT {timestamp} ---\n"
            f"To: {to_address}\n"
            f"Subject: {subject}\n"
            f"Body:\n{body}\n"
            f"-----------------------------------\n\n"
        )
        with open(self.log_path, "a") as f:
            f.write(entry)
        print(f"   📧 Email 'sent' to {to_address} (logged to {self.log_path})")

    def save_draft(self, to_address: str, subject: str, body: str, person_data: Dict[str, Any] = None) -> None:
        """Save draft email to JSON file for the current session."""
        draft_entry = {
            "to": to_address,
            "subject": subject,
            "body": body,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "person_data": person_data or {}
        }
        
        # Read existing drafts from session file
        drafts = []
        if os.path.exists(self.session_drafts_file):
            try:
                with open(self.session_drafts_file, 'r') as f:
                    drafts = json.load(f)
            except:
                drafts = []
        
        # Add new draft
        drafts.append(draft_entry)
        
        # Write back to session file
        with open(self.session_drafts_file, 'w') as f:
            json.dump(drafts, f, indent=2)
        
        # Also save to a "latest" file for quick access
        with open(self.latest_file, 'w') as f:
            json.dump(drafts, f, indent=2)
        
        print(f"   💾 Draft saved for {to_address}")


def build_outreach_email(person: Dict[str, Any], event_name: str, role: str = "speaker") -> Dict[str, str]:
    """
    Build outreach email for a person with role-specific customization.
    
    Args:
        person: Person data dict
        event_name: Event name
        role: Role type (speaker, mentor, sponsor)
    
    Returns:
        Dict with 'subject' and 'body'
    """
    name = person.get("name") or "there"
    title = person.get("title") or "Expert"
    company = person.get("company") or ""
    
    # Role-specific templates
    role = role.lower().strip()
    if role == "speaker":
        role_text = "speaker"
        invitation_text = "join us as a speaker at our upcoming event"
        subject = f"Speaker Invitation: {event_name}"
    elif role == "mentor":
        role_text = "mentor/judge"
        invitation_text = "be a mentor or judge at our upcoming event"
        subject = f"Mentor & Judge Invitation: {event_name}"
    elif role == "sponsor":
        role_text = "sponsor/partner"
        invitation_text = "be a sponsor/partner for our upcoming event"
        subject = f"Sponsorship Opportunity: {event_name}"
    else:
        role_text = role
        invitation_text = f"participate as a {role} in our upcoming event"
        subject = f"{role.title()} Invitation: {event_name}"
    
    body = f"""Hi {name},

I hope this email finds you well.

I am reaching out from the organizing team of {event_name}. We have been following your work{f' at {company}' if company else ''} and are very impressed by your contributions to the field.

We would be honored to have you {invitation_text}. Your expertise as a {role_text} would be invaluable to our attendees and event success.

Could you please let us know if you would be open to a brief conversation about this opportunity?

Best regards,

The {event_name} Team
"""
    
    return {"subject": subject, "body": body}


def send_outreach_batch(
    approved_people: List[Dict[str, Any]],
    event_name: str,
    transport: FileLogTransport,
    role: str = "speaker",
    override_email: Optional[str] = None,
) -> int:
    """
    Send outreach emails to approved people.
    Also saves drafts for review before sending.
    
    Args:
        approved_people: List of approved people
        event_name: Event name
        transport: Email transport implementation
        role: Role type (speaker, mentor, sponsor)
        override_email: Override recipient (for testing)
    
    Returns:
        Number of emails sent
    """
    sent = 0
    
    print(f"   📧 Starting email batch for {len(approved_people)} {role} candidates for {event_name}")
    
    for person in approved_people:
        email = override_email or person.get("email")
        
        # Skip if no email or placeholder
        if not email or "not available" in email.lower():
            print(f"   ⚠️ Skipping {person.get('name', 'Unknown')}: No valid email")
            continue
        
        msg = build_outreach_email(person, event_name, role)
        
        # Save draft before sending
        try:
            transport.save_draft(email, msg["subject"], msg["body"], person)
        except Exception as e:
            print(f"   ⚠️ Failed to save draft for {email}: {e}")
        
        try:
            transport.send_email(email, msg["subject"], msg["body"])
            sent += 1
        except Exception as e:
            print(f"   ❌ Failed to send to {email}: {e}")
    
    return sent