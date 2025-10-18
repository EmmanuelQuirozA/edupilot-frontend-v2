const languages = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
];

const LanguageSelector = ({ value, onChange, variant = 'outline-primary', size = 'sm' }) => (
  <div className="btn-group" role="group" aria-label="Language selector">
    {languages.map(({ code, label }) => (
      <button
        key={code}
        type="button"
        className={`btn btn-${value === code ? variant.replace('outline-', '') : variant} btn-${size}`}
        onClick={() => onChange?.(code)}
      >
        {label}
      </button>
    ))}
  </div>
);

export default LanguageSelector;
