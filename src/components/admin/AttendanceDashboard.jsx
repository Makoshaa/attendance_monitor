import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function AttendanceDashboard() {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadAttendances = async (date) => {
    setLoading(true);
    try {
      const params = date ? { date } : {};
      const response = await api.get('/admin/attendance/all', { params });
      setAttendances(response.data.attendances || []);
    } catch (err) {
      console.error('Failed to load attendances:', err);
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendances(selectedDate);
  }, [selectedDate, lastRefresh]);

  const handleRefresh = () => {
    setLastRefresh(Date.now());
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  return (
    <div className="card fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.5rem' }}>
            Отметки сотрудников
          </h3>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Полная история посещений с фильтрацией
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            <span>Дата:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              style={{ maxWidth: '180px' }}
            />
          </label>
          {selectedDate && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedDate('')}
              style={{ padding: '0.5rem 1rem' }}
            >
              Сбросить
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefresh}
            style={{ padding: '0.5rem 1rem' }}
            title="Обновить данные"
          >
            ↻ Обновить
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          Загрузка...
        </div>
      ) : attendances.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--text-tertiary)',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}>
          Нет отметок за выбранный период
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Email</th>
                <th>Тип</th>
                <th>Подлинность</th>
                <th>Время отметки</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((record) => (
                <tr key={record.id}>
                  <td style={{ fontWeight: 600 }}>{record.userName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{record.userEmail}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: record.type === 'CHECK_OUT'
                          ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      {record.type === 'CHECK_OUT' ? 'Уход' : 'Приход'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      record.livenessScore > 0.9
                        ? 'badge-success'
                        : record.livenessScore > 0.7
                        ? 'badge-warning'
                        : 'badge-error'
                    }`}>
                      {(record.livenessScore * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(record.createdAt).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {attendances.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)'
        }}>
          <span>Всего записей: <strong>{attendances.length}</strong></span>
        </div>
      )}
    </div>
  );
}
