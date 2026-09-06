import { useState, useRef, useEffect } from 'react';
// @ts-ignore - JS module without types
import { signedUrl } from '../../lib/db.js';
import { BUCKETS } from '../../config/supabase';
import './VideoPlayer.css'; // Will create a quick stylesheet for styling

interface VideoPlayerProps {
  storagePath: string;
  title?: string;
  onEnded?: () => void;
}

export function VideoPlayer({ storagePath, title, onEnded }: VideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function fetchVideo() {
      try {
        setLoading(true);
        // A signed URL straight from Storage, no backend needed. Unlike the
        // Firebase download URL this replaces, it expires — two hours, so a
        // long video cannot die mid-playback — and it is only issued if the
        // storage policy says this viewer may read the object.
        const path = storagePath.replace(/^courses\//, '');
        const url = await signedUrl(BUCKETS.courses, path, 7200);
        if (!url) throw new Error('No access to this video');
        setVideoUrl(url);
      } catch (err: any) {
        console.error("Error fetching video:", err);
        setError("Failed to load video. Ensure the file exists and you have permission to view it.");
      } finally {
        setLoading(false);
      }
    }
    fetchVideo();
  }, [storagePath]);

  if (error) {
    return (
      <div className="video-player-error">
        <p>⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="video-player-container">
      {title && <h3 className="video-title">{title}</h3>}
      
      {loading ? (
        <div className="video-loading">
          <p>Loading secure stream...</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          controls
          controlsList="nodownload"
          preload="metadata"
          className="styled-video"
          poster="/placeholder-poster.jpg" // Optional placeholder
          onEnded={onEnded}
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
