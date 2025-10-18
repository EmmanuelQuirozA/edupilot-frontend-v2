import LanguageSelector from './LanguageSelector';
import { getTranslation } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const roleKeyMap = {
  admin: 'admin',
  teacher: 'teacher',
  docente: 'teacher',
  profesor: 'teacher',
  student: 'student',
  alumno: 'student',
  guardian: 'guardian',
  parent: 'guardian',
  family: 'guardian',
};

const HomePage = ({ language, onLanguageChange }) => {
  const { user, logout } = useAuth();
  const t = getTranslation(language);
  const roleKey = roleKeyMap[user?.role?.toLowerCase?.()] ?? 'default';

  return (
    <div className="home-page">
      <header className="home-page__header">
        <LanguageSelector value={language} onChange={onLanguageChange} />
        <button type="button" className="home-page__logout" onClick={logout}>
          {t.home.logout}
        </button>
      </header>
      <main className="home-page__content">
        <h1>
          {t.home.greeting} {user?.first_name ?? user?.name ?? user?.username ?? ''}
        </h1>
        <p className="home-page__subtitle">{t.home.role[roleKey] ?? t.home.role.default}</p>
        <p>{t.home.description}</p>
      </main>
    </div>
  );
};

export default HomePage;
