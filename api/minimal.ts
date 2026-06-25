export default async function handler(req: any, res: any) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, node: process.version, time: Date.now() }));
}
