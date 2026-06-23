import postgres from "postgres";

async function test() {
  const sql = postgres(
    "postgresql://postgres.kimimbrbzqnmtboxjcnh:Kimi1234567890!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    { prepare: false, ssl: "require" }
  );
  try {
    const result = await sql`SELECT 1 as test`;
    console.log("Connection OK:", result);
  } catch (e) {
    console.error("Connection failed:", e);
  } finally {
    await sql.end();
  }
}

test();
