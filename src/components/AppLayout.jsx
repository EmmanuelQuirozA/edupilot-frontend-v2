import LanguageSelector from './LanguageSelector';
import Breadcrumbs from './Breadcrumbs';
import './HomePage.css';

const AppLayout = ({
  t,
  language,
  onLanguageChange,
  isDesktop,
  isSidebarOpen,
  onToggleSidebar,
  onCloseSidebar,
  menuItems,
  activePage,
  onNavClick,
  displayName,
  roleLabel,
  initials,
  headerTitle,
  headerSubtitle,
  breadcrumbs,
  onLogout,
  footerContent,
  children,
}) => {
  return (
    <div className="dashboard">
      <aside className={`dashboard__sidebar ${isDesktop ? '' : 'is-floating'} ${
        isSidebarOpen ? 'is-open' : ''
      }`}>
        <div className="sidebar__header">
          <div>
            <p className="sidebar__eyebrow">{t.home.title}</p>
            <h1>{t.home.subtitle}</h1>
          </div>
          {!isDesktop ? (
            <div className="sidebar__language-badge">
              <LanguageSelector value={language} onChange={onLanguageChange} />
            </div>
          ) : null}
        </div>
        <div>
          <p className="sidebar__name">{displayName}</p>
          <span className="sidebar__role">{roleLabel}</span>
        </div>
        <nav className="sidebar__nav" aria-label={t.home.menu.main}>
          <p className="sidebar__section">{t.home.menu.main}</p>
          <ul>
            {menuItems.map((item) => (
              <li
                key={item.key}
                className={activePage === item.key ? 'is-active' : ''}
                onClick={() => onNavClick(item.key)}
              >
                {item.icon} {item.label}
              </li>
            ))}
          </ul>
          <p className="sidebar__section">{t.home.menu.settings}</p>
          <ul>
            <li>{t.home.menu.paymentCenter}</li>
            <li>{t.home.menu.configuration}</li>
          </ul>
        </nav>
        <button type="button" className="sidebar__logout" onClick={onLogout}>
          {t.home.logout}
        </button>
      </aside>

      {!isDesktop && isSidebarOpen ? (
        <div className="dashboard__overlay" onClick={onCloseSidebar} aria-hidden="true" />
      ) : null}

      <div className="dashboard__main">
        <header className="dashboard__header">
          <div className="dashboard__header-title">
            {!isDesktop ? (
              <button
                type="button"
                className="dashboard__menu-toggle"
                onClick={onToggleSidebar}
                aria-label={isSidebarOpen ? t.home.header.closeMenu : t.home.header.openMenu}
              >
                <span />
                <span />
                <span />
              </button>
            ) : null}
            <div>
              <h1>{headerTitle}</h1>
              <p className="dashboard__subtitle">{headerSubtitle}</p>
            </div>
          </div>
          <div className="dashboard__actions">
            {isDesktop ? (
              <label className="dashboard__search" htmlFor="dashboard-search">
                <span className="visually-hidden">{t.home.header.searchPlaceholder}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z"
                    fill="currentColor"
                  />
                </svg>
                <input id="dashboard-search" type="search" placeholder={t.home.header.searchPlaceholder} />
              </label>
            ) : (
              <button type="button" className="dashboard__search-button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z"
                    fill="currentColor"
                  />
                </svg>
                <span>{t.home.header.searchPlaceholder}</span>
              </button>
            )}
            <button type="button" className="dashboard__notification" aria-label={t.home.header.notifications}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3a5 5 0 0 0-5 5v2.17c0 .7-.28 1.37-.77 1.86L4.6 13.65A1 1 0 0 0 5.3 15h13.4a1 1 0 0 0 .7-1.35l-1.63-1.62a2.63 2.63 0 0 1-.77-1.86V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 1-2.45-2h4.9A2.5 2.5 0 0 1 12 21Z"
                  fill="currentColor"
                />
              </svg>
              <span />
            </button>
            {isDesktop ? <LanguageSelector value={language} onChange={onLanguageChange} /> : null}
            {isDesktop ? (
              <div className="dashboard__user-chip">
                <div className="dashboard__user-initials" aria-hidden="true">
                  {initials || 'AD'}
                </div>
                <div>
                  <p>{displayName}</p>
                  <span>{roleLabel}</span>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <Breadcrumbs items={breadcrumbs} />
        <main className="dashboard__content">{children}</main>
        <footer className="dashboard__footer">{footerContent}</footer>
      </div>
    </div>
  );
};

export default AppLayout;
