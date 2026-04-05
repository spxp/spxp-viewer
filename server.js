/**
 * Local dev server with built-in CORS proxy
 * Run with: node server.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const request = client.get(url, {
            headers: { 'User-Agent': 'SPXP-Viewer/1.0' },
            timeout: 10000
        }, (response) => {
            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                fetchUrl(response.headers.location).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        });
        
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Timeout'));
        });
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // CORS proxy endpoint
    if (url.pathname === '/proxy.php' || url.pathname === '/proxy') {
        const targetUrl = url.searchParams.get('url');
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }
        
        try {
            const data = await fetchUrl(targetUrl);
            res.end(data);
        } catch (error) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: error.message, url: targetUrl }));
        }
        return;
    }
    
    // Static file serving
    let filePath = url.pathname;
    if (filePath === '/') filePath = '/index.html';
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    
    // Security: prevent directory traversal
    if (!fullPath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }
    
    try {
        const content = fs.readFileSync(fullPath);
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        res.end(content);
    } catch (error) {
        res.statusCode = 404;
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🌐 SPXP Viewer running at http://localhost:${PORT}\n`);
    console.log('Press Ctrl+C to stop\n');
});
