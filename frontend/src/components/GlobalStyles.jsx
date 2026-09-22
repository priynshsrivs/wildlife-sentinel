
export default function GlobalStyles() {
return (
<style>{`
* {
box-sizing: border-box;
}

  html, body, #root {
    margin: 0;
    width: 100%;
    min-height: 100%;
    background: #020604;
  }

  body {
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    color: #f8fafc;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  ::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  ::-webkit-scrollbar-track {
    background: #020604;
  }

  ::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 20px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }

  .glass-panel {
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow:
      0 10px 40px rgba(0,0,0,0.18),
      inset 0 1px 0 rgba(255,255,255,0.025);
  }

  .glass-panel:hover {
    border-color: rgba(255,255,255,0.14);
  }

  .ambient-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    pointer-events: none;
    background:
      radial-gradient(
        circle,
        rgba(74,222,128,0.09) 0%,
        rgba(74,222,128,0.035) 35%,
        rgba(0,0,0,0) 70%
      );
    filter: blur(8px);
  }

  .grid-background {
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .leaflet-container {
    background: #d9e2d7;
    font-family: inherit;
  }

  /* Direct OpenStreetMap tiles — no API key required. */
  .sentinel-map .leaflet-tile-pane {
    filter: brightness(.72) saturate(.72) contrast(1.06);
  }

  .sentinel-map .leaflet-control-zoom {
    border: 0 !important;
    box-shadow: 0 8px 24px rgba(0,0,0,.28) !important;
  }

  .sentinel-map .leaflet-control-zoom a {
    background: rgba(8,15,11,.94) !important;
    color: #f8fafc !important;
    border-color: rgba(255,255,255,.10) !important;
  }

  .sentinel-map .leaflet-control-zoom a:hover {
    background: #102019 !important;
  }

  .sentinel-map .leaflet-control-attribution {
    background: rgba(3,8,5,.82) !important;
    color: #94a3b8 !important;
    backdrop-filter: blur(8px);
  }

  .sentinel-map .leaflet-control-attribution a {
    color: #cbd5e1 !important;
  }

  .leaflet-popup-content-wrapper,
  .leaflet-popup-tip {
    background: #0a1118;
    color: #fff;
  }

  .leaflet-popup-content {
    margin: 12px 14px;
  }

  .pulse-ring {
    animation: pulseRing 1.6s infinite;
  }

  @keyframes pulseRing {
    0% {
      transform: scale(0.8);
      opacity: 0.8;
    }
    70% {
      transform: scale(1.8);
      opacity: 0;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  .scan-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      #4ade80,
      transparent
    );
    box-shadow: 0 0 18px #4ade80;
    animation: scanLine 2.2s linear infinite;
    z-index: 20;
  }

  @keyframes scanLine {
    0% {
      top: 0%;
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      top: 100%;
      opacity: 0;
    }
  }

  .danger-pulse {
    animation: dangerPulse 1.4s infinite;
  }

  @keyframes dangerPulse {
    0%, 100% {
      box-shadow: 0 0 0 rgba(239,68,68,0);
    }
    50% {
      box-shadow: 0 0 30px rgba(239,68,68,0.25);
    }
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Full-bleed threat/animal slider */
  .threat-slide-inner {
    position: relative;
    z-index: 2;
    min-height: 360px;
    height: 360px;
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: 15px;
  }

  .threat-slide-copy {
    position: relative;
    z-index: 5;
    width: min(650px, 68%);
    max-width: 650px;
    padding: 34px 34px 78px;
  }

  .threat-slide-image-wrap {
    position: absolute;
    inset: 0;
    z-index: 0;
    height: 100%;
    border-radius: 15px;
    overflow: hidden;
    border: 0;
    background: #07100b;
    box-shadow: none;
    pointer-events: none;
  }

  .threat-slide-image-wrap::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    background:
      linear-gradient(
        90deg,
        rgba(2, 6, 4, .88) 0%,
        rgba(2, 6, 4, .66) 28%,
        rgba(2, 6, 4, .28) 58%,
        rgba(2, 6, 4, .10) 100%
      ),
      linear-gradient(
        0deg,
        rgba(2, 6, 4, .74) 0%,
        rgba(2, 6, 4, .10) 48%,
        rgba(2, 6, 4, .18) 100%
      );
    pointer-events: none;
  }

  .threat-slide-image-wrap::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    background:
      radial-gradient(
        circle at 72% 48%,
        rgba(255,255,255,.06),
        transparent 42%
      ),
      linear-gradient(
        135deg,
        rgba(255,255,255,.04),
        transparent 28%,
        transparent 72%,
        rgba(0,0,0,.16)
      );
    pointer-events: none;
  }

  .threat-slide-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center center;
    transform: scale(1.025);
    filter: saturate(.96) contrast(1.04);
  }

  .threat-slide-image-badge {
    position: absolute;
    right: 22px;
    top: 20px;
    z-index: 4;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(2,6,4,.54);
    border: 1px solid rgba(255,255,255,.14);
    color: #f8fafc;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .13em;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0,0,0,.18);
  }

  .threat-slide-shell {
    position: relative;
    min-height: 360px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.11);
    background: #07100b;
    box-shadow:
      0 22px 65px rgba(0,0,0,.28),
      inset 0 1px 0 rgba(255,255,255,.045);
    isolation: isolate;
  }

  .threat-slide-shell::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 8;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.035);
  }

  .threat-slide-content {
    position: relative;
    z-index: 6;
    min-height: 360px;
    height: 360px;
  }

  .threat-slider-container {
    position: relative;
    min-height: 360px;
    margin-bottom: 22px;
  }

    @media (max-width: 1100px) {
    .desktop-sidebar {
      width: 82px !important;
    }

    .sidebar-label {
      display: none !important;
    }

    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }

    .threat-slide-inner {
      min-height: 360px;
      height: 360px;
    }

    .threat-slide-copy {
      width: min(72%, 620px);
      padding: 30px 30px 76px;
    }

    .threat-slide-image-badge {
      right: 18px;
      top: 17px;
    }
  }

  @media (max-width: 750px) {
    .threat-slider-container {
      min-height: 430px;
    }

    .desktop-sidebar {
      display: none !important;
    }

    .main-content {
      padding: 20px !important;
    }

    .dashboard-grid {
      grid-template-columns: 1fr !important;
    }

    .analytics-grid {
      grid-template-columns: 1fr !important;
    }

    .camera-grid {
      grid-template-columns: 1fr !important;
    }

    .threat-slide-inner {
      min-height: 430px;
      height: 430px;
    }

    .threat-slide-copy {
      width: 100%;
      max-width: 100%;
      padding: 28px 22px 82px;
    }

    .threat-slide-content {
      min-height: 430px;
      height: 430px;
    }

    .threat-slide-image-badge {
      right: 14px;
      top: 14px;
      font-size: 8px;
    }
  }
`}</style>

);
}

/* =========================================================
SMALL UI HELPERS
========================================================= */

