'use client';

import { useState } from 'react';

type OS = 'Windows' | 'macOS' | 'Linux';

interface DownloadInfo {
  filename: string;
  url: string;
  size: string;
}

const DOWNLOAD_LINKS: Record<OS, DownloadInfo> = {
  Windows: {
    filename: 'orbit_0.1.0_x64_en-US.msi',
    url: 'https://github.com/anshul-ab17/orbit/releases/download/v0.1.0/orbit_0.1.0_x64_en-US.msi',
    size: '12.4 MB'
  },
  macOS: {
    filename: 'orbit_0.1.0_x64.dmg',
    url: 'https://github.com/anshul-ab17/orbit/releases/download/v0.1.0/orbit_0.1.0_x64.dmg',
    size: '15.8 MB'
  },
  Linux: {
    filename: 'orbit_0.1.0_amd64.deb',
    url: 'https://github.com/anshul-ab17/orbit/releases/download/v0.1.0/orbit_0.1.0_amd64.deb',
    size: '10.2 MB'
  }
};

// SVG Icons
const VideoIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const ChipIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8.01" y2="16" />
    <line x1="16" y1="16" x2="16.01" y2="16" />
  </svg>
);

const MicIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <path d="M12 1v11a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v3a4 4 0 0 0 4 4z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const BubbleIcon = ({ size = 16, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
  </svg>
);

const WindowsLogo = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <path d="M0 0H11V11H0V0Z" fill="#0078d4"/>
    <path d="M12 0H23V11H12V0Z" fill="#0078d4"/>
    <path d="M0 12H11V23H0V12Z" fill="#0078d4"/>
    <path d="M12 12H23V23H12V12Z" fill="#0078d4"/>
  </svg>
);

const MacLogo = ({ size = 18, style = {}, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.5-.64.73-1.2 1.87-1.05 2.97 1.12.09 2.27-.56 3-1.41Z"/>
  </svg>
);

const LinuxLogo = ({ size = 18, style = {}, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ ...style, verticalAlign: 'middle', display: 'inline-block' }}>
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.132 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.008c-.287 0-.586.067-.84.2a.311.311 0 01-.136.068l-.004.004c-.059.054-.108.067-.172.132-.016.01-.027.02-.04.032.22.464.444.864.717 1.272.274-.136.57-.267.893-.267h.004z" />
  </svg>
);

const ScissorsIcon = ({ size = 20, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, color: 'var(--accent-indigo)' }}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="9.8" y1="8.2" x2="20" y2="17" />
    <line x1="9.8" y1="15.8" x2="20" y2="7" />
  </svg>
);

