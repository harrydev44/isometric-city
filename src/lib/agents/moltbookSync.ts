/**
 * Moltbook Sync Service
 *
 * Fetches AI agents from Moltbook (the social network for AI agents)
 * and auto-registers them in MoltCity.
 *
 * Moltbook API: https://www.moltbook.com/api/v1
 */

import { supabase } from '@/lib/civilization/civilizationDatabase';
import { AgentCharacter } from '@/types/civilization';
import { generateApiKey } from './agentDatabase';

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

// ============================================================================
// TYPES
// ============================================================================

interface MoltbookAuthor {
  id: string;
  name: string;
}

interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  author: MoltbookAuthor;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  submolt?: {
    id: string;
    name: string;
    display_name: string;
  };
}

interface MoltbookPostsResponse {
  success: boolean;
  posts: MoltbookPost[];
  count: number;
  has_more: boolean;
  next_offset: number;
}

export interface MoltbookAgent {
  moltbookId: string;
  name: string;
  karma: number;  // Calculated from upvotes
  postCount: number;
  firstSeen: string;
  lastActive: string;
  topics: string[];  // Submolts they post in
}

export interface SyncResult {
  success: boolean;
  agentsFound: number;
  agentsImported: number;
  agentsSkipped: number;
  errors: string[];
}

// ============================================================================
// CHARACTER TYPE ASSIGNMENT
// ============================================================================

/**
 * Assign a character type based on agent's posting behavior
 */
function assignCharacterType(agent: MoltbookAgent): AgentCharacter {
  const topics = agent.topics.map(t => t.toLowerCase());
  const name = agent.name.toLowerCase();

  // Check for keywords in topics and name
  if (topics.some(t => t.includes('tech') || t.includes('code') || t.includes('dev'))) {
    return 'planner';  // Technical agents are planners
  }
  if (topics.some(t => t.includes('crypto') || t.includes('token') || t.includes('defi'))) {
    return 'capitalist';  // Crypto agents are capitalists
  }
  if (topics.some(t => t.includes('art') || t.includes('creative') || t.includes('music'))) {
    return 'environmentalist';  // Creative agents are environmentalists
  }
  if (name.includes('trump') || name.includes('signal') || name.includes('radar')) {
    return 'gambler';  // Trading signal agents are gamblers
  }
  if (agent.karma > 50) {
    return 'expansionist';  // High karma agents are expansionists
  }

  // Random assignment for others based on name hash
  const hash = agent.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const characters: AgentCharacter[] = [
    'industrialist', 'environmentalist', 'capitalist',
    'expansionist', 'planner', 'gambler'
  ];
  return characters[hash % characters.length];
}

/**
 * Generate personality values based on character type with some randomness
 */
function generatePersonality(character: AgentCharacter, seed: number) {
  const rand = (offset: number) => {
    const n = ((seed + offset) * 1103515245 + 12345) & 0x7fffffff;
    return (n / 0x7fffffff) * 0.3; // 0-0.3 variance
  };

  const base: Record<AgentCharacter, {
    aggressiveness: number;
    industrialFocus: number;
    densityPreference: number;
    environmentFocus: number;
  }> = {
    industrialist: { aggressiveness: 0.7, industrialFocus: 0.9, densityPreference: 0.6, environmentFocus: 0.1 },
    environmentalist: { aggressiveness: 0.3, industrialFocus: 0.1, densityPreference: 0.3, environmentFocus: 0.9 },
    capitalist: { aggressiveness: 0.6, industrialFocus: 0.3, densityPreference: 0.7, environmentFocus: 0.4 },
    expansionist: { aggressiveness: 0.9, industrialFocus: 0.5, densityPreference: 0.2, environmentFocus: 0.3 },
    planner: { aggressiveness: 0.4, industrialFocus: 0.5, densityPreference: 0.5, environmentFocus: 0.5 },
    gambler: { aggressiveness: 0.5, industrialFocus: 0.5, densityPreference: 0.5, environmentFocus: 0.5 },
  };

  const b = base[character];
  return {
    aggressiveness: Math.min(1, Math.max(0, b.aggressiveness + rand(1) - 0.15)),
    industrialFocus: Math.min(1, Math.max(0, b.industrialFocus + rand(2) - 0.15)),
    densityPreference: Math.min(1, Math.max(0, b.densityPreference + rand(3) - 0.15)),
    environmentFocus: Math.min(1, Math.max(0, b.environmentFocus + rand(4) - 0.15)),
  };
}

// ============================================================================
// MOLTBOOK API
// ============================================================================

/**
 * Fetch posts from Moltbook
 */
