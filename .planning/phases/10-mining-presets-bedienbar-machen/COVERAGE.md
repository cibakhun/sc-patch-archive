# API Coverage — Phase 10

No external API integration: die Phase aendert ausschliesslich Markup, Client-Logik
und Texte der bestehenden Mining-Werkbank; der einzige Netzwerkweg ist der seit
Phase 9 vorhandene, projekteigene PostgREST-Zugriff auf `mining_sig_presets` ueber
`window.VBAccount.rest()` (`assets/account-lite.js`). Es kommt kein SDK, kein
Fremddienst und kein neuer Endpunkt hinzu — nur eine weitere HTTP-Methode (`PATCH`)
auf derselben, bereits integrierten Tabelle. Kein Paket wird installiert
(RESEARCH.md § Package Legitimacy Audit: „Nicht erforderlich").
