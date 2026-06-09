// ─── Client → Server ─────────────────────────────────────────────────────────
export const LOBBY_CREATE           = 'lobby:create';
export const LOBBY_JOIN             = 'lobby:join';
export const LOBBY_SELECT_CHARACTER = 'lobby:select_character';
export const LOBBY_READY            = 'lobby:ready';

export const GAME_INPUT             = 'game:input';
export const GAME_SWING             = 'game:swing';
export const GAME_SHOOT             = 'game:shoot';
export const GAME_COMBAT            = 'game:combat';
export const GAME_PICKUP            = 'game:pickup';
export const GAME_DROP              = 'game:drop';
export const GAME_STEAL             = 'game:steal';

// ─── Server → Client ─────────────────────────────────────────────────────────
export const LOBBY_CREATED          = 'lobby:created';
export const LOBBY_JOINED           = 'lobby:joined';
export const LOBBY_UPDATED          = 'lobby:updated';
export const LOBBY_ERROR            = 'lobby:error';
export const LOBBY_PLAYER_LEFT      = 'lobby:player_left';

export const MATCH_START            = 'match:start';
export const MATCH_STATE            = 'match:state';
export const MATCH_EVENT            = 'match:event';
export const MATCH_ITEM_PICKED      = 'match:item_picked';
export const MATCH_ITEM_DROPPED     = 'match:item_dropped';
export const MATCH_ITEM_SPAWNED     = 'match:item_spawned';
export const MATCH_END              = 'match:end';
export const MATCH_SCORE            = 'match:score';   // { coreIndex, scores }
