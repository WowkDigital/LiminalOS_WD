# Open Graph Setup for LiminalOS

We have created an atmospheric retro Open Graph preview image matching the design of LiminalOS, resized it to the optimal landscape dimensions (1200x630), and configured the necessary metadata in `index.html`.

## Generated Preview Image
An evocative retro image was generated and cropped to a widescreen landscape aspect ratio (1.91:1, 1200x630 pixels). It features the iconic yellow office hallway of Level 0 (The Backrooms) with a CRT monitor displaying the LiminalOS console and diagnostic system logs.

![LiminalOS OG Widescreen Preview](file:///C:/Users/wowkd/.gemini/antigravity/brain/7fec18f8-01ec-4929-bd32-88575007fa09/og_image_cropped_1200x630.png)

> [!NOTE]
> The image has been saved to the project directory: `media/images/og_image.png`
> Size: 1200x630 pixels.

## HTML Metadata Implementation
The following tags have been updated in the `<head>` section of `index.html`:

```html
<!-- Open Graph / Facebook Metadata -->
<meta property="og:type" content="website">
<meta property="og:title" content="LIMINAL OS - Backrooms Explorer">
<meta property="og:description" content="A vanilla JS adventure game set in the Backrooms. Survive the liminal space.">
<meta property="og:image" content="media/images/og_image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="LIMINAL OS">
<!-- Note: Replace the URL below with your actual deployed URL for full compatibility -->
<meta property="og:url" content="https://liminalos.com/">

<!-- Twitter Card Metadata -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LIMINAL OS - Backrooms Explorer">
<meta name="twitter:description" content="A vanilla JS adventure game set in the Backrooms. Survive the liminal space.">
<meta name="twitter:image" content="media/images/og_image.png">
```

> [!TIP]
> While relative image paths work in modern platforms (like Discord), for full compatibility across older parsers (like Facebook Debugger), replace `media/images/og_image.png` and `https://liminalos.com/` with your actual absolute domain when deploying.
