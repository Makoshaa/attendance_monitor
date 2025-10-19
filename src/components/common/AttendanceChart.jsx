export default function AttendanceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        color: 'var(--text-tertiary)',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        Нет данных для отображения
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(data.length, 7)}, 1fr)`,
        gap: '1rem',
        alignItems: 'end',
        minHeight: '200px',
        padding: '1rem',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-light)'
      }}>
        {data.slice(0, 7).map((item, index) => {
          const height = (item.count / maxCount) * 100;
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                height: '160px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end'
              }}>
                <div
                  style={{
                    height: `${height}%`,
                    background: 'linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    minHeight: '30px'
                  }}
                >
                  {item.count}
                </div>
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                fontWeight: 500
              }}>
                {item.date}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{
          padding: '1rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Всего отметок
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {data.reduce((sum, item) => sum + item.count, 0)}
          </div>
        </div>
        <div style={{
          padding: '1rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Средняя подлинность
          </div>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            color: (() => {
              const percentage = data.reduce((sum, item) => sum + (item.avgConfidence || 0), 0) / data.length * 100;
              if (percentage >= 95) return 'var(--accent-success)'; // Зеленый для 95%+
              if (percentage >= 85) return 'var(--accent-primary)'; // Синий для 85-94%
              if (percentage >= 70) return 'var(--accent-warning)'; // Оранжевый для 70-84%
              return 'var(--accent-error)'; // Красный для <70%
            })()
          }}>
            {(data.reduce((sum, item) => sum + (item.avgConfidence || 0), 0) / data.length * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
