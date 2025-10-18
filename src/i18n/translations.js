export const LANGUAGES = {
  es: 'es',
  en: 'en',
};

export const translations = {
  es: {
    languageLabel: 'ES',
    loginTitle: 'Iniciar sesión',
    usernamePlaceholder: 'Usuario',
    passwordPlaceholder: 'Contraseña',
    forgotPassword: 'Perdí mi contraseña',
    submit: 'Aceptar',
    welcomeHeadline: 'Una nueva forma de vivir la experiencia escolar.',
    home: {
      greeting: 'Bienvenido,',
      role: {
        admin: 'Panel de administración',
        teacher: 'Panel docente',
        student: 'Panel estudiantil',
        guardian: 'Panel de familias',
        default: 'Inicio',
      },
      description: 'Has accedido correctamente a la plataforma EduPilot.',
      logout: 'Cerrar sesión',
    },
    errors: {
      invalidCredentials: 'Usuario o contraseña incorrectos.',
      userDisabled: 'Tu cuenta está deshabilitada. Contacta al administrador.',
      unexpected: 'Ha ocurrido un error inesperado. Intenta nuevamente más tarde.',
      missingRole: 'No se pudo obtener el rol del usuario.',
      network: 'No se pudo conectar con el servidor. Intenta nuevamente en unos minutos.',
    },
  },
  en: {
    languageLabel: 'EN',
    loginTitle: 'Sign in',
    usernamePlaceholder: 'Username',
    passwordPlaceholder: 'Password',
    forgotPassword: 'I forgot my password',
    submit: 'Sign in',
    welcomeHeadline: 'A new way to live the school experience.',
    home: {
      greeting: 'Welcome,',
      role: {
        admin: 'Admin dashboard',
        teacher: 'Teacher dashboard',
        student: 'Student dashboard',
        guardian: 'Family dashboard',
        default: 'Home',
      },
      description: 'You have successfully signed in to EduPilot.',
      logout: 'Log out',
    },
    errors: {
      invalidCredentials: 'Invalid username or password.',
      userDisabled: 'Your account is disabled. Please contact an administrator.',
      unexpected: 'An unexpected error occurred. Please try again later.',
      missingRole: 'Unable to determine the user role from the server response.',
      network: 'We could not reach the server. Please try again in a moment.',
    },
  },
};

export const getTranslation = (language) => translations[language] ?? translations.es;
