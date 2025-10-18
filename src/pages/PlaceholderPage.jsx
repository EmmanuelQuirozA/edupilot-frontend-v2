const PlaceholderPage = ({ title, description, icon }) => {
  const headingId = `dashboard-placeholder-${(title ?? 'section')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

  return (
    <section className="dashboard__placeholder" aria-labelledby={headingId}>
      <div className="dashboard__placeholder-inner">
        {icon ? (
          <div className="dashboard__placeholder-icon" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
};

export default PlaceholderPage;
