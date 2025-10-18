import PlaceholderPage from './PlaceholderPage';

const StudentsGroupsPage = ({ title, description }) => (
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
          <path d="M12 30c0-4 3-7 7-7s7 3 7 7" />
          <circle cx="19" cy="18" r="5" />
          <path d="M28 32a6 6 0 0 1 12 0" />
          <circle cx="34" cy="22" r="4" />
        </g>
      </svg>
    }
  />
);

export default StudentsGroupsPage;
