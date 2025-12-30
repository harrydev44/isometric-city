#!/bin/bash
# AI Game Monitor Script
# Watches the dev server terminal for AI activity and reports status

TERMINAL_FILE="/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals/2.txt"

echo "🤖 AI Game Monitor Started"
echo "=========================="
echo "Watching: $TERMINAL_FILE"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track last seen values
last_tick=""
last_line_count=0

while true; do
    if [ -f "$TERMINAL_FILE" ]; then
        current_line_count=$(wc -l < "$TERMINAL_FILE")
        
        # Check for new content
        if [ "$current_line_count" -gt "$last_line_count" ]; then
            # Get new lines
            new_lines=$((current_line_count - last_line_count))
            
            # Look for key events in new content
            tail -n "$new_lines" "$TERMINAL_FILE" 2>/dev/null | while read -r line; do
                # Turn summaries
                if echo "$line" | grep -q "TURN SUMMARY"; then
                    echo -e "${GREEN}$line${NC}"
                fi
                
                # Training
                if echo "$line" | grep -q "train_unit:"; then
                    echo -e "${BLUE}$line${NC}"
                fi
                
                # Building
                if echo "$line" | grep -q "BUILD.*Placed\|Built"; then
                    echo -e "${YELLOW}$line${NC}"
                fi
                
                # State updates
                if echo "$line" | grep -q "\[STATE\] Tick:"; then
                    echo -e "${NC}$line"
                fi
                
                # Errors
                if echo "$line" | grep -q "Error\|error\|failed\|FAILED"; then
                    echo -e "${RED}$line${NC}"
                fi
            done
            
            last_line_count=$current_line_count
        fi
        
        # Check for stuck game (no new content for 30 seconds)
        # This is handled by the sleep
    else
        echo -e "${RED}Terminal file not found!${NC}"
    fi
    
    sleep 2
done
