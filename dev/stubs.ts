// Dev-only stand-ins for Home Assistant's <ha-card> and <ha-icon>.
import * as mdi from '@mdi/js';

class HaCard extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:block;background:var(--ha-card-background,#fff);border-radius:12px}</style><slot></slot>';
  }
}

class HaIcon extends HTMLElement {
  private _icon = '';
  set icon(name: string) {
    this._icon = name;
    const key = 'mdi' + name.replace(/^mdi:/, '').replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
    const path = (mdi as Record<string, string>)[key] ?? '';
    this.innerHTML = `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);display:block;fill:currentColor"><path d="${path}"/></svg>`;
  }
  get icon() {
    return this._icon;
  }
}

customElements.define('ha-card', HaCard);
customElements.define('ha-icon', HaIcon);
