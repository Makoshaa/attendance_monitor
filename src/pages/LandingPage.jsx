export default function LandingPage() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: '3rem' }}>
      <section
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <span style={{ color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em' }}>
            REAL-TIME ATTENDANCE
          </span>
          <h1 style={{ fontSize: '2.5rem', margin: 0, lineHeight: 1.2 }}>
            Контроль посещаемости с проверкой подлинности лица в реальном времени
          </h1>
          <p style={{ color: '#4b5563', fontSize: '1rem', lineHeight: 1.6 }}>
            Система совмещает биометрическую идентификацию и детекцию поддельных лиц через WebAssembly-модуль,
            обеспечивает безопасную авторизацию сотрудников и даёт администраторам удобные инструменты управления.
          </p>
        </div>
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(229, 231, 235, 0.9)',
            borderRadius: '18px',
            padding: '2rem',
            display: 'grid',
            gap: '1.5rem',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.08)'
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: '#111827' }}>Возможности</h3>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: '#4b5563', lineHeight: 1.6 }}>
              <li>Двухфакторная проверка сотрудника: ливнес + сравнение с эталоном</li>
              <li>Отдельный кабинет администратора с управлением персоналом</li>
              <li>Хранение дескрипторов лиц в защищённой базе PostgreSQL</li>
            </ul>
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#111827' }}>Технологии</h3>
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', color: '#4b5563', lineHeight: 1.6 }}>
              <li>Node.js + Prisma + PostgreSQL для API и хранения данных</li>
              <li>face-api.js для генерации дескрипторов</li>
              <li>WebAssembly-модуль для анализа подлинности лиц</li>
            </ul>
          </div>
        </div>
      </section>
      <section
        style={{
          background: '#fff',
          borderRadius: '18px',
          padding: '2.5rem',
          border: '1px solid rgba(229, 231, 235, 0.9)',
          boxShadow: '0 18px 60px rgba(15, 23, 42, 0.04)'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#111827' }}>Как это работает</h2>
        <div
          style={{
            display: 'grid',
            gap: '1.5rem',
            marginTop: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
          }}
        >
          {[
            {
              title: 'Администратор',
              text:
                'Создаёт учетные записи сотрудников, загружает эталонные фотографии и управляет базой дескрипторов.'
            },
            {
              title: 'Сотрудник',
              text:
                'Авторизуется в системе, проходит проверку на подлинность через камеру и отмечает присутствие.'
            },
            {
              title: 'Сервер',
              text:
                'Сохраняет данные в PostgreSQL, извлекает дескрипторы и сравнивает их с эталонным набором (порог 0.6).'
            }
          ].map((item) => (
            <div key={item.title} style={{ display: 'grid', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>{item.title}</h3>
              <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.6 }}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
