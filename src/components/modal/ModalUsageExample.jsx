import { useState } from 'react';
import { useModal } from './useModal';
import './modalExamples.css';

const ModalUsageExample = ({ origin, student, description, ctaLabel = 'Editar alumno', onSubmit }) => {
  const { openModal } = useModal();
  const [lastAction, setLastAction] = useState(null);

  const handleOpen = () => {
    openModal({
      key: 'EditStudent',
      props: {
        student,
      },
      onSubmit: (result) => {
        setLastAction(result);
        if (onSubmit) {
          onSubmit(result);
        }
      },
    });
  };

  return (
    <section className="modal-demo">
      <header className="modal-demo__header">
        <h3>{ctaLabel}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      <dl className="modal-demo__summary">
        <div>
          <dt>Contexto</dt>
          <dd>{origin}</dd>
        </div>
        <div>
          <dt>Alumno</dt>
          <dd>
            {student.firstName} {student.lastName}
          </dd>
        </div>
        <div>
          <dt>Grado</dt>
          <dd>{student.grade}</dd>
        </div>
      </dl>
      <button type="button" className="modal-demo__button" onClick={handleOpen}>
        Abrir modal de edición
      </button>
      {lastAction ? (
        <p className="modal-demo__result" role="status">
          Último envío: {lastAction.data.firstName} {lastAction.data.lastName} ({lastAction.data.grade})
        </p>
      ) : null}
    </section>
  );
};

export default ModalUsageExample;
