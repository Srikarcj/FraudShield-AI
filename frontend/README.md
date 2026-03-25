# FraudShield AI Frontend (Next.js + Supabase Auth)

This is a standalone Next.js frontend for the existing Flask fraud detection backend.

## Stack
- Next.js App Router
- Tailwind CSS + ShadCN-style components
- Supabase Auth (email/password)
- Supabase PostgreSQL
- Recharts visualization

## 1) Keep Flask Backend Running
From project root (`d:\DESKTOP-C\zip`):

```powershell
.\.venv\Scripts\Activate
python app.py
```

Backend URL: `http://127.0.0.1:5000`

## 2) Frontend Setup

```powershell
cd frontend
npm install
copy .env.local.example .env.local
```

Set `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_FLASK_API_URL=http://127.0.0.1:5000
```

For production on Vercel, set `NEXT_PUBLIC_FLASK_API_URL` to your Render backend URL.

## 3) Supabase Auth Configuration
In Supabase Dashboard:
1. Go to Authentication -> Providers.
2. Enable Email provider.
3. Keep authentication mode as email/password.
4. Add your site URL (`http://localhost:3000`) and redirect URLs.

## 4) Database Setup
Run SQL from `supabase_schema.sql` in Supabase SQL editor.

## 5) Run Frontend

```powershell
npm run dev
```

Open `http://localhost:3000`.

## 6) Deploying to Vercel and Render

### Render backend
1. Create a new Web Service from this repo root.
2. Use the Render blueprint in `render.yaml` or copy the same settings manually.
3. Keep the root directory as the repository root.
4. Make sure `requirements.txt` is present.
5. Deploy, then copy the public backend URL.

### Vercel frontend
1. Import the `frontend/` folder as the Vercel project root.
2. Set these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_FLASK_API_URL` = your Render backend URL
3. Build and deploy.
4. Update Supabase Auth redirect URLs to include your Vercel domain.

## Routes
- `/` Home
- `/auth` Custom secure auth page (Sign in/Sign up)
- `/dashboard` Protected prediction workspace
- `/results` Protected analytics and evaluation page

## API Integration (Flask)
Frontend uses:
- `POST /api/predict`
- `POST /api/predict_row`
- `GET /api/random_test`
- `POST /api/upload_csv`
- `GET /api/evaluate`

## Notes
- Auth is fully handled by Supabase.
- Signup captures `full_name` and `mobile_number` in user metadata.
- Phone number is stored as profile data only; no SMS OTP flow is used.
- Prediction history is saved in Supabase after each successful prediction.