const FileIcon = ({ size = 20, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ ...style, color: 'var(--accent-indigo)' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export default function Home() {
  const [downloadingOS, setDownloadingOS] = useState<OS | null>(null);
  const [activeMode, setActiveMode] = useState<'capture' | 'macro' | 'mixing' | 'webcam'>('capture');

  const handleDownload = (os: OS) => {
    setDownloadingOS(os);
    
    // Simulate latency before trigger download
    setTimeout(() => {
      window.location.href = DOWNLOAD_LINKS[os].url;
      // Close modal after a brief duration
      setTimeout(() => {
        setDownloadingOS(null);
      }, 3000);
    }, 1500);
  };

  return (
    <div className="layout-container">
      {/* Background ambient glows */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>

      {/* Header */}
      <header className="site-header">
        <div className="logo-wrapper">
          <div className="logo-icon">O</div>
          <span className="logo-title">Orbit</span>
        </div>
        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#downloads">Downloads</a>
          <a href="#architecture">Architecture</a>
          <a href="https://github.com/anshul-ab17/orbit" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <div>
          <a href="#downloads" className="btn btn-primary">Get Orbit</a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="mode-toggles">
            <button 
              className={`mode-btn ${activeMode === 'capture' ? 'active' : ''}`}
              onClick={() => setActiveMode('capture')}
            >
              <VideoIcon /> Capture
            </button>
            <button 
              className={`mode-btn ${activeMode === 'macro' ? 'active' : ''}`}
              onClick={() => setActiveMode('macro')}
            >
              <ChipIcon /> Macro Log
            </button>
            <button 
              className={`mode-btn ${activeMode === 'mixing' ? 'active' : ''}`}
              onClick={() => setActiveMode('mixing')}
            >
              <MicIcon /> Audio Mixer
            </button>
            <button 
              className={`mode-btn ${activeMode === 'webcam' ? 'active' : ''}`}
              onClick={() => setActiveMode('webcam')}
            >
              <BubbleIcon /> Webcam Bubble
            </button>
          </div>

          <div className="tagline">
            {activeMode === 'capture' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><VideoIcon size={12} /> Loom-style screen recording</span>}
            {activeMode === 'macro' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ChipIcon size={12} /> Background mouse & key logging</span>}
            {activeMode === 'mixing' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MicIcon size={12} /> Mix microphone + system audio</span>}
            {activeMode === 'webcam' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BubbleIcon size={12} /> Floating click-ripple webcam</span>}
          </div>

          <h1 className="hero-title">
            Record your screen. Train your workflows.
          </h1>
          <p className="hero-subtitle">
            Orbit is a local desktop screen recorder and OS-level macro trainer.
            Capture screen, webcam, mic, and system audio, while recording global mouse actions and keyboard steps.
            No cloud locks. Everything stays secure on your local disk.
          </p>
          <div className="hero-ctas">
            <a href="#downloads" className="btn btn-primary">
              Download Orbit
            </a>
            <a href="#features" className="btn btn-secondary">
              Explore Features
            </a>
          </div>
          <div className="hero-platform-support">
            <span>Available for:</span>
            <span className="platform-icon"><WindowsLogo size={12} style={{ marginRight: '4px' }} /> Windows</span>
            <span className="platform-icon"><MacLogo size={12} style={{ marginRight: '4px' }} color="var(--text-secondary)" /> macOS</span>
            <span className="platform-icon"><LinuxLogo size={12} style={{ marginRight: '4px' }} color="var(--text-secondary)" /> Linux</span>
          </div>
        </div>

        {/* Right Hero Preview Panel (App Mockup) */}
        <div className="hero-preview">
          <div className="app-mockup">
            <div className="mock-sidebar">
              <div className="mock-logo">O</div>
              <div className="mock-menu">
                <div className={`mock-menu-item ${activeMode === 'capture' ? 'active' : ''}`} onClick={() => setActiveMode('capture')}>
                  <VideoIcon size={14} />
                </div>
                <div className={`mock-menu-item ${activeMode === 'macro' ? 'active' : ''}`} onClick={() => setActiveMode('macro')}>
                  <ChipIcon size={14} />
                </div>
                <div className={`mock-menu-item ${activeMode === 'mixing' ? 'active' : ''}`} onClick={() => setActiveMode('mixing')}>
                  <MicIcon size={14} />
                </div>
                <div className={`mock-menu-item ${activeMode === 'webcam' ? 'active' : ''}`} onClick={() => setActiveMode('webcam')}>
                  <BubbleIcon size={14} />
                </div>
              </div>
            </div>
            <div className="mock-main">
              <div className="mock-header">
                <span className="mock-title">Orbit Desktop App</span>
                <span className="status-badge">
                  <span className="pulse-dot"></span>
                  {activeMode === 'capture' && 'Vite Dev Server'}
                  {activeMode === 'macro' && 'Input Tracking Active'}
                  {activeMode === 'mixing' && 'Audio Mixing Configured'}
                  {activeMode === 'webcam' && 'Bubble Overlay Connected'}
                </span>
              </div>
              <div className="mock-recording-card">
                {activeMode === 'capture' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Screen Recorder</span>
                      <span style={{ color: 'var(--text-muted)' }}>60 FPS</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Source:</span> <span style={{ color: 'var(--text-primary)' }}>Full Desktop</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Codec:</span> <span style={{ color: 'var(--text-primary)' }}>libx264 (FFmpeg)</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button style={{ flex: 1, background: 'var(--accent-indigo)', color: 'white', border: 'none', borderRadius: '4px', padding: '6px', fontWeight: 'bold', fontSize: '10px' }}>Record</button>
                      <button style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', fontSize: '10px' }}>Pause</button>
                    </div>
                  </>
                )}
                {activeMode === 'macro' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>OS Macro Events Log</span>
                      <span style={{ color: 'var(--accent-green)' }}>rdev listening</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '9px', maxHeight: '90px', overflowY: 'hidden' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>[15:10:22.040] MouseClick Left at (450, 230)</div>
                      <div style={{ color: 'var(--text-secondary)' }}>[15:10:22.560] KeyPress KeyR</div>
                      <div style={{ color: 'var(--text-secondary)' }}>[15:10:22.680] KeyRelease KeyR</div>
                      <div style={{ color: 'var(--accent-indigo)', fontWeight: 'bold' }}>[15:10:23.120] MouseClick Right at (960, 540)</div>
                    </div>
                  </>
                )}
                {activeMode === 'mixing' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>FFmpeg Audio Inputs</span>
                      <span style={{ color: 'var(--accent-purple)' }}>amix filter active</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-primary)' }}><MicIcon size={12} /> Mic: Blue Yeti</span> <span style={{ color: 'var(--text-secondary)' }}>80%</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px' }}>
                          <div style={{ width: '80%', height: '100%', background: 'var(--accent-indigo)', borderRadius: '2px' }}></div>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '9px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>🔊 System Audio Loopback</span> <span style={{ color: 'var(--text-secondary)' }}>60%</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px' }}>
                          <div style={{ width: '60%', height: '100%', background: 'var(--accent-purple)', borderRadius: '2px' }}></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {activeMode === 'webcam' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Webcam Overlay</span>
                      <span style={{ color: 'var(--accent-pink)' }}>Bubble active</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-indigo))', border: '2px solid white', boxShadow: '0 0 10px rgba(122,84,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '14px' }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, fontSize: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Circular Bubble mode</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Ripple feedback: Enabled</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Floating Play Button */}
          <button className="preview-play-btn" onClick={() => window.open('https://github.com/anshul-ab17/orbit', '_blank')}>
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2 className="section-title">Features Built for Builders</h2>
          <p className="section-desc">
            An all-in-one local capture powerhouse. No servers, no signups, no cloud dependencies.
          </p>
        </div>

        <div className="features-grid">
          {/* Card 1 */}
          <div className="feature-card">
            <div className="feature-icon"><VideoIcon size={20} /></div>
            <h3 className="feature-name">Loom-style Screen Capture</h3>
            <p className="feature-description">
              High definition recording at 15/24/30/60 FPS. Record the full desktop or select a custom screen region using the precise offset coordinates controls.
            </p>
          </div>

          {/* Card 2 */}
          <div className="feature-card">
            <div className="feature-icon"><ChipIcon size={20} /></div>
            <h3 className="feature-name">OS-level Macro Trainer</h3>
            <p className="feature-description">
              A background listener thread captures mouse clicks with absolute X/Y screen coordinates, keystrokes, and precise timestamps, giving you a live event feed.
            </p>
          </div>

          {/* Card 3 */}
          <div className="feature-card">
            <div className="feature-icon"><MicIcon size={20} /></div>
            <h3 className="feature-name">Dual-Audio Input Mixing</h3>
            <p className="feature-description">
              Seamlessly record and mix local microphone input with system audio loopback using FFmpeg's high-performance <code>amix</code> filter.
            </p>
          </div>

          {/* Card 4 */}
          <div className="feature-card">
            <div className="feature-icon"><BubbleIcon size={20} /></div>
            <h3 className="feature-name">Webcam Bubble & Ripple</h3>
            <p className="feature-description">
              A floating, borderless circular webcam bubble adds your face to the presentation. Enable visual click-ripples on screen that are captured directly into the video.
            </p>
          </div>

          {/* Card 5 */}
          <div className="feature-card">
            <div className="feature-icon"><ScissorsIcon size={20} /></div>
            <h3 className="feature-name">Local Library & Editor</h3>
            <p className="feature-description">
              Manage your recording collection. Replay videos locally using Tauri's secure asset protocol. Trim segments with stream-copy speeds (no re-encoding!).
            </p>
          </div>

          {/* Card 6 */}
          <div className="feature-card">
            <div className="feature-icon"><FileIcon size={20} /></div>
            <h3 className="feature-name">Interactive Export Suite</h3>
            <p className="feature-description">
              Compile your macro logs into a spreadsheet CSV file or render a professional, paginated PDF instruction manual containing chronological user steps.
            </p>
          </div>
        </div>
      </section>

      {/* App Distribution Section */}
      <section id="downloads" className="download-section">
        <div className="section-header">
          <h2 className="section-title">Download Orbit</h2>
          <p className="section-desc">
            Get the latest installer for your desktop operating system. Safe, signed, and ready to go.
          </p>
        </div>

        <div className="download-grid">
          {/* Windows */}
          <div className="download-card windows">
            <div className="os-icon"><WindowsLogo size={40} /></div>
            <div className="os-name">Windows</div>
            <p className="download-desc">
              Recommended for Windows 10/11. Includes automatic tray configuration and loopback options.
            </p>
            <span className="file-info">{DOWNLOAD_LINKS.Windows.filename} ({DOWNLOAD_LINKS.Windows.size})</span>
            <div className="download-links">
              <button onClick={() => handleDownload('Windows')} className="btn btn-primary">
                Download Installer (.msi)
              </button>
            </div>
          </div>

          {/* macOS */}
          <div className="download-card macos">
            <div className="os-icon"><MacLogo size={40} color="var(--text-primary)" /></div>
            <div className="os-name">macOS</div>
            <p className="download-desc">
              Requires Apple Silicon or Intel Mac (macOS 12+). Prompts for camera, microphone, and accessibility permissions.
            </p>
            <span className="file-info">{DOWNLOAD_LINKS.macOS.filename} ({DOWNLOAD_LINKS.macOS.size})</span>
            <div className="download-links">
              <button onClick={() => handleDownload('macOS')} className="btn btn-primary">
                Download DMG Bundle
              </button>
            </div>
          </div>

          {/* Linux */}
          <div className="download-card linux">
            <div className="os-icon"><LinuxLogo size={40} color="var(--text-primary)" /></div>
            <div className="os-name">Linux</div>
            <p className="download-desc">
              Compatible with Ubuntu, Debian, Fedora, and Arch. Built for X11 graphic environments.
            </p>
            <span className="file-info">{DOWNLOAD_LINKS.Linux.filename} ({DOWNLOAD_LINKS.Linux.size})</span>
            <div className="download-links">
              <button onClick={() => handleDownload('Linux')} className="btn btn-primary">
                Download Debian Package
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="architecture-section">
        <div className="section-header">
          <h2 className="section-title">How Orbit Works Under the Hood</h2>
          <p className="section-desc">
            Tauri v2 + Rust backend orchestrates high-performance captures on your local machine.
          </p>
        </div>

        <div className="architecture-card">
          <div className="mermaid-wrapper">
            <svg viewBox="0 0 800 320" width="100%" height="100%" style={{ background: 'transparent' }}>
              {/* WebView Box */}
              <rect x="20" y="60" width="220" height="200" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
              <text x="130" y="40" fill="#3b82f6" fontSize="14" fontWeight="bold" textAnchor="middle">Frontend (WebView)</text>
              <text x="130" y="100" fill="#f8fafc" fontSize="13" textAnchor="middle">React Dashboard</text>
              <text x="130" y="130" fill="#94a3b8" fontSize="11" textAnchor="middle">Settings & Control State</text>
              <text x="130" y="160" fill="#f8fafc" fontSize="13" textAnchor="middle">Webcam + Ripple Overlays</text>
              <text x="130" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">Direct HTML5 getUserMedia</text>
              <text x="130" y="230" fill="#10b981" fontSize="12" fontWeight="bold" textAnchor="middle">IPC invoke / listen</text>

              {/* IPC Arrow */}
              <line x1="240" y1="160" x2="360" y2="160" stroke="#6366f1" strokeWidth="3" strokeDasharray="5,5" />
              <polygon points="360,160 350,154 350,166" fill="#6366f1" />
              <text x="300" y="145" fill="#a5b4fc" fontSize="11" fontWeight="bold" textAnchor="middle">Tauri IPC</text>

              {/* Rust Box */}
              <rect x="360" y="60" width="240" height="200" rx="10" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="2" />
              <text x="480" y="40" fill="#8b5cf6" fontSize="14" fontWeight="bold" textAnchor="middle">Rust Backend (lib.rs)</text>
              <text x="480" y="100" fill="#f8fafc" fontSize="13" textAnchor="middle">rdev listener thread</text>
              <text x="480" y="125" fill="#94a3b8" fontSize="11" textAnchor="middle">Global input tracking</text>
              <text x="480" y="160" fill="#f8fafc" fontSize="13" textAnchor="middle">FFmpeg Spawn Manager</text>
              <text x="480" y="185" fill="#94a3b8" fontSize="11" textAnchor="middle">Segment captures & concats</text>
              <text x="480" y="220" fill="#f8fafc" fontSize="13" textAnchor="middle">Export Service (PDF/CSV)</text>

              {/* Arrow from Rust to OS/Disk */}
              <line x1="600" y1="160" x2="680" y2="160" stroke="#8b5cf6" strokeWidth="2" />
              <polygon points="680,160 672,155 672,165" fill="#8b5cf6" />
              
              {/* OS / Disk Box */}
              <rect x="680" y="80" width="100" height="150" rx="10" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
              <text x="730" y="120" fill="#10b981" fontSize="14" fontWeight="bold" textAnchor="middle">Local Disk</text>
              <text x="730" y="160" fill="#f8fafc" fontSize="12" textAnchor="middle">MP4 Videos</text>
              <text x="730" y="185" fill="#f8fafc" fontSize="12" textAnchor="middle">CSV Logs</text>
              <text x="730" y="210" fill="#f8fafc" fontSize="12" textAnchor="middle">PDF Manuals</text>
            </svg>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo-icon">O</div>
            <span className="logo-title">Orbit</span>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#downloads">Downloads</a>
            <a href="#architecture">Architecture</a>
            <a href="https://github.com/anshul-ab17/orbit" target="_blank" rel="noreferrer">GitHub Project</a>
            <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>|</span>
            {/* Website / Portfolio Link */}
            <a href="https://anshulbharat.com/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Website" style={{ display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </a>
            {/* GitHub Link */}
            <a href="https://github.com/anshul-ab17/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="GitHub" style={{ display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
            {/* X Link */}
            <a href="https://x.com/anshul_ab17" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="X" style={{ display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            {/* LinkedIn Link */}
            <a href="https://www.linkedin.com/in/anshul-bt17/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="LinkedIn" style={{ display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          </div>
        </div>
        <div className="copyright">
          &copy; {new Date().getFullYear()} Orbit.
        </div>
      </footer>

      {/* Downloading Loader Modal */}
      {downloadingOS && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-loader"></div>
            <h3 className="modal-title">Initializing Download</h3>
            <p className="modal-text">
              Preparing the installer package <strong>{DOWNLOAD_LINKS[downloadingOS].filename}</strong> for {downloadingOS}...
            </p>
            <p className="modal-text" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Your download will start automatically. If it doesn't, click the link to retry.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
