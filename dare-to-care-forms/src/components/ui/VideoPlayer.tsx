import { useState, useRef, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
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
        // We get a signed download URL directly from Firebase Storage without a backend!
        const url = await getDownloadURL(ref(storage, storagePath));
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
