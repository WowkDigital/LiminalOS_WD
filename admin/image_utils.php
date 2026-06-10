<?php
// admin/image_utils.php

// Define base paths relative to the media directory
$mediaDir = realpath(__DIR__ . '/../media');
$uploadDir = $mediaDir . '/uploads/';
$imagesDir = $mediaDir . '/images/';
$thumbsDir = $imagesDir . 'thumbs/';

// Ensure directories exist
if (!is_dir($uploadDir))
    mkdir($uploadDir, 0777, true);
if (!is_dir($imagesDir))
    mkdir($imagesDir, 0777, true);
if (!is_dir($thumbsDir))
    mkdir($thumbsDir, 0777, true);

/**
 * Saves a GD image resource to disk with appropriate quality/compression settings.
 */
function saveImage($img, $path, $type, $quality = 85)
{
    switch ($type) {
        case IMAGETYPE_JPEG:
            imagejpeg($img, $path, $quality);
            break;
        case IMAGETYPE_PNG:
            $pngQuality = (int)round(9 * (100 - $quality) / 100);
            imagepng($img, $path, $pngQuality);
            break;
        case IMAGETYPE_WEBP:
            imagewebp($img, $path, $quality);
            break;
    }
}

/**
 * Processes a source image into a compressed version and a thumbnail.
 * Handles EXIF orientation for JPEGs.
 */
function processImage($sourcePath, $filename)
{
    global $imagesDir, $thumbsDir;

    $info = getimagesize($sourcePath);
    if (!$info)
        return false;

    $width = $info[0];
    $height = $info[1];
    $type = $info[2];

    $src = null;
    switch ($type) {
        case IMAGETYPE_JPEG:
            $src = @imagecreatefromjpeg($sourcePath);
            break;
        case IMAGETYPE_PNG:
            $src = @imagecreatefrompng($sourcePath);
            break;
        case IMAGETYPE_WEBP:
            if (function_exists('imagecreatefromwebp'))
                $src = @imagecreatefromwebp($sourcePath);
            break;
    }

    if (!$src)
        return false;

    // Handle EXIF orientation for JPEG
    if ($type === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $exif = @exif_read_data($sourcePath);
        if ($exif && isset($exif['Orientation'])) {
            switch ($exif['Orientation']) {
                case 3:
                    $src = imagerotate($src, 180, 0);
                    break;
                case 6:
                    $src = imagerotate($src, -90, 0);
                    $tmpW = $width;
                    $width = $height;
                    $height = $tmpW;
                    break;
                case 8:
                    $src = imagerotate($src, 90, 0);
                    $tmpW = $width;
                    $width = $height;
                    $height = $tmpW;
                    break;
            }
        }
    }

    // 1. Compressed version (Max 1920x1080)
    $maxW = 1920;
    $maxH = 1080;
    $ratio = min($maxW / $width, $maxH / $height);
    if ($ratio > 1)
        $ratio = 1;

    $newW = (int)round($width * $ratio);
    $newH = (int)round($height * $ratio);

    $tmp = imagecreatetruecolor($newW, $newH);
    if ($type == IMAGETYPE_PNG || $type == IMAGETYPE_WEBP) {
        imagealphablending($tmp, false);
        imagesavealpha($tmp, true);
    }
    imagecopyresampled($tmp, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);
    saveImage($tmp, $imagesDir . $filename, $type, 85);

    // 2. Thumbnail (Max 400px)
    $thumbSize = 400;
    $tRatio = min($thumbSize / $width, $thumbSize / $height);
    if ($tRatio > 1)
        $tRatio = 1;

    $tw = (int)round($width * $tRatio);
    $th = (int)round($height * $tRatio);

    $tTmp = imagecreatetruecolor($tw, $th);
    if ($type == IMAGETYPE_PNG || $type == IMAGETYPE_WEBP) {
        imagealphablending($tTmp, false);
        imagesavealpha($tTmp, true);
    }
    imagecopyresampled($tTmp, $src, 0, 0, 0, 0, $tw, $th, $width, $height);
    saveImage($tTmp, $thumbsDir . $filename, $type, 70);
    return true;
}
