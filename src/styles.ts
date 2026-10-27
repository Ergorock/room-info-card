import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
    height: 100%;
  }

  ha-card {
    position: relative;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 8px;
    border-radius: var(--ric-radius);
    overflow: hidden;
    cursor: pointer;
    outline: none;
  }

  ha-card:focus-visible {
    box-shadow: 0 0 0 2px var(--primary-color);
  }

  ha-card.glass {
    background: rgba(255, 255, 255, var(--ric-opacity));
    backdrop-filter: blur(var(--ric-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--ric-blur)) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  ha-card.none {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  ha-card.tinted::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--ric-tint);
    opacity: var(--ric-tint-opacity);
    pointer-events: none;
  }

  .icon-wrap {
    position: relative;
    flex: none;
    width: var(--ric-icon-size);
    height: var(--ric-icon-size);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--ric-color) 20%, transparent);
    color: var(--ric-color);
    --mdc-icon-size: calc(var(--ric-icon-size) * 0.47);
  }

  .icon-wrap.unavailable {
    --ric-color: var(--disabled-color, #9e9e9e);
  }

  .badge {
    position: absolute;
    top: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    color: #fff;
    z-index: 1;
    --mdc-icon-size: 12px;
  }

  .badge.lux {
    left: -2px;
  }

  .badge.trend {
    right: -2px;
  }

  .temp,
  .name {
    position: relative;
    font-size: var(--ric-font-size);
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .temp {
    font-weight: 600;
    color: var(--primary-text-color);
  }

  .name {
    color: var(--secondary-text-color);
  }
`;
