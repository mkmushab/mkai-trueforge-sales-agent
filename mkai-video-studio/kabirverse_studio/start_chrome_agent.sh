#!/usr/bin/env bash
# Starts Chrome with remote debugging (separate profile). Log in to YouTube + Instagram once.
PROFILE="$HOME/ChromeAgentProfile"
if [[ "$OSTYPE" == darwin* ]]; then
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$PROFILE" &
else
  (google-chrome || chromium || chromium-browser) --remote-debugging-port=9222 --user-data-dir="$PROFILE" &
fi
