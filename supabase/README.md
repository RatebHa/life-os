# Supabase Sync Setup

## Apply the database schema
1. Create a Supabase project.
2. Open the SQL editor.
3. Run [`schema.sql`](C:\Users\isc\Desktop\Projects\Life OS\supabase\schema.sql).

## Deploy the bootstrap function
1. Install the Supabase CLI.
2. Link the project.
3. Deploy `functions/bootstrap_import`.

## Required client values
- `Project URL`
- `Anon key`

These are entered in the desktop app under [Settings.tsx](C:\Users\isc\Desktop\Projects\Life OS\src\pages\Settings.tsx) in the `SYNC ACCOUNT` panel and will be used by the future Flutter mobile app as well.
