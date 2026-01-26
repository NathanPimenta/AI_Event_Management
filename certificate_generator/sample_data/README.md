# Sample Data for Certificate Generator

This folder contains sample files for testing the Certificate Generator.

## Files

### participants.csv
Sample participant data with the following columns:
- `name` - Participant's full name
- `email` - Participant's email address
- `achievement_type` - Type of achievement (e.g., "Participation", "First Place Winner", "Best Presentation")

### sample_logo.png
A sample logo image (placeholder - replace with actual image).

### sample_signature.png
A sample signature image (placeholder - replace with actual image).

## Usage

1. Upload `participants.csv` when generating certificates
2. Upload your own logo and signature images, or use the samples
3. Fill in event details and generate certificates

## Custom Template

You can also upload a custom Jinja2 HTML template. Available variables:
- `{{ name }}` - Participant name
- `{{ event_name }}` - Event name
- `{{ event_date }}` - Event date
- `{{ institution_name }}` - Institution/organizer name
- `{{ achievement_type }}` - Achievement type
- `{{ signature_name }}` - Signatory name and title
- `{{ logo_path }}` - Path to logo image
- `{{ signature_path }}` - Path to signature image
- `{{ qr_code_path }}` - Path to QR code image
- `{{ colors }}` - AI-generated color palette (if enabled)
