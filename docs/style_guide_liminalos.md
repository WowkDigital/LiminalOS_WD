# Przewodnik po Stylu Graficznym LiminalOS v5 (Design System)

Ten dokument opisuje architekturę wizualną, system projektowania (Design System) oraz szczegółowe wytyczne dotyczące stylu graficznego zastosowanego w aplikacji **LiminalOS v5**. Projekt łączy estetykę **liminalną, retro-industrialną i dark sci-fi** z nowoczesnymi trendami UI, takimi jak **glassmorphism**, dynamiczne mikro-animacje oraz interaktywna wizualizacja danych (radar/mapa).

---

## 🎨 1. Paleta Kolorów i Zmienne CSS (:root)

Cały interfejs graficzny opiera się na zestawie zmiennych (Design Tokens) zdefiniowanych w pliku `style.css`:

```css
:root {
    /* Rdzeń i tło */
    --bg-core: #050505;
    --bg-grad-start: #0f1014;
    --bg-grad-end: #000000;

    /* Szkło (Glassmorphism) */
    --glass-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-highlight: rgba(255, 255, 255, 0.05);
    --glass-heavy: rgba(10, 10, 10, 0.85);
    --glass-light: rgba(255, 255, 255, 0.02);

    /* Tekst */
    --text-main: #f0f0f0;
    --text-secondary: #9ca3af;
    --text-muted: #525252;

    /* Akcenty (Amber / Bursztyn) */
    --accent-primary: #eab308;        /* Amber 500 */
    --accent-glow: rgba(234, 179, 8, 0.25);
    --accent-dim: #854d0e;
    --amber: #eab308;

    /* Statusy i stany */
    --success: #10b981;
    --error: #ef4444;

    /* Typografia */
    --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
    --font-mono: 'Space Mono', monospace;
    --font-title: 'VT323', monospace;

    /* Zaokrąglenia */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 24px;
}
```

### Efekt głębi tła (Background Depth)
Tło strony (`body`) nie jest płaską czernią. Zastosowano na nim dwa asymetryczne gradienty radialne imitujące nieznaczne podświetlenie otoczenia:
```css
body {
    background-color: var(--bg-core);
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(30, 30, 35, 0.4) 0%, transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(20, 20, 25, 0.4) 0%, transparent 25%);
}
```

---

## ✍️ 2. Typografia i Hierarchia Tekstu

W aplikacji zastosowano trzy dedykowane fonty z bazy Google Fonts, o zróżnicowanym przeznaczeniu:
1. **`Inter` (Sans-Serif)** – tekst główny, opisy lokacji, elementy interfejsu administracyjnego. Zapewnia maksymalną czytelność.
2. **`Space Mono` (Monospace)** – terminal, dane telemetryczne, napisy w menu, statusy i kody błędów. Wzmacnia techniczny charakter systemu.
3. **`VT323` (Retro Pixel/Raster)** – logotypy oraz tytuły nagłówkowe. Odwołuje się bezpośrednio do estetyki retro-komputerowej i systemów CRT z lat 80. / 90.

---

## 📺 3. Efekty Post-processingu Wizualnego (Klimat Liminalny)

Aplikacja wykorzystuje nakładane warstwowo efekty wizualne na całoekranowym podglądzie pokoi (`#scene-bg`):

* **Podwójna warstwa renderowania obrazu**:
  * Tło z silnym rozmyciem (`#room-image-blur`): `filter: blur(20px) brightness(0.25) saturate(0.8);` – tworzy nastrojową, kolorystyczną poświatę.
  * Ostre centrum (`#room-image`): `filter: brightness(0.55) contrast(1.15) saturate(0.7);` – zmniejsza jasność i saturację, aby wtopić grafikę w mroczny interfejs OS.
* **Winieta cyfrowa (`#scene-vignette`)**: Zciemniający gradient radialny na krawędziach ekranu tworzący poczucie klaustrofobii.
* **Szum i ziarno cyfrowe (`#scene-noise`)**: Subtelny szum wygenerowany przy pomocy wektora SVG (`mix-blend-mode: overlay` z opacity `3.5%`).
* **Efekt monitora CRT (`#crt-overlay`)**: 
  * Wzorzec poziomych linii skanowania (`repeating-linear-gradient`).
  * Animowana w pionie gruba linia skanująca (`scanline 8s linear infinite`), symulująca odświeżanie starego kineskopu.

---

## 💻 4. Stylowanie Terminala (Terminal v2.0)

Terminal działa jako zaawansowany komponent HUD o statusie dynamicznie rozwijanego paska dolnego (`#terminal-line-container`).

