# Deployment Guide (Next.js + Python)

## Vercel compatibility

This project can run on Vercel when it is connected to a durable PostgreSQL
database. The app uses the `DATABASE_SCHEMA` environment variable, defaulting to
`courtai`, so it can share a Supabase project with another application while
keeping CourtAI tables separate.

Before deploying the app, run the SQL migration in
`supabase/migrations/202607180001_create_courtai_schema.sql` from the Supabase
SQL Editor or your migration tool. Runtime schema creation is disabled by
default; set `AUTO_CREATE_DB_SCHEMA=true` only for local development or a
temporary bootstrap.

If admin login fails after changing `ADMIN_PASSWORD`, restart/redeploy the app
so the initial admin account is synchronized from the latest environment
variables.

This project uses **Next.js** for the web interface and **Python (pdfplumber)** for PDF data extraction. Follow these steps to deploy correctly on a Linux server.

## 1. Prerequisites

- **Node.js**: v18.x or higher
- **Python**: v3.10 or higher
- **System Libraries**: Some PDF processing might require OS-level dependencies (e.g., `libgl1` for OpenCV).
  ```bash
  # For Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install -y libgl1-mesa-glx
  ```

## 2. Python Environment Setup

It is highly recommended to use a virtual environment (`venv`) to isolate Python dependencies.

```bash
# Move to project root
cd /path/to/courtai

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

## 3. Node.js Environment Setup

```bash
# Install Node.js dependencies
npm install

# Build Next.js application
npm run build
```

## 4. Environment Variables

Create a `.env.local` file (or set environment variables in your deployment platform):

```env
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
DATABASE_SCHEMA=courtai
DATABASE_SSL=true
AUTO_CREATE_DB_SCHEMA=false
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_USERNAME=replace_with_admin_username
ADMIN_PASSWORD=replace_with_strong_admin_password
ADMIN_NAME=운영자
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
# UPSTAGE_API_KEY is no longer required for PDF parsing, but kept if used elsewhere
```

`DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` are
required. The server will fail instead of creating a default admin account or
using a fallback JWT secret when they are missing.

For Supabase, use a server-side PostgreSQL connection string only. Do not expose
the database password or service role key in client-side variables.

## 5. Running the Application

### Using PM2 (Recommended)

To run the application in the background and ensure it restarts on failure:

```bash
# If using a custom Python path, ensure the environment is activated 
# or use the full path in your Node.js code.
pm2 start npm --name "courtai" -- start
```

## 6. Important Notes for Python Integration

The application calls Python scripts via `child_process.spawn("python3", ...)`. 

- **Custom Python Path**: If `python3` refers to the system Python instead of your `venv`, you may need to update the path in `src/app/api/rehabilitation/process/route.ts` to point to `process.cwd() + "/venv/bin/python3"`.
- **Temp Files**: The application uses a `temp` (or `temp_parsing`) directory for PDF processing. Ensure the user running the app has **write permissions** for these directories.

---
Created on: 2026-01-10
