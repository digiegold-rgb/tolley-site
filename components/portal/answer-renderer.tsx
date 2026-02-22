type AnswerRendererProps = {
  text: string;
};

function isBulletLine(line: string) {
  return /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function toBulletText(line: string) {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
}

export function AnswerRenderer({ text }: AnswerRendererProps) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const bulletLines = lines.filter(isBulletLine);
  const paragraphLines = lines.filter((line) => !isBulletLine(line));

  return (
    <div className="space-y-3 text-sm leading-6 text-white/86 sm:text-[0.95rem]">
      {paragraphLines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}

      {bulletLines.length ? (
        <ul className="space-y-1.5 pt-1">
          {bulletLines.map((line, index) => (
            <li key={`${line}-${index}`} className="flex gap-2.5">
              <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/80" />
              <span>{toBulletText(line)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
