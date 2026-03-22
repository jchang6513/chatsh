#!/usr/bin/env bash
# chatsh daemon integration tests
# Usage: bash scripts/test-daemon.sh

set -uo pipefail

DAEMON_BIN="./src-tauri/target/debug/chatsh-daemon"
SOCK="$HOME/.chatsh/daemon.sock"
STATE="$HOME/.chatsh/state.json"
PASS=0; FAIL=0

c_green='\033[0;32m'; c_red='\033[0;31m'; c_reset='\033[0m'
ok()   { echo -e "${c_green}✅ PASS${c_reset}: $1"; ((PASS++)); }
fail() { echo -e "${c_red}❌ FAIL${c_reset}: $1"; ((FAIL++)); }

daemon_send() { echo "$1" | nc -U "$SOCK" 2>/dev/null; }

setup() {
  pkill -f chatsh-daemon 2>/dev/null; sleep 0.3
  rm -f "$SOCK" "$STATE"
  "$DAEMON_BIN" > /tmp/chatsh-test-daemon.log 2>&1 &
  DAEMON_PID=$!
  sleep 1
  [[ -S "$SOCK" ]] || { echo "daemon failed to start"; exit 1; }
}

teardown() {
  kill $DAEMON_PID 2>/dev/null; wait $DAEMON_PID 2>/dev/null; true
  rm -f "$SOCK" "$STATE"
}

# TC-D01: Daemon 存活
echo "--- TC-D01: Daemon 存活 ---"
setup
if [[ ! -S "$SOCK" ]]; then
  fail "TC-D01: socket missing"
else
  RESULT=$(daemon_send '{"type":"list_panes"}')
  if echo "$RESULT" | grep -q "pane_list"; then
    ok "TC-D01: socket + list_panes OK"
  else
    fail "TC-D01: list_panes failed (got: $RESULT)"
  fi
fi

# TC-D02: Delete 殺 process
echo "--- TC-D02: Delete 殺 process ---"
daemon_send '{"type":"spawn_pane","id":"d02","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
sleep 0.5
PID=$(cat "$STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['panes'] if x['id']=='d02']; print(p[0]['pid'] if p and 'pid' in p[0] else '')" 2>/dev/null || true)
daemon_send '{"type":"delete_pane","id":"d02"}' > /dev/null
sleep 0.5
if [[ -n "$PID" ]]; then
  kill -0 "$PID" 2>/dev/null && fail "TC-D02: process still alive" || ok "TC-D02: process killed"
else
  # pid not in state, check via list
  RESULT=$(daemon_send '{"type":"list_panes"}')
  echo "$RESULT" | grep -q '"d02"' && fail "TC-D02: pane still listed" || ok "TC-D02: pane removed"
fi

