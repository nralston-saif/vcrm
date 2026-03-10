#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// 1. Read environment variables from apps/crm/.env.local
// ---------------------------------------------------------------------------

const envPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../apps/crm/.env.local",
);

function loadEnv(filePath) {
  const vars = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

let env;
try {
  env = loadEnv(envPath);
} catch {
  console.error(
    pc.red(`Failed to read ${envPath}. Make sure the file exists.`),
  );
  process.exit(1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    pc.red(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    ),
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Interactive prompts
// ---------------------------------------------------------------------------

p.intro(pc.bgCyan(pc.black(" Create New User ")));

const answers = await p.group(
  {
    email: () =>
      p.text({
        message: "Email address",
        placeholder: "user@example.com",
        validate: (v) => {
          if (!v) return "Email is required";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
            return "Enter a valid email";
        },
      }),
    password: () =>
      p.password({
        message: "Password",
        validate: (v) => {
          if (!v) return "Password is required";
          if (v.length < 8) return "Password must be at least 8 characters";
        },
      }),
    firstName: () =>
      p.text({
        message: "First name",
        validate: (v) => {
          if (!v) return "First name is required";
        },
      }),
    lastName: () =>
      p.text({
        message: "Last name",
        validate: (v) => {
          if (!v) return "Last name is required";
        },
      }),
  },
  {
    onCancel: () => {
      p.cancel("User creation cancelled.");
      process.exit(0);
    },
  },
);

// ---------------------------------------------------------------------------
// 3. Create auth user via Supabase Admin API
// ---------------------------------------------------------------------------

const spinner = p.spinner();
spinner.start("Creating auth user");

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({
    email: answers.email,
    password: answers.password,
    email_confirm: true,
  }),
});

if (!authRes.ok) {
  const err = await authRes.json().catch(() => ({}));
  spinner.stop("Failed to create auth user", 1);
  console.error(pc.red(`Supabase Auth error: ${err.msg || err.message || authRes.statusText}`));
  process.exit(1);
}

const authUser = await authRes.json();
spinner.stop("Auth user created");

// ---------------------------------------------------------------------------
// 4. Insert people record
// ---------------------------------------------------------------------------

spinner.start("Creating people record");

const fullName = `${answers.firstName} ${answers.lastName}`;

const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/people`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Prefer: "return=representation",
  },
  body: JSON.stringify({
    auth_user_id: authUser.id,
    email: answers.email,
    first_name: answers.firstName,
    last_name: answers.lastName,
    name: fullName,
  }),
});

if (!insertRes.ok) {
  const err = await insertRes.json().catch(() => ({}));
  spinner.stop("Failed to create people record", 1);
  console.error(pc.red(`Supabase REST error: ${err.message || insertRes.statusText}`));
  // Try to clean up the auth user we just created
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  }).catch(() => {});
  console.log(pc.yellow("Rolled back auth user creation."));
  process.exit(1);
}

const [person] = await insertRes.json();
spinner.stop("People record created");

// ---------------------------------------------------------------------------
// 5. Success
// ---------------------------------------------------------------------------

p.note(
  [
    `${pc.bold("Auth User ID:")}  ${authUser.id}`,
    `${pc.bold("Person ID:")}     ${person.id}`,
    `${pc.bold("Email:")}         ${answers.email}`,
    `${pc.bold("Name:")}          ${fullName}`,
  ].join("\n"),
  "User created successfully",
);

p.outro(pc.green("Done! The user can now log in."));
