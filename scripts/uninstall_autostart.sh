#!/bin/bash
# Отключить автозапуск дневника.
PLIST="$HOME/Library/LaunchAgents/com.diary.server.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Автозапуск отключён."
