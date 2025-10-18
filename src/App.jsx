import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import { useAuth } from './context/AuthContext';
import { getTranslation } from './i18n/translations';
import './App.css';

const supportedLanguages = ['es', 'en'];

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'es';
  }

  const stored = window.localStorage.getItem('language');
  if (stored && supportedLanguages.includes(stored)) {
    return stored;
  }

  const browserLanguage = navigator.language?.split('-')?.[0]?.toLowerCase?.();
  return supportedLanguages.includes(browserLanguage) ? browserLanguage : 'es';
};

const HOME_PAGES = new Set(['dashboard', 'payments', 'students', 'teachers', 'schedules', 'grades', 'communications']);

const buildPath = (language, section) => `/${language}/${section}`;

const App = () => {
  const { user } = useAuth();
  const [path, setPath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
  const fallbackLanguageRef = useRef(getInitialLanguage());
  const fallbackLanguage = fallbackLanguageRef.current;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handlePopState = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback(
    (nextPath, { replace = false } = {}) => {
      if (typeof window === 'undefined') {
        setPath(nextPath);
        return;
      }

      const currentPath = window.location.pathname;
      if (currentPath === nextPath) {
        setPath(nextPath);
        return;
      }

      if (replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
      setPath(nextPath);
    },
    [],
  );

  const segments = useMemo(() => path.split('/').filter(Boolean), [path]);
  const languageSegment = segments[0];
  const isLanguageValid = supportedLanguages.includes(languageSegment);
  const language = isLanguageValid ? languageSegment : fallbackLanguage;
  const restSegments = isLanguageValid ? segments.slice(1) : segments;
  const rawSection = restSegments[0];

  const resolvedSection = useMemo(() => {
    if (!user) {
      return 'login';
    }

    if (!rawSection || rawSection === 'login') {
      return 'dashboard';
    }

    return HOME_PAGES.has(rawSection) ? rawSection : 'dashboard';
  }, [rawSection, user]);

  const targetPath = buildPath(language, resolvedSection);

  useEffect(() => {
    if (path !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [navigate, path, targetPath]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('language', language);
    }
  }, [language]);

  const translation = useMemo(() => getTranslation(language), [language]);

  useEffect(() => {
    const displayName = user?.first_name ?? user?.name ?? user?.username ?? '';
    const greeting = user ? `${translation.home.greeting} ${displayName}`.trim() : translation.loginTitle;
    document.title = `${greeting} | EduPilot`;
  }, [translation, user]);

  const handleLanguageChange = useCallback(
    (nextLanguage) => {
      if (!supportedLanguages.includes(nextLanguage) || nextLanguage === language) {
        return;
      }

      navigate(buildPath(nextLanguage, resolvedSection));
    },
    [language, navigate, resolvedSection],
  );

  const handlePageChange = useCallback(
    (nextPage) => {
      const safePage = HOME_PAGES.has(nextPage) ? nextPage : 'dashboard';
      navigate(buildPath(language, safePage));
    },
    [language, navigate],
  );

  if (!user && resolvedSection === 'login') {
    return <LoginPage language={language} onLanguageChange={handleLanguageChange} />;
  }

  if (user && HOME_PAGES.has(resolvedSection)) {
    return (
      <HomePage
        language={language}
        onLanguageChange={handleLanguageChange}
        activePage={resolvedSection}
        onNavigate={handlePageChange}
      />
    );
  }

  return null;
};

export default App;
