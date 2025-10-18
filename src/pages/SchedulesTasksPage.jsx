import PlaceholderPage from './PlaceholderPage';

const SchedulesTasksPage = ({ title, description }) => (
  <PlaceholderPage
    title={title}
    description={description}
    icon={
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="10" width="32" height="30" rx="4" />
          <path d="M16 6v8" />
          <path d="M32 6v8" />
          <path d="M14 22h8" />
          <path d="M26 30h8" />
        </g>
      </svg>
    }
  />
);

export default SchedulesTasksPage;
