<?php
/* Existing /blog/ public asset directory: forward its directory index to Laravel. */
$uri = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
if (str_ends_with($uri, '/index.php')) { header('Location: /blog/', true, 301); exit; }
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = dirname(__DIR__).'/index.php';
require dirname(__DIR__).'/index.php';
