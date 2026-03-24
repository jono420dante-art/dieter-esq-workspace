/* HD SVG Icon System — Crisp vector icons at any resolution */

const SVG_PATHS = {
  // ═══ NAVIGATION ═══
  home: '<path d="M3 9.5L12 2l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  lyrics: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  waveform: '<path d="M2 13h2l2-5 2 10 2-7 2 4 2-8 2 12 2-6 2 3 2-4h2"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  newspaper: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',

  // ═══ TRANSPORT ═══
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  stop: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  skipForward: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  skipBack: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',

  // ═══ ACTIONS ═══
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  heartFilled: '<path fill="currentColor" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  starFilled: '<polygon fill="currentColor" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  barChart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  disc: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
  package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  volumeUp: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',

  // ═══ PLATFORM LOGOS (simplified HD vectors) ═══
  spotify: '<circle cx="12" cy="12" r="10" fill="#1DB954" stroke="none"/><path d="M16.5 8.5c-2.7-1.2-7-1.3-9.5-.5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M15.8 11.2c-2.2-1-5.8-1.1-7.8-.4" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M15 13.8c-1.8-.8-4.5-.9-6.3-.3" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  apple: '<circle cx="12" cy="12" r="10" fill="#fc3c44" stroke="none"/><path d="M15.5 8.5c-.7-.8-1.8-1-2.5-.8-.4.1-1 .4-1 .4s-.6-.3-1-.4c-.7-.2-1.8 0-2.5.8-1.1 1.3-.9 3.3.4 5.2.6.9 1.4 1.9 2.4 1.9h.1c.3 0 .5-.1.6-.1.1 0 .3.1.6.1h.1c1 0 1.8-1 2.4-1.9 1.3-1.9 1.5-3.9.4-5.2z" fill="#fff" stroke="none"/><path d="M12.5 7c.5-.6 1.3-1 2-1" stroke="#fff" stroke-width=".8" fill="none" stroke-linecap="round"/>',
  youtube: '<rect x="2" y="4.5" width="20" height="15" rx="4" fill="#FF0000" stroke="none"/><polygon points="10 8.5 16 12 10 15.5" fill="#fff" stroke="none"/>',
  napster: '<circle cx="12" cy="12" r="10" fill="#0099FF" stroke="none"/><path d="M7 15v-3c0-2.8 2.2-5 5-5s5 2.2 5 5v3" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="5.5" y="13" width="3" height="4" rx="1" fill="#fff" stroke="none"/><rect x="15.5" y="13" width="3" height="4" rx="1" fill="#fff" stroke="none"/>',
  tidal: '<circle cx="12" cy="12" r="10" fill="#000" stroke="none"/><path d="M12 7l3 3-3 3-3-3zM8 11l3 3-3 3-3-3zM16 11l3 3-3 3-3-3z" fill="#fff" stroke="none"/>',
  soundcloud: '<circle cx="12" cy="12" r="10" fill="#FF5500" stroke="none"/><path d="M6 14v-3M8 14v-4M10 14v-5M12 14v-4M14 14v-3M16 14v-4M18 14v-2" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>',
  amazon: '<circle cx="12" cy="12" r="10" fill="#00A8E1" stroke="none"/><path d="M7 13c1.5 1.5 3.5 2.5 5.5 2.5s3.5-.8 4.5-1.5" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M16 14l1-1.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>',
  deezer: '<circle cx="12" cy="12" r="10" fill="#A238FF" stroke="none"/><rect x="6" y="13" width="3" height="2" rx=".5" fill="#fff"/><rect x="10.5" y="10" width="3" height="5" rx=".5" fill="#fff"/><rect x="15" y="8" width="3" height="7" rx=".5" fill="#fff"/>',
  tiktok: '<circle cx="12" cy="12" r="10" fill="#010101" stroke="none"/><path d="M15 7.5c.8.5 1.7.8 2.5.8v2.5c-.9 0-1.7-.2-2.5-.6v4.3c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4v2.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5V7.5h2z" fill="#fff" stroke="none"/>',

  // ═══ SOCIAL MEDIA LOGOS (real brand colors + shapes) ═══
  instagram: '<defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".25" stop-color="#fa7e1e"/><stop offset=".5" stop-color="#d62976"/><stop offset=".75" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)" stroke="none"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3.2" stroke="#fff" stroke-width="1.5" fill="none"/><circle cx="17" cy="7" r="1" fill="#fff" stroke="none"/>',
  facebook: '<rect width="24" height="24" rx="5" fill="#1877F2" stroke="none"/><path d="M16.5 3H14c-1.7 0-3 1.3-3 3v2H9v3h2v8h3v-8h2.5l.5-3h-3V6.5c0-.3.2-.5.5-.5h2V3z" fill="#fff" stroke="none"/>',
  twitter: '<rect width="24" height="24" rx="5" fill="#000" stroke="none"/><path d="M13.8 10.5L19.2 4h-1.3l-4.7 5.6L9.4 4H4l5.7 8.3L4 19.5h1.3l5-5.8 4 5.8H20l-6.2-9zm-1.8 2l-.6-.8L6 5.2h2l3.7 5.3.6.8 4.8 6.8h-2l-3.9-5.6z" fill="#fff" stroke="none"/>',
  threads: '<rect width="24" height="24" rx="5" fill="#000" stroke="none"/><path d="M15.2 11.8c-.1 0-.2 0-.3-.1-.4-2.2-1.6-3.4-3.3-3.3-1 0-1.9.5-2.4 1.3l1.3.8c.3-.5.8-.7 1.2-.7.9 0 1.4.6 1.5 1.7-1.5-.2-3.8.2-3.8 2.3 0 1.3 1 2.2 2.4 2.2 1.1 0 1.9-.5 2.3-1.5.3.9 1 1.4 2 1.4v-1.4c-.5 0-.8-.3-.9-.9v-1.8zm-2.8 2.7c-.6 0-1-.4-1-.9 0-1 1-1.2 2.2-1v.5c0 .8-.5 1.4-1.2 1.4z" fill="#fff" stroke="none"/>',
  snapchat: '<rect width="24" height="24" rx="5" fill="#FFFC00" stroke="none"/><path d="M12 5c-1.7 0-3.3 1.2-3.5 3.5l-.1 1.8c-1-.2-1.6 0-1.7.5-.1.5.4.8 1.1 1.1-.6 1.4-1.6 2.3-2.7 2.7-.3.1-.3.5.1.6 1 .4 2 .5 2.3.9.1.2 0 .6.3.7.3.1.9-.2 1.7-.2.7 0 1.2.5 2.5.5s1.8-.5 2.5-.5c.8 0 1.4.3 1.7.2.3-.1.2-.5.3-.7.3-.4 1.3-.5 2.3-.9.4-.1.4-.5.1-.6-1.1-.4-2.1-1.3-2.7-2.7.7-.3 1.2-.6 1.1-1.1-.1-.5-.7-.7-1.7-.5l-.1-1.8C15.3 6.2 13.7 5 12 5z" fill="#000" stroke="none"/>',
  pinterest: '<circle cx="12" cy="12" r="11" fill="#E60023" stroke="none"/><path d="M12 5.5c-3.6 0-5.5 2.6-5.5 4.7 0 1.3.5 2.5 1.5 2.9.2.1.3 0 .4-.2l.1-.5c.1-.2 0-.3-.1-.5-.3-.4-.5-.9-.5-1.6 0-2.1 1.6-4 4.1-4 2.3 0 3.5 1.4 3.5 3.2 0 2.4-1.1 4.5-2.7 4.5-.9 0-1.5-.7-1.3-1.6.3-1 .8-2.1.8-2.9 0-.7-.4-1.2-1.1-1.2-.9 0-1.6.9-1.6 2.2 0 .8.3 1.3.3 1.3l-1 4.4c-.3 1.3 0 2.8.1 3 0 .1.1.1.2 0 .1-.1 1.2-1.5 1.6-2.9l.6-2.3c.3.6 1.2 1.1 2.1 1.1 2.8 0 4.7-2.5 4.7-5.9C17.7 7.7 15.3 5.5 12 5.5z" fill="#fff" stroke="none"/>',
  linkedin: '<rect width="24" height="24" rx="4" fill="#0A66C2" stroke="none"/><path d="M6 10h2.5v8H6zM7.2 6c.9 0 1.5.6 1.5 1.4s-.6 1.4-1.5 1.4c-.8 0-1.4-.6-1.4-1.4S6.4 6 7.2 6zM10 10h2.4v1.1c.3-.6 1.2-1.4 2.4-1.4 2.5 0 3 1.7 3 3.8V18h-2.5v-3.9c0-.9 0-2.2-1.3-2.2-1.3 0-1.5 1-1.5 2.1V18H10V10z" fill="#fff" stroke="none"/>',
  reddit: '<circle cx="12" cy="12" r="11" fill="#FF4500" stroke="none"/><circle cx="12" cy="13" r="5.5" fill="#fff" stroke="none"/><circle cx="9.5" cy="12.5" r="1.2" fill="#FF4500" stroke="none"/><circle cx="14.5" cy="12.5" r="1.2" fill="#FF4500" stroke="none"/><path d="M9.5 15c.3.5 1.3 1 2.5 1s2.2-.5 2.5-1" stroke="#FF4500" stroke-width=".8" fill="none" stroke-linecap="round"/><circle cx="17.5" cy="7" r="1.3" fill="#fff" stroke="none"/><path d="M14 5.5c0-1.4 1.1-2.5 2.5-2.5" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/><ellipse cx="18" cy="8.5" rx="2.2" ry="2" fill="#fff" stroke="none"/><circle cx="18" cy="8.5" r="1.5" fill="#FF4500" stroke="none"/>',
  discord: '<rect width="24" height="24" rx="5" fill="#5865F2" stroke="none"/><path d="M17.2 7.5c-1-.5-2.1-.8-3.2-1l-.2.4c1 .2 2 .7 2.9 1.2-1.2-.6-2.6-1-4.7-1s-3.5.4-4.7 1c.9-.5 1.8-1 2.9-1.2l-.2-.4c-1.1.2-2.2.5-3.2 1C5 10.7 4.4 13.8 4.7 16.8c1.2.9 2.4 1.5 3.5 1.8l.5-.6c-.5-.2-1-.4-1.5-.7l.2-.2c2.4 1.1 5 1.1 7.4 0l.2.2c-.5.3-1 .5-1.5.7l.5.6c1.1-.3 2.3-.9 3.5-1.8.3-3.5-.6-6.5-2.3-9.3zM9.5 15c-.7 0-1.3-.7-1.3-1.5S8.8 12 9.5 12s1.3.7 1.3 1.5-.6 1.5-1.3 1.5zm5 0c-.7 0-1.3-.7-1.3-1.5s.6-1.5 1.3-1.5 1.3.7 1.3 1.5-.6 1.5-1.3 1.5z" fill="#fff" stroke="none"/>',
  whatsapp: '<circle cx="12" cy="12" r="11" fill="#25D366" stroke="none"/><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1-.2.3-.6.9-.8 1-.1.2-.3.2-.6 0-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1.1 2.6c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" fill="#fff" stroke="none"/>',
  twitch: '<rect width="24" height="24" rx="5" fill="#9146FF" stroke="none"/><path d="M6 3L4 7v12h4v3h3l3-3h3l5-5V3H6zm12 9l-3 3H11l-3 3v-3H5V5h13v7z" fill="#fff" stroke="none"/><rect x="10" y="7" width="1.5" height="4" rx=".5" fill="#fff" stroke="none"/><rect x="13.5" y="7" width="1.5" height="4" rx=".5" fill="#fff" stroke="none"/>',
  telegram: '<circle cx="12" cy="12" r="11" fill="#2AABEE" stroke="none"/><path d="M5.5 11.5l11.5-4.5c.5-.2 1 .1.8.7l-2 9.5c-.1.5-.5.6-.8.4l-2.5-1.8-1.2 1.2c-.1.1-.3.2-.5.1l.2-2.5 5-4.5c.2-.2 0-.3-.1-.2l-6.2 3.9-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="#fff" stroke="none"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
};

export function icon(name, size = 18, cls = '') {
  const path = SVG_PATHS[name];
  if (!path) return '';
  const isLogo = ['spotify', 'apple', 'youtube', 'napster', 'tidal', 'soundcloud', 'amazon', 'deezer', 'tiktok', 'instagram', 'facebook', 'twitter', 'threads', 'snapchat', 'pinterest', 'linkedin', 'reddit', 'discord', 'whatsapp', 'twitch', 'telegram'].includes(name);
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ${isLogo ? '' : 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${path}</svg>`;
}

export function iconLg(name) { return icon(name, 22, 'icon-lg'); }
export function iconSm(name) { return icon(name, 14, 'icon-sm'); }
export function iconXl(name) { return icon(name, 28, 'icon-xl'); }

export { SVG_PATHS };
