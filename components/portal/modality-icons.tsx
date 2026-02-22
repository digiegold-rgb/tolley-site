type IconProps = {
  className?: string;
};

function MicIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M12 15.5a3.8 3.8 0 0 0 3.8-3.8V7.8a3.8 3.8 0 0 0-7.6 0v3.9a3.8 3.8 0 0 0 3.8 3.8Z" />
      <path d="M18.2 12.7a6.2 6.2 0 0 1-12.4 0" />
      <path d="M12 18.9v3.1" />
    </svg>
  );
}

function ImageFileIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M8.6 3.5h5.8l3.2 3.2v11.4a2.4 2.4 0 0 1-2.4 2.4H8.6a2.4 2.4 0 0 1-2.4-2.4V5.9a2.4 2.4 0 0 1 2.4-2.4Z" />
      <path d="M14.4 3.5v3.2h3.2" />
      <path d="m8.9 16.6 2.6-2.6 1.8 1.8 2.9-2.9 1.4 1.4" />
      <circle cx="10" cy="10.5" r="1.2" />
    </svg>
  );
}

function VideoIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="4.5" y="6.5" width="11.5" height="11" rx="2.4" />
      <path d="m15.8 10.2 3.7-2.1v7.8l-3.7-2.1" />
    </svg>
  );
}

export function ModalityRail() {
  return (
    <div
      aria-hidden="true"
      className="modality-rail pointer-events-none flex items-center gap-1.5 text-white/52"
      title="Ready for audio, photos, video, and files"
    >
      <span className="modality-ready hidden text-[0.56rem] tracking-[0.16em] text-white/62 uppercase md:inline">
        ready
      </span>
      <span className="modality-icon">
        <MicIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="modality-icon">
        <ImageFileIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="modality-icon">
        <VideoIcon className="h-[18px] w-[18px]" />
      </span>
    </div>
  );
}
