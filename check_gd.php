<?php
header('Content-Type: text/plain');
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Loaded php.ini: " . php_ini_loaded_file() . "\n";
echo "GD extension: " . (extension_loaded('gd') ? "LOADED" : "NOT LOADED") . "\n";
if (extension_loaded('gd')) {
    echo "imagecreatefromjpeg exists: " . (function_exists('imagecreatefromjpeg') ? "YES" : "NO") . "\n";
    $info = gd_info();
    echo "JPEG Support: " . ($info['JPEG Support'] ? "YES" : "NO") . "\n";
}
?>
