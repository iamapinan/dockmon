import base64

with open('/Users/apinan/Developments/dockmon/assets/dashboard_screen.png', 'rb') as f:
    dash_b64 = base64.b64encode(f.read()).decode('utf-8')

with open('/Users/apinan/Developments/dockmon/assets/system_charts_screen.png', 'rb') as f:
    charts_b64 = base64.b64encode(f.read()).decode('utf-8')

html_content = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>DockMon Facebook Banner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}
  body {{
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background: #08090d;
    color: #f1f3f9;
    font-family: 'Plus Jakarta Sans', 'IBM Plex Sans Thai', sans-serif;
    position: relative;
    display: flex;
    align-items: center;
  }}

  /* Ambient Mesh Gradients */
  .glow-1 {{
    position: absolute;
    top: -150px;
    left: -100px;
    width: 650px;
    height: 650px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.18) 0%, transparent 65%);
    filter: blur(60px);
    pointer-events: none;
  }}
  .glow-2 {{
    position: absolute;
    bottom: -150px;
    right: 200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 65%);
    filter: blur(60px);
    pointer-events: none;
  }}

  /* Micro Grid Pattern */
  .grid-pattern {{
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.85) 40%, transparent 90%);
    pointer-events: none;
  }}

  .container {{
    position: relative;
    z-index: 10;
    width: 1200px;
    height: 630px;
    padding: 56px 64px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 48px;
  }}

  /* Left Column: Brand & Copy */
  .left-col {{
    flex: 0 0 460px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }}

  .brand-pill {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(37, 99, 235, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.28);
    color: #60a5fa;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin-bottom: 20px;
    width: fit-content;
  }}
  .brand-pill svg {{
    width: 16px;
    height: 16px;
  }}

  .title-group {{
    margin-bottom: 16px;
  }}
  .logo-title {{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }}
  .logo-title h1 {{
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #ffffff;
    line-height: 1;
  }}
  .tagline {{
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
    color: #cbd5e1;
    margin-bottom: 12px;
  }}
  .thai-desc {{
    font-size: 15px;
    line-height: 1.5;
    color: #94a3b8;
    margin-bottom: 24px;
  }}

  .feature-list {{
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 32px;
  }}
  .feature-item {{
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }}
  .feature-icon {{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #38bdf8;
    font-size: 13px;
  }}

  .meta-badges {{
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: #64748b;
  }}
  .meta-tag {{
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #94a3b8;
  }}
  .meta-status {{
    display: flex;
    align-items: center;
    gap: 6px;
    color: #34d399;
  }}
  .status-dot {{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  }}

  /* Right Column: High-End Browser Frame Mockup */
  .right-col {{
    flex: 1;
    height: 500px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }}

  .mockup-window {{
    width: 620px;
    height: 480px;
    background: #10121a;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
      0 24px 60px -12px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 8px 30px rgba(37, 99, 235, 0.12);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: perspective(1000px) rotateY(-4deg) rotateX(2deg);
    transition: transform 0.3s ease;
  }}

  .mockup-header {{
    height: 38px;
    background: #151822;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 14px;
  }}
  .window-dots {{
    display: flex;
    gap: 7px;
  }}
  .dot {{
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }}
  .dot-red {{ background: #ff5f56; }}
  .dot-yellow {{ background: #ffbd2e; }}
  .dot-green {{ background: #27c93f; }}

  .url-bar {{
    flex: 1;
    height: 24px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: #94a3b8;
    max-width: 320px;
    margin: 0 auto;
  }}
  .url-bar span {{
    color: #34d399;
    margin-right: 5px;
  }}

  .mockup-body {{
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #090a0f;
  }}
  .mockup-body img {{
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
    object-position: top center;
  }}
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="grid-pattern"></div>

  <div class="container">
    <!-- Left Copy & Features -->
    <div class="left-col">
      <div class="brand-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        Self-Hosted Infrastructure
      </div>

      <div class="title-group">
        <div class="logo-title">
          <svg viewBox="0 0 32 32" width="38" height="38" fill="none" stroke="#f8fafc" stroke-width="2">
            <path d="M16 3L4 9.5v13L16 29l12-6.5v-13L16 3z" fill="rgba(255,255,255,0.08)" />
            <path d="M16 3v13M16 16L4 9.5M16 16l12-6.5M16 16v13" />
            <circle cx="16" cy="16" r="3" fill="#38bdf8" />
          </svg>
          <h1>DockMon</h1>
        </div>
        <div class="tagline">Lightweight Server &amp; Docker Monitoring</div>
        <div class="thai-desc">มอนิเตอร์เซิร์ฟเวอร์แบบ Real-time พร้อมฟังก์ชันจัดการ Docker คอนเทนเนอร์ &amp; Cloudflare ครบจบในที่เดียว</div>
      </div>

      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon">⚡</div>
          <span>Multi-Server Telemetry (CPU, RAM, Disk, Network)</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🐳</div>
          <span>Docker Lifecycle (Restart, Stop, Start &amp; Shiki Logs)</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🌐</div>
          <span>Cloudflare DNS Connect &amp; Domain Traffic Mapping</span>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🔒</div>
          <span>Zero-Trust Agent Auth • Ultra-Low CPU Footprint</span>
        </div>
      </div>

      <div class="meta-badges">
        <div class="meta-status">
          <span class="status-dot"></span>
          <span>v0.21.1 Live</span>
        </div>
        <div class="meta-tag">Open Source</div>
        <div class="meta-tag">github.com/iamapinan/dockmon</div>
      </div>
    </div>

    <!-- Right Screen Mockup -->
    <div class="right-col">
      <div class="mockup-window">
        <div class="mockup-header">
          <div class="window-dots">
            <div class="dot dot-red"></div>
            <div class="dot dot-yellow"></div>
            <div class="dot dot-green"></div>
          </div>
          <div class="url-bar">
            <span>🔒</span>https://dockmon.vm.gracer.ai
          </div>
        </div>
        <div class="mockup-body">
          <img src="data:image/png;base64,{charts_b64}" alt="DockMon System Dashboard" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

with open('/Users/apinan/Developments/dockmon/assets/facebook_post_banner.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print('Banner HTML generated successfully!')
