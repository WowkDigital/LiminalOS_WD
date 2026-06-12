# Kierunki Rozwoju LiminalOS (Wersja v5.5+)

Niniejszy dokument przedstawia zaawansowane, konkretne pomysły na rozwój projektu **LiminalOS // Backrooms Explorer**. Propozycje podzielono na kluczowe obszary, skupiając się na immersji, interaktywności terminala, ulepszeniach edytora oraz aspektach technicznych.

---

## 1. Mechanika Rozgrywki & Interaktywność (Gameplay & CLI)

### 1.1 Minigra Hakerska (`HACK` / `DECRYPT`)
*   **Koncepcja**: Zamiast prostego sprawdzania, czy gracz posiada pendrive (`flash_drive`), uruchomienie interaktywnej minigry CLI przy próbie uzyskania dostępu do zablokowanych terminali (np. `workstation_pc` lub konsol w serwerowni).
*   **Mechanika**: 
    *   **Zgadywanie hasła (styl Fallout)**: Terminal wyświetla zrzut pamięci z losowymi słowami. Gracz ma 4 próby na dopasowanie hasła, a system informuje, ile liter w wybranej próbie jest na właściwych miejscach.
    *   **Deszyfracja Binarna**: Szybkie przepisywanie migających ciągów binarnych lub heksadecymalnych w celu stabilizacji sygnału na czas.
*   **Integracja**: Wymaga dodania nowego stanu terminala (`currentState = "HACKING"`) i przechwytywania klawiatury w `terminal.js`.

### 1.2 System Unikania Bytów i Anomalii (Dynamic Danger States)
*   **Koncepcja**: Losowe zdarzenia zagrażające życiu/poczytalności gracza, które wymuszają interakcję z otoczeniem.
*   **Mechanika**:
    *   W pewnych pokojach po zalogowaniu terminal nagle zaczyna wyświetlać czerwone komunikaty: `OSTRZEŻENIE: WYKRYTO ANOMALIĘ SYGNATURY CIEPLNEL... ZBLIŻANIE BYTU`.
    *   Gracz musi wykonać akcję w pokoju, np. ugasić światło (`ACT lobby_light off`) lub schować się w wentylacji (`ACT lobby_vent hide`), a następnie przeczekać w bezruchu przez 5 sekund.
    *   Niewykonanie akcji na czas skutkuje potężnym spadkiem Sanity lub "wygnaniem" do pustki (Transition do pokoju `void`).

### 1.3 Zaawansowana Baza Logów i Dzienników (`LOGS` / `ARCHIVE`)
*   **Koncepcja**: Rozbudowany, fabularny system eksploracji plików.
*   **Mechanika**:
    *   Komenda `DIR` lub `FILES` listująca pliki tekstowe znalezione na komputerach (np. `sys_log_04.txt`, `survey_report.bin`).
    *   Komenda `CAT [nazwa]` lub `READ [nazwa]` wyświetlająca treść. Niektóre pliki mogą zawierać kody numeryczne do zablokowanych drzwi lub podpowiedzi, które przejścia (transitions) są bezpieczne, a które prowadzą w pułapkę.

---

## 2. Immersja Audio-Wizualna (Audiovisual & Shader Effects)

### 2.1 Sanity-Coupled DSP (Efekty Audio Zależne od Poczytalności)
*   **Koncepcja**: Dźwięk staje się lustrem zdrowia psychicznego bohatera.
*   **Implementacja (Web Audio API)**:
    *   **Low-Pass Filter**: W miarę jak poczytalność spada poniżej 40%, na główny kanał ambientów nakładany jest filtr dolnoprzepustowy. Dźwięk staje się przytłumiony, głuchy (symulacja paniki i izolacji).
    *   **Pisk uszu (Tinnitus)**: Przy skrajnie niskim Sanity (< 15%) syntezowany jest cichy oscylator sinusoidalny o częstotliwości ok. 8000Hz, którego głośność pulsuje w rytmie bicia serca.
    *   **Glitch audio**: Losowe trzaski i szumy radiowe wpinane do pętli środowiskowych.

### 2.2 Efekt Wypukłości Ekranu CRT (CSS/SVG 3D)
*   **Koncepcja**: Zwiększenie autentyczności stylizacji na retro-monitor.
*   **Implementacja**:
    *   Zastosowanie lekkiej transformacji 3D lub nakładki SVG warp do wygięcia głównego kontenera `#app-container` (efekt sferycznej soczewki kineskopu).
    *   Dodanie dynamicznego efektu migotania luminoforu (phosphor flicker) o niskiej częstotliwości (subtelna pulsacja jasności).

