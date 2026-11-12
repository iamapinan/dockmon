import base64

with open('/Users/apinan/Developments/dockmon/assets/dashboard_screen.png', 'rb') as f:
    dash_b64 = base64.b64encode(f.read()).decode('utf-8')

square_html = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>DockMon Facebook Square Post</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1200px;
    height: 1200px;
    overflow: hidden;
    background: #08090e;
    color: #f1f3f9;
    font-family: 'Plus Jakarta Sans', 'IBM Plex Sans Thai', sans-serif;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 64px 64px 54px 64px;
  }}

  .glow-1 {{
    position: absolute;
    top: -200px;
    left: -150px;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, transparent 65%);
    filter: blur(80px);
    pointer-events: none;
  }}
  .glow-2 {{
    position: absolute;
    bottom: -150px;
    right: -100px;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, transparent 65%);
    filter: blur(80px);
    pointer-events: none;
  }}
  .grid-pattern {{
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.9) 50%, transparent 95%);
    pointer-events: none;
  }}

  /* Top Section */
  .top-section {{
    position: relative;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }}
  .brand-group {{
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .brand-pill {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 9999px;
    background: rgba(37, 99, 235, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.28);
    color: #60a5fa;
    font-size: 13px;
    font-weight: 600;
    width: fit-content;
  }}
  .logo-title {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .logo-title h1 {{
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #ffffff;
    line-height: 1;
  }}
  .tagline {{
    font-size: 22px;
    font-weight: 700;
    color: #cbd5e1;
    margin-top: 2px;
  }}
  .thai-desc {{
    font-size: 16px;
    color: #94a3b8;
    max-width: 680px;
    line-height: 1.5;
    margin-top: 4px;
  }}

  .meta-badges {{
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
  }}
  .status-badge {{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 13px;
    font-weight: 600;
  }}
  .status-dot {{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
  }}
  .repo-tag {{
    font-size: 13px;
    color: #64748b;
  }}

  /* Middle Feature Grid */
  .features-grid {{
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin: 22px 0 26px 0;
  }}
  .feat-card {{
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .feat-card-top {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #f1f5f9;
  }}
  .feat-card p {{
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.4;
  }}

  /* Bottom Showcase Window */
  .mockup-wrapper {{
    position: relative;
    z-index: 10;
    width: 100%;
    height: 640px;
    background: #10121a;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 
      0 32px 80px -16px rgba(0, 0, 0, 0.9),
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 12px 40px rgba(37, 99, 235, 0.16);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }}
  .mockup-header {{
    height: 38px;
    background: #141722;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 14px;
  }}
  .window-dots {{
    display: flex;
    gap: 8px;
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
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    color: #94a3b8;
    max-width: 380px;
    margin: 0 auto;
  }}
  .url-bar span {{ color: #34d399; margin-right: 6px; }}

  .mockup-body {{
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #090a0f;
  }}
  .mockup-body img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }}
</style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="grid-pattern"></div>

  <!-- Top Brand & Meta -->
  <div class="top-section">
    <div class="brand-group">
      <div class="brand-pill">Self-Hosted Infrastructure Monitoring</div>
      <div class="logo-title">
        <svg viewBox="0 0 32 32" width="42" height="42" fill="none" stroke="#f8fafc" stroke-width="2">
          <path d="M16 3L4 9.5v13L16 29l12-6.5v-13L16 3z" fill="rgba(255,255,255,0.08)" />
          <path d="M16 3v13M16 16L4 9.5M16 16l12-6.5M16 16v13" />
          <circle cx="16" cy="16" r="3" fill="#38bdf8" />
        </svg>
        <h1>DockMon</h1>
      </div>
      <div class="tagline">Lightweight Server &amp; Docker Monitoring</div>
      <div class="thai-desc">แพลตฟอร์มมอนิเตอร์เซิร์ฟเวอร์แบบ Real-time พร้อมฟังก์ชันจัดการ Docker คอนเทนเนอร์ &amp; เชื่อมต่อ Cloudflare ครบจบในตัว</div>
    </div>

    <div class="meta-badges">
      <div class="status-badge">
        <span class="status-dot"></span>
        <span>v0.21.1 Live Production</span>
      </div>
      <div class="repo-tag">github.com/iamapinan/dockmon</div>
    </div>
  </div>

  <!-- 4 Feature Highlights -->
  <div class="features-grid">
    <div class="feat-card">
      <div class="feat-card-top"><span>⚡</span> Multi-Host Telemetry</div>
      <p>กราฟ CPU, RAM, Disk I/O และ Network ความละเอียดสูง พร้อมเก็บบันทึกประวัติ</p>
    </div>
    <div class="feat-card">
      <div class="feat-card-top"><span>🐳</span> Container Controls</div>
      <p>สั่ง Restart, Stop, Start ได้ทันที พร้อมดู Shiki Syntax Live Logs แบบเรียลไทม์</p>
    </div>
    <div class="feat-card">
      <div class="feat-card-top"><span>🌐</span> Cloudflare Connect</div>
      <p>ตรวจสอบจับคู่โดเมนกับเครื่องโฮสต์ และซิงก์ DNS Records อัตโนมัติ</p>
    </div>
    <div class="feat-card">
      <div class="feat-card-top"><span>🔒</span> Zero-Trust Transport</div>
      <p>เชื่อมต่อผ่าน WebSocket / SSH เอเจนต์ขนาดเล็กมาก ไม่กินทรัพยากรเครื่อง</p>
    </div>
  </div>

  <!-- Bottom Real Screen Mockup -->
  <div class="mockup-wrapper">
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
      <img src="data:image/png;base64,{dash_b64}" alt="DockMon Dashboard" />
    </div>
  </div>
</body>
</html>
"""

with open('/Users/apinan/Developments/dockmon/assets/facebook_post_square.html', 'w', encoding='utf-8') as f:
    f.write(square_html)

print('Square HTML generated successfully!')
