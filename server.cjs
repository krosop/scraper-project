const http = require('http');
const fs = require('fs');
const path = require('path');
http.createServer((req, res) => {
  let file = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(file)) file = path.join(__dirname, 'dist', 'index.html');
  const ext = path.extname(file);
  const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
  res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
}).listen(3456, () => console.log('Server on http://localhost:3456'));
