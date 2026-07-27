import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Plus, Pencil, Trash2, X, Film, Star, Sparkles, Upload, Search, Loader2, Check } from 'lucide-react';

type MediaType = 'movie' | 'tv';

interface MoviesProps {
  typeFilter: 'movie' | 'tvshow';
  search: string;
}

const emptyForm = {
  title: '',
  overview: '',
  posterUrl: '',
  backdropUrl: '',
  trailerYoutubeKey: '',
  fullMovieUrl: '',
  genreNames: '' as string, // comma-separated in the form, split on save
  releaseDate: '',
  rating: 7,
  featured: false,
};

export default function Movies({ typeFilter, search }: MoviesProps) {
  const mediaType: MediaType = typeFilter === 'tvshow' ? 'tv' : 'movie';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  
  // TMDB Search State
  const [tmdbSearchOpen, setTmdbSearchOpen] = useState(false);
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbSearching, setTmdbSearching] = useState(false);
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [selectedTMDB, setSelectedTMDB] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: all } = (await websiteApi.getContent()) as { items: any[] };
      let list = all.filter((m) => m.mediaType === mediaType);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter((m) => m.title.toLowerCase().includes(q));
      }
      setItems(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mediaType, search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { 
    setEditing(null); 
    setForm({ ...emptyForm }); 
    setSaveError(null); 
    setVideoUploadError(null);
    setTmdbSearchOpen(true); // Open TMDB search instead of manual form
  };
  
  // TMDB Search Functions
  const handleTMDBSearch = async () => {
    if (!tmdbQuery.trim() || tmdbQuery.trim().length < 2) {
      setTmdbError('Please enter at least 2 characters');
      return;
    }
    
    setTmdbSearching(true);
    setTmdbError(null);
    setTmdbResults([]);
    
    try {
      const data = await websiteApi.searchTMDB(tmdbQuery, mediaType);
      setTmdbResults(data.results || []);
    } catch (err: any) {
      setTmdbError(err.message || 'Failed to search TMDB');
    } finally {
      setTmdbSearching(false);
    }
  };
  
  const selectTMDBItem = async (item: any) => {
    setSelectedTMDB(item);
    setLoadingDetails(true);
    
    try {
      const itemType = item.media_type === 'tv' ? 'tv' : 'movie';
      const data = await websiteApi.getTMDBDetails(itemType, item.id);
      
      // Check for duplicate by TMDB ID
      const existingMovie = items.find((m) => m.tmdbId === item.id);
      if (existingMovie) {
        setTmdbError(`This movie has already been added as "${existingMovie.title}".`);
        setLoadingDetails(false);
        return;
      }
      
      // Pre-fill form with TMDB data
      const posterUrl = data.details.poster_path 
        ? `https://image.tmdb.org/t/p/w500${data.details.poster_path}` 
        : '';
      const backdropUrl = data.details.backdrop_path 
        ? `https://image.tmdb.org/t/p/original${data.details.backdrop_path}` 
        : posterUrl;
      
      setForm({
 ...emptyForm,
        title: data.details.title,
        overview: data.details.overview,
        posterUrl,
        backdropUrl,
        trailerYoutubeKey: data.details.trailer_youtube_key || '',
        genreNames: data.details.genre_names.join(', '),
        releaseDate: data.details.release_date || '',
        rating: data.details.vote_average || 7,
      });
      
      // Store TMDB data for submission
      setSelectedTMDB({
        ...data.details,
        cast: data.cast,
        crew: data.crew,
        seasons: data.seasons,
        episodes: data.episodes,
      });
      
      setTmdbSearchOpen(false);
      setModalOpen(true);
    } catch (err: any) {
      setTmdbError(err.message || 'Failed to load TMDB details');
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const save = async () => {
    if (!form.title.trim() || !form.posterUrl.trim()) {
      setSaveError('Title and a poster image URL are both required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    
    const payload: any = {
      title: form.title.trim(),
      overview: form.overview.trim(),
      posterUrl: form.posterUrl.trim(),
      backdropUrl: form.backdropUrl.trim() || form.posterUrl.trim(),
      trailerYoutubeKey: form.trailerYoutubeKey.trim(),
      fullMovieUrl: form.fullMovieUrl.trim(),
      mediaType,
      genreNames: form.genreNames.split(',').map((g: string) => g.trim()).filter(Boolean).slice(0, 6),
      releaseDate: form.releaseDate || undefined,
      rating: Number(form.rating) || 0,
      featured: form.featured,
    };
    
    // Add TMDB data if imported
    if (selectedTMDB) {
      payload.tmdbId = selectedTMDB.tmdb_id;
      payload.genreIds = selectedTMDB.genre_ids;
      payload.seasons = selectedTMDB.seasons;
      payload.episodes = selectedTMDB.episodes;
      payload.cast = selectedTMDB.cast;
      payload.crew = selectedTMDB.crew;
      payload.firstAirDate = selectedTMDB.first_air_date;
      payload.lastAirDate = selectedTMDB.last_air_date;
      payload.status = selectedTMDB.status;
      payload.numberOfSeasons = selectedTMDB.number_of_seasons;
      payload.numberOfEpisodes = selectedTMDB.number_of_episodes;
      payload.originalLanguage = selectedTMDB.original_language;
      payload.originalTitle = selectedTMDB.original_title;
      payload.popularity = selectedTMDB.popularity;
      payload.voteCount = selectedTMDB.vote_count;
      payload.video = selectedTMDB.video;
    }
    
    try {
      if (editing) await websiteApi.updateContent(editing.id, payload);
      else await websiteApi.createContent(payload);
      setModalOpen(false);
      setSelectedTMDB(null);
      load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      title: m.title,
      overview: m.overview || '',
      posterUrl: m.posterUrl || '',
      backdropUrl: m.backdropUrl || '',
      trailerYoutubeKey: m.trailerYoutubeKey || '',
      fullMovieUrl: m.fullMovieUrl || '',
      genreNames: (m.genreNames || []).join(', '),
      releaseDate: m.releaseDate || '',
      rating: m.rating ?? 7,
      featured: !!m.featured,
    });
    setSaveError(null);
    setVideoUploadError(null);
    setModalOpen(true);
  };

  const handleUploadVideo = async (file: File) => {
    if (!editing) return;
    setVideoUploading(true);
    setVideoUploadError(null);
    try {
      const { item } = await websiteApi.uploadContentVideo(editing.id, file);
      setEditing(item);
      load();
    } catch (e: any) {
      setVideoUploadError(e.message || 'Upload failed.');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!editing) return;
    if (!confirm('Remove the uploaded video for this title? Only the trailer will be watchable afterward.')) return;
    setVideoUploading(true);
    setVideoUploadError(null);
    try {
      const { item } = await websiteApi.removeContentVideo(editing.id);
      setEditing(item);
      load();
    } catch (e: any) {
      setVideoUploadError(e.message || 'Failed to remove video.');
    } finally {
      setVideoUploading(false);
    }
  };

  const remove = async (m: any) => {
    if (!confirm(`Delete "${m.title}"? This removes it from the live website immediately.`)) return;
    try {
      await websiteApi.deleteContent(m.id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const label = mediaType === 'tv' ? 'TV Show' : 'Movie';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{label}s</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cinemax Originals — admin-authored titles shown on the website's homepage, alongside the TMDB catalog.
          </p>
        </div>
        <button onClick={openNew} className="neon-btn flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm cursor-pointer">
          <Plus className="w-4 h-4" /> Add {label}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(57,255,20,0.2)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <Film className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {label.toLowerCase()}s yet. Add your first one to feature it on the homepage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((m) => (
            <div key={m.id} className="rounded-2xl overflow-hidden group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="aspect-[2/3] relative overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                {m.posterUrl ? <img src={m.posterUrl} alt={m.title} className="w-full h-full object-cover" /> : <Film className="w-8 h-8 m-auto" style={{ color: 'var(--text-faint)' }} />}
                {m.featured && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: 'var(--accent)', color: '#050505' }}>
                    <Sparkles className="w-3 h-3" /> Featured
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <button onClick={() => openEdit(m)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'var(--accent)', color: '#050505' }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(m)} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-white truncate">{m.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{(m.releaseDate || '').slice(0, 4) || '—'}</span>
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
                    <Star className="w-3 h-3 fill-current" /> {m.rating?.toFixed?.(1) ?? m.rating}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TMDB Search Modal */}
      {tmdbSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setTmdbSearchOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Search TMDB</h2>
              <button onClick={() => setTmdbSearchOpen(false)} className="cursor-pointer"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <div className="flex gap-2">
              <input
                className="input-base flex-1"
                placeholder={`Search for ${mediaType === 'tv' ? 'TV shows' : 'movies'}...`}
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTMDBSearch()}
              />
              <button
                onClick={handleTMDBSearch}
                disabled={tmdbSearching}
                className="neon-btn px-4 py-2 rounded-xl font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {tmdbSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {tmdbSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {tmdbError && (
              <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{tmdbError}</div>
            )}

            {tmdbResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Results ({tmdbResults.length})</p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {tmdbResults.map((item) => {
                    const isDuplicate = items.some((m) => m.tmdbId === item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isDuplicate && selectTMDBItem(item)}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isDuplicate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
                        }`}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                      >
                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt={item.title || item.name}
                            className="w-12 h-16 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-md flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>
                            <Film className="w-5 h-5" style={{ color: 'var(--text-faint)' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.title || item.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {(item.release_date || item.first_air_date || '').slice(0, 4)} • {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          </p>
                          {item.vote_average && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 text-amber-500 fill-current" />
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.vote_average.toFixed(1)}</span>
                            </div>
                          )}
                          {isDuplicate && (
                            <p className="text-xs font-semibold mt-1" style={{ color: '#f87171' }}>Already added</p>
                          )}
                        </div>
                        {isDuplicate ? (
                          <Check className="w-5 h-5" style={{ color: '#22c55e' }} />
                        ) : (
                          <Check className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tmdbQuery && !tmdbSearching && tmdbResults.length === 0 && !tmdbError && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found. Try a different search term.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit' : 'Add'} {label}</h2>
              <button onClick={() => setModalOpen(false)} className="cursor-pointer"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <Field label="Title *"><input className="input-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Overview"><textarea rows={3} className="input-base resize-none" value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poster Image *">
                <ImageInput
                  value={form.posterUrl}
                  onChange={(v) => setForm({ ...form, posterUrl: v })}
                  onError={setSaveError}
                />
              </Field>
              <Field label="Backdrop Image">
                <ImageInput
                  value={form.backdropUrl}
                  onChange={(v) => setForm({ ...form, backdropUrl: v })}
                  onError={setSaveError}
                />
              </Field>
            </div>
            <Field label="YouTube Trailer Key (e.g. dQw4w9WgXcQ)"><input className="input-base" value={form.trailerYoutubeKey} onChange={(e) => setForm({ ...form, trailerYoutubeKey: e.target.value })} /></Field>
            <Field label="Full Movie URL (e.g., https://example.com/movie/avatar)">
              <input 
                className="input-base" 
                placeholder="https://example.com/movie/avatar" 
                value={form.fullMovieUrl} 
                onChange={(e) => setForm({ ...form, fullMovieUrl: e.target.value })} 
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                External streaming URL. Users will be directed to this URL when clicking "Watch Movie".
              </p>
            </Field>

            <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold">Your own video file (optional)</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Only upload a file here if you own the rights to it. When present, viewers can
                watch it directly; otherwise only the trailer above plays.
              </p>
              {!editing ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Save this title first, then reopen it to upload a video.
                </p>
              ) : (
                <>
                  {editing.videoUrl ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>Video uploaded ✓</span>
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        disabled={videoUploading}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                      <Upload className="w-4 h-4" />
                      <span>{videoUploading ? 'Uploading…' : 'Choose video file (mp4, webm, mov, m4v)'}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.m4v"
                        className="hidden"
                        disabled={videoUploading}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadVideo(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {videoUploadError && <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{videoUploadError}</p>}
                </>
              )}
            </div>

            <Field label="Genres (comma-separated)"><input className="input-base" placeholder="Action, Sci-Fi" value={form.genreNames} onChange={(e) => setForm({ ...form, genreNames: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Release Date"><input type="date" className="input-base" value={form.releaseDate || ''} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></Field>
              <Field label="Rating (0–10)"><input type="number" min={0} max={10} step={0.1} className="input-base" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} /></Field>
            </div>
            <label className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Feature on homepage</span>
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4" />
            </label>

            {saveError && <p className="text-xs font-semibold" style={{ color: '#f87171' }}>{saveError}</p>}

            <button onClick={save} disabled={saving} className="w-full neon-btn font-bold py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-60">
              {saving ? 'Saving...' : editing ? 'Save Changes' : `Add ${label}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Image input that accepts either a hosted URL or a local file upload
 * (converted to a data URL so it merges into the same list as remote titles).
 * Keeps the input as a single value string so the save payload is unchanged.
 */
function ImageInput({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (v: string) => void;
  onError: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => fileRef.current?.click();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file (PNG, JPG, WebP).');
      return;
    }
    // ~4MB cap so the JSON payload stays reasonable when embedded as base64.
    if (file.size > 4 * 1024 * 1024) {
      onError('Image is over 4MB. Please choose a smaller file or paste a URL.');
      return;
    }
    setUploading(true);
    onError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error('Read failed'));
        reader.readAsDataURL(file);
      });
      onChange(dataUrl);
    } catch (err: any) {
      onError(err?.message || 'Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  const isDataUrl = value.startsWith('data:');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input-base flex-1"
          placeholder="https://... or upload"
          value={isDataUrl ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
          style={{ background: 'rgba(57,255,20,0.1)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.25)' }}
          title="Upload from your device"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? '...' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      {value && (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt=""
            className="w-12 h-16 object-cover rounded-md"
            style={{ background: 'var(--surface-3)' }}
          />
          {isDataUrl && (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Local upload — will be saved with this title.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
