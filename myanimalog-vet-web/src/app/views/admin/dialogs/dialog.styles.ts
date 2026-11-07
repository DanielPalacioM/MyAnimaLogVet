/** Marco común de los diálogos de administración (Figma 2192:300 y 2192:483): 520 px, radio 16, título de 20 px. */
export const ADMIN_DIALOG_STYLES = `
  :host { display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; width: min(520px, 94vw); padding: 26px 28px; font-family: 'Afacad', sans-serif; color: #1a1a2e; }
  h2 { margin: 0; font: 700 20px/1.3 'Afacad', sans-serif; }
  .lead { margin: 0; color: #4a4860; font: 500 13px/1.4 'Afacad', sans-serif; }
  .label { margin: 0; color: #8a8a9a; font: 700 12px/1.3 'Afacad', sans-serif; letter-spacing: 0; text-transform: uppercase; }
  .options { display: flex; flex-direction: column; gap: 12px; }
  .opt { display: flex; align-items: center; gap: 12px; cursor: pointer; font: 500 14px/1.3 'Afacad', sans-serif; }
  .opt input { position: absolute; opacity: 0; pointer-events: none; }
  .opt .txt { font-weight: 500; }
  .opt input:checked ~ .txt { font-weight: 700; }
  .box { display: grid; flex: none; place-items: center; box-sizing: border-box; width: 20px; height: 20px; border: 2px solid #000; border-radius: 4px; background: #fff; color: #fff; font: 700 14px/1 'Afacad', sans-serif; }
  .opt input:checked ~ .box { border-color: #4037be; background: #4037be; }
  .opt input:checked ~ .box::after { content: '✓'; }
  .radio { display: grid; flex: none; place-items: center; box-sizing: border-box; width: 20px; height: 20px; border: 2px solid #000; border-radius: 50%; background: #fff; }
  .opt input:checked ~ .radio { border-color: #4037be; }
  .opt input:checked ~ .radio::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: #4037be; }
  .opt input:focus-visible ~ .box, .opt input:focus-visible ~ .radio { outline: 2px solid #4037be; outline-offset: 2px; }
  textarea { box-sizing: border-box; width: 100%; height: 96px; padding: 12px 14px; border: 2px solid #000; border-radius: 5px; background: #fff; resize: none; color: #1a1a2e; font: 500 14px/1.35 'Afacad', sans-serif; }
  textarea:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
  .count { margin: -8px 0 0; color: #8a8a9a; font: 500 12px/1.3 'Afacad', sans-serif; }
  .warn { margin: 0; padding: 10px 14px; border-radius: 8px; background: #fef3f2; color: #b42318; font: 700 12px/1.35 'Afacad', sans-serif; }
  .error { margin: 0; color: #b42318; font: 700 13px/1.3 'Afacad', sans-serif; }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
  .btn { padding: 10px 18px; border: 2px solid #4037be; border-radius: 5px; background: #4037be; color: #fff; font: 700 14px/1.2 'Afacad', sans-serif; cursor: pointer; }
  .btn--ghost { border-color: #000; background: #fff; color: #1a1a2e; }
  .btn--danger { border-color: #b42318; background: #b42318; }
  .btn:disabled { opacity: 0.6; cursor: default; }
  .btn:focus-visible { outline: 2px solid #4037be; outline-offset: 2px; }
`;
