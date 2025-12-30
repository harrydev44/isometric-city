#!/bin/bash
# Real-time game monitoring script
# Watches AI activity and displays key metrics

TERMINAL_FILE="/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals/2.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${MAGENTA}${BOLD}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║     🎮 Rise of Nations - AI Game Monitor 🎮            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

last_line_count=0
last_summary=""

while true; do
    if [ -f "$TERMINAL_FILE" ]; then
        current_line_count=$(wc -l < "$TERMINAL_FILE")
        
        if [ "$current_line_count" -gt "$last_line_count" ]; then
            new_lines=$((current_line_count - last_line_count))
            
            tail -n "$new_lines" "$TERMINAL_FILE" 2>/dev/null | while IFS= read -r line; do
                # Turn summaries - most important!
                if echo "$line" | grep -q "TURN SUMMARY"; then
                    echo -e "\n${GREEN}${BOLD}$line${NC}"
                # State updates
                elif echo "$line" | grep -q "\[STATE\] Tick:"; then
                    echo -e "${CYAN}$line${NC}"
                # Training units
                elif echo "$line" | grep -q "Queued citizen\|Queued militia"; then
                    echo -e "${BLUE}  → $line${NC}"
                # Building
                elif echo "$line" | grep -q "Built "; then
                    echo -e "${YELLOW}  → $line${NC}"
                # Errors
                elif echo "$line" | grep -q "Not enough\|✗"; then
                    echo -e "${RED}  ✗ $line${NC}"
                # Pop cap warnings
                elif echo "$line" | grep -q "POP CAPPED\|small_city"; then
                    echo -e "${MAGENTA}  ⚠️ $line${NC}"
                # Military
                elif echo "$line" | grep -q "Military:"; then
                    echo -e "${RED}  ⚔️ $line${NC}"
                fi
            done
            
            last_line_count=$current_line_count
        fi
    else
        echo -e "${RED}Terminal file not found! Is the dev server running?${NC}"
    fi
    
    sleep 1
done
