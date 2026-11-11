# Moje hudba – Music Player v1.1

Vlastní hudební PWA pro iPhone. Navazuje na návrh z 8. 8. 2026: GitHub Pages → PWA → Cloudflare R2, knihovna interpretů a alb, obaly, oblíbené, playlisty, vyhledávání, přehrávač a vybrané skladby offline.

## Rychlé zprovoznění na iPhonu bez cloudu

1. Vytvoř **nový veřejný GitHub repozitář** (např. `moje-hudba`) a nahraj do jeho kořene **obsah** této ZIP složky. Zachovej složky `css`, `js`, `icons`, `scripts`.
2. V GitHubu otevři **Settings → Pages → Build and deployment → Deploy from a branch**. Vyber `main` a `/ (root)` a ulož.
3. Otevři `https://TVUJ-UCET.github.io/moje-hudba/` na iPhonu **v Safari**.
4. V Safari klepni na nabídku **Sdílet → Přidat na plochu**. Spusť ikonu **Moje hudba**.
5. V aplikaci otevři **Přidat → Vybrat hudební soubory**. Vyber MP3 nebo M4A z aplikace **Soubory**. Získané audio soubory musíš mít oprávnění používat a stahovat.
6. Skladby se uloží v prohlížečovém úložišti na tomto iPhonu a pak je lze přehrávat bez internetu. Aplikaci nejdřív jednou otevři online, aby se nainstalovala offline PWA část.

**Důležité:** Přehrávač **nestahuje hudbu z YouTube** ani neobchází YouTube Premium. Umí přehrát importované audio soubory.

## Soubory

- `index.html` – rozhraní aplikace
- `css/style.css` – design, mobilní rozložení, tmavý/světlý režim
- `js/app.js` – knihovna, playlisty, historie právě přehrávané fronty, ovládání, offline ukládání
- `js/store.js` – IndexedDB úložiště pro metadata a zvukové soubory
- `js/tags.js` – zabudované čtení MP3 ID3v2 a M4A tagů/obalů bez externích knihoven
- `sw.js` – offline aplikační prostředí (nikoli cache všech skladeb)
- `manifest.webmanifest`, `icons` – instalace na plochu iPhonu
- `scripts/upload_to_r2.py` – volitelný import velké hudební knihovny do R2

## Velká knihovna přes Cloudflare R2

V telefonu není rozumné držet celých 50–100 GB v databázi prohlížeče. R2 proto slouží jako vzdálená hudební knihovna a jednotlivé skladby se podle potřeby stahují offline.

1. V Cloudflare vytvoř R2 bucket, např. `moje-hudba`, a nastav jeho veřejnou URL přes vlastní doménu nebo veřejnou `r2.dev` adresu (na testy). **Pozor: public bucket znamená, že kdokoli s odkazem může soubory získat. Neumisťuj do něj soukromé/neoprávněně sdílené nahrávky.** Pro soukromou knihovnu bude potřeba doplnit přístupový backend.
2. Vytvoř **R2 API token** s oprávněním zápisu do daného bucketu. API klíče zadávej jen na svém počítači, nikdy je nedávej do GitHub Pages/HTML/JS.
3. Na PC/Macu s Pythonem 3.10+ spusť:

   ```bash
   python -m pip install -r scripts/requirements.txt
   export R2_ACCOUNT_ID="..."
   export R2_ACCESS_KEY_ID="..."
   export R2_SECRET_ACCESS_KEY="..."
   python scripts/upload_to_r2.py "/cesta/k/hudbe" --bucket moje-hudba
   ```

   Pozn.: výše je příklad pro macOS/Linux, ve Windows se proměnné nastavují přes `set` (CMD) nebo `$env:` (PowerShell).

4. Skript najde MP3/M4A (a další uvedené formáty), načte metadata, nahraje audio a vložené obaly a **automaticky vytvoří a nahraje `library.json`**.
5. Na R2 bucketu nakonfiguruj **CORS**: GET a HEAD z originu svého GitHub Pages webu (viz `scripts/r2-cors-example.json`). CORS je nutné pro `fetch` knihovny a pro stahování offline. Po změně CORS může být nutné vyčistit cache a vyčkat na aktualizaci.
6. V aplikaci **Přidat → Moje Cloudflare R2** zadej veřejnou URL bucketu (s koncovým `/`) a klepni na **Načíst cloudovou knihovnu**.
7. V seznamu skladeb klepni na **⋯ → Stáhnout pro offline poslech**.

Chceš-li si zatím jen ověřit tagy/manifest, spusť skript s `--manifest-only`. Tento režim **nenahraje soubory**, pouze vytvoří manifest v hudební složce.

## Co funguje

- Import několika souborů najednou z aplikace Soubory.
- Metadata MP3 ID3v2 / M4A, interpret, album a vložený obal, pokud se podaří přečíst.
- Vyhledávání, filtry cloud/offline/oblíbené, přehled skladeb.
- Oblíbené, vlastní playlisty, přejmenování, odebrání, export/import playlistů bez audia.
- Malý a rozšířený přehrávač, přeskakování, posouvání, shuffle, repeat one/all.
- Media Session API pro systémové ovládání v iOS (chování na zamčené obrazovce záleží na iOS/Safari).
- Ukládání a mazání jednotlivých cloudových skladeb offline.
- Světlý/tmavý režim, instalace na plochu, offline aplikační shell.

## Omezení a bezpečnost

- **Offline úložiště:** iOS může IndexedDB data vymazat při nedostatku místa nebo smazání dat Safari. Nelze garantovat 50–100 GB lokálně. Originální soubory si zálohuj mimo aplikaci.
- **Přehrávání na zamčené obrazovce:** Media Session je implementováno, ale iOS některé činnosti PWA na pozadí omezuje. Není to plnohodnotná nativní aplikace.
- **Online přehrávání:** pro streaming musí být R2 objekt přístupný. Offline download vyžaduje CORS. Nepodporované kodeky iOS nepřehraje.
- **Veřejný R2 bucket:** veřejné adresy může získat kdokoli; nevhodné pro soukromé skladby bez další autentizace. Tento projekt neobsahuje přihlášení ani server pro privátní streamování.
- Importované soubory nesynchronizuje mezi zařízeními; záloha exportuje jen playlisty a oblíbené.
- Nahrávání v R2 skriptu při opakovaném spuštění znovu odešle nalezené soubory. Pro velké knihovny lze později přidat inkrementální synchronizaci.
- Aplikace není přehrávačem obsahu YouTube ani jeho stahovačem. Používej skladby, které máš právo kopírovat a streamovat.

**Verze:** 1.1 · vyrobeno jako statický GitHub Pages projekt. Není nutný žádný build ani npm pro samotný frontend.
