const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOMS_FILE = path.join(__dirname, 'world_data', 'rooms.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
    // API Routes
    if (req.url === '/api/rooms' && req.method === 'GET') {
        fs.readFile(ROOMS_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read rooms' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    if (req.url === '/api/rooms' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const { id, room } = payload;

                if (!id || !room) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid data' }));
                    return;
                }

                fs.readFile(ROOMS_FILE, 'utf8', (err, data) => {
                    let roomsJson = { rooms: {} };
                    if (!err) {
                        try {
                            roomsJson = JSON.parse(data);
                        } catch (e) {
                            roomsJson = { rooms: {} };
                        }
                    }

                    roomsJson.rooms[id] = room;

                    fs.writeFile(ROOMS_FILE, JSON.stringify(roomsJson, null, 4), 'utf8', (err) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save room' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: `Room ${id} saved` }));
                    });
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = req.url === '/' ? '/index.html' : req.url;

    // Handle /admin redirect and path mapping
    if (filePath === '/admin') {
        res.writeHead(301, { "Location": "/admin/" });
        res.end();
        return;
    }
    if (filePath === '/admin/') {
        filePath = '/admin/index.html';
    }

    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(fullPath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Liminal Engine running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
