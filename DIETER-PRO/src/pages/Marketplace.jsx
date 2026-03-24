import { useState, useEffect, useCallback } from 'react';

const CATEGORIES = ['All', 'Beats', 'Samples', 'Presets', 'Vocals', 'Loops', 'Sound FX'];

const MOCK_LISTINGS = Array.from({ length: 24 }, (_, i) => ({
  id: `listing-${i}`,
  title: ['Midnight Trap Kit', 'Lo-Fi Piano Chords', 'Ambient Texture Pack', 'Drill 808 Bass Pack', 'Vocal Chop Collection', 'Synthwave Arps Bundle', 'Afrobeat Drum Kit', 'Jazz Chord Progressions'][i % 8],
  artist: ['ProducerX', 'BeatKing', 'SoundWizard', 'LoopMaster', 'VocalPro', 'SynthLord'][i % 6],
  category: CATEGORIES[1 + (i % 6)],
  price: [0, 4.99, 9.99, 14.99, 19.99, 24.99][i % 6],
  downloads: Math.floor(Math.random() * 5000) + 100,
  rating: (3.5 + Math.random() * 1.5).toFixed(1),
  tags: [['trap', 'dark'], ['lofi', 'chill'], ['ambient', 'texture'], ['drill', 'bass'], ['vocal', 'chops'], ['synth', '80s']][i % 6],
  color: ['#a855f7', '#f97316', '#38bdf8', '#ec4899', '#22c55e', '#eab308'][i % 6],
}));

export default function Marketplace() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');

  const filtered = MOCK_LISTINGS.filter((l) => {
    if (category !== 'All' && l.category !== category) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => sort === 'popular' ? b.downloads - a.downloads : sort === 'price' ? a.price - b.price : b.rating - a.rating);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search marketplace..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 250 }}
        />
        <div style={{ display: 'flex', gap: 3 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={`tag${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="popular">Most Popular</option>
          <option value="price">Lowest Price</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            className="panel"
            style={{ border: `1px solid ${item.color}22`, transition: 'all 0.15s', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color + '55'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = item.color + '22'; }}
          >
            <div style={{ height: 60, borderRadius: 6, marginBottom: 8, background: `linear-gradient(135deg, ${item.color}22, ${item.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.5rem', opacity: 0.6 }}>🎵</span>
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', marginBottom: 2 }}>{item.title}</div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: 6 }}>by {item.artist}</div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {item.tags.map((t) => (
                <span key={t} style={{ fontSize: '0.55rem', padding: '1px 6px', borderRadius: 999, background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}33` }}>{t}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: item.price === 0 ? '#22c55e' : '#e5e7eb' }}>
                {item.price === 0 ? 'FREE' : `$${item.price}`}
              </span>
              <div style={{ display: 'flex', gap: 8, fontSize: '0.58rem', color: '#6b7280' }}>
                <span>⬇ {item.downloads}</span>
                <span>⭐ {item.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
