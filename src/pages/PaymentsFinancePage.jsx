import PlaceholderPage from './PlaceholderPage';

const PaymentsFinancePage = ({ title, description }) => (
  <PlaceholderPage
    title={title}
    description={description}
    icon={
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="14" width="36" height="20" rx="4" />
          <path d="M10 20h12" />
          <path d="M32 28h6" />
        </g>
      </svg>
    }
  />
);

export default PaymentsFinancePage;
