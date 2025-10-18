import PlaceholderPage from './PlaceholderPage';

const GradesPage = ({ title, description }) => (
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
          <path d="M24 6 6 14l18 8 18-8Z" />
          <path d="M14 20v8a10 10 0 0 0 20 0v-8" />
          <path d="M19 42h10" />
        </g>
      </svg>
    }
  />
);

export default GradesPage;
