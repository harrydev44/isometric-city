#!/bin/bash
# AI Supervisor Script
# Controls and monitors Rise of Nations AI players
# 
# Usage: ./scripts/ai-supervisor.sh [command]
# Commands:
#   start   - Start new game and monitor
#   reset   - Reset the current game
#   status  - Get current game status
#   boost   - Give AI resources
#   monitor - Just monitor (don't reset)
#   watch   - Continuous monitoring loop

API_URL="http://localhost:3000/api/ron-control"
TERMINAL_FILE="/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals/2.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${MAGENTA}"
    echo "╔════════════════════════════════════════════╗"
    echo "║     🤖 Rise of Nations AI Supervisor 🤖    ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

send_command() {
    local action=$1
    local data=$2
    
    if [ -n "$data" ]; then
        curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -d "{\"action\": \"$action\", \"data\": $data}"
    else
        curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -d "{\"action\": \"$action\"}"
    fi
}

get_status() {
    curl -s "$API_URL" 2>/dev/null
}

reset_game() {
    echo -e "${YELLOW}🔄 Sending reset command...${NC}"
    result=$(send_command "reset")
    echo -e "${GREEN}$result${NC}"
}

boost_ai() {
    echo -e "${YELLOW}💰 Boosting AI resources...${NC}"
    result=$(send_command "boost" '{"food": 5000, "wood": 3000, "metal": 2000, "gold": 1000}')
    echo -e "${GREEN}$result${NC}"
}

get_latest_state() {
    if [ -f "$TERMINAL_FILE" ]; then
        # Get the latest state line
        grep -E "\[STATE\] Tick:" "$TERMINAL_FILE" 2>/dev/null | tail -1
    fi
}

get_latest_summary() {
    if [ -f "$TERMINAL_FILE" ]; then
        grep "TURN SUMMARY" "$TERMINAL_FILE" 2>/dev/null | tail -1
    fi
}

get_economy() {
    if [ -f "$TERMINAL_FILE" ]; then
        grep "Economy:" "$TERMINAL_FILE" 2>/dev/null | tail -1
    fi
}

monitor_once() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$(date '+%H:%M:%S') - Game Status${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    state=$(get_latest_state)
    if [ -n "$state" ]; then
        # Parse state
        tick=$(echo "$state" | grep -oP 'Tick: \d+' | grep -oP '\d+')
        pop=$(echo "$state" | grep -oP 'Pop: \d+/\d+')
        military=$(echo "$state" | grep -oP 'Military: \d+' | grep -oP '\d+')
        
        echo -e "  ${GREEN}Tick:${NC} $tick"
        echo -e "  ${GREEN}Population:${NC} $pop"
        echo -e "  ${GREEN}Military:${NC} $military"
    else
        echo -e "  ${RED}No game state found${NC}"
    fi
    
    economy=$(get_economy)
    if [ -n "$economy" ]; then
        echo -e "  ${YELLOW}$economy${NC}"
    fi
    
    summary=$(get_latest_summary)
    if [ -n "$summary" ]; then
        # Parse summary
        time=$(echo "$summary" | grep -oP 'in \d+\.\d+s' | grep -oP '\d+\.\d+')
        actions=$(echo "$summary" | grep -oP '\d+ actions' | grep -oP '\d+')
        echo -e "  ${BLUE}Last turn: ${time}s, ${actions} actions${NC}"
    fi
    
    echo ""
}

watch_loop() {
    print_header
    echo -e "${GREEN}Starting continuous monitoring...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    last_tick=""
    last_summary=""
    stale_count=0
    
    while true; do
        state=$(get_latest_state)
        summary=$(get_latest_summary)
        
        # Check if state changed
        if [ "$state" != "$last_tick" ] || [ "$summary" != "$last_summary" ]; then
            monitor_once
            last_tick="$state"
            last_summary="$summary"
            stale_count=0
        else
            stale_count=$((stale_count + 1))
            
            # Warn if stale for too long
            if [ $stale_count -eq 10 ]; then
                echo -e "${YELLOW}⚠️  No updates for 30 seconds - game may be paused${NC}"
            elif [ $stale_count -eq 20 ]; then
                echo -e "${RED}🛑 No updates for 60 seconds - game likely paused or browser not focused${NC}"
            fi
        fi
        
        sleep 3
    done
}

start_game() {
    print_header
    
    echo -e "${GREEN}🚀 Starting fresh game...${NC}"
    
    # Send reset command
    reset_game
    
    # Open browser
    echo -e "${BLUE}🌐 Opening game in browser...${NC}"
    open "http://localhost:3000/ron"
    
    sleep 3
    
    echo -e "${GREEN}✅ Game started! Beginning monitoring...${NC}"
    echo ""
    
    watch_loop
}

# Main command handling
case "${1:-watch}" in
    start)
        start_game
        ;;
    reset)
        reset_game
        ;;
    status)
        monitor_once
        ;;
    boost)
        boost_ai
        ;;
    monitor)
        monitor_once
        ;;
    watch)
        print_header
        watch_loop
        ;;
    help|--help|-h)
        echo "AI Supervisor - Commands:"
        echo "  start   - Reset game and start monitoring"
        echo "  reset   - Reset the current game"
        echo "  status  - Show current game status"
        echo "  boost   - Give AI extra resources"
        echo "  watch   - Continuous monitoring (default)"
        echo "  help    - Show this help"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use 'help' for available commands"
        exit 1
        ;;
esac
