#!/bin/bash
# Start the game and monitor AI players
# Usage: ./scripts/start-game-with-monitor.sh

cd "$(dirname "$0")/.."

echo "🎮 Rise of Nations - AI Game Launcher"
echo "======================================"
echo ""

# Check if dev server is running
if curl -s http://localhost:3000/ron > /dev/null 2>&1; then
    echo "✅ Dev server already running at http://localhost:3000"
else
    echo "🚀 Starting dev server..."
    npm run dev &
    DEV_PID=$!
    echo "   Dev server PID: $DEV_PID"
    
    # Wait for server to be ready
    echo "   Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/ron > /dev/null 2>&1; then
            echo "   ✅ Server ready!"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "📊 Game URL: http://localhost:3000/ron"
echo ""
echo "🤖 AI Players are managed in-browser with separate instances:"
echo "   - AI Red (player-1)"  
echo "   - AI Green (player-2)"
echo ""
echo "Each AI has:"
echo "   ✓ Separate conversation history (responseId)"
echo "   ✓ Separate state tracking"
echo "   ✓ Staggered polling (5s intervals, 1.5s stagger)"
echo ""
echo "⚠️  IMPORTANT: Keep the browser tab FOCUSED for game to run at full speed!"
echo ""
echo "---"
echo ""

# Now run the monitor
TERMINAL_FILE="/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals/2.txt"

if [ ! -f "$TERMINAL_FILE" ]; then
    echo "Waiting for terminal output..."
    sleep 5
fi

echo "📺 Monitoring AI activity (Ctrl+C to stop)..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

last_tick=""
last_summary_time=0

while true; do
    if [ -f "$TERMINAL_FILE" ]; then
        # Get latest state
        latest_state=$(grep -E "\[STATE\] Tick:" "$TERMINAL_FILE" 2>/dev/null | tail -1)
        if [ -n "$latest_state" ] && [ "$latest_state" != "$last_tick" ]; then
            last_tick="$latest_state"
            # Extract tick and pop info
            tick=$(echo "$latest_state" | grep -oP 'Tick: \d+' | grep -oP '\d+')
            pop=$(echo "$latest_state" | grep -oP 'Pop: \d+/\d+')
            military=$(echo "$latest_state" | grep -oP 'Military: \d+' | grep -oP '\d+')
            echo -e "${CYAN}[Tick $tick]${NC} $pop | Military: $military"
        fi
        
        # Check for turn summaries (new ones)
        current_time=$(date +%s)
        if [ $((current_time - last_summary_time)) -ge 5 ]; then
            summary=$(grep "TURN SUMMARY" "$TERMINAL_FILE" 2>/dev/null | tail -1)
            if [ -n "$summary" ]; then
                iterations=$(echo "$summary" | grep -oP '\d+ iterations' | grep -oP '\d+')
                actions=$(echo "$summary" | grep -oP '\d+ actions' | grep -oP '\d+')
                time_taken=$(echo "$summary" | grep -oP 'in \d+\.\d+s' | grep -oP '\d+\.\d+')
                echo -e "${GREEN}📊 Turn: ${time_taken}s | ${iterations} iterations | ${actions} actions${NC}"
                last_summary_time=$current_time
            fi
        fi
        
        # Check for recent builds
        recent_build=$(grep "BUILD.*Placed\|Built" "$TERMINAL_FILE" 2>/dev/null | tail -1)
        
        # Check for recent trains
        recent_train=$(grep "Queued citizen\|Queued militia" "$TERMINAL_FILE" 2>/dev/null | tail -1)
    fi
    
    sleep 3
done
