# YouTube API Integration for Cinemax

## Overview
This integration dynamically links the TMDB API with the YouTube API to provide fallback video embedding for movies and TV shows. When a user selects a title, the system automatically searches YouTube for matching full movies or episodes and provides a seamless alternative to the primary streaming providers.

## Features

### 1. Automatic YouTube Search
- **Smart Matching**: Searches YouTube using movie/series title and release year from TMDB
- **Strict Filtering**: Excludes trailers, clips, and previews to find full content
- **TV Show Support**: Handles season and episode-specific searches for TV shows
- **Duration Validation**: Prioritizes videos with appropriate duration (60+ min for movies, 20-60 min for episodes)
- **Playlist Detection**: Automatically finds YouTube playlists for complete TV series/seasons

### 2. Custom YouTube Player
- **Premium UI**: Dark-mode player matching Cinemax's cinematic theme
- **Custom Controls**: Play/pause, volume, fullscreen, and progress controls
- **Responsive Design**: Adapts to different screen sizes seamlessly
- **Error Handling**: Automatic fallback to iframe player if YouTube fails

### 3. Full Series Playback
- **Playlist Support**: Automatically detects YouTube playlists for TV series
- **Episode Grid**: Visual episode selector for all episodes in a playlist
- **One-Click Episode Switching**: Click any episode number to play immediately
- **Season Support**: Searches for season-specific playlists when available
- **Fallback Logic**: Gracefully handles cases where YouTube content isn't available

### 4. Seamless Integration
- **Toggle Switch**: Users can switch between YouTube and primary streaming providers
- **Loading States**: Visual feedback during YouTube search
- **Episode Indicators**: Shows YouTube playlist availability with episode count
- **Dual Episode Selectors**: Separate YouTube and TMDB episode selectors

## Configuration

### Environment Variables
The YouTube API key is configured in your environment files:

**Development (.env.local):**
```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
```

**Production (.env.production):**
```env
VITE_YOUTUBE_API_KEY=AIzaSyD0J1BhaTamiF9jUExlY6zPej_bOX17VlU
```

### Security
- API key is stored as an environment variable (never hardcoded)
- Vite automatically injects it during build time
- Key is not exposed in client-side JavaScript bundles

## How It Works

### 1. User Selects a Movie/TV Show
```
User clicks movie → TMDB metadata loaded → YouTube search triggered
```

### 2. YouTube Search Process
```typescript
// From youtube.ts
const result = await searchYouTubeVideo(
  title,           // "The Matrix"
  year,            // 1999
  isTvShow,        // false
  season,          // undefined
  episode          // undefined
);
```

### 3. Search Query Construction
- Movies: `"The Matrix 1999" "full movie" -trailer -clip -preview`
- TV Shows: `"Breaking Bad" "season 1" "episode 1" "full episode" -trailer -clip`

### 4. Result Matching
- **Exact Match**: Video title closely matches TMDB title + appropriate duration
- **Fallback**: First result if no exact match found
- **No Results**: Falls back to primary streaming providers

### 5. Player Display
- YouTube toggle button appears when video is found
- User can switch between YouTube and primary providers
- Custom YouTube player provides premium viewing experience

## File Structure

```
website/
├── src/
│   ├── components/
│   │   └── YouTubePlayer.tsx       # Custom YouTube player component
│   ├── utils/
│   │   └── youtube.ts              # YouTube API service
│   └── components/
│       └── PlayerPage.tsx          # Integration point
├── .env.example                    # Example configuration
└── .env.production                 # Production configuration
```

## API Usage

### YouTube Service Functions

#### `searchYouTubeVideo(title, year, isTvShow, season, episode)`
Searches YouTube for matching videos.

```typescript
const result = await searchYouTubeVideo(
  "Inception",
  2010,
  false,
  undefined,
  undefined
);

// Returns:
{
  videos: YouTubeVideo[],
  exactMatch: YouTubeVideo | null,
  playlist: YouTubePlaylist | null,  // NEW: Playlist support for TV series
  totalResults: number
}
```

#### `buildYouTubeEmbedUrl(videoId, autoplay, startTime)`
Builds a YouTube embed URL with custom parameters.

```typescript
const url = buildYouTubeEmbedUrl("dQw4w9WgXcQ", true, 30);
// Returns: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&start=30&..."
```

#### `isYouTubeConfigured()`
Checks if YouTube API key is properly configured.

```typescript
if (isYouTubeConfigured()) {
  // YouTube integration is available
}
```

### New Playlist Functions

#### `YouTubePlaylist` Interface
Represents a YouTube playlist with full episode information.

```typescript
interface YouTubePlaylist {
  playlistId: string;
  title: string;
  description: string;
  thumbnail: string;
  videoCount: number;
  videos: YouTubeVideo[];  // All episodes in the playlist
}
```

#### Playlist Search Behavior
When searching for TV shows, the system now:
1. First searches for YouTube playlists (complete series/seasons)
2. If playlist found, returns all episodes with playlist metadata
3. Automatically matches specific episodes within playlists
4. Falls back to individual video search if no playlist available

#### Episode Matching in Playlists
The system uses multiple strategies to find episodes:
- **By Episode Number**: Uses playlist position as episode number
- **By Title Pattern**: Matches "Episode X" patterns in video titles
- **By Position**: Fallback to playlist position if other methods fail

## User Experience

### Normal Flow
1. User selects a movie from the homepage
2. Primary streaming provider loads (VidSrc, etc.)
3. YouTube search runs in background
4. If YouTube video found, "Switch to YouTube" button appears
5. User can toggle between providers

### YouTube-Only Flow
1. User selects a movie
2. Primary provider fails or is unavailable
3. User clicks "Switch to YouTube"
4. Custom YouTube player loads with matching video
5. Video plays with custom controls and dark theme

### TV Series Playlist Flow
1. User selects a TV show
2. YouTube automatically searches for playlists (complete seasons)
3. If playlist found, shows "YouTube Playlist (X episodes)" badge
4. YouTube episode grid appears with all available episodes
5. User can click any episode number to play immediately
6. Episode switches seamlessly within the YouTube player
7. TMDB episode selector remains available as fallback

## Troubleshooting

### YouTube Button Not Appearing
- Check if `VITE_YOUTUBE_API_KEY` is set in environment
- Verify API key is valid and has YouTube Data API v3 enabled
- Check browser console for API errors

### No YouTube Videos Found
- Search query may be too specific (try different title)
- Video may not be available on YouTube
- Check if video is region-restricted

### Player Not Loading
- Ensure YouTube Iframe API is accessible
- Check browser console for JavaScript errors
- Verify video ID is valid and not removed

## Performance Considerations

- YouTube search runs asynchronously (doesn't block initial player load)
- Search results are cached per movie/episode combination
- YouTube player only loads when user toggles to it
- Custom controls minimize YouTube API calls

## Future Enhancements

- [ ] Add YouTube video quality selector
- [ ] Implement YouTube playlist support for TV series
- [ ] Add YouTube search refinement options
- [ ] Cache YouTube search results in localStorage
- [ ] Add YouTube analytics tracking

## API Limits

YouTube Data API v3 has quota limits:
- **Daily quota**: 10,000 units
- **Search cost**: 100 units per request
- **Video details**: 1 unit per video

Current implementation uses ~101 units per movie search (search + video details).

## License

This integration is part of the Cinemax streaming platform.