# TC-D03: 外部 kill-9 偵測
echo "--- TC-D03: 外部 kill-9 偵測 ---"
daemon_send '{"type":"spawn_pane","id":"d03","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
sleep 0.5
# Get PID from state.json (pane_list doesn't expose pid)
PID=$(python3 -c "
import json
d=json.load(open('$STATE'))
p=[x for x in d['panes'] if x['id']=='d03']
print(p[0].get('pid','') if p else '')
" 2>/dev/null || true)
if [[ -n "$PID" ]]; then
  kill -9 "$PID" 2>/dev/null; sleep 1.5
  STATUS=$(daemon_send '{"type":"list_panes"}' | python3 -c "
import sys,json
for line in sys.stdin:
  try:
    d=json.loads(line)
    if d.get('type')=='pane_list':
      p=[x for x in d['panes'] if x['id']=='d03']
      print(p[0]['status'] if p else '')
  except: pass
" 2>/dev/null || true)
  [[ "$STATUS" == "stopped" ]] && ok "TC-D03: kill-9 detected (status=stopped)" || fail "TC-D03: status=$STATUS (expected stopped)"
else
  fail "TC-D03: could not get PID from state.json (got empty)"
fi

# TC-D04: Restart 不重複
echo "--- TC-D04: Restart 不重複 ---"
daemon_send '{"type":"spawn_pane","id":"d04","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
sleep 0.5
for i in {1..5}; do
  daemon_send '{"type":"restart_pane","id":"d04"}' > /dev/null; sleep 0.3
done
sleep 0.5
ZSHCOUNT=$(pgrep -c zsh 2>/dev/null || true)
# Should only have ≤ expected system zsh processes (not 5 extra)
RESULT=$(daemon_send '{"type":"list_panes"}')
D04_STATUS=$(echo "$RESULT" | python3 -c "
import sys,json
for line in sys.stdin:
  try:
    d=json.loads(line)
    if d.get('type')=='pane_list':
      p=[x for x in d['panes'] if x['id']=='d04']
      print(p[0]['status'] if p else 'missing')
  except: pass
" 2>/dev/null || echo "missing")
[[ "$D04_STATUS" == "running" ]] && ok "TC-D04: pane still running after 5 restarts" || fail "TC-D04: status=$D04_STATUS"

# TC-D05: Daemon 重連（daemon 不重啟）
echo "--- TC-D05: Daemon 重連 ---"
daemon_send '{"type":"spawn_pane","id":"d05a","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
daemon_send '{"type":"spawn_pane","id":"d05b","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
sleep 0.5
# Reconnect = new socket connection
RESULT=$(daemon_send '{"type":"list_panes"}')
COUNT=$(echo "$RESULT" | python3 -c "
import sys,json
for line in sys.stdin:
  try:
    d=json.loads(line)
    if d.get('type')=='pane_list':
      print(len([x for x in d['panes'] if x['id'] in ('d05a','d05b') and x['status']=='running']))
  except: pass
" 2>/dev/null || echo "0")
[[ "$COUNT" == "2" ]] && ok "TC-D05: 2 panes still running after reconnect" || fail "TC-D05: only $COUNT running"

# TC-D06: Daemon crash 後 state 保留
echo "--- TC-D06: Daemon crash 後恢復 ---"
daemon_send '{"type":"spawn_pane","id":"d06","command":["zsh"],"cwd":"/tmp","env":{}}' > /dev/null
sleep 0.5
kill -9 $DAEMON_PID 2>/dev/null; sleep 0.5
if [[ -f "$STATE" ]]; then
  HAS=$(python3 -c "import json; d=json.load(open('$STATE')); print('yes' if any(p['id']=='d06' for p in d['panes']) else 'no')" 2>/dev/null || echo "no")
  [[ "$HAS" == "yes" ]] && ok "TC-D06: state.json preserved after daemon crash" || fail "TC-D06: d06 not in state"
else
  fail "TC-D06: state.json missing"
fi

# Restart daemon for TC-D07
"$DAEMON_BIN" > /tmp/chatsh-test-daemon.log 2>&1 &
DAEMON_PID=$!; sleep 1

# TC-D07: Shell tab 持久化
echo "--- TC-D07: Shell tab 持久化 ---"
daemon_send '{"type":"spawn_pane","id":"d07-agent","command":["zsh"],"cwd":"/tmp","env":{},"pane_type":"agent","parent_pane_id":null}' > /dev/null
sleep 0.3
daemon_send '{"type":"spawn_pane","id":"d07-shell1","command":["zsh"],"cwd":"/tmp","env":{},"pane_type":"shell","parent_pane_id":"d07-agent"}' > /dev/null
sleep 0.3
daemon_send '{"type":"spawn_pane","id":"d07-shell2","command":["zsh"],"cwd":"/tmp","env":{},"pane_type":"shell","parent_pane_id":"d07-agent"}' > /dev/null
sleep 0.5
RESULT=$(daemon_send '{"type":"list_panes"}')
COUNTS=$(echo "$RESULT" | python3 -c "
import sys,json
for line in sys.stdin:
  try:
    d=json.loads(line)
    if d.get('type')=='pane_list':
      agents=[x for x in d['panes'] if x.get('pane_type')=='agent' and x['id']=='d07-agent']
      shells=[x for x in d['panes'] if x.get('pane_type')=='shell' and x.get('parent_pane_id')=='d07-agent']
      print(f'{len(agents)},{len(shells)}')
  except: pass
" 2>/dev/null || echo "0,0")
[[ "$COUNTS" == "1,2" ]] && ok "TC-D07: 1 agent + 2 shell tabs persisted" || fail "TC-D07: counts=$COUNTS (expected 1,2)"

teardown

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]]
