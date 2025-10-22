import './LanguageSelector.css';

const languages = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
];

const LanguageSelector = ({ value, onChange }) => (
  <div className="language-selector" role="group" aria-label="Language selector">
    {languages.map(({ code, label }) => (
      <button
        key={code}
        type="button"
        className={`language-selector__button${value === code ? ' is-active' : ''}`}
        onClick={() => onChange?.(code)}
      >
        {label}
      </button>
    ))}
  </div>
);

export default LanguageSelector;
