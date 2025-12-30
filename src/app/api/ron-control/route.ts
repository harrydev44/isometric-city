/**
 * Rise of Nations - Game Control API
 * 
 * Provides external control over the game state:
 * - Reset/restart game
 * - Get current state summary
 * - Boost AI resources
 * - Force AI actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CONTROL_DIR = '/tmp/ron-control';
const CONTROL_FILE = join(CONTROL_DIR, 'commands.json');

interface ControlCommand {
  action: 'reset' | 'pause' | 'unpause' | 'boost' | 'status' | 'speed';
  data?: Record<string, unknown>;
  timestamp: number;
  applied?: boolean;
}

// Ensure control directory exists
if (!existsSync(CONTROL_DIR)) {
  mkdirSync(CONTROL_DIR, { recursive: true });
}

export async function GET() {
  // Return current pending commands
  try {
    if (existsSync(CONTROL_FILE)) {
      const commands = JSON.parse(readFileSync(CONTROL_FILE, 'utf-8')) as ControlCommand[];
      return NextResponse.json({ 
        success: true, 
        commands,
        message: 'Pending commands retrieved'
      });
    }
    return NextResponse.json({ success: true, commands: [], message: 'No pending commands' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to read commands' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 });
    }

    const command: ControlCommand = {
      action,
      data,
      timestamp: Date.now(),
      applied: false,
    };

    // Read existing commands (with size limit check)
    let commands: ControlCommand[] = [];
    if (existsSync(CONTROL_FILE)) {
      try {
        const fileContent = readFileSync(CONTROL_FILE, 'utf-8');
        // If file is too large (>100KB), reset it
        if (fileContent.length > 100000) {
          console.log('[CONTROL] Commands file too large, resetting');
          commands = [];
        } else {
          commands = JSON.parse(fileContent);
        }
      } catch {
        commands = [];
      }
    }

    // Limit data size to prevent memory issues
    const safeCommand: ControlCommand = {
      ...command,
      data: command.data ? JSON.parse(JSON.stringify(command.data).slice(0, 1000)) : undefined,
    };

    // Add new command
    commands.push(safeCommand);

    // Keep only last 5 commands (reduced from 10)
    if (commands.length > 5) {
      commands = commands.slice(-5);
    }

    // Write commands with error handling
    try {
      const jsonStr = JSON.stringify(commands, null, 2);
      if (jsonStr.length > 50000) {
        // Too big, reset to just this command
        writeFileSync(CONTROL_FILE, JSON.stringify([safeCommand], null, 2));
      } else {
        writeFileSync(CONTROL_FILE, jsonStr);
      }
    } catch (writeError) {
      // If stringify fails, reset the file
      console.error('[CONTROL] Write error, resetting file:', writeError);
      writeFileSync(CONTROL_FILE, JSON.stringify([{ action, timestamp: Date.now(), applied: false }], null, 2));
    }

    console.log(`[CONTROL] Command queued: ${action}`, data || '');

    return NextResponse.json({ 
      success: true, 
      message: `Command '${action}' queued`,
      command 
    });

  } catch (error) {
    console.error('[CONTROL] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
