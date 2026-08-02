# Biller

Biller is an intelligent web application designed to digitize and extract structured data from handwritten Indian bills, receipts, and kachcha invoices. By leveraging Google's advanced vision models, the application accurately parses regional scripts, line items, and tax arithmetic, and seamlessly pushes the processed data into accounting software.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React, Vite, Tailwind CSS |
| **Backend & Database** | Supabase (PostgreSQL, Authentication, Storage) |
| **AI / Vision** | Google Gemini API (Gemini 2.5 Pro) |
| **Routing & API** | TanStack Start / React Router |

## Key Features

- **Intelligent OCR:** Extracts vendor details, dates, and line items from messy handwriting and regional Indian scripts.
- **Tax Extraction:** Automatically identifies and parses CGST, SGST, and IGST amounts.
- **Human-in-the-Loop Review:** Provides a side-by-side ledger UI to verify and edit the AI's extraction before saving.
- **Zoho Books Integration:** Pushes reviewed bills directly into Zoho Books as categorized expenses.
- **Secure Local Backend:** Fully dockerized local Supabase environment for safe, isolated development.

---

## Prerequisites

Before setting up the project, ensure you have the following installed on your machine:

- **Node.js & npm**
- **Docker Desktop** (must be actively running to host the local database)
- **Supabase CLI**
  ```bash
  npm install -g supabase
  ```
- **Google AI Studio Account** (to generate a free Gemini API key)

---

## Local Setup & Installation

### 1. Install Dependencies

Clone the repository and install the required Node modules:

```bash
npm install
```

### 2. Start the Local Supabase Environment

Ensure Docker is running, then initialize the local Supabase backend. This will apply all database migrations located in the `supabase/migrations/` directory.

```bash
supabase start
```

Once the containers are running, the terminal will output your local API credentials.

### 3. Configure Environment Variables

Create a `.env` file in the root directory of the project and add the following variables:

```env
# Local Supabase Credentials (from 'supabase start' output)
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_PUBLISHABLE_KEY="your-local-publishable-key"

# Vite Frontend Credentials
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="your-local-publishable-key"
VITE_SUPABASE_ANON_KEY="your-local-publishable-key"

# AI Provider
GEMINI_API_KEY="your-google-gemini-api-key"
```

### 4. Create the Storage Bucket

Because local Supabase instances start with a blank storage configuration, you must manually create the bucket for uploading images:

1. Navigate to the local Supabase Studio at:
   ```
   http://127.0.0.1:54323
   ```
2. Go to **Storage** and create a new bucket named **bills**.
3. Toggle the **Public bucket** option to **ON**.
4. Navigate to **Policies** under the `bills` bucket.
5. Click **New Policy** and create a policy that allows all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations for local development.

### 5. Start the Development Server

With the database running and environment variables configured, start the frontend application:

```bash
npm run dev
```

Navigate to:

```
http://localhost:5173
```

in your browser.

---

## Usage Guide

### Authentication

Navigate to `/auth` to create a local user account.

You can automatically confirm the user via the Supabase Studio dashboard:

```
http://127.0.0.1:54323
```

Go to:

```
Authentication → Users
```

### Upload Bills

Navigate to the `/upload` route to submit a photo of an invoice.

### Review Extractions

The application routes the image to **Gemini 2.5 Pro** for extraction.

Review the parsed:

- Line items
- Tax details
- Totals

against the original uploaded image.

### Export

Once verified, use the **Push to Zoho** functionality to sync the record to your accounting software.

---

## Project Structure Overview

```text
src/
├── components/
│   └── ui/                 # Reusable UI components (buttons, dialogs, forms)
├── lib/
│   ├── ai-vision.server.ts # Gemini integration logic
│   └── bills.functions.ts  # Server-side database operations
├── routes/
│   └── _authenticated/     # Protected dashboard and upload routes

supabase/
└── migrations/             # SQL schema definitions and database setup
```

## Architecture

```text
User Upload
     │
     ▼
Supabase Storage
     │
     ▼
Gemini 2.5 Pro OCR
     │
     ▼
Structured Bill Data
     │
     ▼
Review & Edit UI
     │
     ▼
Supabase Database
     │
     ▼
Zoho Books Export
```

## Future Enhancements

- Multi-language invoice support
- Automatic vendor categorization
- GST filing assistance
- Batch invoice processing
- Advanced analytics dashboard
- Mobile application support

## License

This project is licensed under the MIT License.