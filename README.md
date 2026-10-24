# 🛹 Landed – Trick-Tagebuch für deine Crew

Hake ab, **wann du welchen Trick gestanden hast** – mit Datum, Spot und Beweis-Clip – und teile es mit deiner Crew.
**Ohne eigenen Server, ohne Account:** Die Handys verbinden sich direkt per WebRTC, alles ist Ende-zu-Ende-verschlüsselt.

Die App ist **eine einzige Datei: [`index.html`](index.html)** – auf GitHub Pages hosten, auf dem Handy öffnen, „Zum Startbildschirm hinzufügen“, fertig.

---

## ✨ Funktionen

| Bereich | Was geht |
| :-- | :-- |
| 🛹 **Trickliste** | ~150 Tricks in 9 Kategorien (Grundlagen, Flips, Shove-its & Spins, Grinds, Slides, Manuals, Rampe & Bowl, Grabs, Old School) mit Schwierigkeit, Tipp und Voraussetzungen; eigene Tricks anlegen |
| 📶 **Stufen mit Datum** | Nicht versucht → Übe ich → Gestanden → Sitzt → Gemeistert – jede Stufe mit Zeitpunkt, Nachtragen mit Datum möglich |
| 🧮 **Stance × Obstacle** | Jeder Trick als Raster Regular/Fakie/Nollie/Switch × Flat/Treppe/Gap/Ledge/Rail/Ramp, Fortschrittsring in der Liste, Schnell-Haken |
| 🧩 **Trick-Baukasten** | Drehung + Board-Trick + Grind/Slide + Ausstieg → neuer Trick mit berechneter Schwierigkeit |
| 🌳 **Lernpfad** | Skill-Tree nach Voraussetzungen, „Als Nächstes“-Vorschläge |
| 🎬 **Beweise** | Foto oder Clip (≤ 15 s, wird automatisch verkleinert), Vorschau sofort, Original per P2P bei Bedarf, Zeitlupe |
| 📍 **Spots** | Gemeinsame OpenStreetMap-Karte, Fotos, Sterne, „hier gestanden“-Liste |
| ⏱ **Sessions** | „Tony ist im Park XY seit 17:20“ (nur Spot-Name, kein GPS-Tracking), Versuche zählen, Zusammenfassung |
| 📣 **Feed** | Automatische „gestanden“-Posts, Abzeichen, Level-Ups, Spiele – mit Reaktionen und Kommentaren |
| 🛹 **Game of S.K.A.T.E.** | Langzeit-Modus per Video: Vorsetzer lädt Clip hoch, die anderen haben X Tage zum Nachstehen (Ehrensache, Clip Pflicht). Duell oder Gruppe, Wort wählbar (SKATE, SK8, PIG …) |
| ⚡ **Challenges** | „Wer steht ihn zuerst?“ (automatisch aus den Logs) oder „Wer schafft am meisten?“ mit Deadline und Rangliste |
| 🏅 **XP, Level, Badges** | XP = Schwierigkeit × Stance × Obstacle × Stufe, 31 Abzeichen, Crew-Rangliste |
| 🎰 **Trick-Roulette** | Zieht einen Trick aus deiner „Übe ich“-Liste |
| 📈 **Statistik** | Fortschrittskurve, Tricks pro Monat, Kategorien/Stances, Timeline, **Jahresrückblick als Bild** |
| 👥 **Mehrere Crews** | Deine Historie ist persönlich und erscheint in jeder deiner Crews |
| 🎨 **Themes** | Street · Sunset Bowl · DIY · Retro 80s – jeweils mit Illustration, nur Farben oder eigenem Foto |
| 💾 **Backup & Umzug** | Als Datei sichern/laden oder per QR direkt aufs neue Handy übertragen |

---

## 🔌 Wie verbinden sich die Handys? (ohne Server)

1. **Im Park, ganz ohne Netz – „🤝 Direkt koppeln“:** Handy A zeigt einen QR-Code (WebRTC-Angebot), Handy B scannt ihn und zeigt einen Antwort-Code, A scannt die Antwort → direkter Datenkanal. Beide gleichen sofort alles ab. Code kopieren/einfügen (z.B. per Messenger) geht auch.
2. **Aus der Ferne – Einladungslink:** Crew-Code + PIN → die App findet sich über öffentliche MQTT-Broker (nur Chiffretext), baut dann **direkte WebRTC-Verbindungen** auf und nutzt den Broker als Fallback.
3. Verbundene Handys reichen Nachrichten weiter (Mesh) – wer einmal etwas hat, kann es an andere geben.

**Verschlüsselung:** AES-GCM-256, Schlüssel per PBKDF2 aus Crew-Code + PIN. Der Crew-Code ist das Geheimnis – nicht erratbar wählen (🎲) oder PIN setzen.
**Benachrichtigungen:** Toast, Ton, Vibration und System-Benachrichtigung, solange die App offen bzw. im Hintergrund ist. Echte Push-Nachrichten bei geschlossener App gehen ohne Server nicht.

---

## 🚀 Veröffentlichen & Nutzen

Kamera (QR, Clips) und GPS brauchen HTTPS → **GitHub Pages**: Repository → *Settings → Pages → Branch `main` / root*.
Danach ist die App unter `https://<name>.github.io/landed/` erreichbar.

Lokal testen:

```bash
python3 -m http.server 8765
```

URL-Parameter zum Testen: `?profile=b` (zweites Profil im selben Browser), `?nobroker=1` (nur Tabs/WebRTC), `?nolocal=1` (ohne Tab-Kanal).

---

## 🧱 Aufbau

```
src/
  index.html            Gerüst mit Platzhaltern
  css/  base.css        Layout          components.css  Bausteine          themes.css  4 Themes, Glas-Effekt
  js/   util.js         DOM-Helfer, Zeit, Dateien      idb.js     IndexedDB
        crypto.js       AES-GCM / PBKDF2 pro Crew      mqtt.js    schlanker MQTT-Client (Failover)
        net.js          Bus: WebRTC-Mesh + BroadcastChannel + MQTT, Weiterleitung, Dedup
        mesh.js         automatische WebRTC-Verbindungen + Kopplung per QR (Pair)
        docs.js         geteilte Dokumente, Last-Writer-Wins, Abgleich bei neuer Verbindung
        blobs.js        Fotos/Clips: lokal + Verteilung auf Anfrage (P2P, sonst Broker-Chunks)
        tricks.js       Katalog, Stances, Obstacles, Kategorien, Baukasten
        scenes.js       SVG-Hintergrundszenen       themes.js   Theme-Umschaltung
        model.js        Profil, Trick-Logs, XP, Level, Badges
        crews.js        Crews, Spiegelung der eigenen Daten, S.K.A.T.E.- und Challenge-Logik
        ui.js           Sheets, Toasts, Benachrichtigungen, Navigation
        media.js        Foto/Video aufnehmen, verkleinern, ansehen      qr.js  QR, Einladung, Kopplung
        view_*.js       Tricks, Feed, Spiele, Spots, Ich                backup.js  Backup & Umzug
        app.js          Start, Willkommen, Abhaken -> Feed/XP/Badges
build.py                baut index.html (inkl. Leaflet, qrcode-generator, jsQR aus vendor/)
```

```bash
python3 build.py --check
```
