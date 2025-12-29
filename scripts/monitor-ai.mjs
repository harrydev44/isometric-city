#!/usr/bin/env node
/**
 * AI Gameplay Monitor Script
 * 
 * Analyzes the current game state and AI player performance.
 * Run with: node scripts/monitor-ai.mjs
 */

import fs from 'fs';
import path from 'path';

// Read terminal output to extract recent AI activity
const terminalsDir = '/Users/andrewmilich/.cursor/projects/Users-andrewmilich-Documents-GitHub-isometric-city/terminals';

function extractAIActions(terminalContent) {
  const lines = terminalContent.split('\n');
  const actions = [];
  const summaries = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Extract turn summaries
    if (line.includes('[TURN SUMMARY]')) {
      summaries.push(line);
    }
    
    // Extract agent thinking
    if (line.includes('[AGENT THINKING]') || line.includes('[AGENT OUTPUT]')) {
      let thought = line;
      // Capture multi-line thoughts
      while (i + 1 < lines.length && !lines[i + 1].startsWith('[') && !lines[i + 1].includes('===')) {
        i++;
        thought += '\n' + lines[i];
      }
      actions.push({ type: 'thought', content: thought });
    }
    
    // Extract actions
    if (line.includes('- build:') || line.includes('- train:') || line.includes('- unit_task:')) {
      actions.push({ type: 'action', content: line.trim() });
    }
  }
  
  return { actions, summaries };
}

function analyzeAIPerformance(actions, summaries) {
  const analysis = {
    totalTurns: summaries.length,
    buildActions: 0,
    trainActions: 0,
    unitTaskActions: 0,
    buildingTypes: {},
    unitTypes: {},
    avgActionsPerTurn: 0,
    avgTimePerTurn: 0,
    issues: [],
    strengths: [],
  };
  
  let totalActions = 0;
  let totalTime = 0;
  
  for (const summary of summaries) {
    // Parse: [TURN SUMMARY] Completed in 65.6s | 4 iterations | 12 actions
    const timeMatch = summary.match(/Completed in ([\d.]+)s/);
    const actionsMatch = summary.match(/(\d+) actions/);
    
    if (timeMatch) totalTime += parseFloat(timeMatch[1]);
    if (actionsMatch) totalActions += parseInt(actionsMatch[1]);
  }
  
  for (const action of actions) {
    if (action.type === 'action') {
      if (action.content.includes('- build:')) {
        analysis.buildActions++;
        // Extract building type
        const typeMatch = action.content.match(/"type":"(\w+)"/);
        if (typeMatch) {
          analysis.buildingTypes[typeMatch[1]] = (analysis.buildingTypes[typeMatch[1]] || 0) + 1;
        }
      } else if (action.content.includes('- train:')) {
        analysis.trainActions++;
      } else if (action.content.includes('- unit_task:')) {
        analysis.unitTaskActions++;
        // Extract task type
        const taskMatch = action.content.match(/"task":"(\w+)"/);
        if (taskMatch) {
          analysis.unitTypes[taskMatch[1]] = (analysis.unitTypes[taskMatch[1]] || 0) + 1;
        }
      }
    }
  }
  
  analysis.avgActionsPerTurn = summaries.length > 0 ? (totalActions / summaries.length).toFixed(1) : 0;
  analysis.avgTimePerTurn = summaries.length > 0 ? (totalTime / summaries.length).toFixed(1) : 0;
  
  // Identify issues
  if (analysis.buildingTypes['barracks'] > 0 && analysis.trainActions === 0) {
    analysis.issues.push('⚠️ Built barracks but not training military units');
  }
  
  if (!analysis.buildingTypes['small_city'] && !analysis.buildingTypes['large_city']) {
    analysis.issues.push('⚠️ Not expanding population cap with cities');
  }
  
  if (analysis.unitTypes['gather_food'] < analysis.unitTypes['gather_wood']) {
    analysis.issues.push('⚠️ More wood gathering than food - may starve');
  }
  
  if (analysis.avgTimePerTurn > 60) {
    analysis.issues.push('⚠️ Turn time very high (>60s) - AI may be overthinking');
  }
  
  // Identify strengths
  if (analysis.buildingTypes['farm'] > 0) {
    analysis.strengths.push('✓ Building farms for food production');
  }
  
  if (analysis.buildingTypes['woodcutters_camp'] > 0) {
    analysis.strengths.push('✓ Building lumber camps');
  }
  
  if (analysis.buildingTypes['market'] > 0) {
    analysis.strengths.push('✓ Building markets for gold');
  }
  
  return analysis;
}

async function main() {
  console.log('🔍 AI Gameplay Monitor');
  console.log('='.repeat(60));
  
  // Read all terminal files
  const files = fs.readdirSync(terminalsDir).filter(f => f.endsWith('.txt'));
  
  let allActions = [];
  let allSummaries = [];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(terminalsDir, file), 'utf-8');
    const { actions, summaries } = extractAIActions(content);
    allActions = allActions.concat(actions);
    allSummaries = allSummaries.concat(summaries);
  }
  
  console.log(`\n📊 Found ${allSummaries.length} AI turn summaries\n`);
  
  if (allSummaries.length === 0) {
    console.log('No AI activity detected yet. Start the game and let the AI play.');
    return;
  }
  
  const analysis = analyzeAIPerformance(allActions, allSummaries);
  
  console.log('📈 PERFORMANCE METRICS:');
  console.log(`   Total turns analyzed: ${analysis.totalTurns}`);
  console.log(`   Avg actions/turn: ${analysis.avgActionsPerTurn}`);
  console.log(`   Avg time/turn: ${analysis.avgTimePerTurn}s`);
  console.log();
  
  console.log('🏗️ BUILDING ACTIVITY:');
  console.log(`   Total build actions: ${analysis.buildActions}`);
  for (const [type, count] of Object.entries(analysis.buildingTypes)) {
    console.log(`     - ${type}: ${count}`);
  }
  console.log();
  
  console.log('👷 WORKER TASKS:');
  console.log(`   Total task assignments: ${analysis.unitTaskActions}`);
  for (const [task, count] of Object.entries(analysis.unitTypes)) {
    console.log(`     - ${task}: ${count}`);
  }
  console.log();
  
  console.log('⚔️ MILITARY:');
  console.log(`   Training actions: ${analysis.trainActions}`);
  console.log();
  
  if (analysis.issues.length > 0) {
    console.log('🚨 ISSUES DETECTED:');
    for (const issue of analysis.issues) {
      console.log(`   ${issue}`);
    }
    console.log();
  }
  
  if (analysis.strengths.length > 0) {
    console.log('✅ STRENGTHS:');
    for (const strength of analysis.strengths) {
      console.log(`   ${strength}`);
    }
    console.log();
  }
  
  // Show last few turns
  console.log('📝 RECENT TURN SUMMARIES:');
  const recentSummaries = allSummaries.slice(-5);
  for (const summary of recentSummaries) {
    console.log(`   ${summary}`);
  }
}

main().catch(console.error);