---

## 3. Rozbudowa Wizualizacji Mapy (Enhanced Map UX)

### 3.1 Historia Ścieżki & Poziomy Zagrożenia (Trail & Heatmap)
*   **Koncepcja**: Zwiększenie czytelności mapy jako narzędzia nawigacyjnego.
*   **Mechanika**:
    *   **Breadcrumbs (Okruchy chleba)**: Rysowanie krawędzi (linii połączeń), którymi gracz fizycznie szedł, innym kolorem (np. jasny, neonowy zielony) lub jako linia przerywana z animacją przepływu.
    *   **Wizualizacja Zagrożenia**: Kolorowanie węzłów (kółek) pokoi na mapie w zależności od ich tagów: pokoje industrialne świecą na pomarańczowo-rdzawy kolor, ciemne pokoje mają głęboki fioletowy puls, a bezpieczne strefy są neonowo-niebieskie.

### 3.2 Skaner Sektorowy (Sonar Pulse)
*   **Koncepcja**: Aktywna umiejętność mapy.
*   **Mechanika**:
    *   Komenda w terminalu `PING` lub przycisk na mapie wyzwala animowaną falę radialną rozchodzącą się od pozycji gracza.
    *   Fala na kilka sekund podświetla "duchy" nieodkrytych jeszcze pokoi sąsiadujących, pozwalając graczowi zaplanować kierunek marszu bez wchodzenia do nich.

---

## 4. Narzędzia Autorskie & Panel Admina (Admin Tooling)

### 4.1 Wizualny Kreator Przejść i Pokoi (Visual Graph Editor)
*   **Koncepcja**: Ułatwienie rozbudowy świata gry bez edycji formularzy.
*   **Implementacja**:
    *   Wykorzystanie biblioteki takiej jak `Rete.js` lub `GoJS` (lub lekki customowy SVG canvas) w panelu admina (`admin/#editor`).
    *   Możliwość tworzenia pokoi jako bloczków (nodes) i przeciągania linii łączących je (krawędzie - transitions), co w tle wysyła zapytania `INSERT/UPDATE` do SQLite w `api.php`.

### 4.2 Edytor Drzewa Dialogowego (Visual Dialogue Tree Builder)
*   **Koncepcja**: Wizualizacja struktury `terminal_dialogue.json`.
*   **Mechanika**:
    *   Interfejs typu node-link w adminie, pokazujący powiązania między stanami (np. jak `ROOM_LOBBY` prowadzi do `LOBBY_WORKSTATION` po wybraniu opcji).
    *   Zapobiega to błędom składniowym JSON-a i pozwala na szybkie dodawanie wymagań (`requirements`) i efektów (`effects`) w interfejsie graficznym.

### 4.3 Walidator Spójności Logicznej Świata
*   **Koncepcja**: Rozszerzenie testów diagnostycznych w PHP (`run_tests.php`).
*   **Mechanika**:
    *   Test wykrywający martwe pokoje (pokoje, do których nie prowadzi żadna ścieżka z `lobby`).
    *   Test spójności dialogów: sprawdza, czy wszystkie stany typu `ROOM_X` zdefiniowane w bazie SQLite mają swoje odpowiedniki w `terminal_dialogue.json`.
    *   Sprawdzanie zapętleń w dialogach, które mogą uniemożliwić wyjście z terminala.

---

## 5. Ulepszenia Techniczne & Architektura (Technical Upgrades)

### 5.1 System Wielojęzyczności (Localization / i18n)
*   **Koncepcja**: Przygotowanie LiminalOS pod globalną dystrybucję.
*   **Implementacja**:
    *   Przeniesienie opisów pokoi i dialogów z bazy głównej do słowników językowych (np. `locales/pl.json`, `locales/en.json`).
    *   Dodanie przełącznika języka w ustawieniach systemowych, który dynamicznie przeładowuje teksty w locie.

### 5.2 Pełna Obsługa PWA i Trybu Offline
*   **Koncepcja**: Gra uruchamiająca się jak natywna aplikacja na telefonie i komputerze bez potrzeby połączenia z internetem.
*   **Implementacja**:
    *   Service Worker obsługujący agresywny caching obrazów i efektów audio w Cache Storage API.
    *   Wszystkie interakcje, generowanie mapy i postęp gry zapisywane w `IndexedDB`/`localStorage` bez odpytywania backendu, z opcją synchronizacji z SQLite po wykryciu połączenia sieciowego.
