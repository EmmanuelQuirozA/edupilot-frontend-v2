const PlaceholderPage = ({ title, description, icon }) => {
  const headingId = `dashboard-placeholder-${(title ?? 'section')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

  return (
    <section className="py-5">
      <div className="bg-white border rounded-4 shadow-sm text-center p-5 mx-auto" style={{ maxWidth: '40rem' }}>
        {icon ? (
          <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary mb-4" style={{ width: '72px', height: '72px' }} aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h2 id={headingId} className="h4 fw-semibold mb-3">
          {title}
        </h2>
        {description ? <p className="text-secondary mb-0">{description}</p> : null}
      </div>
    </section>
  );
};

export default PlaceholderPage;
