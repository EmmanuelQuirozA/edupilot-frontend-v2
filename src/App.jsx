import { useEffect, useState } from 'react';
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

const App = () => {
  const { user } = useAuth();
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('language', language);
    }
  }, [language]);

  useEffect(() => {
    const t = getTranslation(language);
    document.title = user ? `${t.home.greeting} ${user?.name ?? ''} | EduPilot` : `${t.loginTitle} | EduPilot`;
  }, [language, user]);

  return user ? (
    <HomePage language={language} onLanguageChange={setLanguage} />
  ) : (
    <LoginPage language={language} onLanguageChange={setLanguage} />
  );
};

export default App;
