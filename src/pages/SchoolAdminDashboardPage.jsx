const SchoolAdminDashboardPage = ({ strings }) => {
  const { hero, stats, studentsCard, paymentsCard } = strings;

  return (
    <div className="page">
      <section className="dashboard__hero">
        <div className="hero__content">
          <span className="hero__tag">{hero.tag}</span>
          <h2>{hero.title}</h2>
          <p>{hero.description}</p>
          <div className="hero__highlights">
            <div>
              <h3>{hero.highlights.students.value}</h3>
              <span>{hero.highlights.students.label}</span>
            </div>
            <div>
              <h3>{hero.highlights.retention.value}</h3>
              <span>{hero.highlights.retention.label}</span>
            </div>
          </div>
        </div>
        <div className="hero__media" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=720&q=80"
            alt=""
          />
        </div>
      </section>

      <section className="dashboard__stats">
        {stats.map((stat) => (
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
              <h3>{studentsCard.title}</h3>
              <p>{studentsCard.subtitle}</p>
            </div>
            <button type="button">{studentsCard.actionLabel}</button>
          </header>
          <ul className="students-card__list">
            {studentsCard.list.map((student) => (
              <li key={`${student.name}-${student.grade}`}>
                <div className="students-card__identity">
                  <div className="students-card__avatar" aria-hidden="true">
                    {student.name
                      .split(' ')
                      .map((part) => part.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div>
                    <p>{student.name}</p>
                    <span>{student.grade}</span>
                  </div>
                </div>
                <span className={`students-card__status students-card__status--${student.status}`}>
                  {studentsCard.status[student.status]}
                </span>
                <span className="students-card__amount">{student.amount}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="payments-card">
          <header className="payments-card__header">
            <div>
              <h3>{paymentsCard.label}</h3>
              <p>{paymentsCard.summary}</p>
            </div>
            <div className="payments-card__period">
              <button type="button" className="is-active">
                {paymentsCard.periodOptions[0]}
              </button>
              <button type="button">{paymentsCard.periodOptions[1]}</button>
            </div>
          </header>

          <div className="payments-card__content">
            <div className="payments-card__next">
              <div className="payments-card__next-info">
                <p>{paymentsCard.nextPaymentTitle}</p>
                <strong>{paymentsCard.nextPayment.amount}</strong>
              </div>
              <div className="payments-card__next-student">
                <div className="payments-card__avatar" aria-hidden="true">
                  {paymentsCard.nextPayment.student
                    .split(' ')
                    .map((part) => part.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <p>{paymentsCard.nextPayment.student}</p>
                  <span>
                    {paymentsCard.nextPayment.grade} · {paymentsCard.nextPayment.dueIn}
                  </span>
                </div>
              </div>
            </div>

            <div className="payments-card__totals">
              {paymentsCard.totals.map((item) => (
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
                  <h4>{paymentsCard.chart.caption}</h4>
                  <p>{paymentsCard.chart.description}</p>
                </div>
                <span className="payments-card__chart-total">
                  ${paymentsCard.chart.values.at(-1)}
                  {paymentsCard.chart.valueSuffix}
                </span>
              </div>
              <svg
                viewBox="0 0 180 80"
                preserveAspectRatio="none"
                role="img"
                aria-label={paymentsCard.chart.ariaLabel}
              >
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
                {paymentsCard.chart.months.map((month) => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default SchoolAdminDashboardPage;
