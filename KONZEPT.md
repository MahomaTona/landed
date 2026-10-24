# 🛹 Landed – Konzept (Stand 24.10.2026)

Trick-Tagebuch für Skate-Crews: Tricks abhaken mit Datum, Crew-Feed, Spiele – **ohne eigenen Server**.

## Technik
- PWA, Quellcode in `src/`, `build.py` baut **eine HTML-Datei** (Muster wie OrgaEvent), Hosting auf GitHub Pages, offline nutzbar
- Sync: **WebRTC P2P**. Handshake **per QR-Code** beim Treffen (echt serverlos), **Fallback** über öffentliche MQTT-Broker, wenn man nicht zusammen ist
- **Ende-zu-Ende-verschlüsselt** (AES-GCM, Schlüssel aus Crew-Code + PIN)
- Daten als Dokumente mit Last-Writer-Wins, lokal in IndexedDB (offline-first)
- **Export/Import-Backup** und **Geräte-Umzug per QR/P2P**
- Nur Deutsch (Tricknamen englisch)
- Benachrichtigungen: Toast/Ton/Vibration + System-Benachrichtigung, solange die App läuft

## Crews
- Eine Person kann in **mehreren Crews** sein; die eigene Trickhistorie ist persönlich und in jeder Crew sichtbar
- Alle Mitglieder haben gleiche Rechte
- Datenmodell vorbereitet für **Crew gegen Crew** (später)

## Tricks
- **Großer Katalog** (~200 Tricks: Flat, Ledge/Rail, Transition/Bowl, Manual, Old School) mit Schwierigkeit 1–10, plus eigene Tricks
- **Status-Stufen** mit Datum: Nicht versucht → Übe ich → Gestanden → Sitzt → Gemeistert
- Pro Eintrag: **Spot**, **Foto/Video-Beweis** (Clip ≤ 15 s, komprimiert, Vorschau sofort, Original per P2P bei Bedarf)
- Anzeige: Basis-Trick mit Fortschrittsring → aufklappbares **Raster Stance × Obstacle**
  - Stances: Regular, Fakie, Switch, Nollie
  - Obstacles: Flat, Stairs, Gap, Ledge, Rail, Ramp/Transition
- **Trick-Baukasten**: Bausteine (FS/BS, 180/360, Flip/Heel/Shove …) erzeugen neue Basis-Tricks
- **Tipps & Lernpfade**: Kurzbeschreibung, Voraussetzungen, Skill-Tree

## Feed
- Automatische „gestanden“-Posts beim Abhaken
- Reaktionen (🔥🤯👏 …) und Kommentare

## Spiele & Motivation
- **Game of S.K.A.T.E. (Langzeit, remote per Video)**: Vorsetzer lädt Clip hoch, Gegner haben z. B. 1 Woche Zeit, nachzustehen; Ehrensache-Prinzip (Clip Pflicht, man markiert selbst); 1-gegen-1 und Gruppenpartien, später Crew gegen Crew
- **Crew-Challenges** mit Deadline und Rangliste
- **XP, Level & Badges**: Schwierigkeit × Stance-Multiplikator × Obstacle-Multiplikator, Bonus für höhere Stufen
- **Trick-Roulette** aus der „Übe ich“-Liste

## Weitere Features
- **Spot-Karte** (OpenStreetMap/Leaflet, kein Key): Spots mit Fotos/Bewertung, Tricks mit Spot verknüpft
- **Session-Tracker**: „Tony ist im Park XY seit 17:20“ (nur Spot-Name, kein Live-GPS), Versuche-Zähler pro Trick
- **Statistiken & Timeline**: Fortschrittskurve, Tricks pro Monat, Zeit vom ersten Versuch bis gestanden, Jahresrückblick

## Themes
Street (Beton/Nacht/Neon) · Sunset Bowl (Kalifornien, 70er) · DIY unter der Brücke · Retro 80s/VHS –
jeweils **mit und ohne Hintergrundbild** (umschaltbar).

## Veröffentlichung
GitHub-Repo `landed` + GitHub Pages; dafür wird die GitHub-CLI (`gh`) installiert.
