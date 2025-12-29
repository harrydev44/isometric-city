#!/usr/bin/env node
/**
 * Check current game state from terminal output
 */

import fs from 'fs';
import path from 'path';

const terminalsDir = '/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals';

function main() {
  console.log('🔍 Game State Analysis');
  console.log('='.repeat(60));
  
  const files = fs.readdirSync(terminalsDir).filter(f => f.endsWith('.txt'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(terminalsDir, file), 'utf-8');
    
    // Look for player info
    const multiAIMatch = content.match(/\[MULTI-AI\] Configured (\d+) AI players/);
    if (multiAIMatch) {
      console.log(`✅ Multi-AI detected: ${multiAIMatch[1]} AI players`);
    }
    
    // Look for individual AI logs
    const aiRedLogs = (content.match(/\[AI Red\]/g) || []).length;
    const aiGreenLogs = (content.match(/\[AI Green\]/g) || []).length;
    const singleAILogs = (content.match(/\[AI\] Tick/g) || []).length;
    
    console.log(`\n📊 AI Activity in ${file}:`);
    console.log(`   [AI Red] logs: ${aiRedLogs}`);
    console.log(`   [AI Green] logs: ${aiGreenLogs}`);
    console.log(`   [AI] (single) logs: ${singleAILogs}`);
    
    // Look for player count
    const playerMatch = content.match(/players.*?(\d+)/i);
    
    // Check for enemy info
    const enemyMatch = content.match(/ENEMY INFO:.*?Buildings: ([^\n]+)/s);
    if (enemyMatch) {
      console.log(`\n   Enemy buildings: ${enemyMatch[1]}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 To get 2 AI players, you need to RESET the game:');
  console.log('   1. Open browser console');
  console.log('   2. Run: localStorage.removeItem("ron-game-state")');
  console.log('   3. Refresh the page');
  console.log('   OR click the Reset button in game settings');
}

main();
