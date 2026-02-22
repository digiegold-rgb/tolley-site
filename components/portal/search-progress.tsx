type SearchProgressProps = {
  visible: boolean;
};

const SEARCH_PROGRESS_MESSAGE =
  "Where pioneering meets modern systems—and results happen…";

export function SearchProgress({ visible }: SearchProgressProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="progress-pill mt-5 inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm text-white/86">
      <span className="progress-orb" aria-hidden="true" />
      <span className="tracking-[0.015em]">{SEARCH_PROGRESS_MESSAGE}</span>
      <span className="progress-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
