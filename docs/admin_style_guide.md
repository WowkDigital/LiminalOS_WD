# Przewodnik po Stylu Interfejsu LiminalOS (/admin)

Ten dokument opisuje kompletny system projektowania (Design System) zastosowany w panelu administracyjnym `/admin`. Łączy on elementy **estetyki liminalnej, industrialnej oraz dark cyberpunk** z nowoczesnym efektem **glassmorphism** i wyrazistymi, żółto-bursztynowymi akcentami.

---

## 🎨 1. Paleta Kolorów i Zmienne CSS (:root)

Cały styl opiera się na zestawie zmiennych CSS, co pozwala na pełną spójność i łatwe przenoszenie stylów.

```css
:root {
    /* Tła (Backgrounds) */
    --bg-core: #050505;
    --bg-grad-start: #0f1014;
    --bg-grad-end: #000000;

    /* Szkło (Glassmorphism) */
    --glass-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-highlight: rgba(255, 255, 255, 0.05);

    /* Tekst (Typography Colors) */
    --text-main: #f0f0f0;
    --text-secondary: #9ca3af;
    --text-muted: #525252;

    /* Akcenty (Amber / Yellow) */
    --accent-primary: #eab308;        /* Amber 500 */
    --accent-glow: rgba(234, 179, 8, 0.3);
    --accent-dim: #854d0e;

    /* Statusy (States) */
    --success: #10b981;
    --error: #ef4444;

    /* Typografia (Fonts) */
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'Space Mono', monospace;

    /* Zaokrąglenia (Border Radius) */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 24px;

    /* Animacje i Efekty */
    --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --shadow-soft: 0 4px 20px -2px rgba(0, 0, 0, 0.5);
    --shadow-card: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
}
```

### Charakterystyka tła body:
Tło nie jest jednolicie czarne. Wykorzystuje subtelne radialne gradienty po bokach ekranu, tworzące wrażenie przestrzenności (tzw. "vibe" głębi):
```css
body {
    background-color: var(--bg-core);
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(30, 30, 35, 0.4) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(20, 20, 25, 0.4) 0%, transparent 25%);
}
```

---

## ✍️ 2. Typografia

W projekcie zaimportowano dwie czcionki z biblioteki Google Fonts:
1. **`Inter`** (font bezszeryfowy) – używany do tekstu głównego, opisów, kontrolek formularzy i elementów o wysokiej czytelności.
2. **`Space Mono`** (font o stałej szerokości znaków) – używany do nagłówków `h2`, logo, przycisków nawigacyjnych, etykiet danych, tagów oraz wskaźników technicznych. Podkreśla "maszynowy" i terminalowy charakter aplikacji.

---

## 🪟 3. Efekt Glassmorphism (Efekt Szkła)

Elementy interfejsu (karty, panele boczne, modale) sprawiają wrażenie półprzezroczystych, nałożonych na siebie warstw szkła:
* **Przezroczyste tło**: `rgba(255, 255, 255, 0.03)`
* **Subtelna obwódka**: `1px solid rgba(255, 255, 255, 0.08)` (zapobiega zlewaniu się elementów z czarnym tłem)
* **Rozmycie tła (Backdrop Filter)**: `backdrop-filter: blur(20px);` (kluczowe do rozmywania elementów pod spodem)

---

## 📐 4. Układ i Grid (Layout)

* **Siatka dwukolumnowa**: Panel podzielony jest na stały pasek boczny (`.sidebar`, szerokość `280px`) z efektem rozmycia oraz elastyczny panel zawartości głównej (`.content`).
* **Responsywność (Media Queries)**: Dla ekranów poniżej `1024px` układ zmienia się w jednokolumnowy (pasek boczny przechodzi na górę jako nagłówek, a zawartość główna przewija się w pionie na całym ekranie).
* **Grid Kart (`.rooms-grid`)**: Dynamiczna siatka dopasowująca się do szerokości ekranu:
  ```css
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  ```

---

## ✨ 5. Interakcje i Mikro-animacje (Micro-interactions)

To one nadają interfejsowi luksusowy i dopracowany wygląd:

### A. Animacja hover na kartach (`.room-card`)
Gdy najeżdżasz myszką na kartę pokoju:
1. Karta delikatnie unosi się w górę: `transform: translateY(-4px);`
2. Obwódka zmienia kolor na akcentowy (bursztynowy).
3. Pojawia się subtelna poświata: `box-shadow: 0 0 20px rgba(234, 179, 8, 0.1);`
4. Zdjęcie wewnątrz karty powiększa się o 5% i staje się w pełni wyraźne (`opacity: 1`, `scale(1.05)`).

### B. Bursztynowa linia dekoracyjna (`::before`)
Każda karta posiada ukrytą na samej górze poziomą linię akcentową o wysokości `2px`. Przy najechaniu myszką rozsuwa się ona od lewej do prawej:
```css
.room-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 2px;
    background: var(--accent-primary);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
}
.room-card:hover::before {
    transform: scaleX(1);
}
```

### C. Pulsująca dioda statusu (`.dot`)
Dioda wskazująca stan "System Online" w lewym dolnym rogu stale pulsuje jasnością:
```css
@keyframes pulse {
    0% { opacity: 0.5; }
    50% { opacity: 1; }
    100% { opacity: 0.5; }
}
.dot {
    width: 6px; height: 6px;
    background: var(--success);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--success);
    animation: pulse 2s infinite;
}
```

### D. Przyciski i nawigacja (`.nav-btn`, `.btn-primary`)
* Aktywny przycisk nawigacyjny posiada tło `rgba(234, 179, 8, 0.1)` z bursztynowym tekstem i ikoną.
* Ikony przycisków przy najechaniu lekko przesuwają się w prawo o 2px (`transform: translateX(2px);`).
* Główny przycisk (`.btn-primary`) ma pełny bursztynowy kolor, a przy najechaniu zyskuje poświatę `box-shadow: 0 0 15px var(--accent-glow)`.

---

## 💻 6. Podstawowy szablon HTML i CSS do wykorzystania na stronie głównej

Poniższy kod stanowi gotową bazę do stworzenia strony głównej gry w identycznym stylu.

### Plik CSS (`style_base.css`):
```css
/* Import czcionek */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

/* Zmienne globalne */
:root {
    --bg-core: #050505;
    --glass-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-highlight: rgba(255, 255, 255, 0.05);
    --text-main: #f0f0f0;
    --text-secondary: #9ca3af;
    --accent-primary: #eab308;
    --accent-glow: rgba(234, 179, 8, 0.3);
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'Space Mono', monospace;
    --radius-md: 12px;
}

body {
    background-color: var(--bg-core);
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(30, 30, 35, 0.4) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(20, 20, 25, 0.4) 0%, transparent 25%);
    color: var(--text-main);
    font-family: var(--font-sans);
    margin: 0;
    padding: 0;
    min-height: 100vh;
}

/* Szklany kontener */
.glass-container {
    background: var(--glass-panel);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-md);
    padding: 2rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}

/* Bursztynowy przycisk */
.accent-btn {
    background: var(--accent-primary);
    color: #151515;
    font-family: var(--font-mono);
    border: none;
    padding: 12px 28px;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.accent-btn:hover {
    box-shadow: 0 0 15px var(--accent-glow);
    background: #facc15;
    transform: translateY(-1px);
}
```
