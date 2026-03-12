export function VaterContrails() {
  return (
    <div className="vater-contrails" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="vater-contrail" />
      ))}
    </div>
  );
}
