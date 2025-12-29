#!/usr/bin/env node
/**
 * Watch AI activity in real-time
 * Run after resetting the game to see 2 AI players
 */

import fs from 'fs';
import path from 'path';

const terminalsDir = '/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals';

function getLatestLines(file, numLines = 100) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(-numLines).join('\n');
  } catch {
    return '';
  }
}

function analyzeContent(content) {
  const analysis = {
    multiAI: content.includes('[MULTI-AI]'),
    aiRedCount: (content.match(/\[AI Red/g) || []).length,
    aiGreenCount: (content.match(/\[AI Green/g) || []).length,
    turnSummaries: (content.match(/\[TURN SUMMARY\]/g) || []).length,
    thinkingCount: (content.match(/\[AGENT THINKING\]/g) || []).length,
  };
  return analysis;
}

function main() {
  console.log('🔍 AI Activity Monitor (run after resetting game)');
  console.log('='.repeat(60));
  console.log('Looking for [MULTI-AI], [AI Red], [AI Green] logs...\n');

  const files = fs.readdirSync(terminalsDir).filter(f => f.endsWith('.txt'));
  
  let totalAIRed = 0;
  let totalAIGreen = 0;
  let foundMultiAI = false;

  for (const file of files) {
    const latestContent = getLatestLines(path.join(terminalsDir, file), 200);
    const analysis = analyzeContent(latestContent);
    
    if (analysis.multiAI) foundMultiAI = true;
    totalAIRed += analysis.aiRedCount;
    totalAIGreen += analysis.aiGreenCount;
    
    if (analysis.aiRedCount > 0 || analysis.aiGreenCount > 0 || analysis.multiAI) {
      console.log(`📂 ${file}:`);
      if (analysis.multiAI) console.log(`   ✅ [MULTI-AI] configuration detected!`);
      if (analysis.aiRedCount > 0) console.log(`   🔴 AI Red activity: ${analysis.aiRedCount} logs`);
      if (analysis.aiGreenCount > 0) console.log(`   🟢 AI Green activity: ${analysis.aiGreenCount} logs`);
      console.log(`   📊 Turn summaries: ${analysis.turnSummaries}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (foundMultiAI) {
    console.log('✅ MULTI-AI MODE ACTIVE!');
    console.log(`   🔴 AI Red total logs: ${totalAIRed}`);
    console.log(`   🟢 AI Green total logs: ${totalAIGreen}`);
  } else {
    console.log('⚠️  MULTI-AI NOT DETECTED YET');
    console.log('   The game may still be using old saved state.');
    console.log('   Please reset the game:');
    console.log('   1. Open browser console (F12)');
    console.log('   2. Run: localStorage.removeItem("ron-game-state")');
    console.log('   3. Refresh the page');
  }
  
  // Show last few lines of terminal 2 for context
  const term2 = path.join(terminalsDir, '2.txt');
  if (fs.existsSync(term2)) {
    console.log('\n📝 Last 30 lines of terminal 2:');
    console.log('-'.repeat(60));
    const last30 = getLatestLines(term2, 30);
    console.log(last30);
  }
}

main();
