// Minimal Home Assistant frontend types used by the card (no custom-card-helpers).

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_updated: string;
}

export interface HassConnection {
  addEventListener(ev: 'ready', cb: () => void): void;
  removeEventListener(ev: 'ready', cb: () => void): void;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale: { language: string };
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  connection: HassConnection;
}

export interface ActionConfig {
  action: 'more-info' | 'navigate' | 'none';
  navigation_path?: string;
}
