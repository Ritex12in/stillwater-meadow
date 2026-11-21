// Small pictures of the things you carry, drawn for the backpack's grid (24 x 24, SVG). Each takes
// the colour the item has (a flower's, a fish's) where it has one.
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  rod: () => svg('<path d="M4 21 L19 3" stroke="#8a5a34" stroke-width="1.8" stroke-linecap="round"/><path d="M19 3 C22 9 21 14 17 18" stroke="#e9e2d6" stroke-width="0.8" fill="none"/><circle cx="7.5" cy="17" r="2.2" fill="#3b3b3b" stroke="#c9c2b6" stroke-width="0.8"/><circle cx="17" cy="18.5" r="1" fill="#e85a4f"/>'),
  cone: () => svg('<ellipse cx="12" cy="13" rx="5" ry="7.5" fill="#7a4f2c"/><path d="M7.5 10 L16.5 10 M7 13 L17 13 M7.5 16 L16.5 16 M9 7.5 L15 7.5" stroke="#4e3119" stroke-width="1"/><path d="M12 5.5 L12 3" stroke="#5a7a3a" stroke-width="1.4" stroke-linecap="round"/>'),
  fish: (c = '#7d9a8a') => svg(`<path d="M3 12 C7 6 14 6 18 12 C14 18 7 18 3 12 Z" fill="${c}"/><path d="M17.5 12 L22 7.5 L22 16.5 Z" fill="${c}"/><circle cx="7" cy="11" r="1.1" fill="#1d1d1d"/><path d="M10 9.5 C11.5 11 11.5 13 10 14.5" stroke="rgba(0,0,0,0.25)" stroke-width="0.9" fill="none"/>`),
  flower: (c = '#f3a6c4') => svg(`<path d="M12 13 L12 22" stroke="#4f7a36" stroke-width="1.6"/><path d="M12 18 C9 16 8 17 7.5 18.5 C9 19 10.5 19 12 18" fill="#5e8f3e"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.2" rx="2.6" ry="3.6" fill="${c}" transform="rotate(${a} 12 9.8)"/>`).join('')}<circle cx="12" cy="9.8" r="1.8" fill="#f2c230"/>`),
  bouquet: (cs = ['#f3a6c4', '#f3d36a', '#56c3d6']) => svg(`<path d="M7 13 L12 22.5 L17 13 Z" fill="#f2e6cf" stroke="#cdbb98" stroke-width="0.7"/>${cs.slice(0, 5).map((c, i) => { const p = [[12, 7], [8.5, 9.5], [15.5, 9.5], [10, 12], [14, 12]][i]; return `<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="${c}"/>`; }).join('')}`),
};
