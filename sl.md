The error **`42501: new row violates row-level security policy for table "users"`** is occurring because your `signupUser` function is trying to insert a new record into the `users` table, but the database's Row Level Security (RLS) is blocking the operation.

### The Root Cause

When you use the Supabase client in your server action (`signupUser`), it defaults to using the **logged-in user's context** (or an unauthenticated context if the user hasn't signed in yet).

1. **Policy Conflict:** Your current RLS policies for `users` (as seen in the provided SQL and your image) only allow:
   - `SELECT` and `UPDATE` on rows where `id = auth.uid()`.
   - `SELECT` for admins.
2. **The Missing Policy:** There is **no `INSERT` policy** for the `users` table. When `signupUser` attempts `supabase.from('users').insert(...)`, the database checks the policies, finds no permission to `INSERT`, and rejects the row—even though the Auth user was just created.

### How to Fix It

You have two main ways to solve this.

#### Option 1: Use the `supabaseAdmin` client (Recommended)

In your `signupUser` function within `auth.js`, you are currently using `supabase` (the client-side/authenticated instance). You should use a **Service Role** client for the profile creation step. The service role key bypasses RLS policies entirely.

1. **Update `lib/supabaseClient.js`** to export an admin client:
   **JavaScript**

   ```
   import { createClient } from '@supabase/supabase-js';

   // Standard client
   export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

   // Admin client (Use this only in server-side actions!)
   export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   ```

2. **Update `app/actions/auth.js`** :
   Change the insert call to use `supabaseAdmin`:
   **JavaScript**

```
   import { supabase, supabaseAdmin } from '@/lib/supabaseClient.js'; // Import admin

   // ... inside signupUser function
   // Use supabaseAdmin instead of supabase for the profile insert
   const { error: profileError } = await supabaseAdmin.from('users').insert({
     id: authData.user.id,
     email,
     // ... rest of your fields
   });
```

#### Option 2: Add an `INSERT` policy (If you prefer not to use Admin)

If you do not want to use the service role key, you must allow the database to insert a record during the signup flow. However, this is tricky because the user doesn't technically "exist" in the `users` table yet.

A common pattern in Supabase is to create a **PostgreSQL Trigger** that automatically creates the user row in the `users` table as soon as a new user is added to the `auth.users` system table.

**To implement the trigger (Recommended Architecture):**

1. **Delete** the explicit `insert` call in your `signupUser` function.
2. **Run this SQL in your Supabase SQL Editor:**
   **SQL**

   ```
   -- 1. Create the function
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.users (id, email, full_name, role)
     VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'role');
     RETURN new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- 2. Trigger it on auth.users
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
   ```

### Summary of Recommendation

I recommend **Option 1** for your current setup. It requires the least amount of structural change to your existing code. Simply switch to the `supabaseAdmin` client for the `insert` operation, and the RLS policy error will disappear because the service role key acts as a "super-user" that bypasses RLS filters.
