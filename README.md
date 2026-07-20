# Nachprüfung Lerntrainer 2026

Responsive Lernapp für die Prüfungen **Portfolio Management** und **German & International Taxation** am 04.08.2026.

## Start

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Der lokale Entwicklungsserver zeigt die URL im Terminal an. Der Lernstand wird ausschließlich im `localStorage` des verwendeten Browsers gespeichert.

Produktionsprüfung:

```bash
npm run build
npm test
npm run lint
```

Separater Vercel-Build:

```bash
npm run build:vercel
```

`vercel.json` wählt dafür den Next.js-Build. Das Projekt kann als Git-Repository in Vercel importiert werden; Datenbank, Anmeldung und Umgebungsvariablen werden nicht benötigt.

## Inhalt und Funktionen

- Dashboard mit Countdown, Fachfortschritt, Trefferquote, Themenstatus und Zielen 90/105/115
- 64 Portfolio- und 55 Taxation-Karteikarten
- 40 Portfolio- und 30 Taxation-Quizfragen
- kurze Diagnosetests je Fach
- vollständige Rechenfälle mit Lösungsweg
- Leitner-Intervalle, Favoriten, Suche und Filter
- Fehlerprotokoll mit Antwortzeit, Sicherheit und sieben Fehlerarten
- 90-Minuten-Prüfungsmodus mit exakt 90 Punkten, verdeckten Lösungen und Themenauswertung
- 19 Modelle und Ablaufschemata
- Quellenreferenz pro Karte, Frage und Modell
- Offline-Cache nach dem ersten erfolgreichen Laden; keine externen Schriftarten oder APIs

## Quellenpolitik

Alle fachlichen Inhalte stammen aus den bereitgestellten Kursdateien. Aktuelle offizielle 2025-Unterlagen und Lösungen haben Vorrang. Ältere offizielle 2024-Unterlagen werden nur sichtbar gekennzeichnet verwendet, wenn die entsprechende 2025-Datei beschädigt ist und kein Widerspruch zum 2025-Formelstand festgestellt wurde.

Nicht verwendet wurden:

- `PS8_25_Final.pdf` — 0 Byte
- `PS8_25_Solution_Final.pdf` — abgeschnitten, Trailer/XRef fehlt
- `BSC_Portfolio_Management_FT25_90_final_Solution.pdf` — abgeschnitten, Trailer/XRef fehlt
- studentische Übersichten als alleinige Quelle
- widersprüchliche oder zeitabhängige Steuerrechnungen aus den in der Quellenprüfung markierten Fällen

Die App ist ein Lernwerkzeug. Die Punkteschätzung im Dashboard ist keine Prüfungsprognose und die steuerlichen Inhalte ersetzen keine steuerliche Beratung.
