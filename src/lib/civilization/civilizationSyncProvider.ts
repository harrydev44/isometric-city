/**
 * Civilization Sync Provider
 *
 * Manages real-time synchronization between multiple viewers of the AI Civilization.
 * Uses leader-based architecture where one viewer runs the simulation and broadcasts
 * updates to all followers.
 *
 * Features:
 * - Leader election (oldest viewer by joinedAt wins)
 * - Heartbeat monitoring (15s timeout)
 * - Turn update broadcasting (deltas, not full state)
 * - Throttled state persistence to database (every 10s)
 * - Automatic leader takeover on disconnect
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import {
  AgentCity,
  AgentPerformance,
  AgentDecision,
  TurnPhase,
  CivilizationEvent,
  CharacterAward,
} from '@/types/civilization';
import { CivilizationStats, CharacterStats } from '@/lib/turnManager';
import {
  supabase,
  SESSION_ID,
  loadCivilizationSession,
  saveCivilizationSession,
  updateLeaderHeartbeat,
  updateViewerCount,
  clearLeadership,
  CivilizationSessionState,
} from './civilizationDatabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const HEARTBEAT_INTERVAL = 5000; // 5s - send heartbeat
const LEADER_TIMEOUT = 15000; // 15s - leader considered dead
const STATE_SAVE_INTERVAL = 10000; // 10s - save to database

// ============================================================================
// TYPES
// ============================================================================

export interface CivilizationTurnUpdate {
  turn: number;
  timestamp: number;
  turnPhase: TurnPhase;
  currentViewIndex: number; // Synced camera position
  agentUpdates: Array<{
    agentId: number;
    rank: number;
    performance: AgentPerformance;
    lastDecision: AgentDecision | null;
  }>;
  stats: CivilizationStats;
  events: CivilizationEvent[];
  awards: CharacterAward[];
  characterStats: CharacterStats[];
}

export interface PresenceState {
  viewerId: string;
  joinedAt: number;
}

export interface SyncProviderCallbacks {
  onConnectionChange?: (connected: boolean) => void;
  onViewerCountChange?: (count: number) => void;
  onLeaderChange?: (isLeader: boolean) => void;
  onStateReceived?: (state: CivilizationSessionState) => void;
  onTurnUpdate?: (update: CivilizationTurnUpdate) => void;
  onCameraChange?: (viewIndex: number) => void; // Called when leader changes camera view
  onRequestState?: (targetViewerId: string) => void; // Called when a new viewer joins and needs state
  onError?: (error: string) => void;
}

// ============================================================================
// SYNC PROVIDER CLASS
// ============================================================================

export class CivilizationSyncProvider {
  public readonly viewerId: string;
  public isLeader: boolean = false;
  public isConnected: boolean = false;
  public viewerCount: number = 0;

  private channel: RealtimeChannel | null = null;
  private callbacks: SyncProviderCallbacks;
  private joinedAt: number;
  private destroyed: boolean = false;

  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private leaderCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastLeaderHeartbeat: number = 0;
  private currentLeaderId: string | null = null;

  // State save throttling
  private lastStateSave: number = 0;
  private pendingStateSave: CivilizationSessionState | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: SyncProviderCallbacks = {}) {
    this.viewerId = this.generateViewerId();
    this.joinedAt = Date.now();
    this.callbacks = callbacks;
  }

  private generateViewerId(): string {
    return `viewer-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  async connect(): Promise<CivilizationSessionState | null> {
    if (!supabase) {
      console.log('[CivSync] Supabase not configured - will use local mode');
      throw new Error('Supabase not configured');
    }
    if (this.destroyed) {
      throw new Error('Provider destroyed');
    }

    console.log('[CivSync] Connecting to Supabase Realtime...');

    // Load existing state from database
    const existingSession = await loadCivilizationSession();
    let initialState: CivilizationSessionState | null = null;

    if (existingSession) {
      initialState = existingSession.state;

      // Check if existing leader is still alive
      if (existingSession.leaderId && existingSession.leaderHeartbeat) {
        const heartbeatAge = Date.now() - existingSession.leaderHeartbeat.getTime();
        if (heartbeatAge < LEADER_TIMEOUT) {
          // Leader is alive
          this.currentLeaderId = existingSession.leaderId;
          this.lastLeaderHeartbeat = existingSession.leaderHeartbeat.getTime();
        }
      }
    }

    // Create Supabase Realtime channel
    this.channel = supabase.channel(`civilization-${SESSION_ID}`, {
      config: {
        presence: { key: this.viewerId },
        broadcast: { self: false },
      },
    });

    // Set up listeners
    this.setupChannelListeners();

    // Subscribe
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe(async (status) => {
        console.log('[CivSync] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Track our presence
          await this.channel!.track({
            viewerId: this.viewerId,
            joinedAt: this.joinedAt,
          } as PresenceState);

          console.log('[CivSync] Connected and tracked presence');
          this.isConnected = true;
          this.callbacks.onConnectionChange?.(true);

          // Set viewer count to at least 1 (ourselves)
          this.viewerCount = 1;
          this.callbacks.onViewerCountChange?.(1);

          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[CivSync] Channel error');
          reject(new Error('Channel subscription failed'));
        }
      });
    });

    // Start leader monitoring - with a small delay to allow presence to sync
    setTimeout(() => {
      this.startLeaderMonitoring();
    }, 500);

    // If we're not the leader after connecting, request state from leader
    // Keep requesting until we receive state
    const requestStateFromLeader = () => {
      if (!this.destroyed && !this.isLeader && this.channel) {
        console.log('[CivSync] Requesting state from leader (as new joiner)');
        this.channel.send({
          type: 'broadcast',
          event: 'request-state',
          payload: { viewerId: this.viewerId },
        });
      }
    };

    // Request state multiple times to ensure delivery
    setTimeout(requestStateFromLeader, 1000);
    setTimeout(requestStateFromLeader, 2500);
    setTimeout(requestStateFromLeader, 5000);

    return initialState;
  }

  private setupChannelListeners(): void {
    if (!this.channel) return;

    this.channel
      // Presence sync - track all viewers
      .on('presence', { event: 'sync' }, () => {
        console.log('[CivSync] Presence sync event');
        const state = this.channel!.presenceState();

        // Count actual viewers from presence state
        let viewerCount = 0;
        Object.values(state).forEach((presences) => {
          viewerCount += presences.length;
        });

        this.viewerCount = Math.max(1, viewerCount);
        this.callbacks.onViewerCountChange?.(this.viewerCount);

        // Update viewer count in database
        updateViewerCount(this.viewerCount);

        // Always re-check leader election on presence change
        this.checkLeaderElection();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // A new viewer joined
        if (newPresences.length > 0) {
          console.log('[CivSync] New viewer joined:', newPresences.length);
          this.viewerCount++;
          this.callbacks.onViewerCountChange?.(this.viewerCount);

          // If we're leader, send the new viewer our current state
          if (this.isLeader && this.callbacks.onRequestState) {
            const newViewerId = (newPresences[0] as unknown as PresenceState).viewerId;
            if (newViewerId && newViewerId !== this.viewerId) {
              console.log('[CivSync] Leader sending state to new viewer:', newViewerId);
              // Request current state from context to send to new viewer
              setTimeout(() => {
                if (!this.destroyed && this.isLeader) {
                  this.callbacks.onRequestState?.(newViewerId);
                }
              }, 1000); // Delay to let them finish connecting
            }
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (leftPresences.length > 0) {
          console.log('[CivSync] Presence leave event:', leftPresences.length, 'viewers left');

          // Check if leader left
          const leftIds = leftPresences.map(
            (p) => (p as unknown as PresenceState).viewerId
          );
          if (this.currentLeaderId && leftIds.includes(this.currentLeaderId)) {
            console.log('[CivSync] Leader disconnected, will re-elect');
            this.currentLeaderId = null;
            this.lastLeaderHeartbeat = 0;
          }

          // Re-check leader election (presence sync will also fire and update counts)
          this.checkLeaderElection();
        }
      })
      // Broadcast: turn updates from leader
      .on('broadcast', { event: 'turn-update' }, ({ payload }) => {
        if (this.isLeader) return; // Leaders don't receive their own updates

        const update = payload as CivilizationTurnUpdate;
        if (update && update.turn !== undefined) {
          this.callbacks.onTurnUpdate?.(update);
        }
      })
      // Broadcast: camera position changes from leader
      .on('broadcast', { event: 'camera-change' }, ({ payload }) => {
        if (this.isLeader) return;

        const { viewIndex } = payload as { viewIndex: number };
        if (viewIndex !== undefined) {
          this.callbacks.onCameraChange?.(viewIndex);
        }
      })
      // Broadcast: leader heartbeat
      .on('broadcast', { event: 'leader-heartbeat' }, ({ payload }) => {
        const { leaderId, timestamp } = payload as {
          leaderId: string;
          timestamp: number;
        };
        if (leaderId && leaderId !== this.viewerId) {
          this.currentLeaderId = leaderId;
          this.lastLeaderHeartbeat = timestamp;

          // If we thought we were leader but someone else is sending heartbeats,
          // re-check election to see who should really be leader
          if (this.isLeader) {
            console.log('[CivSync] Received heartbeat from another leader, re-checking election');
            this.checkLeaderElection();
          }
        }
      })
      // Broadcast: new viewer requesting state from leader
      .on('broadcast', { event: 'request-state' }, ({ payload }) => {
        const { viewerId } = payload as { viewerId: string };
        console.log('[CivSync] Received state request from:', viewerId, 'isLeader:', this.isLeader);
        if (this.isLeader && viewerId && viewerId !== this.viewerId) {
          // Send state to the requester
          this.callbacks.onRequestState?.(viewerId);
        }
      })
      // Broadcast: full state sync (for new joiners)
      .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
        console.log('[CivSync] Received state-sync broadcast, isLeader:', this.isLeader);
        if (this.isLeader) {
          console.log('[CivSync] Ignoring state-sync (we are leader)');
          return;
        }

        const { state, targetViewer } = payload as {
          state: CivilizationSessionState;
          targetViewer?: string;
        };

        // Accept if broadcast to all or specifically to us
        if (state && (!targetViewer || targetViewer === this.viewerId)) {
          console.log('[CivSync] Applying state-sync, turn:', state.currentTurn, 'agents:', state.agents?.length);
          this.callbacks.onStateReceived?.(state);
        } else {
          console.log('[CivSync] State-sync not for us, targetViewer:', targetViewer);
        }
      });
  }

  // ============================================================================
  // LEADER ELECTION
  // ============================================================================

  private startLeaderMonitoring(): void {
    // Check for stale leader every 5s
    this.leaderCheckInterval = setInterval(() => {
      if (this.destroyed) return;

      const now = Date.now();
      const timeSinceHeartbeat = now - this.lastLeaderHeartbeat;

      if (this.currentLeaderId && timeSinceHeartbeat > LEADER_TIMEOUT) {
        // Leader is stale
        console.log('[CivSync] Leader timeout, triggering election');
        this.currentLeaderId = null;
        this.lastLeaderHeartbeat = 0;
        this.checkLeaderElection();
      }
    }, HEARTBEAT_INTERVAL);

    // Initial election check
    this.checkLeaderElection();
  }

  private checkLeaderElection(): void {
    if (this.destroyed || !this.channel) return;

    // If there's an active leader sending heartbeats (not us), defer to them
    if (this.currentLeaderId && this.currentLeaderId !== this.viewerId) {
      const timeSinceHeartbeat = Date.now() - this.lastLeaderHeartbeat;
      if (timeSinceHeartbeat < LEADER_TIMEOUT) {
        console.log('[CivSync] Active leader exists:', this.currentLeaderId, 'deferring');
        if (this.isLeader) {
          // We thought we were leader but someone else is active
          console.log('[CivSync] Relinquishing leadership to:', this.currentLeaderId);
          this.isLeader = false;
          this.stopHeartbeat();
          this.callbacks.onLeaderChange?.(false);
        }
        return;
      }
    }

    // Get all viewers from presence
    const presenceState = this.channel.presenceState();
    const viewers: Array<{ viewerId: string; joinedAt: number }> = [];

    Object.values(presenceState).forEach((presences) => {
      presences.forEach((presence) => {
        const p = presence as unknown as PresenceState;
        if (p.viewerId && p.joinedAt) {
          viewers.push({ viewerId: p.viewerId, joinedAt: p.joinedAt });
        }
      });
    });

    // Update viewer count
    if (viewers.length > 0) {
      this.viewerCount = viewers.length;
      this.callbacks.onViewerCountChange?.(viewers.length);
    }

    // If no viewers in presence yet, wait for presence to sync
    if (viewers.length === 0) {
      console.log('[CivSync] No viewers in presence yet, waiting...');
      return;
    }

    // Sort by joinedAt (oldest first), then by viewerId for deterministic tiebreaker
    viewers.sort((a, b) => {
      if (a.joinedAt !== b.joinedAt) {
        return a.joinedAt - b.joinedAt;
      }
      return a.viewerId.localeCompare(b.viewerId);
    });

    // Oldest viewer becomes leader
    const newLeaderId = viewers[0].viewerId;
    console.log('[CivSync] Leader election: viewers=', viewers.length, 'elected=', newLeaderId, 'me=', this.viewerId);

    if (newLeaderId === this.viewerId) {
      if (!this.isLeader) {
        this.becomeLeader();
      }
    } else {
      // Someone else should be leader
      if (this.isLeader) {
        // We were leader but lost election
        console.log('[CivSync] Lost leadership to:', newLeaderId);
        this.isLeader = false;
        this.stopHeartbeat();
        this.callbacks.onLeaderChange?.(false);
      }
      this.currentLeaderId = newLeaderId;
    }
  }

  private becomeLeader(): void {
    if (this.isLeader) return;

    console.log('[CivSync] Becoming leader! viewerId:', this.viewerId);
    this.isLeader = true;
    this.currentLeaderId = this.viewerId;
    this.lastLeaderHeartbeat = Date.now();

    // Start heartbeat
    this.startHeartbeat();

    // Notify callback
    this.callbacks.onLeaderChange?.(true);
    console.log('[CivSync] Leader callback fired');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.destroyed || !this.isLeader) return;

      // Broadcast heartbeat to all viewers
      this.channel?.send({
        type: 'broadcast',
        event: 'leader-heartbeat',
        payload: {
          leaderId: this.viewerId,
          timestamp: Date.now(),
        },
      });

      // Also update database
      updateLeaderHeartbeat(this.viewerId);
    }, HEARTBEAT_INTERVAL);

    // Send immediate heartbeat
    this.channel?.send({
      type: 'broadcast',
      event: 'leader-heartbeat',
      payload: {
        leaderId: this.viewerId,
        timestamp: Date.now(),
      },
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ============================================================================
  // BROADCASTING
  // ============================================================================

  /**
   * Broadcast a turn update to all followers (called by leader only)
   */
  broadcastTurnUpdate(update: CivilizationTurnUpdate): void {
    if (!this.isLeader || !this.channel || this.destroyed) return;

    this.channel.send({
      type: 'broadcast',
      event: 'turn-update',
      payload: update,
    });
  }

  /**
   * Broadcast camera position change to all followers (called by leader only)
   */
  broadcastCameraChange(viewIndex: number): void {
    if (!this.isLeader || !this.channel || this.destroyed) return;

    this.channel.send({
      type: 'broadcast',
      event: 'camera-change',
      payload: { viewIndex },
    });
  }

  /**
   * Broadcast full state sync (for new joiners or recovery)
   */
  broadcastFullState(state: CivilizationSessionState, targetViewer?: string): void {
    if (!this.isLeader || !this.channel || this.destroyed) {
      console.log('[CivSync] Cannot broadcast state: isLeader=', this.isLeader, 'channel=', !!this.channel);
      return;
    }

    console.log('[CivSync] Broadcasting full state to:', targetViewer || 'all', 'turn:', state.currentTurn, 'agents:', state.agents?.length);
    this.channel.send({
      type: 'broadcast',
      event: 'state-sync',
      payload: { state, targetViewer },
    });
  }

  // ============================================================================
  // STATE PERSISTENCE
  // ============================================================================

  /**
   * Save state to database (throttled)
   */
  saveStateToDatabase(state: CivilizationSessionState): void {
    if (!this.isLeader) return;

    const now = Date.now();
    const timeSinceLastSave = now - this.lastStateSave;

    if (timeSinceLastSave >= STATE_SAVE_INTERVAL) {
      // Save immediately
      this.doSaveState(state);
    } else {
      // Queue the save for later
      this.pendingStateSave = state;

      if (!this.saveTimeout) {
        this.saveTimeout = setTimeout(() => {
          this.saveTimeout = null;
          if (this.pendingStateSave && !this.destroyed && this.isLeader) {
            this.doSaveState(this.pendingStateSave);
            this.pendingStateSave = null;
          }
        }, STATE_SAVE_INTERVAL - timeSinceLastSave);
      }
    }
  }

  private doSaveState(state: CivilizationSessionState): void {
    this.lastStateSave = Date.now();
    saveCivilizationSession(state, this.viewerId).catch((e) => {
      console.error('[CivSync] Failed to save state:', e);
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Stop intervals
    this.stopHeartbeat();
    if (this.leaderCheckInterval) {
      clearInterval(this.leaderCheckInterval);
      this.leaderCheckInterval = null;
    }

    // Save pending state
    if (this.pendingStateSave && this.isLeader) {
      this.doSaveState(this.pendingStateSave);
      this.pendingStateSave = null;
    }

    // Clear save timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Clear leadership in database if we were leader
    if (this.isLeader) {
      clearLeadership(this.viewerId);
    }

    // Unsubscribe from channel
    if (this.channel) {
      this.channel.unsubscribe();
      supabase?.removeChannel(this.channel);
      this.channel = null;
    }

    this.isConnected = false;
    this.isLeader = false;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create and connect a civilization sync provider
 */
export async function createCivilizationSyncProvider(
  callbacks: SyncProviderCallbacks = {}
): Promise<{
  provider: CivilizationSyncProvider;
  initialState: CivilizationSessionState | null;
}> {
  const provider = new CivilizationSyncProvider(callbacks);
  const initialState = await provider.connect();
  return { provider, initialState };
}
