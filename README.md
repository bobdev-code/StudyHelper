# Nachprüfung Lerntrainer 2026

Responsive Lernapp für die Prüfungen **Portfolio Management** und **German & International Taxation** am 04.08.2026.

## Start

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Der lokale Entwicklungsserver zeigt die URL im Terminal an. Ohne Anmeldung bleibt der Lernstand im versionierten `localStorage`. Mit einem Supabase-Lernkonto werden lokale und entfernte Ereignisse anhand ihrer IDs zusammengeführt, statt den kompletten Stand eines Geräts blind zu überschreiben.

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

`vercel.json` wählt dafür den Next.js-Build. Die öffentliche Lernapp funktioniert lokal ohne Konto; Anmeldung und geräteübergreifende Synchronisierung verwenden die konfigurierte Supabase-Instanz.

## Inhalt und Funktionen

- Dashboard mit Countdown, Fachfortschritt, Trefferquote, Themenstatus und Zielen 90/105/115
- 64 Portfolio- und 75 Taxation-Karteikarten
- 49 Portfolio- und 57 Taxation-Quizfragen mit drei sichtbaren Schwierigkeitsstufen
- kurze Diagnosetests je Fach
- vollständige Rechenfälle mit Lösungsweg
- Leitner-Intervalle, Favoriten, Suche und Filter
- Fehlerprotokoll mit Antwortzeit, Sicherheit und sieben Fehlerarten
- fachgetrennte Navigation mit Übersicht, Planen, Lernen und Prüfen
- direkte Fach-/Themenübergabe aus „Optimal lernen“, Tagesplan, Kompetenzmatrix und Fehlerbuch
- je drei wechselnde, quellengebundene Prüfungsvarianten: Portfolio nach der offiziellen 24/18/48-Punkte-Struktur sowie Tax als German-Teil (60 Min/60 P), International-Teil (30 Min/30 P) oder Gesamtprüfung (90 Min/90 P im Verhältnis 2:1)
- vollständige Fälle, Freitext, interaktive Tax-Zeichnungsantworten, Rechenblatt, Markierungen, Autosave und Teilpunkte-Rubrik
- Prüfungscoach mit Resttagen, Simulationsempfehlung und offenen Reparaturen
- Klausurauswertung nach Punkten, Zeit pro Punkt, unbeantworteten Blöcken, Fehlerart und Thema sowie automatisch priorisiertem Reparaturblock
- ausklappbare offizielle Portfolio-Formelsammlung, sicherer Taschenrechner sowie Tax-Zeichenbausteine und schematischer Belastungsvergleich
- gespeicherte und selbstbewertete Klausurantworten im Tax-Falllabor
- gemeinsames Attempt-Modell für Karten, Quiz, Rechenlabor, Tax-Fälle, Portfolio-Klausurwerkstatt und Simulation
- nachweisbasierte Kompetenzstufen von Abruf über Anwendung und Transfer bis zur Leistung unter Zeitdruck
- Fehlerreparatur mit neuer Variante und Abschluss erst nach erfolgreicher Anwendung
- 19 Modelle und Ablaufschemata
- Quellenreferenz pro Karte, Frage und Modell
- Offline-Cache nach dem ersten erfolgreichen Laden; keine externen Schriftarten oder APIs

## Quellenpolitik

Alle fachlichen Inhalte stammen aus den bereitgestellten Kursdateien. Aktuelle offizielle 2025-Unterlagen und Lösungen haben Vorrang. Der offizielle EBS-Single-Choice-Fragenkatalog ergänzt 40 geprüfte Tax-Fragen. Die markierte International-Taxation-Altklausur 2023 wird nur für eindeutig markierte und gegengeprüfte Aussagen verwendet. Das Quizlet-Dokument dient ausschließlich als sekundäre Abdeckungs- und Wiederholungsquelle.

Die zuvor als beschädigt markierten Dateien `PS8_25_Final.pdf`, `PS8_25_Solution_Final.pdf` und `BSC_Portfolio_Management_FT25_90_final_Solution.pdf` wurden am 30.07.2026 erneut geprüft und sind in den jetzt bereitgestellten Fassungen vollständig lesbar. Sie dürfen damit wieder zur Quellenkontrolle verwendet werden. Studentische Übersichten werden weiterhin nie als alleinige Quelle genutzt; widersprüchliche oder zeitabhängige Steuerrechnungen bleiben ausgeschlossen.

Die App ist ein Lernwerkzeug. Die Punkteschätzung im Dashboard ist keine Prüfungsprognose und die steuerlichen Inhalte ersetzen keine steuerliche Beratung.
