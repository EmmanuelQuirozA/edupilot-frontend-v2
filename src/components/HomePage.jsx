import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const mainStats = [
  {
    title: 'Total Estudiantes',
    value: '8,903',
    description: 'En los últimos 12 meses · 0% incidencia',
    accent: 'blue',
  },
  {
    title: 'Total Profesores',
    value: '45',
    description: 'Nuevos 10 · Estable',
    accent: 'green',
  },
  {
    title: 'Restaurantes',
    value: '4',
    description: 'Atención diaria',
    accent: 'orange',
  },
  {
    title: 'Eventos Programados',
    value: '23',
    description: 'Eventos mensuales · 12 alumnos',
    accent: 'purple',
  },
];

const students = [
  { name: 'María José Diaz', grade: '4°A', status: 'Pagado', amount: '$1,000 MXN', statusColor: 'paid' },
  { name: 'Jeronimo Diaz', grade: '4°A', status: 'Pendiente', amount: '$1,000 MXN', statusColor: 'pending' },
  { name: 'Fernanda Diaz', grade: '4°A', status: 'Pendiente', amount: '$1,000 MXN', statusColor: 'pending' },
  { name: 'Jorge Diaz', grade: '4°A', status: 'Pagado', amount: '$1,000 MXN', statusColor: 'paid' },
  { name: 'Valentina Diaz', grade: '4°A', status: 'Pendiente', amount: '$1,000 MXN', statusColor: 'pending' },
];

const paymentSummary = {
  period: '2 meses',
  label: 'Balance pagos estudiantes',
  nextPayment: {
    student: 'María José Diaz',
    grade: '4°A',
    amount: '$1,000 MXN',
    dueIn: 'Vence en 12 días',
  },
  totals: [
    { label: 'Pagado', value: '$41,456', change: '+12%' },
    { label: 'Pendiente', value: '$12,800', change: '-4%' },
  ],
  chart: {
    caption: 'Balance últimos 6 meses',
    values: [40, 52, 48, 60, 68, 73],
    months: ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'],
  },
};

