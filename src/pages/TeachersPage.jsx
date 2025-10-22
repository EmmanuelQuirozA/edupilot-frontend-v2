import PlaceholderPage from './PlaceholderPage';
import ModalUsageExample from '../components/modal/ModalUsageExample.jsx';

const TeachersPage = ({ title, description }) => (
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
            <path d="M10 34v-6l14-8 14 8v6" />
            <path d="M24 18v-6l14 8" />
            <path d="M18 42v-7a6 6 0 0 1 12 0v7" />
          </g>
        </svg>
      }
    />
    <ModalUsageExample
      origin="Panel de docentes"
      student={{
        id: 'st-teachers-001',
        firstName: 'Camila',
        lastName: 'Ríos',
        email: 'camila.rios@example.com',
        grade: '3°B',
      }}
      description="El equipo docente puede actualizar los datos clave del alumnado directamente desde esta vista."
      ctaLabel="Editar alumna destacada"
    />
  </div>
);

export default TeachersPage;
