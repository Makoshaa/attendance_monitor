export default function ProgressBar({ progress, label }) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem'
        }}>
          <span>{label}</span>
          <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      )}
      <div className="progress-container">
        <div
          className="progress-bar"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
    </div>
  );
}