const HomePage = ({ language, onLanguageChange }) => {
  const { user, logout } = useAuth();
  const t = getTranslation(language);

  const displayName = user?.first_name ?? user?.name ?? user?.username ?? 'Administrador';
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const searchPlaceholder = language === 'en' ? 'Search' : 'Buscar';

  return (
    <div className="dashboard">
      <aside className="dashboard__sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">school</span>
          <span className="sidebar__brand-badge">EduPilot</span>
        </div>
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden="true">
            {initials || 'AD'}
          </div>
          <div>
            <p className="sidebar__name">{displayName}</p>
            <span className="sidebar__role">Administrador escolar</span>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Menú principal">
          <p className="sidebar__section">Menú Principal</p>
          <ul>
            <li className="is-active">Dashboard</li>
            <li>Pagos y Finanzas</li>
            <li>Alumnos y Grupos</li>
            <li>Profesores</li>
            <li>Horarios y Tareas</li>
            <li>Calificaciones</li>
            <li>Comunicaciones</li>
          </ul>
          <p className="sidebar__section">Ajustes</p>
          <ul>
            <li>Centro de pagos</li>
            <li>Configuración</li>
          </ul>
        </nav>
        <button type="button" className="sidebar__logout" onClick={logout}>
          {t.home.logout}
        </button>
      </aside>
      <div className="dashboard__main">
        <header className="dashboard__header">
          <div>
            <h1>Dashboard</h1>
            <p className="dashboard__subtitle">School The Sauses</p>
          </div>
          <div className="dashboard__actions">
            <label className="dashboard__search" htmlFor="dashboard-search">
              <span className="visually-hidden">{searchPlaceholder}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z"
                  fill="currentColor"
                />
              </svg>
              <input id="dashboard-search" type="search" placeholder={searchPlaceholder} />
            </label>
            <LanguageSelector value={language} onChange={onLanguageChange} />
            <button type="button" className="dashboard__notification" aria-label="Notificaciones">
              <span />
            </button>
            <div className="dashboard__user-chip">
              <span className="dashboard__user-initials" aria-hidden="true">
                {initials || 'AD'}
              </span>
              <div>
                <p>{displayName}</p>
                <span>{user?.role ?? 'Administrador'}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="dashboard__hero">
          <div className="hero__content">
            <span className="hero__tag">School The Sauses</span>
            <h2>Bienvenido a tu panel administrativo</h2>
            <p>
              Gestiona las operaciones diarias, revisa los indicadores clave y acompaña a tu
              comunidad educativa desde un solo lugar.
            </p>
            <div className="hero__highlights">
              <div>
                <h3>8,903</h3>
                <span>Estudiantes activos</span>
              </div>
              <div>
                <h3>98%</h3>
                <span>Retención anual</span>
              </div>
            </div>
          </div>
          <div className="hero__media" aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=720&q=80"
              alt="Estudiantes en el aula"
            />
          </div>
        </section>

        <section className="dashboard__stats">
          {mainStats.map((stat) => (
            <article key={stat.title} className={`stat-card stat-card--${stat.accent}`}>
              <header>
                <p>{stat.title}</p>
                <span>{stat.description}</span>
              </header>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard__grid">
          <article className="students-card">
            <header className="students-card__header">
              <div>
                <h3>Lista estudiantes</h3>
                <p>Grupo destacado · 4°A</p>
              </div>
              <button type="button">Ver más</button>
            </header>
            <ul className="students-card__list">
              {students.map((student) => (
                <li key={`${student.name}-${student.grade}`}>
                  <div className="students-card__identity">
                    <span className="students-card__avatar" aria-hidden="true">
                      {student.name
                        .split(' ')
                        .map((part) => part.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div>
                      <p>{student.name}</p>
                      <span>{student.grade}</span>
                    </div>
                  </div>
                  <span className={`students-card__status students-card__status--${student.statusColor}`}>
                    {student.status}
                  </span>
                  <span className="students-card__amount">{student.amount}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="payments-card">
            <header className="payments-card__header">
              <div>
                <h3>{paymentSummary.label}</h3>
                <p>Resumen de pagos automáticos</p>
              </div>
              <div className="payments-card__period">
                <button type="button" className="is-active">
                  {paymentSummary.period}
                </button>
                <button type="button">3 meses</button>
              </div>
            </header>

            <div className="payments-card__content">
              <div className="payments-card__next">
                <div className="payments-card__next-info">
                  <p>Siguiente pago</p>
                  <strong>{paymentSummary.nextPayment.amount}</strong>
                </div>
                <div className="payments-card__next-student">
                  <span className="payments-card__avatar" aria-hidden="true">
                    {paymentSummary.nextPayment.student
                      .split(' ')
                      .map((part) => part.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div>
                    <p>{paymentSummary.nextPayment.student}</p>
                    <span>
                      {paymentSummary.nextPayment.grade} · {paymentSummary.nextPayment.dueIn}
                    </span>
                  </div>
                </div>
              </div>

              <div className="payments-card__totals">
                {paymentSummary.totals.map((item) => (
                  <div key={item.label}>
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                    <span>{item.change}</span>
                  </div>
                ))}
              </div>

              <div className="payments-card__chart">
                <div className="payments-card__chart-header">
                  <div>
                    <h4>{paymentSummary.chart.caption}</h4>
                    <p>Ingresos netos proyectados</p>
                  </div>
                  <span className="payments-card__chart-total">${paymentSummary.chart.values.at(-1)}k</span>
                </div>
                <svg viewBox="0 0 180 80" preserveAspectRatio="none" role="img" aria-label="Tendencia de pagos">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                      <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 60 C 20 50, 40 55, 60 40 S 100 20, 120 30 160 60, 180 45 V 80 H 0 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M0 60 C 20 50, 40 55, 60 40 S 100 20, 120 30 160 60, 180 45"
                    fill="none"
                    stroke="rgba(37, 99, 235, 0.9)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="payments-card__chart-footer">
                  {paymentSummary.chart.months.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