### Elementy stylistyczne:
* **Obudowa szklana**: Panel zbudowany na rozmyciu tła (`backdrop-filter: blur(20px)`) z tłem `rgba(8, 8, 12, 0.75)` i delikatną białą ramką o opacity `6%`.
* **Stan uśpienia (Standby)**: Zwinięty do formy wąskiego paska z boku ekranu. Wyświetla jednoliniowy podgląd ostatniej odpowiedzi systemowej w kolorze bursztynowym (`--accent-primary`) wraz z cieniem neonowym (`text-shadow`).
* **Diody statusowe z animacjami**:
  * `online`: Zielony, stały punkt.
  * `active` / `blink`: Bursztynowy, pulsujący za pomocą `@keyframes statusPulse` lub szybko migający `@keyframes statusRapidBlink`.
  * `busy`: Błękitny, o podwyższonej częstotliwości pulsowania (procesor zajęty).
  * `error`: Czerwony, alarmowy.
* **Interaktywne Opcje wyboru (`.terminal-option-item`)**:
  * Po najechaniu myszką podświetlają się na bursztynowo, zyskują tło o niskim opacity (`rgba(234, 179, 8, 0.06)`) oraz animują wewnętrzną ramkę i ikonę.
  * Posiadają efekt fali uderzeniowej po kliknięciu (`.option-ripple`) wykorzystujący dynamiczną animację transformacji skali i zanikania.
  * **Opcje ze spadkiem poczytalności (`.opt-failed-sanity`)**: Wyróżnione kolorem pomarańczowym (`#f97316`) z dedykowanym stylem graficznym, sygnalizujące ograniczenia psychiczne bohatera.

---

## 🗺️ 5. Wizualizacja Mapy (SYS.LOCATOR_DUMP_v5.2)

Mapa to interaktywny radar SVG wbudowany w prawy panel boczny (`#map-panel`), obsługujący powiększenie (zoom), przesuwanie (pan) oraz przeciąganie węzłów (Map V2).

### Detale graficzne:
* **Tło siatki radarowej**: Zastosowano wzór SVG (`#map-grid`) złożony z kropek o kolorze bursztynowym z opacity `12%` rozstawionych co 24px.
* **Wizualizacja Węzłów (Pokoi)**:
  * **Bieżący Pokój (`.map-node--current`)**: Duży bursztynowy punkt z białą obwódką, otoczony dwoma koncentrycznymi elementami:
    1. Pulsacyjny pierścień poświaty (`--accent-glow`), stale zmieniający swój promień od 11px do 17px.
    2. Techniczny pierścień celowniczy o wzorze przerywanym (`stroke-dasharray`), obracający się wokół własnej osi (`animateTransform rotate`).
  * **Dostępne Sąsiednie Pokoje (`.map-node--reachable`)**: Przezroczysty punkt bursztynowy otoczony pulsującym nimbem celowniczym z zielonkawym/żółtawym podpisem "▸ GO".
  * **Odwiedzone Pokoje (`.map-node--visited`)**: Zielone punkty o twardej obwódce (`--success`).
  * **Nieodkryte Pokoje (`.map-node--unknown`)**: Małe, szare, przerywane punkciki ze znakiem zapytania w środku.
* **Ścieżki i Połączenia (`.map-edge` / `.map-edge-flow`)**:
  * Skierowane linie z ostrzami strzałek (`#arrowhead`), dopasowujące się kolorystycznie do kategorii przejść (np. schody, drzwi, szyb wentylacyjny).
  * Ścieżki nieodkryte rysowane są jako szare linie przerywane.
  * Na odwiedzonych ścieżkach nakładany jest animowany przebieg danych (`.map-edge-flow`), imitujący impuls lasera poruszający się od punktu startowego do celu.
* **Panel Telemetrii (`#map-node-details`)**: Czarny, techniczny panel u dołu mapy wyświetlający pseudo-współrzędne wygenerowane na podstawie hashu nazwy pokoju oraz listę kierunków wyjściowych w formie surowego logu systemowego.

---

## 📊 6. Panel HUD i Menu Ustawień

* **Pasek HUD (`#hud-bar`)**:
  * Półprzezroczysta czarna belka górna (`rgba(10, 10, 10, 0.6)`) z filtrem rozmycia, oddzielona od viewportu gry linią `--glass-border`.
  * Wskaźnik poczytalności (Sanity) z płynnym, czerwono-bursztynowym paskiem postępu (`#sanity-fill`), reagującym natychmiast na zmiany parametrów zdrowia psychicznego.
* **Menu Ustawień (`#settings-panel`)**:
  * Minimalistyczny wysuwany panel w stylu konsoli systemowej z nagłówkiem `// SYSTEM CONFIG`.
  * Suwaki (`input[type="range"]`) dopasowane do stylu retro – szare tło z bursztynowym paskiem postępu i okrągłym manipulatorem.

---

*Przewodnik ten określa spójność stylistyczną aplikacji i powinien być podstawą przy wdrażaniu wszelkich nowych widoków, podstron oraz rozszerzeń gry.*
