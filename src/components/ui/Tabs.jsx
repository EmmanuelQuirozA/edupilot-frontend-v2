/**
 * @typedef {Object} TabDefinition
 * @property {string} key
 * @property {import('react').ReactNode} label
 * @property {import('react').ReactNode} [icon]
 * @property {string} [className]
 */

/**
 * @typedef {Object} TabsProps
 * @property {TabDefinition[]} tabs
 * @property {string} activeKey
 * @property {(key: string) => void} [onSelect]
 * @property {string} [className]
 * @property {string} [navClassName]
 * @property {import('react').ReactNode} [actions]
 * @property {(context: { activeKey: string }) => import('react').ReactNode} [renderActions]
 * @property {string} [actionsClassName]
 */

/**
 * @param {TabsProps} props
 */
const Tabs = ({
  tabs,
  activeKey,
  onSelect,
  className = '',
  navClassName = '',
  actions,
  renderActions,
  actionsClassName = '',
}) => {
  const actionContent = typeof renderActions === 'function' ? renderActions({ activeKey }) : actions;

  return (
    <div className={["global-tabs d-flex flex-column flex-md-row gap-3 align-items-md-center", className]
      .filter(Boolean)
      .join(' ')}
    >
      <ul className={["nav nav-tabs global-tabs__nav", navClassName].filter(Boolean).join(' ')} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const tabClassName = ["nav-link", "global-tabs__link", isActive ? 'active' : '', tab.className]
            .filter(Boolean)
            .join(' ');

          return (
            <li key={tab.key} className="nav-item" role="presentation">
              <button
                type="button"
                className={tabClassName}
                onClick={() => {
                  if (!isActive) {
                    onSelect?.(tab.key);
                  }
                }}
                role="tab"
                aria-selected={isActive}
              >
                {tab.icon ? <span className="me-2 d-inline-flex align-items-center">{tab.icon}</span> : null}
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {actionContent
        ? (
          <div className={["global-tabs__actions ms-md-auto", actionsClassName].filter(Boolean).join(' ')}>
            {actionContent}
          </div>
        )
        : null}
    </div>
  );
};

export default Tabs;
