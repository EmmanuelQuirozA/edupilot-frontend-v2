import PlaceholderPage from './PlaceholderPage';
import ModalUsageExample from '../components/modal/ModalUsageExample.jsx';

const CommunicationsPage = ({ title, description }) => (
  <div>
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
            <path d="M10 12h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H19l-9 8v-8h-2a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z" />
            <path d="m14 20 5.34 4.45a6 6 0 0 0 7.32 0L32 20" />
          </g>
        </svg>
      }
    />
    <ModalUsageExample
      origin="Panel de comunicaciones"
      student={{
        id: 'st-communications-204',
        firstName: 'Mateo',
        lastName: 'Salas',
        email: 'mateo.salas@example.com',
        grade: '5°A',
      }}
      description="Desde comunicaciones se puede revisar y ajustar la información de contacto antes de enviar avisos."
      ctaLabel="Editar alumno para comunicar"
    />
  </div>
);

export default CommunicationsPage;