async function fetchMoltbookPosts(
  limit: number = 100,
  offset: number = 0,
  sort: 'new' | 'hot' | 'top' = 'new'
): Promise<MoltbookPost[]> {
  try {
    const url = `${MOLTBOOK_API}/posts?sort=${sort}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MoltCity/1.0',
      },
    });

    if (!response.ok) {
      console.error('[MoltbookSync] API error:', response.status);
      return [];
    }

    const data: MoltbookPostsResponse = await response.json();
    return data.posts || [];
  } catch (e) {
    console.error('[MoltbookSync] Fetch error:', e);
    return [];
  }
}

/**
 * Extract unique agents from posts
 */
function extractAgentsFromPosts(posts: MoltbookPost[]): Map<string, MoltbookAgent> {
  const agents = new Map<string, MoltbookAgent>();

  for (const post of posts) {
    const authorId = post.author.id;

    if (agents.has(authorId)) {
      // Update existing agent
      const agent = agents.get(authorId)!;
      agent.karma += post.upvotes - post.downvotes;
      agent.postCount++;
      if (post.submolt && !agent.topics.includes(post.submolt.name)) {
        agent.topics.push(post.submolt.name);
      }
      if (new Date(post.created_at) > new Date(agent.lastActive)) {
        agent.lastActive = post.created_at;
      }
    } else {
      // New agent
      agents.set(authorId, {
        moltbookId: authorId,
        name: post.author.name,
        karma: post.upvotes - post.downvotes,
        postCount: 1,
        firstSeen: post.created_at,
        lastActive: post.created_at,
        topics: post.submolt ? [post.submolt.name] : [],
      });
    }
  }

  return agents;
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Find next available game slot for Moltbook agents (50-199)
 * Slots 0-49 are reserved for manual registrations
 */
async function findAvailableMoltbookSlot(): Promise<number | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('registered_agents')
      .select('game_slot')
      .not('game_slot', 'is', null)
      .gte('game_slot', 50)
      .order('game_slot', { ascending: true });

    if (error) {
      console.error('[MoltbookSync] Slot query error:', error);
      return null;
    }

    const takenSlots = new Set((data || []).map(r => r.game_slot));

    // Find first available slot in 50-199 range
    for (let i = 50; i < 200; i++) {
      if (!takenSlots.has(i)) {
        return i;
      }
    }

    return null;
  } catch (e) {
    console.error('[MoltbookSync] Slot error:', e);
    return null;
  }
}

/**
 * Check if a Moltbook agent is already registered (by name)
 */
async function isAgentRegistered(agentName: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // Check by name and framework=moltbook, or by farcaster_handle pattern
    const { data, error } = await supabase
      .from('registered_agents')
      .select('id')
      .eq('framework', 'moltbook')
      .eq('name', agentName)
      .single();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Register a Moltbook agent in MoltCity
 */
async function registerMoltbookAgent(agent: MoltbookAgent): Promise<boolean> {
  if (!supabase) return false;

  try {
    // Check if already registered by name
    if (await isAgentRegistered(agent.name)) {
      return false;  // Skip, already exists
    }

    // Find available slot
    const slot = await findAvailableMoltbookSlot();
    if (slot === null) {
      console.log('[MoltbookSync] No slots available');
      return false;
    }

    // Assign character and personality
    const character = assignCharacterType(agent);
    const seed = agent.name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const personality = generatePersonality(character, seed);

    // Generate API key (they can claim it later if they want)
    const apiKey = generateApiKey();

    // Insert agent
    // Store Moltbook username (for profile URL) in farcaster_handle as "moltbook:{username}"
    const { error } = await supabase
      .from('registered_agents')
      .insert({
        api_key: apiKey,
        name: agent.name,
        bio: `AI agent from Moltbook with ${agent.karma} karma`,
        character_type: character,
        aggressiveness: personality.aggressiveness,
        industrial_focus: personality.industrialFocus,
        density_preference: personality.densityPreference,
        environment_focus: personality.environmentFocus,
        farcaster_handle: `moltbook:${agent.name}`,  // Store Moltbook username for profile URL
        framework: 'moltbook',
        game_slot: slot,
      });

    if (error) {
      console.error('[MoltbookSync] Insert error:', error);
      return false;
    }

    console.log(`[MoltbookSync] Registered ${agent.name} as ${character} in slot ${slot}`);
    return true;
  } catch (e) {
    console.error('[MoltbookSync] Register error:', e);
    return false;
  }
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync agents from Moltbook to MoltCity
 *
 * @param maxAgents - Maximum number of new agents to import
 * @param fetchPages - Number of pages to fetch from Moltbook (100 posts each)
 */
export async function syncMoltbookAgents(
  maxAgents: number = 50,
  fetchPages: number = 3
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    agentsFound: 0,
    agentsImported: 0,
    agentsSkipped: 0,
    errors: [],
  };

  if (!supabase) {
    result.errors.push('Database not configured');
    return result;
  }

  try {
    console.log(`[MoltbookSync] Starting sync - max ${maxAgents} agents, ${fetchPages} pages`);

    // Fetch posts from multiple pages
    const allPosts: MoltbookPost[] = [];
    for (let page = 0; page < fetchPages; page++) {
      const posts = await fetchMoltbookPosts(100, page * 100, 'new');
      allPosts.push(...posts);

      // Also fetch hot posts for variety
      if (page === 0) {
        const hotPosts = await fetchMoltbookPosts(50, 0, 'hot');
        allPosts.push(...hotPosts);
      }

      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[MoltbookSync] Fetched ${allPosts.length} posts`);

    // Extract unique agents
    const agents = extractAgentsFromPosts(allPosts);
    result.agentsFound = agents.size;
    console.log(`[MoltbookSync] Found ${agents.size} unique agents`);

    // Sort by karma (highest first) and import top agents
    const sortedAgents = Array.from(agents.values())
      .sort((a, b) => b.karma - a.karma)
      .slice(0, maxAgents);

    // Import agents
    for (const agent of sortedAgents) {
      const imported = await registerMoltbookAgent(agent);
      if (imported) {
        result.agentsImported++;
      } else {
        result.agentsSkipped++;
      }

      // Stop if we've imported enough
      if (result.agentsImported >= maxAgents) {
        break;
      }
    }

    result.success = true;
    console.log(`[MoltbookSync] Complete - imported ${result.agentsImported}, skipped ${result.agentsSkipped}`);
  } catch (e) {
    console.error('[MoltbookSync] Sync error:', e);
    result.errors.push(String(e));
  }

  return result;
}

/**
 * Get count of Moltbook agents in the game
 */
export async function getMoltbookAgentCount(): Promise<number> {
  if (!supabase) return 0;

  try {
    const { count, error } = await supabase
      .from('registered_agents')
      .select('*', { count: 'exact', head: true })
      .eq('framework', 'moltbook');

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}
