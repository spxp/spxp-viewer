<?php
/**
 * SPXP CORS Proxy
 * Fetches SPXP profiles and forwards them to the browser.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get and validate URL
$url = $_GET['url'] ?? '';

if (empty($url)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing url parameter']);
    exit;
}

// Basic URL validation
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid URL']);
    exit;
}

// Only allow http(s)
$scheme = parse_url($url, PHP_URL_SCHEME);
if (!in_array($scheme, ['http', 'https'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Only HTTP(S) URLs allowed']);
    exit;
}

// Fetch the URL
$context = stream_context_create([
    'http' => [
        'timeout' => 10,
        'user_agent' => 'SPXP-Viewer/1.0',
        'follow_location' => true,
        'max_redirects' => 5
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true
    ]
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch URL', 'url' => $url]);
    exit;
}

// Forward the response
echo $response;
