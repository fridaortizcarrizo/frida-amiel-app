import { useState, useEffect, useRef, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabaseClient';

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a', surface: '#141414', surface2: '#1e1e1e',
  yellow: '#f5c842', orange: '#ff6b1a', text: '#f5f0e8',
  muted: '#666', border: '#2a2a2a',
};
const S = {
  screen: { flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', paddingBottom: 80, overflowY: 'auto', position: 'relative', zIndex: 1 },
  btn: { background: C.yellow, color: C.bg, border: 'none', padding: '12px 24px', fontFamily: "'Courier New', monospace", fontSize: 14, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1 },
  btnDark: { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, padding: '10px 18px', fontFamily: "'Courier New', monospace", fontSize: 13, cursor: 'pointer' },
  card: { background: C.surface, border: `1px solid ${C.border}`, padding: 14 },
  chip: (active) => ({ background: active ? C.yellow : C.surface2, color: active ? C.bg : C.muted, border: `1px solid ${active ? C.yellow : C.border}`, padding: '5px 12px', fontFamily: "'Courier New', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: 0.5 }),
};

// ─── AVATAR IMAGES ────────────────────────────────────────────────────────────
const FRIDA_IMG = '/sprites/Frida_idle.png';
const AMIEL_IMG = '/sprites/Amiel_idle.png';

// Floating character sprite — wrapper handles positioning + float animation
function CharImg({ src, height = 75, delay = '0s', style = {} }) {
  return (
    <div style={{ lineHeight: 0, animation: `float 2.5s ease-in-out infinite`, animationDelay: delay, ...style }}>
      <img src={src} alt="" style={{ height, imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

// ─── STARFIELD (fixed, behind everything) ────────────────────────────────────
const STAR_DATA = Array.from({ length: 60 }, (_, i) => ({
  left: ((i * 137.508) % 100).toFixed(2),
  top: ((i * 97.314 + i * 3.7) % 100).toFixed(2),
  size: (i % 3 === 0 ? 2 : 1),
  yellow: i % 7 === 0,
  duration: (1.5 + (i % 15) * 0.1).toFixed(1),
  delay: ((i * 0.23) % 3).toFixed(2),
}));

function Starfield() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {STAR_DATA.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: s.yellow ? C.yellow : '#ffffff',
          animation: `starTwinkle ${s.duration}s ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── PIXEL FACE SVG (artist cards) ───────────────────────────────────────────
function PixelFace({ hairColor }) {
  return (
    <svg width={32} height={32} style={{ display: 'block' }}>
      <rect x={7} y={2} width={18} height={7} fill={hairColor} />
      <rect x={5} y={4} width={4} height={9} fill={hairColor} />
      <rect x={23} y={4} width={4} height={9} fill={hairColor} />
      <rect x={8} y={8} width={16} height={14} fill="#f5cba7" />
      <rect x={11} y={13} width={3} height={3} fill="#1a0a00" />
      <rect x={18} y={13} width={3} height={3} fill="#1a0a00" />
      <rect x={13} y={18} width={6} height={2} fill="#c0705a" />
    </svg>
  );
}

// ─── HERO SCENE (3 background options) ───────────────────────────────────────
const FAIRY_COLORS = ['#f5c842','#ff6b1a','#ffffff','#f5c842','#ff6b1a','#ffffff','#f5c842','#ff6b1a','#ffffff','#f5c842','#ff6b1a','#ffffff'];

const STAR_DOTS = [
  {cx:'12%',cy:'10%',d:'0s',dur:'1.8s'},{cx:'32%',cy:'7%',d:'0.6s',dur:'2.2s'},
  {cx:'54%',cy:'13%',d:'1.2s',dur:'1.6s'},{cx:'74%',cy:'8%',d:'0.3s',dur:'2.5s'},
  {cx:'89%',cy:'16%',d:'1.7s',dur:'1.9s'},
];

// FIX 1: fondos corregidos — haciendo la valla = bg_concert (cola afuera), durmiendo la calle = bg_arena_day
function HeroScene({ background = 'haciendo la valla', height = 180 }) {
  const bgImage = background === 'haciendo la valla' ? '/assets/bg_concert.png'
    : background === 'durmiendo la calle' ? '/assets/bg_arena_day.png'
    : background === 'partiendo en el hotel' ? '/assets/bg_hotel.png'
    : null;

  // 8 sparkles for the concert scene
  const SPARKLES = [
    { left:'8%',  top:'15%', size:12, color:'#f5c842', dur:'1.8s', delay:'0s'   },
    { left:'20%', top:'40%', size:10, color:'#ffffff', dur:'2.4s', delay:'0.3s' },
    { left:'35%', top:'10%', size:14, color:'#ff6b1a', dur:'1.5s', delay:'0.8s' },
    { left:'50%', top:'30%', size:11, color:'#f5c842', dur:'2.8s', delay:'0.5s' },
    { left:'65%', top:'12%', size:13, color:'#ffffff', dur:'2.1s', delay:'1.1s' },
    { left:'75%', top:'45%', size:10, color:'#ff6b1a', dur:'1.7s', delay:'0.2s' },
    { left:'88%', top:'20%', size:12, color:'#f5c842', dur:'3.0s', delay:'0.7s' },
    { left:'42%', top:'55%', size:10, color:'#ffffff', dur:'2.2s', delay:'1.4s' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', flexShrink: 0 }}>
      {/* Base background */}
      {bgImage
        ? <img src={bgImage} alt="" onError={(e) => { e.target.style.display='none'; }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
        : <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#050510', zIndex: 0 }} />
      }

      {/* Option 1 — haciendo la valla: sparkle crosses only, no rects */}
      {background === 'haciendo la valla' && SPARKLES.map((sp, i) => (
        <div key={i} style={{
          position: 'absolute', left: sp.left, top: sp.top,
          fontSize: sp.size, color: sp.color, pointerEvents: 'none', zIndex: 5,
          animation: `sparkleIn ${sp.dur} ${sp.delay} ease-in-out infinite`,
          lineHeight: 1,
        }}>✦</div>
      ))}

      {/* Option 2 — durmiendo la calle: tent right side, no fire */}
      {background === 'durmiendo la calle' && (
        <img src="/assets/tent.png" alt="" style={{
          position: 'absolute', bottom: 0, right: 0, height: 65,
          imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 5,
          animation: 'sway 3s ease-in-out infinite', transformOrigin: 'bottom center',
        }} />
      )}

      {/* Option 3 — partiendo en el hotel: window lights + stars */}
      {background === 'partiendo en el hotel' && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
          {[
            {x:'22%',y:'25%',d:'0s',dur:'2.1s'},{x:'45%',y:'18%',d:'0.5s',dur:'3.2s'},
            {x:'62%',y:'28%',d:'1.1s',dur:'1.8s'},{x:'30%',y:'35%',d:'0.3s',dur:'2.7s'},
            {x:'52%',y:'38%',d:'0.8s',dur:'1.5s'},{x:'70%',y:'20%',d:'1.5s',dur:'2.4s'},
          ].map((w, i) => (
            <rect key={i} x={w.x} y={w.y} width={4} height={4} fill="#f5c842"
              style={{ animation: `fairyBlink ${w.dur} ${w.d} infinite` }} />
          ))}
          {[{cx:'8%',cy:'8%',d:'0s'},{cx:'82%',cy:'10%',d:'0.9s'},{cx:'93%',cy:'5%',d:'1.5s'}].map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={1.5} fill="#ffffff"
              style={{ animation: `starTwinkle ${1.8 + i * 0.6}s ${s.d} infinite` }} />
          ))}
        </svg>
      )}

      {/* Characters — centered, all 3 options */}
      <CharImg src={FRIDA_IMG} height={72} delay="0s"
        style={{ position: 'absolute', bottom: 0, left: '38%', transform: 'translateX(-50%)', zIndex: 10 }} />
      <CharImg src={AMIEL_IMG} height={72} delay="0.4s"
        style={{ position: 'absolute', bottom: 0, left: '55%', transform: 'translateX(-50%)', zIndex: 10 }} />
    </div>
  );
}

// ─── RELAX SCENE (fixed bg_arena_night + tent/fire left, no switcher) ─────────
function RelaxScene() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 160, overflow: 'hidden', flexShrink: 0 }}>
      <img src="/assets/bg_arena_night.png" alt="" onError={(e) => { e.target.style.display='none'; }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
        {STAR_DOTS.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={2} fill={i % 2 === 0 ? '#ffffff' : '#f5c842'}
            style={{ animation: `starTwinkle ${s.dur} ${s.d} infinite` }} />
        ))}
      </svg>
      {/* Tent left side */}
      <img src="/assets/tent.png" alt="" onError={(e) => { e.target.style.display='none'; }} style={{
        position: 'absolute', bottom: 0, left: '5%', height: 65,
        imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 6,
        animation: 'sway 3s ease-in-out infinite', transformOrigin: 'bottom center',
      }} />
      {/* Fire in front of tent */}
      <img src="/assets/fire.gif" alt="" onError={(e) => { e.target.style.display='none'; }} style={{
        position: 'absolute', bottom: 5, left: '18%', height: 48,
        imageRendering: 'pixelated', pointerEvents: 'none', zIndex: 7,
      }} />
      {/* Characters centered */}
      <CharImg src={FRIDA_IMG} height={72} delay="0s"
        style={{ position: 'absolute', bottom: 0, left: '38%', transform: 'translateX(-50%)', zIndex: 10 }} />
      <CharImg src={AMIEL_IMG} height={72} delay="0.4s"
        style={{ position: 'absolute', bottom: 0, left: '55%', transform: 'translateX(-50%)', zIndex: 10 }} />
    </div>
  );
}

// ─── STAGE SVG ───────────────────────────────────────────────────────────────
function StageSVG({ width = 380 }) {
  return (
    <svg width={width} height={140} style={{ display: 'block', flexShrink: 0 }}>
      <rect width={width} height={140} fill="#050510" />
      <rect x={width*0.1} y={60} width={width*0.8} height={50} fill="#1a1a2e" />
      <rect x={width*0.15} y={50} width={width*0.7} height={15} fill="#0d0d1f" />
      {[0.2, 0.35, 0.5, 0.65, 0.8].map((p, i) => (
        <g key={i}>
          <line x1={width*p} y1={10} x2={width*p + (i%2===0?-20:20)} y2={55} stroke={i%2===0?'#ff6b1a':'#f5c842'} strokeWidth={1.5} opacity={0.4} />
          <circle cx={width*p} cy={10} r={5} fill={i%2===0?'#ff6b1a':'#f5c842'} className="star-twinkle" style={{ animationDelay: `${i*0.2}s` }} />
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx={30 + i * (width-60)/13} cy={118 - (i%3)*6} rx={9} ry={14} fill={`hsl(${240+i*10},30%,${8+i%3*3}%)`} />
      ))}
    </svg>
  );
}

// ─── DATA ────────────────────────────────────────────────────────────────────
const ARTISTS = [
  { name: 'Niall Horan', color: '#3a7bd5', hair: '#ef8a00' },
  { name: 'Harry Styles', color: '#d53a7b', hair: '#5c3317' },
  { name: 'Louis Tomlinson', color: '#3ad5a0', hair: '#5c3317' },
  { name: 'Liam Payne', color: '#d5a03a', hair: '#5c3317' },
  { name: 'Zayn Malik', color: '#7b3ad5', hair: '#1a0a00' },
  { name: 'Taylor Swift', color: '#d53a3a', hair: '#f5c842' },
  { name: 'RM', color: '#a0d53a', hair: '#1a0a00' },
  { name: 'Jin', color: '#d57b3a', hair: '#1a0a00' },
  { name: 'Suga', color: '#888', hair: '#333' },
  { name: 'J-Hope', color: '#d5d53a', hair: '#1a0a00' },
  { name: 'Jimin', color: '#d53a7b', hair: '#1a0a00' },
  { name: 'V', color: '#3ad5d5', hair: '#1a0a00' },
  { name: 'Jungkook', color: '#3a3ad5', hair: '#1a0a00' },
  { name: 'Tyler Joseph', color: '#ff6b1a', hair: '#5c3317' },
  { name: 'Josh Dun', color: '#c0392b', hair: '#f5a0a0' },
  { name: 'Sabrina Carpenter', color: '#f5c842', hair: '#f5c842' },
  { name: 'Olivia Rodrigo', color: '#8b2252', hair: '#1a0a00' },
  { name: 'Perrie Edwards', color: '#3a8bd5', hair: '#f0e0a0' },
  { name: 'Jade Thirlwall', color: '#d53a8b', hair: '#1a0a00' },
  { name: 'Leigh-Anne Pinnock', color: '#2d6a4f', hair: '#1a0a00' },
  { name: 'Jesy Nelson', color: '#6b4226', hair: '#1a0a00' },
  { name: 'Shawn Mendes', color: '#d5783a', hair: '#5c3317' },
  { name: 'Luke Hemmings', color: '#555', hair: '#e8c878' },
  { name: 'Calum Hood', color: '#4a2e6a', hair: '#1a0a00' },
  { name: 'Michael Clifford', color: '#ff3a3a', hair: '#c0392b' },
  { name: 'Ashton Irwin', color: '#8b6914', hair: '#5c3317' },
];

const GENRES = ['romance', 'aventura', 'comedia', 'angst', 'fluff', 'misterio'];
const SCENARIOS = ['backstage', 'meet & greet', 'after party', 'aeropuerto', 'tour bus', 'hotel', 'soundcheck', 'acampe'];
const LENGTHS = ['corta', 'media', 'larga'];

const STORY_SUGGESTIONS = [
  { icon: '🎸', artist: 'Harry Styles', hook: 'Las entradas perdidas del show' },
  { icon: '🌙', artist: 'Niall Horan', hook: 'Noche de acampe en el Luna Park' },
  { icon: '🎤', artist: 'BTS', hook: 'Un meet & greet que salió mal' },
  { icon: '☕', artist: 'Tyler Joseph', hook: 'El mate que lo cambió todo' },
  { icon: '✈️', artist: 'Taylor Swift', hook: 'Perdidas en el aeropuerto' },
  { icon: '🎭', artist: 'Olivia Rodrigo', hook: 'Backstage a medianoche' },
  { icon: '🔥', artist: 'Louis Tomlinson', hook: 'El after party del siglo' },
  { icon: '🌟', artist: '5SOS', hook: 'Tour bus rumbo a ningún lado' },
  { icon: '💌', artist: 'Shawn Mendes', hook: 'Una carta que nunca llegó' },
  { icon: '🎪', artist: 'Zayn Malik', hook: 'Soundcheck secreto' },
];

const ALL_SONGS = [
  'Slow Hands','This Town','Flicker','Nice to Meet Ya','Put A Little Love On Me',
  'Watermelon Sugar','As It Was','Adore You','Golden','Falling',
  'Two Ghosts','Sign of the Times','Kiwi','Lights Up','Treat People With Kindness',
  'Back to You','Always You','Walls','Two of Us','Miss You',
  'Strip That Down','Stack It Up','Get Low','Familiar',
  'Pillowtalk','LIKE I WOULD','She','Too Much','Let Me',
  'Anti-Hero','Shake It Off','Blank Space','All Too Well','Cruel Summer','Love Story',
  'Dynamite','Butter','Boy With Luv','DNA','Fake Love','Spring Day',
  'Black Swan','ON','Life Goes On','Permission to Dance',
  'Stressed Out','Heathens','Ride','Car Radio','Tear in My Heart',
  'Jumpsuit','Ode to Sleep','Goner','The Judge','Fairly Local',
  'Espresso','Please Please Please','Nonsense','Because I Liked a Boy',
  'drivers license','good 4 u','brutal','deja vu','traitor','vampire',
  'Move','Shout Out to My Ex','Touch','Black Magic','Little Me',
  'Treat You Better','Mercy','Nothing Holding Me Back','Stitches',
  'Youngblood','Want You Back','Easier','She Looks So Perfect',
  'Broken Home','Jet Black Heart','Teeth','Not in the Same Way',
];

const LOADING_MSGS = [
  'armando el campamento...', 'eligiendo el outfit perfecto...', 'preparando el mate...',
  'buscando las entradas...', 'escribiendo el prólogo...', 'consultando el horóscopo...',
  'cargando la playlist...', 'pidiendo Wi-Fi al del lado...', 'guardando el lugar...',
  'soñando el primer capítulo...', 'recordando 2018...', 'poniendo fichas en el celular...',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function timeSince(dateStr) {
  const from = new Date(dateStr);
  const now = new Date();
  let years = now.getFullYear() - from.getFullYear();
  let months = now.getMonth() - from.getMonth();
  let days = now.getDate() - from.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { years--; months += 12; }
  return { years, months, days };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
function OnboardingScreen({ onDone }) {
  const [selected, setSelected] = useState(null);
  const [outfit, setOutfit] = useState('fan casual');
  const [background, setBackground] = useState('haciendo la valla');
  const outfits = ['fan casual', 'acampe', 'show night', 'pride'];
  const backgrounds = ['haciendo la valla', 'durmiendo la calle', 'partiendo en el hotel'];
  const [w, setW] = useState(Math.min(window.innerWidth, 430) - 32);
  useEffect(() => {
    const h = () => setW(Math.min(window.innerWidth, 430) - 32);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return (
    <div style={{ ...S.screen, padding: '24px 16px 100px', alignItems: 'center' }}>
      <div style={{ fontSize: 32, color: C.yellow, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>¿quién sos?</div>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 28 }}>elegí tu personaje</div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, width: '100%', justifyContent: 'center' }}>
        {[
          { name: 'Frida', src: FRIDA_IMG, delay: '0s' },
          { name: 'Amiel', src: AMIEL_IMG, delay: '0.4s' },
        ].map(({ name, src, delay }) => (
          <div key={name} onClick={() => setSelected(name)}
            style={{ flex: 1, background: selected === name ? '#1a1a0a' : C.surface, border: `2px solid ${selected === name ? C.yellow : C.border}`, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ lineHeight: 0, animation: `float 2.5s ease-in-out infinite`, animationDelay: delay }}>
              <img src={src} alt={name} style={{ height: 80, imageRendering: 'pixelated', display: 'block' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: selected === name ? C.yellow : C.text }}>{name}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, alignSelf: 'flex-start' }}>outfit</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignSelf: 'flex-start' }}>
        {outfits.map(o => <button key={o} onClick={() => setOutfit(o)} style={S.chip(outfit === o)}>{o}</button>)}
      </div>

      <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, alignSelf: 'flex-start' }}>escenario</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, alignSelf: 'flex-start' }}>
        {backgrounds.map(b => <button key={b} onClick={() => setBackground(b)} style={S.chip(background === b)}>{b}</button>)}
      </div>

      <div style={{ width: '100%', marginBottom: 24 }}>
        <HeroScene background={background} height={190} />
      </div>

      <button onClick={() => { if (selected) { localStorage.setItem('fa_user', selected); onDone(selected); } }}
        disabled={!selected} style={{ ...S.btn, width: '100%', opacity: selected ? 1 : 0.4, fontSize: 16, letterSpacing: 2 }}>
        entrar →
      </button>
    </div>
  );
}

// ─── HOME ────────────────────────────────────────────────────────────────────
function HomeScreen({ user, onNav, onGenerateFromSuggestion, lastStory, onUserChange }) {
  const [w] = useState(Math.min(window.innerWidth, 430));
  const { years, months, days } = timeSince('2018-07-05');
  const [suggestions] = useState(() => shuffle(STORY_SUGGESTIONS).slice(0, 4));
  const [background, setBackground] = useState(() => localStorage.getItem('fa_bg') || 'haciendo la valla');
  const [showPicker, setShowPicker] = useState(false);
  const greeting = user === 'Frida' ? 'hola, Fri ✦' : 'hola, Ami ✦';

  const changeBackground = (bg) => {
    setBackground(bg);
    localStorage.setItem('fa_bg', bg);
    setShowPicker(false);
  };

  return (
    <div style={{ ...S.screen, padding: 0, paddingBottom: 100 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <HeroScene background={background} height={180} />
        <button onClick={() => setShowPicker(p => !p)}
          style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: `1px solid ${C.border}`, color: C.text, fontSize: 14, padding: '4px 8px', cursor: 'pointer', fontFamily: "'Courier New', monospace", zIndex: 10, lineHeight: 1 }}>🎨</button>
        {showPicker && (
          <div style={{ position: 'absolute', top: 44, right: 8, background: C.surface, border: `1px solid ${C.border}`, padding: 8, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['haciendo la valla', 'durmiendo la calle', 'partiendo en el hotel'].map(bg => (
              <button key={bg} onClick={() => changeBackground(bg)} style={{ ...S.chip(background === bg), textAlign: 'left', whiteSpace: 'nowrap' }}>{bg}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 20, color: C.yellow, fontWeight: 'bold' }}>{greeting}</div>
          <button onClick={onUserChange}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: "'Courier New', monospace", textDecoration: 'underline' }}>cambiar usuario</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[{ label: 'años', val: years }, { label: 'meses', val: months }, { label: 'días', val: days }].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 28, color: C.yellow, fontWeight: 'bold' }}>{val}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 20 }}>de amistad y locuras compartidas ✨</div>

        <div onClick={() => onNav('messages')}
          style={{ ...S.card, marginBottom: 20, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>último mensaje</div>
            <div style={{ fontSize: 13, color: C.text }}>ver mensajes →</div>
          </div>
          <div style={{ fontSize: 20 }}>♡</div>
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, letterSpacing: 1 }}>HISTORIAS SUGERIDAS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => onGenerateFromSuggestion(s)}
              style={{ ...S.card, cursor: 'pointer', padding: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.orange, marginBottom: 4 }}>{s.artist}</div>
              <div style={{ fontSize: 11, color: C.text, lineHeight: 1.4 }}>{s.hook}</div>
            </div>
          ))}
        </div>

        {lastStory && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>última historia guardada</div>
            <div style={{ fontSize: 14, color: C.yellow, marginBottom: 6 }}>{lastStory.title}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{lastStory.meta}</div>
            <button onClick={() => onNav('reader', lastStory)} style={{ ...S.btnDark, fontSize: 11, width: '100%' }}>
              ▶ escuchar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GENERATOR ───────────────────────────────────────────────────────────────
function GeneratorScreen({ user, onBack, onGenerate }) {
  const [protagonists, setProtagonists] = useState(['Frida', 'Amiel']);
  const [selectedArtists, setSelectedArtists] = useState([]);
  const [genre, setGenre] = useState('romance');
  const [scenario, setScenario] = useState('acampe');
  const [length, setLength] = useState('media');

  const toggleArtist = (name) =>
    setSelectedArtists(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px' }}>
      <button onClick={onBack} style={{ ...S.btnDark, alignSelf: 'flex-start', marginBottom: 20, fontSize: 12 }}>← volver</button>
      <div style={{ fontSize: 22, color: C.yellow, marginBottom: 20, fontWeight: 'bold', letterSpacing: 2 }}>NUEVA HISTORIA</div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>PROTAGONISTAS</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['Frida', 'Amiel'].map(p => (
          <button key={p} onClick={() => setProtagonists(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
            style={S.chip(protagonists.includes(p))}>{p}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        ARTISTAS <span style={{ color: C.orange }}>{selectedArtists.length > 0 ? `(${selectedArtists.length})` : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 20 }}>
        {ARTISTS.map(a => (
          <div key={a.name} onClick={() => toggleArtist(a.name)}
            style={{ background: selectedArtists.includes(a.name) ? '#1a1500' : C.surface, border: `1px solid ${selectedArtists.includes(a.name) ? C.yellow : C.border}`, padding: '8px 6px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.color, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <PixelFace hairColor={a.hair} />
            </div>
            <div style={{ fontSize: 9, color: selectedArtists.includes(a.name) ? C.yellow : C.text, lineHeight: 1.3 }}>{a.name}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>GÉNERO</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {GENRES.map(g => <button key={g} onClick={() => setGenre(g)} style={S.chip(genre === g)}>{g}</button>)}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>ESCENARIO</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {SCENARIOS.map(sc => <button key={sc} onClick={() => setScenario(sc)} style={S.chip(scenario === sc)}>{sc}</button>)}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>LONGITUD</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {LENGTHS.map(l => <button key={l} onClick={() => setLength(l)} style={S.chip(length === l)}>{l}</button>)}
      </div>

      <button onClick={() => onGenerate({ protagonists, artists: selectedArtists, genre, scenario, length, user })}
        disabled={selectedArtists.length === 0}
        style={{ ...S.btn, width: '100%', opacity: selectedArtists.length > 0 ? 1 : 0.4 }}>
        generar historia ✦
      </button>
    </div>
  );
}

// ─── LOADING ─── FIX 4: luna pixel art centrada en lugar de estrella ──────────
function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t1 = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 1500);
    const t2 = setInterval(() => setDots(d => d >= 3 ? 1 : d + 1), 500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);
  return (
    <div style={{ ...S.screen, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <div style={{ animation: 'pulse 1.5s ease-in-out infinite', transformOrigin: 'center' }}>
        <img src="/assets/moon.png" alt="" style={{ width: 120, height: 120, imageRendering: 'pixelated' }} />
      </div>
      <div style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>
        {LOADING_MSGS[msgIdx]}{'.'.repeat(dots)}
      </div>
    </div>
  );
}

// ─── WATTPAD READER ─── FIX 3: paginado estilo Wattpad ───────────────────────
function WattpadReader({ body, isStreaming }) {
  const [page, setPage] = useState(0);

  const pages = body
    ? body.split(/\n{2,}/).filter(p => p.trim()).reduce((acc, para, i) => {
        const pageIdx = Math.floor(i / 4);
        if (!acc[pageIdx]) acc[pageIdx] = [];
        acc[pageIdx].push(para.trim());
        return acc;
      }, [])
    : [[]];

  const total = pages.length;
  const current = pages[page] || [];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 2, padding: '24px 20px', minHeight: 300, marginBottom: 16 }}>
        {current.map((para, i) => (
          <p key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.9, color: C.text, marginBottom: 18, marginTop: 0 }}>
            {para}
          </p>
        ))}
        {isStreaming && page === total - 1 && (
          <span style={{ color: C.yellow }}>▌</span>
        )}
      </div>

      {!isStreaming && total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ ...S.btnDark, fontSize: 12, opacity: page === 0 ? 0.3 : 1 }}>← anterior</button>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Courier New', monospace" }}>
            {page + 1} / {total}
          </span>
          <button onClick={() => setPage(p => Math.min(total - 1, p + 1))} disabled={page === total - 1}
            style={{ ...S.btnDark, fontSize: 12, opacity: page === total - 1 ? 0.3 : 1 }}>siguiente →</button>
        </div>
      )}
    </div>
  );
}

// ─── READER ──────────────────────────────────────────────────────────────────
function ReaderScreen({ story, user, onBack, onSave, onNew, isStreaming }) {
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [w] = useState(Math.min(window.innerWidth, 430));

  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
      setVoices(vs.length ? vs : window.speechSynthesis.getVoices().slice(0, 5));
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => window.speechSynthesis.cancel();
  }, []);

  const handlePlay = () => {
    if (!story?.body) return;
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const u = new SpeechSynthesisUtterance(story.body);
    u.rate = 0.82;
    u.pitch = 1.05;
    u.lang = 'es-AR';
    if (voices[voiceIdx]) u.voice = voices[voiceIdx];
    u.onend = () => setPlaying(false);
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };

  const handleSave = async () => {
    if (saved || !story) return;
    await onSave(story);
    setSaved(true);
  };

  return (
    <div style={{ ...S.screen, padding: 0 }}>
      <StageSVG width={w} />
      <div style={{ padding: '16px 16px 100px' }}>
        <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 16 }}>← volver</button>
        {story && (
          <>
            <div style={{ fontSize: 22, color: C.yellow, fontWeight: 'bold', marginBottom: 6 }}>
              {story.title || 'cargando...'}
            </div>
            {story.meta && <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>{story.meta}</div>}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button onClick={handlePlay}
                  style={{ background: playing ? C.orange : C.yellow, color: C.bg, border: 'none', width: 36, height: 36, cursor: 'pointer', fontSize: 14, fontFamily: "'Courier New', monospace" }}>
                  {playing ? '■' : '▶'}
                </button>
                <div style={{ flex: 1, height: 4, background: C.border }}>
                  <div style={{ height: '100%', background: playing ? C.orange : C.muted, width: playing ? '60%' : '0%', transition: 'width 2s' }} />
                </div>
                <span style={{ fontSize: 10, color: C.muted }}>{playing ? 'leyendo...' : 'listo'}</span>
              </div>
              <div style={{ borderLeft: '3px solid #f5c842', paddingLeft: '8px', fontSize: '11px', color: '#ff6b1a', marginBottom: '8px', lineHeight: 1.5 }}>
                🎙️ Para voces más naturales: abrí esta app en Safari desde iPhone o iPad
              </div>
              {voices.length > 0 && (
                <select value={voiceIdx} onChange={e => setVoiceIdx(Number(e.target.value))}
                  style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, fontSize: 10, padding: '3px 6px', width: '100%', fontFamily: "'Courier New', monospace" }}>
                  {voices.map((v, i) => <option key={i} value={i}>{v.name}</option>)}
                </select>
              )}
            </div>

            {/* FIX 3: WattpadReader en lugar de texto plano */}
            <WattpadReader body={story.body} isStreaming={isStreaming} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saved || isStreaming}
                style={{ ...S.btn, flex: 1, opacity: saved || isStreaming ? 0.5 : 1, fontSize: 12 }}>
                {saved ? 'guardada ✓' : 'guardar historia'}
              </button>
              <button onClick={onNew} disabled={isStreaming}
                style={{ ...S.btnDark, flex: 1, fontSize: 12 }}>crear otra</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RELAX ───────────────────────────────────────────────────────────────────
function RelaxScreen({ onNav }) {
  return (
    <div style={{ ...S.screen, padding: 0, paddingBottom: 100 }}>
      <RelaxScene />
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 20, color: C.yellow, marginBottom: 20, fontWeight: 'bold', textAlign: 'center' }}>escápate un rato</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { key: 'stim', icon: '✦', label: 'stimming', desc: 'pinta y jugá' },
            { key: 'breath', icon: '◎', label: 'respiración', desc: 'box breathing' },
            { key: 'sounds', icon: '♪', label: 'sonidos', desc: 'ambiente' },
            { key: 'game', icon: '▤', label: 'setlist game', desc: 'catch songs' },
          ].map(item => (
            <div key={item.key} onClick={() => onNav(item.key)}
              style={{ ...S.card, cursor: 'pointer', textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 28, color: C.yellow, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── STIM ────────────────────────────────────────────────────────────────────
function StimScreen({ onBack }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('pintar');
  const isDrawing = useRef(false);
  const particles = useRef([]);
  const animFrame = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const modes = ['pintar', 'fuegos artificiales', 'burbujas', 'lluvia de estrellas'];

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const spawnAt = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const m = modeRef.current;
    if (m === 'pintar') {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${(Date.now() / 20) % 360},90%,60%)`;
      ctx.fill();
    } else {
      for (let i = 0; i < 8; i++) {
        particles.current.push({
          x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5 - (m === 'lluvia de estrellas' ? 2 : 0),
          life: 60, color: `hsl(${Math.random()*360},90%,60%)`,
          size: m === 'burbujas' ? Math.random()*12+4 : Math.random()*4+1, type: m,
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.current = [];

    const animate = () => {
      const m = modeRef.current;
      if (m !== 'pintar') {
        ctx.fillStyle = 'rgba(20,20,20,0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        particles.current = particles.current.filter(p => p.life > 0);
        particles.current.forEach(p => {
          ctx.beginPath();
          if (p.type === 'burbujas') {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.stroke();
          } else {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.fillStyle = p.color; ctx.fill();
          }
          p.x += p.vx; p.y += p.vy; p.life--;
          if (p.type === 'lluvia de estrellas') p.vy += 0.1;
          if (p.type === 'fuegos artificiales') { p.vx *= 0.95; p.vy = p.vy * 0.95 + 0.05; }
        });
      }
      animFrame.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animFrame.current);
  }, [mode]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.surface; ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.current = [];
  };

  const canvasW = Math.min(window.innerWidth, 430) - 32;

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px' }}>
      <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 16, alignSelf: 'flex-start' }}>← volver</button>
      <div style={{ fontSize: 18, color: C.yellow, marginBottom: 16, fontWeight: 'bold' }}>stimming ✦</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {modes.map(m => <button key={m} onClick={() => setMode(m)} style={S.chip(mode === m)}>{m}</button>)}
      </div>
      <canvas ref={canvasRef} width={canvasW} height={280}
        style={{ background: C.surface, display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onMouseDown={e => { isDrawing.current = true; spawnAt(...Object.values(getPos(e, canvasRef.current))); }}
        onMouseMove={e => { if (isDrawing.current || mode !== 'pintar') spawnAt(...Object.values(getPos(e, canvasRef.current))); }}
        onMouseUp={() => isDrawing.current = false}
        onTouchStart={e => { e.preventDefault(); spawnAt(...Object.values(getPos(e, canvasRef.current))); }}
        onTouchMove={e => { e.preventDefault(); spawnAt(...Object.values(getPos(e, canvasRef.current))); }}
      />
      <button onClick={clear} style={{ ...S.btnDark, marginTop: 12, fontSize: 12 }}>limpiar</button>
    </div>
  );
}

// ─── BREATH ──────────────────────────────────────────────────────────────────
function BreathScreen({ onBack }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(4);
  const phases = [
    { label: 'inhalar', duration: 4, color: C.yellow },
    { label: 'sostener', duration: 4, color: C.orange },
    { label: 'exhalar', duration: 4, color: '#3ad5a0' },
    { label: 'sostener', duration: 4, color: '#7b3ad5' },
  ];

  useEffect(() => {
    if (!running) return;
    if (count > 0) {
      const t = setTimeout(() => setCount(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      const next = (phase + 1) % 4;
      setPhase(next);
      setCount(phases[next].duration);
    }
  }, [running, count, phase]);

  const current = phases[phase];
  const expand = running && phase === 0;
  const contract = running && phase === 2;
  const size = expand ? 170 : contract ? 110 : running ? 140 : 130;

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px', alignItems: 'center' }}>
      <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 20, alignSelf: 'flex-start' }}>← volver</button>
      <div style={{ fontSize: 18, color: C.yellow, marginBottom: 8, fontWeight: 'bold' }}>respiración</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 40 }}>box breathing · 4-4-4-4</div>

      <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
        <div style={{ position: 'absolute', width: size + 30, height: size + 30, borderRadius: '50%', border: `3px solid ${current.color}`, transition: 'all 1s ease-in-out', opacity: 0.3 }} />
        <div style={{ width: size, height: size, borderRadius: '50%', background: current.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 1s ease-in-out', boxShadow: `0 0 30px ${current.color}40` }}>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: C.bg }}>{count}</div>
          <div style={{ fontSize: 12, color: C.bg, opacity: 0.8 }}>{current.label}</div>
        </div>
      </div>

      <button onClick={() => { if (running) { setRunning(false); setPhase(0); setCount(4); } else setRunning(true); }}
        style={{ ...S.btn, minWidth: 140 }}>
        {running ? 'detener' : 'comenzar'}
      </button>
    </div>
  );
}

// ─── SOUNDS ─── FIX 2: rutas de audio sin espacios ───────────────────────────
function SoundsScreen({ onBack }) {
  const [active, setActive] = useState({});
  const nodes = useRef({});
  const audioCtx = useRef(null);

  const getCtx = () => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.current.state === 'suspended') audioCtx.current.resume();
    return audioCtx.current;
  };

  const SOUNDS = [
    {
      id: 'rain', label: 'lluvia', icon: '🌧',
      gen: () => {
        const audio = new Audio('/assets/rain_compressed.mp3');
        audio.loop = true;
        audio.play().catch(() => {});
        return { stop: () => { audio.pause(); audio.currentTime = 0; } };
      },
    },
    {
      id: 'crowd', label: 'crowd', icon: '🎤',
      gen: () => {
        const audio = new Audio('/assets/live_crowd.mp3');
        audio.loop = true;
        audio.play().catch(() => {});
        return { stop: () => { audio.pause(); audio.currentTime = 0; } };
      },
    },
    {
      id: 'lofi', label: 'lo-fi', icon: '🎵',
      gen: () => {
        const audio = new Audio('/assets/lofi_compressed.mp3');
        audio.loop = true;
        audio.play().catch(() => {});
        return { stop: () => { audio.pause(); audio.currentTime = 0; } };
      },
    },
    {
      id: 'heart', label: 'latidos', icon: '💓',
      gen: (ctx) => {
        let stopped = false;
        const masterGain = ctx.createGain(); masterGain.gain.value = 1; masterGain.connect(ctx.destination);
        const playThump = (delay) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.frequency.value = 80; osc.type = 'sine';
          const t = ctx.currentTime + delay;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.5, t + 0.02);
          g.gain.linearRampToValueAtTime(0, t + 0.12);
          osc.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t + 0.18);
        };
        const beat = () => {
          if (stopped) return;
          playThump(0);
          playThump(0.15);
          setTimeout(beat, 900);
        };
        beat();
        return { stop: () => { stopped = true; try { masterGain.disconnect(); } catch(e){} } };
      },
    },
  ];

  const toggle = (sound) => {
    if (active[sound.id]) {
      nodes.current[sound.id]?.stop();
      delete nodes.current[sound.id];
      setActive(prev => { const n = {...prev}; delete n[sound.id]; return n; });
    } else {
      const ctx = sound.id === 'heart' ? getCtx() : null;
      nodes.current[sound.id] = sound.gen(ctx);
      setActive(prev => ({ ...prev, [sound.id]: true }));
    }
  };

  useEffect(() => () => Object.values(nodes.current).forEach(n => n?.stop()), []);

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px' }}>
      <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 20, alignSelf: 'flex-start' }}>← volver</button>
      <div style={{ fontSize: 18, color: C.yellow, marginBottom: 20, fontWeight: 'bold' }}>sonidos ambiente</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {SOUNDS.map(s => (
          <div key={s.id} onClick={() => toggle(s)}
            style={{ ...S.card, cursor: 'pointer', textAlign: 'center', padding: 24,
              border: `1px solid ${active[s.id] ? C.orange : C.border}`,
              background: active[s.id] ? '#1a0a00' : C.surface,
              animation: active[s.id] ? 'pulse 1.5s infinite' : 'none' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 12, color: active[s.id] ? C.orange : C.text }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{active[s.id] ? '● on' : '○ off'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GAME ────────────────────────────────────────────────────────────────────
function GameScreen({ onBack }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('idle');
  const [setlist, setSetlist] = useState([]);
  const stRef = useRef({ notes: [], catcher: 0, fallDuration: 5, misses: 0, caught: [], frame: 0, flashTimer: 0, flashText: '' });
  const animRef = useRef(null);
  const [shuffledSongs] = useState(() => shuffle(ALL_SONGS));
  const W = Math.min(window.innerWidth, 430) - 32;
  const H = 420;
  const CW = 90;
  const CY = H - 40;
  const FPS = 60;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const st = stRef.current;

    const loop = () => {
      ctx.fillStyle = '#050510'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1;
      for (let y=0; y<H; y+=30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      const spawnEvery = Math.max(70 - Math.floor(st.caught.length / 3) * 2, 25);
      if (st.frame % spawnEvery === 0) {
        const song = shuffledSongs[st.frame % shuffledSongs.length];
        const nw = Math.min(song.length * 6 + 24, W - 20);
        const speed = H / (st.fallDuration * FPS);
        st.notes.push({ x: Math.random() * (W - nw), y: -30, w: nw, song, speed });
      }
      st.frame++;

      const toRemove = [];
      st.notes.forEach((note, i) => {
        note.y += note.speed;
        ctx.fillStyle = '#1e1e1e'; ctx.strokeStyle = C.yellow; ctx.lineWidth = 1;
        roundRect(ctx, note.x, note.y, note.w, 26, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '10px "Courier New"';
        ctx.fillText(note.song, note.x + 8, note.y + 17);
        if (note.y + 26 >= CY && note.y <= CY + 16) {
          if (note.x + note.w > st.catcher && note.x < st.catcher + CW) {
            st.caught.push(note.song);
            st.flashText = '¡atrapada! ✨';
            st.flashTimer = 45;
            if (st.caught.length % 5 === 0) {
              st.fallDuration = Math.max(st.fallDuration - 0.25, 1.8);
            }
            toRemove.push(i); return;
          }
        }
        if (note.y > H) { st.misses++; toRemove.push(i); }
      });
      toRemove.reverse().forEach(i => st.notes.splice(i, 1));

      ctx.fillStyle = C.yellow; ctx.fillRect(st.catcher, CY, CW, 14);
      ctx.fillStyle = '#0a0a0a'; ctx.font = 'bold 9px "Courier New"';
      ctx.fillText('◉', st.catcher + CW/2 - 5, CY + 10);

      for (let m = 0; m < 3; m++) {
        ctx.font = '16px serif';
        ctx.fillStyle = m < (3 - st.misses) ? '#c0392b' : C.muted;
        ctx.fillText('♥', 8 + m * 22, 22);
      }
      ctx.fillStyle = C.yellow; ctx.font = 'bold 11px "Courier New"';
      ctx.fillText(`${st.caught.length} canciones`, W - 100, 22);

      if (st.flashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.flashTimer / 15);
        ctx.fillStyle = C.yellow;
        ctx.font = 'bold 16px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(st.flashText, W / 2, H / 2 - 20);
        ctx.restore();
        st.flashTimer--;
      }

      if (st.misses >= 3) { setSetlist([...st.caught]); setGameState('over'); return; }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState, W, CY, CW, shuffledSongs]);

  const handleMove = useCallback((clientX) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    stRef.current.catcher = Math.max(0, Math.min(W - CW, clientX - rect.left - CW/2));
  }, [W, CW]);

  const startGame = () => {
    const st = stRef.current;
    st.notes = []; st.catcher = W/2 - CW/2;
    st.fallDuration = 5; st.misses = 0; st.caught = []; st.frame = 0; st.flashTimer = 0; st.flashText = '';
    setGameState('playing'); setSetlist([]);
  };

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px', alignItems: 'center' }}>
      <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 16, alignSelf: 'flex-start' }}>← volver</button>
      <div style={{ fontSize: 18, color: C.yellow, marginBottom: 12, fontWeight: 'bold' }}>setlist game ▤</div>

      {gameState === 'idle' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: C.yellow, marginBottom: 8, fontWeight: 'bold' }}>¿lista para armar tu setlist? 🎵</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.7 }}>
            atrapá las canciones con la barra amarilla.<br/>perdés si se te escapan 3.
          </div>
          <button onClick={startGame} style={S.btn}>empezar</button>
        </div>
      )}

      {gameState === 'playing' && (
        <canvas ref={canvasRef} width={W} height={H}
          style={{ display: 'block', cursor: 'none', touchAction: 'none' }}
          onMouseMove={e => handleMove(e.clientX)}
          onTouchMove={e => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
        />
      )}

      {gameState === 'over' && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 18, color: C.yellow, marginBottom: 8, textAlign: 'center' }}>tu setlist de hoy 🎤</div>
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 16 }}>{setlist.length} canciones atrapadas</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16, marginBottom: 20, maxHeight: 280, overflowY: 'auto' }}>
            {setlist.length === 0
              ? <div style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>ninguna... la próxima 😅</div>
              : setlist.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: C.text, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.orange, marginRight: 8 }}>{i+1}.</span>{s}
                </div>
              ))
            }
          </div>
          <button onClick={startGame} style={{ ...S.btn, width: '100%', fontSize: 12 }}>jugar de nuevo</button>
        </div>
      )}
    </div>
  );
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
function MessagesScreen({ user, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const other = user === 'Frida' ? 'Amiel' : 'Frida';

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('messages').select('*')
        .or(`and(from_user.eq.${user},to_user.eq.${other}),and(from_user.eq.${other},to_user.eq.${user})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      setLoading(false);
      if (data?.length) {
        await supabase.from('messages').update({ read: true }).eq('to_user', user).eq('read', false);
      }
    };
    load();
    const sub = supabase.channel('messages-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        if ((msg.from_user === user && msg.to_user === other) || (msg.from_user === other && msg.to_user === user)) {
          setMessages(prev => [...prev, msg]);
        }
      }).subscribe();
    return () => supabase.removeChannel(sub);
  }, [user, other]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim(); setInput('');
    await supabase.from('messages').insert({ from_user: user, to_user: other, text });
  };

  return (
    <div style={{ ...S.screen, padding: 0, paddingBottom: 0 }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.surface }}>
        <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, padding: '8px 12px' }}>←</button>
        <div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>{other}</div>
          <div style={{ fontSize: 10, color: C.muted }}>mensajes privados</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 130 }}>
        {loading && <div style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>cargando...</div>}
        {!loading && messages.length === 0 && (
          <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            todavía no hay mensajes.<br/>escribile algo a {other} ♡
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.from_user === user ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '75%', padding: '8px 12px', background: m.from_user === user ? C.orange : C.surface2, color: m.from_user === user ? '#fff' : C.text, fontSize: 13, lineHeight: 1.5, borderRadius: m.from_user === user ? '12px 12px 2px 12px' : '12px 12px 12px 2px' }}>
              <div>{m.text}</div>
              <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>{formatDate(m.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, padding: '8px 16px', background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, zIndex: 50 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`escribile a ${other}...`}
          style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, padding: '10px 12px', fontFamily: "'Courier New', monospace", fontSize: 13, outline: 'none' }}
        />
        <button onClick={send} style={{ ...S.btn, padding: '10px 16px', fontSize: 13 }}>→</button>
      </div>
    </div>
  );
}

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────
function ArchiveScreen({ user, onBack, onReadStory }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('stories').select('*').eq('user_id', user).order('created_at', { ascending: false })
      .then(({ data }) => { setStories(data || []); setLoading(false); });
  }, [user]);

  return (
    <div style={{ ...S.screen, padding: '16px 16px 100px' }}>
      <button onClick={onBack} style={{ ...S.btnDark, fontSize: 12, marginBottom: 16, alignSelf: 'flex-start' }}>← volver</button>
      <div style={{ fontSize: 20, color: C.yellow, marginBottom: 20, fontWeight: 'bold' }}>archivo de historias</div>
      {loading && <div style={{ color: C.muted, fontSize: 12 }}>cargando...</div>}
      {!loading && stories.length === 0 && (
        <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 40 }}>
          todavía no guardaste ninguna historia.<br/>
          <span style={{ fontSize: 11 }}>generá una y guardala 💾</span>
        </div>
      )}
      {stories.map(s => (
        <div key={s.id} style={{ ...S.card, marginBottom: 12, position: 'relative' }}>
          <button onClick={async (e) => {
            e.stopPropagation();
            if (!window.confirm('¿Borrar esta historia?')) return;
            await supabase.from('stories').delete().eq('id', s.id);
            setStories(prev => prev.filter(x => x.id !== s.id));
          }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14, padding: '2px 6px', fontFamily: "'Courier New', monospace", lineHeight: 1 }}>✕</button>
          <div onClick={() => onReadStory(s)} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: 15, color: C.yellow, marginBottom: 4, paddingRight: 24 }}>{s.title}</div>
            {s.meta && <div style={{ fontSize: 10, color: C.orange, marginBottom: 6 }}>{s.meta}</div>}
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>{s.body?.slice(0, 120)}...</div>
            <div style={{ fontSize: 10, color: C.muted }}>{formatDate(s.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function BottomNav({ active, onNav }) {
  const tabs = [
    { key: 'home', icon: '⌂', label: 'inicio' },
    { key: 'generator', icon: '✦', label: 'historias' },
    { key: 'relax', icon: '◎', label: 'relax' },
    { key: 'messages', icon: '♡', label: 'mensajes' },
    { key: 'archive', icon: '▤', label: 'archivo' },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: C.surface, borderTop: `1px solid ${C.border}`, display: 'flex', zIndex: 100 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onNav(t.key)}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 18, color: active === t.key ? C.yellow : C.muted }}>{t.icon}</span>
          <span style={{ fontSize: 9, color: active === t.key ? C.yellow : C.muted, fontFamily: "'Courier New', monospace", letterSpacing: 0.5 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── STORY GEN ───────────────────────────────────────────────────────────────
async function generateStory(params, onChunk) {
  const { protagonists, artists, genre, scenario, length, user } = params;
  const lengthMap = { corta: '800-1200 palabras', media: '1500-2500 palabras', larga: '3000-5000 palabras' };
  const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: `Sos una escritora de fanfiction argentina experta en estilo Wattpad 2012-2018. Escribís en español rioplatense con vos, expresiones argentinas. Evitá el "che" constantemente — usalo solo en momentos naturales. Historias largas con mucho diálogo y descripciones vívidas. Tono tragicomédico. PROTAGONISTAS: Frida (alta, pelo naranja, creativa, caótica, mochila con stickers) y Amiel (pelo rojo con flequillo, dulce, observadora, resiliente, ingeniosa — siempre tiene un plan B; toma café todos los días y fernet con coca cuando hay fiesta). Se conocieron en el acampe del show de Niall Horan en el Luna Park de Buenos Aires en 2018. Primera línea del output: TÍTULO: [título]`,
    messages: [{ role: 'user', content: `Escribí una historia de fanfiction. PROTAGONISTAS: ${protagonists.join(' y ')}. ARTISTAS: ${artists.join(', ')}. GÉNERO: ${genre}. ESCENARIO: ${scenario}. LONGITUD: ${lengthMap[length]}. PERSPECTIVA: el lector es ${user}. Primera línea: TÍTULO: [título]. Segunda línea: META: ${artists.join(', ')} · ${genre} · ${scenario}. Luego el cuerpo de la historia.` }],
  });

  let full = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      full += chunk.delta.text;
      onChunk(full);
    }
  }
  return full;
}

function parseStory(raw) {
  const lines = raw.split('\n');
  let title = '', meta = '', bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('TÍTULO:')) { title = lines[i].replace('TÍTULO:', '').trim(); bodyStart = i + 1; }
    else if (lines[i].startsWith('META:')) { meta = lines[i].replace('META:', '').trim(); bodyStart = i + 1; }
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  return { title: title || 'historia sin título', meta, body };
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('fa_user'));
  const [screen, setScreen] = useState('home');
  const [storyParams, setStoryParams] = useState(null);
  const [currentStory, setCurrentStory] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastStory, setLastStory] = useState(null);

  const navTo = useCallback((s, data) => {
    setScreen(s);
    if (data && s === 'reader') setCurrentStory(data);
  }, []);

  const handleGenerate = useCallback(async (params) => {
    setStoryParams(params);
    setCurrentStory(null);
    setScreen('loading');
    setIsStreaming(true);
    try {
      let parsed = { title: '', meta: '', body: '' };
      await generateStory(params, (raw) => {
        parsed = parseStory(raw);
        setCurrentStory({ ...parsed });
      });
      setCurrentStory({ ...parsed });
      setIsStreaming(false);
      setScreen('reader');
    } catch (err) {
      console.error('Story gen error:', err);
      setCurrentStory({ title: 'error al generar', meta: '', body: `No se pudo generar la historia: ${err.message}` });
      setIsStreaming(false);
      setScreen('reader');
    }
  }, []);

  const handleGenerateFromSuggestion = useCallback((suggestion) => {
    handleGenerate({ protagonists: ['Frida', 'Amiel'], artists: [suggestion.artist], genre: 'romance', scenario: 'acampe', length: 'media', user });
  }, [user, handleGenerate]);

  const handleUserChange = useCallback(() => {
    localStorage.removeItem('fa_user');
    setUser(null);
  }, []);

  const handleSaveStory = useCallback(async (story) => {
    if (!story || !user) return;
    const { data } = await supabase.from('stories').insert({ user_id: user, title: story.title, body: story.body, meta: story.meta }).select().single();
    if (data) setLastStory(data);
  }, [user]);

  const showNav = ['home', 'generator', 'relax', 'messages', 'archive'].includes(screen);

  if (!user) {
    return (
      <div style={{ position: 'relative', minHeight: '100dvh' }}>
        <Starfield />
        <OnboardingScreen onDone={(u) => { setUser(u); setScreen('home'); }} />
      </div>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'home': return <HomeScreen user={user} onNav={navTo} onGenerateFromSuggestion={handleGenerateFromSuggestion} lastStory={lastStory} onUserChange={handleUserChange} />;
      case 'generator': return <GeneratorScreen user={user} onBack={() => setScreen('home')} onGenerate={handleGenerate} />;
      case 'loading': return <LoadingScreen />;
      case 'reader': return <ReaderScreen story={currentStory} user={user} onBack={() => setScreen(storyParams ? 'generator' : 'archive')} onSave={handleSaveStory} onNew={() => setScreen('generator')} isStreaming={isStreaming} />;
      case 'relax': return <RelaxScreen onNav={navTo} />;
      case 'stim': return <StimScreen onBack={() => setScreen('relax')} />;
      case 'breath': return <BreathScreen onBack={() => setScreen('relax')} />;
      case 'sounds': return <SoundsScreen onBack={() => setScreen('relax')} />;
      case 'game': return <GameScreen onBack={() => setScreen('relax')} />;
      case 'messages': return <MessagesScreen user={user} onBack={() => setScreen('home')} />;
      case 'archive': return <ArchiveScreen user={user} onBack={() => setScreen('home')} onReadStory={(s) => navTo('reader', s)} />;
      default: return <HomeScreen user={user} onNav={navTo} onGenerateFromSuggestion={handleGenerateFromSuggestion} lastStory={lastStory} onUserChange={handleUserChange} />;
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <Starfield />
      {renderScreen()}
      {showNav && <BottomNav active={screen} onNav={navTo} />}
    </div>
  );
}
