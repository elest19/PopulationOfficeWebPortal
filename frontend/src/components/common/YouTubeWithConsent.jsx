import React, { useMemo, useState } from 'react';
import { Modal, Button } from '@mantine/core';

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  // If it's already an ID (no protocol and no slashes), return as-is
  if (!/^https?:\/\//i.test(urlOrId) && !urlOrId.includes('/')) return urlOrId;

  try {
    const url = new URL(urlOrId);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '');
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      // handle /embed/ID
      const parts = url.pathname.split('/');
      const embedIndex = parts.indexOf('embed');
      if (embedIndex !== -1 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
  } catch (_) {
    // ignore parsing errors
  }
  return urlOrId;
}

export function YouTubeWithConsent({ videoUrl, videoId, title = 'Embedded YouTube Video', ratio = '16x9' }) {
  const [opened, setOpened] = useState(false);
  const [consented, setConsented] = useState(false);

  const id = useMemo(() => extractYouTubeId(videoId || videoUrl), [videoId, videoUrl]);
  const src = id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : '';

  const handleRequestPlay = () => setOpened(true);
  const handleConfirm = () => {
    setOpened(false);
    setConsented(true);
  };

  const ratioClass = useMemo(() => {
    // map common ratios to Bootstrap ratio classes
    switch (ratio) {
      case '1x1': return 'ratio-1x1';
      case '4x3': return 'ratio-4x3';
      case '21x9': return 'ratio-21x9';
      case '16x9':
      default:
        return 'ratio-16x9';
    }
  }, [ratio]);

  return (
    <div>
      {!consented ? (
        <button
          type="button"
          aria-label="Play video (opens disclosure)"
          onClick={handleRequestPlay}
          className="w-100 border-0 bg-transparent p-0"
        >
          <div className={`ratio ${ratioClass} rounded shadow-sm position-relative bg-light`}>
            <div className="d-flex align-items-center justify-content-center h-100 w-100">
              <div className="text-center">
                <div className="bg-danger text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                  </svg>
                </div>
                <div className="mt-2 small text-muted">Click to view YouTube video</div>
              </div>
            </div>
          </div>
        </button>
      ) : (
        <div className={`ratio ${ratioClass} rounded overflow-hidden shadow-sm`}>
          <iframe
            title={title}
            src={src}
            style={{ border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title="Disclosure Notice" centered>
        <div className="mb-3">
          <p className="mb-2">
            This video is hosted on YouTube, a third-party platform. By choosing to view this content, you acknowledge that
            YouTube may process your data in accordance with its own terms, which may include the use of cookies, tracking
            technologies, and other forms of data processing not governed by this website.
          </p>
          <p className="mb-0">
            If you consent, the video will be loaded from YouTube and may collect information about your interaction with this
            media. For more details, please review YouTube’s Terms of Service and Privacy Policy.
          </p>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <Button onClick={handleConfirm}>I Understand</Button>
        </div>
      </Modal>
    </div>
  );
}
