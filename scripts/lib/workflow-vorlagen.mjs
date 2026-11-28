// Workflows, die in einem ANDEREN Repo laufen, deren Vorlage aber hier liegt
// und hier geprueft wird (dieselben Regeln wie fuer .github/workflows/).
// Anlass: das Live-Backup laeuft im privaten Backup-Repo, damit Secret, Logs
// und Archive nicht oeffentlich sind (docs/betrieb/datenbank-backup.md).
// Gelesen von verify:supply-chain (Form) und verify:action-pins (Herkunft).
export const WORKFLOW_VORLAGEN = ['scripts/backup/vorlage-backup-repo.yml'];
