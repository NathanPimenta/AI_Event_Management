"""Email outreach agent stub for future implementation."""

from typing import List, Dict, Any, Protocol, Optional



import os
import time

class EmailTransport(Protocol):
    """Interface for email sending."""
    
    def send_email(self, to_address: str, subject: str, body: str) -> None:
        """Send an email."""
        ...

class FileLogTransport:
    """Simulates email sending by logging to a file."""
    
    def __init__(self, log_path: str = "sent_emails.log"):
        self.log_path = log_path
        
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


def build_outreach_email(person: Dict[str, Any], event_name: str) -> Dict[str, str]:
    """
    Build outreach email for a person.
    
    Args:
        person: Person data dict
        event_name: Event name
    
    Returns:
        Dict with 'subject' and 'body'
    """
    name = person.get("name") or "there"
    role = person.get("title") or "Expert"
    company = person.get("company") or ""
    
    subject = f"Speaker Invitation: {event_name}"
    
    body = f"""Hi {name},

I hope this email finds you well.

I am reaching out from the organizing team of {event_name}. We have been following your work{f' at {company}' if company else ''} and are very impressed by your contributions to the field.

We would be honored to have you join us as a speaker/mentor for our upcoming event. Your expertise would be invaluable to our attendees.

Could you please let us know if you would be open to a brief conversation about this opportunity?

Best regards,

The {event_name} Team
"""
    
    return {"subject": subject, "body": body}


def send_outreach_batch(
    approved_people: List[Dict[str, Any]],
    event_name: str,
    transport: EmailTransport,
    override_email: Optional[str] = None,
) -> int:
    """
    Send outreach emails to approved people.
    
    Args:
        approved_people: List of approved people
        event_name: Event name
        transport: Email transport implementation
        override_email: Override recipient (for testing)
    
    Returns:
        Number of emails sent
    """
    sent = 0
    
    print(f"   📧 Starting email batch for {len(approved_people)} candidates for {event_name}")
    
    for person in approved_people:
        email = override_email or person.get("email")
        
        # Skip if no email or placeholder
        if not email or "not available" in email.lower():
            print(f"   ⚠️ Skipping {person.get('name', 'Unknown')}: No valid email")
            continue
        
        msg = build_outreach_email(person, event_name)
        
        try:
            transport.send_email(email, msg["subject"], msg["body"])
            sent += 1
        except Exception as e:
            print(f"   ❌ Failed to send to {email}: {e}")
    
    return sent