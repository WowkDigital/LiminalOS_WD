# Propozycje Usprawnień dla LiminalOS (Admin Panel & Game Engine)

Na podstawie analizy kodu zidentyfikowano kluczowe obszary, które można usprawnić pod kątem wydajności, bezpieczeństwa, czystości kodu (clean code) oraz wrażeń z rozgrywki.

---

## 1. Architektura i Frontend Panelu Admina (Refaktoryzacja `script.js`)

Obecny plik `script.js` ma prawie 2000 linii kodu i łączy w sobie obsługę sieci, routing, zarządzanie stanem i ręczne renderowanie DOM. 

### A. Podział na Moduły ES6
Rozbicie monolitu na dedykowane pliki o pojedynczej odpowiedzialności (Single Responsibility Principle):
*   `api.js` – Centralny klient API. Obsługa zapytań `fetch`, ujednolicenie nagłówków, obsługa błędów sieciowych i tokenów autoryzacji.
*   `state.js` – Sklep stanu aplikacji (Store). Reaktywne powiadamianie komponentów o zmianach w `roomsData` czy `audioMappings` (zapobiega to niespójnościom w interfejsie).
*   `router.js` – Moduł obsługujący zmiany hasha w adresie URL (`#dashboard`, `#editor`), przejścia animowane między widokami oraz autoryzację.
*   `views/` – Podfolder zawierający osobne widoki (np. `dashboardView.js`, `editorView.js`, `mediaLibraryView.js`).

### B. Przejście z Raw HTML na Komponenty/Szablony
*   **Problem:** Formularze są budowane przez łączenie stringów HTML (`innerHTML = '...'`), co uniemożliwia statyczną analizę kodu i jest podatne na błędy XSS.
*   **Rozwiązanie:** Stworzenie małych, reużywalnych klas/funkcji komponentów (np. `MediaSelector`, `RequirementsBuilder`) korzystających z tagu `<template>` zdefiniowanego w HTML lub tworzących elementy bezpośrednio przez `document.createElement`.

---

## 2. Backend API i Spójność Danych (SQLite & PHP)

### A. Integralność Bazy Danych (Kaskadowe Usuwanie)
*   **Problem:** W `api.php` ręcznie kasujemy powiązane rekordy (np. przy usuwaniu obiektu interaktywnego usuwamy wpisy z tabel pomocniczych).
*   **Rozwiązanie:** Włączenie obsługi kluczy obcych (`PRAGMA foreign_keys = ON;` w SQLite) oraz zdefiniowanie relacji z parametrem `ON DELETE CASCADE`. Zapobiegnie to powstawaniu osieroconych wpisów.

### B. Przeniesienie Danych do Jednego Miejsca
*   **Problem:** Definicje przejść częściowo znajdują się w bazie SQLite, a częściowo w plikach JSON (`transitions.json`).
*   **Rozwiązanie:** Pełna migracja danych konfiguracyjnych do SQLite, czyniąc bazę danych jedynym źródłem prawdy (Single Source of Truth).

### C. Garbage Collector dla Plików
*   Dodanie w backendzie automatycznego usuwania plików fizycznych z dysku (`media/uploads/` i `media/sound_effects/`) w momencie, gdy powiązany rekord jest usuwany z tabel `media_library` lub `audio_library`.

---

## 3. Silnik Gry (Game Client - `app.js`, `audio.js`, `mapgen.js`)

### A. Zapis Gry w Chmurze (Cloud Save)
*   Umożliwienie graczowi zapisu stanu gry bezpośrednio w bazie SQLite poprzez API (np. pod unikalnym identyfikatorem sesji), zamiast polegania wyłącznie na ulotnej pamięci `localStorage`.

### B. Efekty Audio Zależne od Sanity (Dynamic DSP)
*   **Dynamiczny Filtr Low-Pass:** Gdy sanity spada poniżej 40%, silnik audio (`audio.js`) mógłby nakładać filtr dolnoprzepustowy (Low-Pass Filter) na muzykę tła (BGM), tłumiąc wysokie tony, aby zasymulować otępienie zmysłów.
*   **Proceduralny Pisk (Tinnitus):** Przy krytycznie niskim poziomie sanity (< 15%) generowanie cichego oscylatora o wysokiej częstotliwości (np. sinus 8000Hz), potęgującego uczucie paniki u gracza.

### C. Optymalizacja Pamięci w AudioEngine
*   Zapobieganie wyciekom pamięci w Web Audio API poprzez aktywne niszczenie i odpinanie nieużywanych węzłów (Nodes) oraz recykling oscylatorów.

### D. Rozbudowa Wizualizacji Mapy (`mapgen.js`)
*   **Ścieżka Historii:** Oznaczanie na mapie krawędzi (linii połączeń), którymi gracz już podróżował (np. grubsza linia lub inny kolor), aby ułatwić orientację w terenie.
*   **Wskaźniki Zagrożenia:** Dynamiczne zabarwienie węzłów pokoju na mapie w zależności od wymagań psychicznych (np. pokoje z wysokim wymaganiem Sanity świecące delikatnie na czerwono/pomarańczowo).
