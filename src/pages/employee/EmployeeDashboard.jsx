import { useEffect, useState } from 'react';

import api from '@/lib/api';
import AttendanceModal from '@/components/attendance/AttendanceModal.jsx';
import AttendanceChart from '@/components/common/AttendanceChart.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    avgConfidence: 0,
    chartData: []
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [attendanceType, setAttendanceType] = useState('CHECK_IN');
  const [message, setMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const checkTodayAttendance = (records) => {
    if (!records || records.length === 0) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastRecord = records[0];
    const lastRecordDate = new Date(lastRecord.createdAt);
    lastRecordDate.setHours(0, 0, 0, 0);

    return lastRecordDate.getTime() === today.getTime();
  };

  const loadData = async (autoOpenModal = true) => {
    console.log('Loading attendance data...', { isInitialLoad, autoOpenModal });

    if (isInitialLoad) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [historyRes, statsRes] = await Promise.all([
        api.get('/attendance/history'),
        api.get('/attendance/stats')
      ]);

      const records = historyRes.data.records || [];
      console.log(`Loaded ${records.length} attendance records`);
      if (records.length > 0) {
        console.log('Most recent record:', records[0]);
      }
      setHistory(records);

      // Ensure stats always has default values
      const statsData = statsRes.data || {
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        avgConfidence: 0,
        chartData: []
      };
      console.log('Loaded stats:', statsData);
      setStats(statsData);

      const checkedIn = checkTodayAttendance(records);
      console.log('Checked in today:', checkedIn);
      setHasCheckedInToday(checkedIn);

      // Only auto-open modal on initial load and if not checked in
      if (autoOpenModal && isInitialLoad && !checkedIn) {
        setModalOpen(true);
      }

      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      // Set default stats even on error
      setStats({
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        avgConfidence: 0,
        chartData: []
      });
      // Only auto-open modal on error if it's the initial load
      if (autoOpenModal && isInitialLoad) {
        setModalOpen(true);
      }
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSuccess = async (payload) => {
    console.log('Attendance marked successfully:', payload);
    setModalOpen(false);

    if (payload.type === 'CHECK_OUT') {
      setMessage(`Уход подтвержден. Подлинность: ${(payload.livenessScore * 100).toFixed(1)}%. Выход из системы...`);
      // При уходе - выход из системы через 2 секунды
      setTimeout(async () => {
        console.log('Logging out after checkout...');
        await logout();
      }, 2000);
    } else {
      // При приходе - обновляем данные
      setMessage(`Приход отмечен. Подлинность: ${(payload.livenessScore * 100).toFixed(1)}%`);
      setHasCheckedInToday(true);
      setTimeout(() => {
        console.log('Reloading attendance data...');
        loadData(false);
      }, 1000);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: '2.5rem' }}>
      <AttendanceModal open={modalOpen} onSuccess={handleSuccess} type={attendanceType} />

      <div className="card fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.75rem' }}>
            Здравствуйте, {user.fullName || user.email}!
          </h2>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
            {hasCheckedInToday
              ? 'Вы уже отметились сегодня. Приятного рабочего дня!'
              : 'Отметьтесь через камеру для подтверждения посещения.'}
          </p>
        </div>

        {hasCheckedInToday && !message && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            fontSize: '0.95rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>✓</span>
            <span>Вы уже отметились сегодня</span>
          </div>
        )}

        {message && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            fontSize: '0.95rem',
            fontWeight: 500
          }}>
            {message}
          </div>
        )}

        {hasCheckedInToday && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(59, 130, 246, 0.05)',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            💡 Вы можете отметиться повторно, но это будет вторая отметка за сегодня. Обычно достаточно одной отметки в день.
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            className={hasCheckedInToday ? 'secondary-button' : 'primary-button'}
            onClick={() => {
              setAttendanceType('CHECK_IN');
              setModalOpen(true);
            }}
            disabled={modalOpen}
          >
            <span>{hasCheckedInToday ? '↻ Отметить приход повторно' : '→ Отметить приход'}</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setAttendanceType('CHECK_OUT');
              setModalOpen(true);
            }}
            disabled={modalOpen}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
              color: '#fff',
              border: 'none'
            }}
          >
            <span>← Подтвердить уход</span>
          </button>
        </div>
      </div>

      {!initialLoading && (
        <div className="fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              Ваша статистика
            </h3>
            {refreshing && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                Обновление...
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}>
            <div className="stat-card">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Сегодня
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {stats.todayCount}
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                отметок
              </div>
            </div>

            <div className="stat-card">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                За неделю
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                {stats.weekCount}
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                отметок
              </div>
            </div>

            <div className="stat-card">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                За месяц
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                {stats.monthCount}
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                отметок
              </div>
            </div>

            <div className="stat-card">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Средняя подлинность
              </div>
              <div style={{ 
                fontSize: '2.5rem', 
                fontWeight: 700, 
                color: (() => {
                  const percentage = stats.avgConfidence * 100;
                  if (percentage >= 95) return 'var(--accent-success)'; // Зеленый для 95%+
                  if (percentage >= 85) return 'var(--accent-primary)'; // Синий для 85-94%
                  if (percentage >= 70) return 'var(--accent-warning)'; // Оранжевый для 70-84%
                  return 'var(--accent-error)'; // Красный для <70%
                })()
              }}>
                {(stats.avgConfidence * 100).toFixed(0)}%
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                достоверности
              </div>
            </div>
          </div>
        </div>
      )}

      {!initialLoading && stats.chartData && stats.chartData.length > 0 && (
        <div className="card fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              График посещаемости
            </h3>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Последние 7 дней активности
            </p>
          </div>
          <AttendanceChart data={stats.chartData} />
        </div>
      )}

      <div className="card fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              История отметок
            </h3>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Последние 50 записей посещений
            </p>
          </div>
          {refreshing && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', padding: '0.5rem' }}>
              Обновление...
            </span>
          )}
        </div>

        {initialLoading ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-tertiary)'
          }}>
            Загрузка...
          </div>
        ) : history.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-tertiary)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}>
            Пока нет отметок. Пройдите проверку чтобы создать первую запись.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {history.map((record) => (
              <div
                key={record.id}
                className="card-compact"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className="badge"
                    style={{
                      background: record.type === 'CHECK_OUT'
                        ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    {record.type === 'CHECK_OUT' ? '← Уход' : '→ Приход'}
                  </span>
                  <span className={`badge ${
                    record.livenessScore > 0.9
                      ? 'badge-success'
                      : record.livenessScore > 0.7
                      ? 'badge-warning'
                      : 'badge-error'
                  }`}>
                    {(record.livenessScore * 100).toFixed(1)}% подлинность
                  </span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {new Date(record.createdAt).toLocaleString('ru-RU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
