#!/usr/bin/env bash
# CampusCare AI — API walkthrough with curl.
# Runs the complete flow against a running server (npm run dev) with demo data (npm run seed -w server).
# Usage:  bash scripts/api-walkthrough.sh
# Needs:  curl and jq (both included with recent macOS; otherwise: brew install jq)
set -euo pipefail

API="${API:-http://localhost:4000/api}"
JAR="$(mktemp -d)"                      # cookie files (one per user) live here
trap 'rm -rf "$JAR"' EXIT
PW='Demo@1234'                          # demo-only password from the seed script

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
login() { # login <email> <cookie-name>
  curl -sf -c "$JAR/$2" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PW\"}" "$API/auth/login" | jq -r '"logged in as \(.user.name) (\(.user.role))"'
}

step "1. Health check (no login needed)"
curl -sf "$API/health" | jq '{status, database, aiConfigured}'

step "2. Student logs in (the login cookie is saved to a file)"
login student@campuscare.test student

step "3. Student submits a complaint (multipart form: 'data' = JSON)"
TICKET=$(curl -sf -b "$JAR/student" \
  -F 'data={"title":"Ceiling fan sparking in room 210","description":"The ceiling fan in room 210 sparks when switched on and there is a burning smell.","location":{"building":"Main Building","room":"210"}}' \
  "$API/tickets" | jq -r '.ticket.ticketId')
echo "created $TICKET"
curl -sf -b "$JAR/student" "$API/tickets/$TICKET" | jq '.ticket | {ticketId, status, category, priority, department}'

step "4. Admin logs in and sees why it needs review"
login admin@campuscare.test admin
curl -sf -b "$JAR/admin" "$API/tickets/$TICKET" | jq '.ticket | {status, reviewReasons, ai: {source: .ai.source, suggested: "\(.ai.category) / \(.ai.priority)", confidence: .ai.confidence, why: .ai.categoryReason}, routing: .routing.reason}'

step "5. Admin confirms the classification and assigns it"
DEPT=$(curl -sf -b "$JAR/admin" "$API/admin/departments" | jq -r '.departments[] | select(.categories | index("Electrical")) | .id')
curl -sf -b "$JAR/admin" -X PATCH -H 'Content-Type: application/json' \
  -d '{"category":"Electrical","priority":"Critical"}' "$API/tickets/$TICKET/classification" | jq -r '"classified: \(.ticket.category) / \(.ticket.priority), due \(.ticket.dueAt)"'
curl -sf -b "$JAR/admin" -X PATCH -H 'Content-Type: application/json' \
  -d "{\"departmentId\":\"$DEPT\",\"note\":\"Safety issue - please check today\"}" "$API/tickets/$TICKET/assign" | jq -r '"status: \(.ticket.status) → \(.ticket.department.name)"'

step "6. Electrical staff starts work, then resolves (needs confirm + note)"
login electrical.staff@campuscare.test staff
curl -sf -b "$JAR/staff" -X PATCH -H 'Content-Type: application/json' -d '{"status":"In Progress"}' "$API/tickets/$TICKET/status" | jq -r '"status: \(.ticket.status)"'
curl -s -o /dev/null -w 'resolve WITHOUT confirmation → HTTP %{http_code} (expected 400)\n' -b "$JAR/staff" -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"Resolved","note":"Replaced the regulator"}' "$API/tickets/$TICKET/status"
curl -sf -b "$JAR/staff" -X PATCH -H 'Content-Type: application/json' \
  -d '{"status":"Resolved","note":"Replaced the faulty regulator","confirm":true}' "$API/tickets/$TICKET/status" | jq -r '"status: \(.ticket.status)"'

step "7. Student tracks the ticket and reads notifications"
curl -sf -b "$JAR/student" "$API/tickets/$TICKET" | jq '.ticket | {status, history: [.statusHistory[] | "\(.to) — \(.by.name // "System")"]}'
curl -sf -b "$JAR/student" "$API/notifications?limit=5" | jq '{unreadCount, latest: [.items[] | select(.ticket.ticketId == "'"$TICKET"'") | .message]}'

step "8. Security checks (these MUST be refused)"
curl -s -o /dev/null -w 'student → admin stats:          HTTP %{http_code} (expected 403)\n' -b "$JAR/student" "$API/admin/stats"
login neha@campuscare.test neha >/dev/null
curl -s -o /dev/null -w "another student → $TICKET: HTTP %{http_code} (expected 404)\n" -b "$JAR/neha" "$API/tickets/$TICKET"
curl -s -o /dev/null -w 'no login → ticket list:          HTTP %{http_code} (expected 401)\n' "$API/tickets"

printf '\n\033[1mDone.\033[0m Open http://localhost:5173/tickets/%s to see the same ticket in the app.\n' "$TICKET"
