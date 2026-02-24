import type { ClefMode, DifficultyLevel, GameMode, LivesMode } from '@/types/gameplay';

export type AnalyticsInputMode = 'keyboard' | 'midi' | 'microphone';
export type AnalyticsPreferenceSource = 'hud_toggle';
export type AnalyticsGameStartTrigger = 'start' | 'restart';
export type AnalyticsGameEndReason = 'game_over' | 'manual_end' | 'restart';
export type FeedbackLocation = 'game_over';
export type AnalyticsScene = 'menu' | 'game' | 'game-over';

interface GameplayEventContext {
  input_mode: AnalyticsInputMode;
  mode: GameMode;
  difficulty: DifficultyLevel;
  clef_mode: ClefMode;
  speed_multiplier: number;
  lives_mode: LivesMode;
}

export interface AnalyticsEventProps {
  app_loaded: {
    path: string;
    is_dnt: boolean;
  };
  analytics_preference_changed: {
    enabled: boolean;
    source: AnalyticsPreferenceSource;
  };
  input_mode_selected: {
    input_mode: AnalyticsInputMode;
    previous_input_mode: AnalyticsInputMode;
    scene: AnalyticsScene;
  };
  midi_connect_attempted: Record<string, never>;
  midi_connected: {
    device_count: number;
    selected_input_present: boolean;
  };
  midi_connect_failed: {
    error_name: string;
  };
  microphone_connect_attempted: Record<string, never>;
  microphone_connected: Record<string, never>;
  microphone_connect_failed: {
    error_name: string;
  };
  game_started: GameplayEventContext & {
    trigger: AnalyticsGameStartTrigger;
  };
  game_ended: GameplayEventContext & {
    reason: AnalyticsGameEndReason;
    duration_ms: number;
    score: number;
    wave: number;
    lives: number;
  };
  feedback_submission_attempted: {
    location: FeedbackLocation;
  };
  feedback_submitted: {
    location: FeedbackLocation;
    rating: 1 | 2 | 3 | 4 | 5;
    has_message: boolean;
  };
  feedback_submit_failed: {
    location: FeedbackLocation;
    error_name: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventProps;
