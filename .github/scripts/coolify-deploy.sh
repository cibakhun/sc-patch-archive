#!/usr/bin/env bash
# Stoesst einen Coolify-Deploy an. Eine Fassung fuer alle drei Pipelines
# (deploy-image.yml, deploy-staging.yml, deploy-bot-image.yml), statt drei
# auseinanderlaufender Kopien.
#
# Umgebung:
#   HOOK      Deploy-Webhook der Coolify-Anwendung (…/api/v1/deploy?uuid=…)
#   TOKEN     Coolify-API-Token
#   LABEL     Name fuer die Protokollzeilen (z. B. "live", "staging", "bot")
#   PIN_TAG   optional. Gesetzt (z. B. auf den Commit-SHA): vor dem Deploy
#             stellt das Skript die Anwendung auf GENAU diesen Image-Tag um.
#             Dann zieht Coolify nie einen veraenderlichen Tag wie :latest,
#             den jeder Workflow-Lauf mit packages:write ueberschreiben
#             koennte. Braucht ein Token mit Recht "write" statt nur "deploy"
#             und den Image-Typ "Docker Image" in Coolify.
#
# Fehlt HOOK oder TOKEN, wird bewusst NICHT rot (ein Fork ohne Coolify soll
# bauen koennen), aber als ::warning:: — ein gesetztes, aber LEERES Secret
# liess am 14.08.2026 den Lauf gruen durchlaufen, ohne dass je ein Deploy
# stattfand.
#
# Rand-Leerraum wird abgeschnitten: ein an den Secret-Wert geratenes
# Zeilenende macht den Bearer-Header ungueltig (401), ohne dass man es dem
# Log ansieht. Siehe deploy-staging.yml, 14.08.2026. Jeder Aufruf hat eine
# Zeitgrenze — am 29.10.2026 hing der Bot-Deploy gut sieben Minuten im
# Webhook-Aufruf, bevor er scheiterte (Lauf 40897563706).
set -euo pipefail

LABEL="${LABEL:-app}"
if [ -z "${HOOK:-}" ] || [ -z "${TOKEN:-}" ]; then
  FEHLT=""
  [ -z "${HOOK:-}" ] && FEHLT="Webhook"
  [ -z "${TOKEN:-}" ] && FEHLT="${FEHLT:+$FEHLT und }API-Token"
  echo "::warning::KEIN Deploy ausgeloest ($LABEL) — $FEHLT leer oder nicht gesetzt. Das Image liegt fertig in ghcr; in Coolify manuell Redeploy klicken. Achtung: ein Secret kann gesetzt UND leer sein."
  exit 0
fi

CLEAN_TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
CLEAN_HOOK=$(printf '%s' "$HOOK" | tr -d '[:space:]')
echo "Token: ${#TOKEN} Zeichen roh, ${#CLEAN_TOKEN} nach dem Trimmen (Wert wird nicht ausgegeben)."
BODY=$(mktemp)

if [ -n "${PIN_TAG:-}" ]; then
  case "$PIN_TAG" in
    *[!A-Za-z0-9._-]*) echo "::error::PIN_TAG enthaelt unerlaubte Zeichen."; exit 1 ;;
  esac
  BASE="${CLEAN_HOOK%%/api/v1/*}"
  UUID=$(printf '%s' "$CLEAN_HOOK" | sed -n 's/.*[?&]uuid=\([A-Za-z0-9_-]*\).*/\1/p')
  if [ -z "$UUID" ] || [ "$BASE" = "$CLEAN_HOOK" ]; then
    echo "::error::Aus dem Webhook laesst sich keine Anwendung (uuid) ablesen — PIN_TAG braucht die Form …/api/v1/deploy?uuid=…"
    exit 1
  fi
  CODE=$(curl -sS --max-time 30 -o "$BODY" -w '%{http_code}' -X PATCH "$BASE/api/v1/applications/$UUID" \
    -H "Authorization: Bearer $CLEAN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"docker_registry_image_tag\":\"$PIN_TAG\"}") || CODE=000
  echo "Image-Tag auf $PIN_TAG: HTTP $CODE"
  if [ "$CODE" -lt 200 ] || [ "$CODE" -ge 300 ]; then
    echo "Antwort: $(head -c 400 "$BODY")"
    echo "::error::Coolify lehnt das Umstellen des Image-Tags ab (HTTP $CODE). Das Token braucht das Recht 'write'."
    exit 1
  fi
fi

CODE=$(curl -sS --max-time 60 -o "$BODY" -w '%{http_code}' "$CLEAN_HOOK" -H "Authorization: Bearer $CLEAN_TOKEN") || CODE=000
echo "HTTP $CODE"
# Den Antwortrumpf nur bei einem Fehler zeigen: bei Erfolg nennt er die
# Kennungen der Anwendungen, und das Protokoll ist in einem oeffentlichen Repo
# fuer jeden lesbar.
if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ]; then
  echo "Coolify redeploy ($LABEL) triggered."
else
  echo "Antwort: $(head -c 400 "$BODY")"
  echo "::error::Coolify lehnt den Deploy-Aufruf ab (HTTP $CODE). Bei 401: Token in Coolify unter Keys & Tokens pruefen (Berechtigung 'deploy') und das Token ohne Zeilenende neu setzen."
  exit 1
fi
