# Use Python 3.11 slim image as base
FROM python:3.11.9-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy application code
COPY main_api.py .
COPY src/ ./src/
COPY data/ ./data/
COPY team_formation/ ./team_formation/
COPY index.html .

# Create output directory
RUN mkdir -p /app/output

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/docs')" || exit 1

# Run the application
CMD ["uvicorn", "main_api:app", "--host", "0.0.0.0", "--port", "8000"]
