// Grants or revokes the admin role. Roles can only change through a trusted
// database role (see drizzle/0006_admin_role_guard.sql), so this runs as the
// postgres owner via DIRECT_URL — never from the browser.
//
// Usage:
//   node scripts/set-role.mjs <email> admin
//   node scripts/set-role.mjs <email> member
//   node scripts/set-role.mjs --list          # show current admins
import { config } from "dotenv";
import postgres from "postgres";

config({ path: [".env.local", ".env"], quiet: true });

const [emailOrFlag, role] = process.argv.slice(2);
if (!emailOrFlag || (emailOrFlag !== "--list" && !["admin", "member"].includes(role))) {
  console.error("Usage: node scripts/set-role.mjs <email> <admin|member>  |  --list");
  process.exit(1);
}

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  if (emailOrFlag === "--list") {
    const admins = await sql`
      SELECT a.email, u.first_name, u.last_name, u.updated_at
      FROM public.users u JOIN auth.users a ON a.id = u.id
      WHERE u.role = 'admin' ORDER BY a.email`;
    if (admins.length) console.table(admins);
    else console.log("No admins yet.");
  } else {
    const rows = await sql`
      UPDATE public.users u SET role = ${role}
      FROM auth.users a
      WHERE a.id = u.id AND lower(a.email) = lower(${emailOrFlag})
      RETURNING a.email, u.role`;
    if (rows.length === 0) {
      console.error(`No user with email ${emailOrFlag}. They must sign up first.`);
      process.exitCode = 1;
    } else {
      console.log(`${rows[0].email} is now ${rows[0].role}. Takes effect on their next request.`);
    }
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
