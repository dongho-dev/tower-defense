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
    back: svg(
        '<path d="M14.5 5 L7.5 12 L14.5 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    ),
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
    crown: svg(
        '<path d="M3.5 8 L8 12 L12 4.5 L16 12 L20.5 8 L18.8 18 H5.2 Z" fill="currentColor"/><rect x="5.2" y="19" width="13.6" height="2" rx="1" fill="currentColor"/>'
    ),
    moon: svg(
        '<path d="M15.5 3.2 A9 9 0 1 0 20.8 15.6 A7.2 7.2 0 0 1 15.5 3.2 Z" fill="currentColor"/><circle cx="18.5" cy="5.5" r="1" fill="currentColor"/><circle cx="21" cy="9.5" r="0.7" fill="currentColor"/>'
    ),
    skull: svg(
        '<path d="M12 2.5c-4.7 0-8 3.3-8 7.8 0 2.7 1.3 4.6 3 5.8V19h2.3v-2h1.4v2h2.6v-2h1.4v2H17v-2.9c1.7-1.2 3-3.1 3-5.8 0-4.5-3.3-7.8-8-7.8Z" fill="currentColor"/><circle cx="8.8" cy="11" r="2" fill="#1b1529"/><circle cx="15.2" cy="11" r="2" fill="#1b1529"/>'
    ),
    physical: svg(
        '<path d="M4 20 L16 8 M14 4 L20 10 L17 13 L11 7 Z" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linejoin="round"/>'
    ),
    arcane: svg(
        '<path d="M12 2.5 L17.5 9 L12 21.5 L6.5 9 Z" fill="currentColor" opacity="0.9"/><path d="M6.5 9 H17.5 M12 2.5 V21.5" stroke="#1a1028" stroke-width="1.2" opacity="0.55"/><path d="M18.5 4 L22 2.5 M19 7.5 L22.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    mine: svg(
        '<path d="M3.5 21 L11 13.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5 9.5 C9 4.5 15 4 20 7 C15 7.5 11.5 9.5 9 13 Z" fill="currentColor"/><path d="M15.5 14 L19 12.5 L21.5 15.5 L19.5 20 L15 20.5 L13.5 17 Z" fill="currentColor" opacity="0.75"/>'
    ),
    link: svg(
        '<path d="M10 14 L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 11.5 L6 14 A3.5 3.5 0 0 0 11 19 L13.5 16.5 M15.5 12.5 L18 10 A3.5 3.5 0 0 0 13 5 L10.5 7.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'
    ),
    book: svg(
        '<path d="M4 5 C7 4 10 4.5 12 6 C14 4.5 17 4 20 5 V19 C17 18 14 18.5 12 20 C10 18.5 7 18 4 19 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 6 V20" stroke="currentColor" stroke-width="1.6"/>'
    ),
    magic: svg('<path d="M12 2 L13.8 9.2 L21 12 L13.8 14.8 L12 22 L10.2 14.8 L3 12 L10.2 9.2 Z" fill="currentColor"/>'),
    wall: svg(
        '<path d="M3 9 H21 V20 H3 Z" fill="currentColor" opacity="0.85"/><path d="M3 9 V5 H6.5 V7 H10 V5 H14 V7 H17.5 V5 H21 V9" fill="currentColor"/><path d="M3 14.5 H21 M9 9 V14.5 M15 9 V14.5 M6 14.5 V20 M12 14.5 V20 M18 14.5 V20" stroke="#0b0b14" stroke-width="1.1" opacity="0.55"/>'
    ),
    barracks: svg(
        '<path d="M5 4.5 L19 18.5 M19 4.5 L5 18.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3.5 3 L7 4 L6 7.5 Z M20.5 3 L17 4 L18 7.5 Z" fill="currentColor"/><path d="M12 8.5 L17 10.5 V14c0 3-2.2 5.2-5 6.5-2.8-1.3-5-3.5-5-6.5v-3.5Z" fill="currentColor" stroke="#1b1529" stroke-width="1"/>'
    ),
    shield: svg(
        '<path d="M12 2.5 L20 5.5 V11c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V5.5Z" fill="currentColor"/><path d="M12 5.5 V18.5 M7 10 H17" stroke="#1b1529" stroke-width="1.6" opacity=".6"/>'
    ),
    hero: svg(
        '<path d="M6 12 C6 7 8.5 4 12 4 C15.5 4 18 7 18 12 V18 L15 21 H9 L6 18 Z" fill="currentColor"/><path d="M8 11.5 H16 M12 11.5 V17" stroke="#1b1529" stroke-width="1.8" stroke-linecap="round"/><path d="M12 4 C13 1.5 16.5 1 18.5 2.5 C16.5 3 15 4 14.5 5.5" fill="#ffd24a"/>'
    ),
    sword: svg(
        '<path d="M19.5 3 L21 4.5 L10 15.5 L8.5 14 Z" fill="currentColor"/><path d="M6 12.5 L11.5 18 M7.5 16.5 L3.5 20.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    ),
    repair: svg(
        '<path d="M14.5 3.5 a5 5 0 0 0-5.6 6.6 L3.5 15.5 a2.1 2.1 0 0 0 3 3 L11.9 13.1 a5 5 0 0 0 6.6-5.6 L15.5 10.5 L13 10 L12.5 7.5 Z" fill="currentColor"/>'
    ),
    rally: svg(
        '<path d="M6 21.5 V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 3.5 H18 L15.5 7.5 L18 11.5 H6 Z" fill="currentColor"/><ellipse cx="6" cy="21" rx="4" ry="1.3" fill="currentColor" opacity=".5"/>'
    ),
    cinderling: svg(
        '<path d="M6 12c0-3.7 2.7-6.5 6-6.5s6 2.8 6 6.5v5l-2 3H8l-2-3Z" fill="currentColor"/><path d="M12 1.5c.8 1.6 2.4 2.4 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-.9.5-1.6 1.1-2.1Z" fill="#ff8a3a"/><circle cx="9.5" cy="12.5" r="1.3" fill="#ffb24a"/><circle cx="14.5" cy="12.5" r="1.3" fill="#ffb24a"/><path d="M9 16.5 L15 16.5" stroke="#ff6a1a" stroke-width="1.4"/>'
    ),
    flameborn: svg(
        '<path d="M12 2c1.4 3.4 6 5.4 6 11a6 6 0 0 1-12 0c0-2.8 1.3-4.6 2.8-6 .2 2 1 3.2 2.2 3.7C10.4 7.6 11 4.6 12 2Z" fill="currentColor"/><circle cx="10" cy="14" r="1.3" fill="#ffe08a"/><circle cx="14" cy="14" r="1.3" fill="#ffe08a"/>'
    ),
    magmaLord: svg(
        '<path d="M4 10 L6.5 4 L9 7.5 L12 2.5 L15 7.5 L17.5 4 L20 10 V15c0 3.6-3.6 6.5-8 6.5S4 18.6 4 15Z" fill="currentColor"/><path d="M7 13.5 L10.5 15 M17 13.5 L13.5 15 M8.5 18.5 Q12 16.5 15.5 18.5" stroke="#ff7a26" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
    ),
    rimeguard: svg(
        '<path d="M12 2.5 L20 5.5 V11c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V5.5Z" fill="currentColor"/><path d="M12 6 L13.6 9.5 L12 13 L10.4 9.5 Z M8 11 L16 11" fill="#9fdcff" stroke="#9fdcff" stroke-width="1.4"/>'
    ),
    yeti: svg(
        '<path d="M5 10 C5 5 8 2.5 12 2.5 S19 5 19 10 V16 L21 20 H3 L5 16 Z" fill="currentColor"/><path d="M8 11 L10.5 12 M16 11 L13.5 12" stroke="#7dfff0" stroke-width="1.8" stroke-linecap="round"/><path d="M9 16 L10 14.5 L11 16 L12 14.5 L13 16 L14 14.5 L15 16" stroke="#e8fbff" stroke-width="1.1" fill="none"/>'
    ),
    glacier: svg(
        '<path d="M2.5 20 L7 8 L10 12 L13 3.5 L17 11 L19 8.5 L21.5 20 Z" fill="currentColor"/><path d="M8.5 15.5 L10.5 16.2 M15.5 15.5 L13.5 16.2" stroke="#7dd8ff" stroke-width="1.8" stroke-linecap="round"/><path d="M13 3.5 L12 9 L14.5 7.5" stroke="#e8fbff" stroke-width="1" fill="none" opacity=".8"/>'
    ),
    shade: svg(
        '<path d="M14 4 C9 4 6 8 6 12 L3 20 L8 17 L10 21 L12 17.5 L15 20.5 L16 16 C18.5 14 19.5 11.5 19 8.5 C18.5 5.5 16.5 4 14 4 Z" fill="currentColor"/><circle cx="12.5" cy="10" r="1.3" fill="#ff3fd0"/><circle cx="16" cy="10" r="1.3" fill="#ff3fd0"/><path d="M2 8 H5 M1.5 12 H4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>'
    ),
    splitter: svg(
        '<circle cx="8.5" cy="13" r="6" fill="currentColor"/><circle cx="16" cy="11" r="5" fill="currentColor"/><path d="M12.2 7 L12 19" stroke="#ff3fd0" stroke-width="1.4" stroke-dasharray="2 1.5"/><circle cx="7" cy="12" r="1.1" fill="#ff3fd0"/><circle cx="17" cy="10" r="1.1" fill="#ff3fd0"/>'
    ),
    mite: svg(
        '<circle cx="12" cy="13" r="5.5" fill="currentColor"/><path d="M8 9 L5.5 6 M16 9 L18.5 6 M7 16 L4 18 M17 16 L20 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10.5" cy="12" r="1" fill="#ff3fd0"/><circle cx="13.5" cy="12" r="1" fill="#ff3fd0"/>'
    ),
    riftlord: svg(
        '<path d="M5 9 L8 3 L10.5 7 L12 2 L13.5 7 L16 3 L19 9 V15c0 3.5-3.1 6.5-7 6.5S5 18.5 5 15Z" fill="currentColor"/><path d="M12 9 C10 11 14 13 12 15 C10 17 13 19 12 21" stroke="#ff3fd0" stroke-width="1.6" fill="none"/><circle cx="9" cy="12" r="1.2" fill="#ff3fd0"/><circle cx="15" cy="12" r="1.2" fill="#ff3fd0"/>'
    ),
    bloomer: svg(
        '<circle cx="12" cy="13" r="4" fill="currentColor"/><g fill="#ffb8e8"><circle cx="12" cy="5.5" r="2.6"/><circle cx="18.5" cy="10" r="2.6"/><circle cx="16" cy="18.5" r="2.6"/><circle cx="8" cy="18.5" r="2.6"/><circle cx="5.5" cy="10" r="2.6"/></g><circle cx="12" cy="13" r="2.2" fill="#ffd24a"/>'
    ),
    burrower: svg(
        '<path d="M3 17 C3 11 7 7.5 12 7.5 S21 11 21 17 Z" fill="currentColor"/><path d="M14.5 9.5 L18 7 M16 11 L20 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="16.5" cy="13" r="1.2" fill="#ffd24a"/><path d="M1.5 19.5 H22.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>'
    ),
    thornwood: svg(
        '<path d="M9 21.5 L10 13 L6 9 L9 9.5 L8 4 L12 8 L14 3 L15 9 L19 7 L15.5 13 L15 21.5 Z" fill="currentColor"/><circle cx="10.5" cy="14.5" r="1.1" fill="#6dff9a"/><circle cx="13.5" cy="14.5" r="1.1" fill="#6dff9a"/><path d="M5 12 L3 11 M19 12 L21 11 M7 17 L4.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    ),
    sprout: svg(
        '<path d="M12 21 V11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12 C8 12 5 9.5 5 5.5 C9 5.5 12 8 12 12 Z M12 10.5 C12 7 14.5 4 18.5 4 C18.5 8 16 10.5 12 10.5 Z" fill="currentColor"/>'
    ),
    stormeater: svg(
        '<circle cx="12" cy="12" r="7" fill="currentColor"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2"/><path d="M13 6.5 L9.5 12.5 H12 L11 17.5 L15 11 H12.5 Z" fill="#b890ff"/>'
    ),
    harpy: svg(
        '<path d="M12 9 C9 6 5 5 1.5 6.5 C5 8 7 10 8.5 13 L12 15 L15.5 13 C17 10 19 8 22.5 6.5 C19 5 15 6 12 9 Z" fill="currentColor"/><circle cx="12" cy="9.5" r="2.4" fill="currentColor"/><path d="M10.5 16 L9.5 20 M13.5 16 L14.5 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12.8" cy="9.2" r=".8" fill="#ffd24a"/>'
    ),
    tempest: svg(
        '<path d="M4 9 C4 5 7.5 2.5 12 2.5 S20 5 20 9 V14c0 4-3.6 7.5-8 7.5S4 18 4 14Z" fill="currentColor"/><path d="M13 7 L9.5 13 H12 L11 18 L15 11.5 H12.5 Z" fill="#b890ff"/><path d="M2.5 11 C1 13 2 15 3.5 16 M21.5 11 C23 13 22 15 20.5 16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    )
};

export const TOWER_TINT = {
    ranger: '#f2c46b',
    ember: '#ff7a3d',
    frost: '#8fe3ff',
    storm: '#b890ff',
    arcane: '#ff7ad9',
    mine: '#7fe0a0',
    barracks: '#9fc0ff',
    wall: '#c9d4e6'
};
