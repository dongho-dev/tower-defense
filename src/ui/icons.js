// 인라인 SVG 아이콘 (24×24 뷰박스, currentColor). 외부 이미지 없이 선명하게.
const svg = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;

export const ICONS = {
    ranger: svg(
        '<path d="M4 20 L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6 L19.5 2.5 L21.5 4.5 Z M15 3 L21 9" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20 L3 17 M4 20 L7 21 M6 18 L4.5 15.5 M6 18 L8.5 19.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    ember: svg(
        '<path d="M12 2.5c1 3.2 4.8 5.2 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.2 1-3.6 2.2-4.8.2 1.6.9 2.6 1.9 3C10.6 8 11 5 12 2.5Z" fill="currentColor"/><path d="M12 13.5c.7 1.2 2 1.8 2 3.4a2 2 0 0 1-4 0c0-1 .6-1.7 1.2-2.2.2.4.5.7.8.8Z" fill="#fff4" />'
    ),
    frost: svg(
        '<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M12 5.5l-2-2M12 5.5l2-2M12 18.5l-2 2M12 18.5l2 2M5.8 8.4l-2.7.7M5.8 8.4l-.7-2.7M18.2 15.6l2.7-.7M18.2 15.6l.7 2.7M5.8 15.6l-.7 2.7M5.8 15.6l-2.7-.7M18.2 8.4l.7-2.7M18.2 8.4l2.7.7"/></g>'
    ),
    storm: svg(
        '<path d="M13.5 2 L5 13.5 h5.5 L9 22 L19 9.5 h-5.8 Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'
    ),
    grunt: svg(
        '<path d="M6 11c0-3.9 2.7-6.5 6-6.5s6 2.6 6 6.5v5.5l-2 3H8l-2-3Z" fill="currentColor"/><path d="M6.5 7 L3 3.5 L5 9 M17.5 7 L21 3.5 L19 9" fill="currentColor"/><circle cx="9.5" cy="12.5" r="1.4" fill="#ffd24a"/><circle cx="14.5" cy="12.5" r="1.4" fill="#ffd24a"/>'
    ),
    stalker: svg(
        '<path d="M3 13 L7 6 L9.5 10 L14.5 10 L17 6 L21 13 L17.5 19 H6.5 Z" fill="currentColor"/><circle cx="9" cy="14" r="1.2" fill="#ffd24a"/><circle cx="15" cy="14" r="1.2" fill="#ffd24a"/>'
    ),
    ironclad: svg(
        '<path d="M12 2.5 L20 5.5 V11c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V5.5Z" fill="currentColor"/><path d="M8.5 11h7" stroke="#ff3fd0" stroke-width="1.8" stroke-linecap="round"/>'
    ),
    wraith: svg(
        '<path d="M12 2.5c4 0 6.5 3 6.5 7v11l-2.2-1.6-2.1 1.6-2.2-1.6-2.1 1.6-2.2-1.6L5.5 20.5v-11c0-4 2.5-7 6.5-7Z" fill="currentColor"/><circle cx="9.7" cy="10" r="1.4" fill="#7dfff0"/><circle cx="14.3" cy="10" r="1.4" fill="#7dfff0"/>'
    ),
    hexcaller: svg(
        '<path d="M7 21 L10 9 H14 L17 21 Z" fill="currentColor"/><circle cx="12" cy="6.5" r="3" fill="currentColor"/><path d="M19 3v18" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="3.5" r="2" fill="#6dff9a"/>'
    ),
    colossus: svg(
        '<path d="M4 9 L7 3 L9.5 7 L12 2 L14.5 7 L17 3 L20 9 V15c0 3.5-3.5 6.5-8 6.5S4 18.5 4 15Z" fill="currentColor"/><path d="M8 13 L10.5 14 M16 13 L13.5 14" stroke="#ff3fd0" stroke-width="2" stroke-linecap="round"/><path d="M9 18h6" stroke="#ff3fd0" stroke-width="1.5"/>'
    ),
    meteor: svg(
        '<circle cx="15.5" cy="15.5" r="5" fill="currentColor"/><path d="M11.5 12 L3 3.5 M13.5 10 L8 2.5 M10 14 L2.5 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".75"/><circle cx="14" cy="14" r="1.5" fill="#fff6"/>'
    ),
    freeze: svg(
        '<path d="M12 2 L14.5 8 L21 9 L16 13.5 L17.5 20.5 L12 17 L6.5 20.5 L8 13.5 L3 9 L9.5 8 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 7v10M8 12h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    life: svg(
        '<path d="M12 2 L18 9 L12 22 L6 9 Z" fill="currentColor"/><path d="M12 2 L12 22 M6 9 H18" stroke="#0004" stroke-width="1"/><path d="M12 2 L9 9 L12 22" fill="#fff3"/>'
    ),
    gold: svg(
        '<ellipse cx="12" cy="15" rx="8" ry="4" fill="currentColor" opacity=".7"/><ellipse cx="12" cy="11.5" rx="8" ry="4" fill="currentColor"/><ellipse cx="12" cy="11.5" rx="5" ry="2.2" fill="none" stroke="#0005" stroke-width="1"/>'
    ),
    wave: svg(
        '<path d="M5 21V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 4 C9 2 12 6 19 4 V13 C12 15 9 11 5 13 Z" fill="currentColor"/>'
    ),
    upgrade: svg('<path d="M12 4 L19 12 H15 V20 H9 V12 H5 Z" fill="currentColor"/>'),
    sell: svg(
        '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14.8 8.8c-.6-.9-1.6-1.3-2.8-1.3-1.7 0-2.8.9-2.8 2.2 0 3 5.7 1.7 5.7 4.6 0 1.3-1.2 2.3-2.9 2.3-1.3 0-2.4-.5-3-1.4M12 6v1.5M12 16.5V18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    target: svg(
        '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    ),
    close: svg('<path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    play: svg('<path d="M7 4.5 L19 12 L7 19.5 Z" fill="currentColor"/>'),
    fast: svg('<path d="M3 5 L12 12 L3 19 Z M12 5 L21 12 L12 19 Z" fill="currentColor"/>'),
    pause: svg(
        '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor"/>'
    ),
    gear: svg(
        '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    ),
    sound: svg(
        '<path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor"/><path d="M16 8.5c1.2 1 1.8 2.2 1.8 3.5S17.2 14.5 16 15.5M18.5 6c2 1.6 3 3.6 3 6s-1 4.4-3 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
    ),
    mute: svg(
        '<path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor"/><path d="M16.5 9 L21.5 15 M21.5 9 L16.5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    ),
    star: svg(
        '<path d="M12 2.8 L14.8 8.7 L21.2 9.4 L16.4 13.8 L17.8 20.2 L12 16.9 L6.2 20.2 L7.6 13.8 L2.8 9.4 L9.2 8.7 Z" fill="currentColor"/>'
    ),
    skull: svg(
        '<path d="M12 2.5c-4.7 0-8 3.3-8 7.8 0 2.7 1.3 4.6 3 5.8V19h2.3v-2h1.4v2h2.6v-2h1.4v2H17v-2.9c1.7-1.2 3-3.1 3-5.8 0-4.5-3.3-7.8-8-7.8Z" fill="currentColor"/><circle cx="8.8" cy="11" r="2" fill="#1b1529"/><circle cx="15.2" cy="11" r="2" fill="#1b1529"/>'
    ),
    physical: svg(
        '<path d="M4 20 L16 8 M14 4 L20 10 L17 13 L11 7 Z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/>'
    ),
    magic: svg('<path d="M12 2 L13.8 9.2 L21 12 L13.8 14.8 L12 22 L10.2 14.8 L3 12 L10.2 9.2 Z" fill="currentColor"/>')
};

export const TOWER_TINT = {
    ranger: '#f2c46b',
    ember: '#ff7a3d',
    frost: '#8fe3ff',
    storm: '#b890ff'
};
