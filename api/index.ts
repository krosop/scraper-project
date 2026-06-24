export default function (req: any, res: any) {
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, message: "Minimal index" }));
}
