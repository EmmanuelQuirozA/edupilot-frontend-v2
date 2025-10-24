import PropTypes from 'prop-types';

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

      {actionContent ? (
        <div className={["global-tabs__actions ms-md-auto", actionsClassName].filter(Boolean).join(' ')}>
          {actionContent}
        </div>
      ) : null}
    </div>
  );
};

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      icon: PropTypes.node,
      className: PropTypes.string,
    }),
  ).isRequired,
  activeKey: PropTypes.string.isRequired,
  onSelect: PropTypes.func,
  className: PropTypes.string,
  navClassName: PropTypes.string,
  actions: PropTypes.node,
  renderActions: PropTypes.func,
  actionsClassName: PropTypes.string,
};

export default Tabs;
