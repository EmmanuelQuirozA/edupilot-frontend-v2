const PlaceholderPage = ({ title, description }) => {
  const headingId = `dashboard-placeholder-${(title ?? 'section')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

  return (
    <section className="dashboard__placeholder" aria-labelledby={headingId}>
      <div className="dashboard__placeholder-inner">
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  );
};

export default PlaceholderPage;
