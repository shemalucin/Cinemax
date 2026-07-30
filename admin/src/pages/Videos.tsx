import { useCallback, useEffect, useRef, useState } from 'react';
import { websiteApi } from '../lib/websiteApi';
import { Loader2, Video, Send, Trash2, Users, UploadCloud, Film } from 'lucide-react';

export default function Videos() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ recipients: number } | null>(null);
  const [deleteMenuOpen, setDeleteMenuOpen] = useState<string | null>(null);
  const [commentsModalOpen, setCommentsModalOpen] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteApi.getVideos();
      setVideos(data.videos || []);
    } catch (e: any) {
      // Silently handle error - show empty state instead of error
      setVideos([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setSending(true);
    setSent(null);
    try {
      const res = await websiteApi.uploadVideo(file, title.trim(), description.trim());
      setSent({ recipients: res.video?.notified_users ?? 0 });
      setTitle('');
      setDescription('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      setTimeout(() => setSent(null), 5000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string, deleteEverywhere: boolean = false) => {
    const message = deleteEverywhere 
      ? 'Delete this video everywhere? This will permanently remove the video file from both admin and website. Users will no longer be able to play it.'
      : 'Delete from admin only? This removes the video from the admin panel but keeps it accessible on the website for users who already received the notification.';
    
    if (!confirm(message)) return;
    try {
      await websiteApi.deleteVideo(id, deleteEverywhere);
      setDeleteMenuOpen(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const loadComments = async (videoId: string) => {
    setLoadingComments(true);
    try {
      const data = await websiteApi.getVideoComments(videoId);
      setComments(data.comments || []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    const text = replyText[commentId];
    if (!text || !text.trim()) return;
    
    setSubmittingReply(commentId);
    try {
      await websiteApi.replyToVideoComment(commentsModalOpen!, commentId, text.trim());
      setReplyText({ ...replyText, [commentId]: '' });
      loadComments(commentsModalOpen!);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingReply(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await websiteApi.deleteVideoComment(commentsModalOpen!, commentId);
      loadComments(commentsModalOpen!);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Video className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
          Video
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Upload a video and send it — every user instantly gets a "Admin added a video" notification.
          Tapping it on the site opens the player and plays this file automatically.
        </p>
      </div>

      {sent != null && (
        <div className="rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2 accent-chip">
          <Users className="w-4 h-4" /> Sent — notified {sent.recipients} user{sent.recipients === 1 ? '' : 's'}.
        </div>
      )}

      <form onSubmit={handleSend} className="rounded-2xl p-5 space-y-3 glass-card">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title"
          className="input-base"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional) — shown in the notification body"
          rows={3}
          className="input-base resize-none"
        />

        <label
          htmlFor="video-upload-input"
          className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer border border-dashed transition-colors"
          style={{ borderColor: file ? 'var(--accent)' : 'var(--border)' }}
        >
          {file ? <Film className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-text)' }} /> : <UploadCloud className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: file ? 'var(--text)' : 'var(--text-muted)' }}>
              {file ? file.name : 'Choose a video file (mp4, webm, mov, m4v)'}
            </p>
            {file && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
          </div>
        </label>
        <input
          id="video-upload-input"
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          type="submit"
          disabled={sending || !title.trim() || !file}
          className="neon-btn flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs uppercase disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {sending ? 'Uploading…' : 'Send to All Users'}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white">Sent Videos</h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-text)' }} />
          </div>
        ) : error ? (
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        ) : videos.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No videos sent yet.</p>
        ) : (
          <div className="space-y-2">
            {videos.map((v) => (
              <div key={v.id} className="rounded-xl p-4 flex items-center gap-3 glass-card relative">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 accent-chip">
                  <Video className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{v.title}</p>
                  {v.description && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{v.description}</p>}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Notified {v.notified_users} users &middot; {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setCommentsModalOpen(v.id);
                      loadComments(v.id);
                    }}
                    title="View comments"
                    className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    💬
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDeleteMenuOpen(deleteMenuOpen === v.id ? null : v.id)}
                      title="Delete options"
                      className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs font-bold"
                    >
                      ⋯
                    </button>
                    {deleteMenuOpen === v.id && (
                      <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-xl z-10 overflow-hidden">
                        <button
                          onClick={() => handleDelete(v.id, false)}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete from Admin only
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, true)}
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-2 border-t border-white/5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Everywhere
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {commentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Video Comments</h2>
              <button
                onClick={() => setCommentsModalOpen(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingComments ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-text)' }} />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-center py-10" style={{ color: 'var(--text-muted)' }}>No comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl p-4 border border-white/5 bg-white/[0.02] space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {comment.user_avatar ? (
                          <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-neutral-400">
                            {comment.user_name?.charAt(0).toUpperCase() || "U"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">{comment.user_name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-xs text-neutral-300 mt-1 break-words">{comment.text}</p>
                        {comment.admin_reply && (
                          <div className="mt-2 p-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/20">
                            <p className="text-[10px] font-bold text-[#39FF14] mb-1">Admin Reply</p>
                            <p className="text-xs text-neutral-300">{comment.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <input
                        type="text"
                        value={replyText[comment.id] || ''}
                        onChange={(e) => setReplyText({ ...replyText, [comment.id]: e.target.value })}
                        placeholder="Reply as admin..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs focus:outline-none focus:border-[#39FF14]"
                      />
                      <button
                        onClick={() => handleReplySubmit(comment.id)}
                        disabled={submittingReply === comment.id || !replyText[comment.id]?.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[#39FF14] text-black font-semibold text-xs hover:bg-[#39FF14]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {submittingReply === comment.id ? '...' : 'Reply'}
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
