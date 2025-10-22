import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { ModalComponentProps } from '../modalRegistry';
import type { StudentFormValues } from '../modalRegistry';

const EMPTY_FORM: StudentFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  grade: '',
};

const CreateStudentForm = ({ instanceId, initialValues, close, submit }: ModalComponentProps<'CreateStudent'>) => {
  const [values, setValues] = useState<StudentFormValues>({
    ...EMPTY_FORM,
    ...initialValues,
  });
  const [touched, setTouched] = useState<Record<keyof StudentFormValues, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    grade: false,
  });

  const validate = useCallback((candidate: StudentFormValues) => {
    const nextErrors: Partial<Record<keyof StudentFormValues, string>> = {};

    if (!candidate.firstName.trim()) {
      nextErrors.firstName = 'El nombre es obligatorio';
    }

    if (!candidate.lastName.trim()) {
      nextErrors.lastName = 'El apellido es obligatorio';
    }

    if (!candidate.email.trim()) {
      nextErrors.email = 'El correo es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email)) {
      nextErrors.email = 'El correo no es válido';
    }

    if (!candidate.grade.trim()) {
      nextErrors.grade = 'El grado es obligatorio';
    }

    return nextErrors;
  }, []);

  const errors = useMemo(() => validate(values), [validate, values]);

  const handleChange = useCallback((field: keyof StudentFormValues) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setValues((current) => ({ ...current, [field]: nextValue }));
      setTouched((current) => ({ ...current, [field]: true }));
    };
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const currentErrors = validate(values);
      const hasErrors = Object.keys(currentErrors).length > 0;

      setTouched({
        firstName: true,
        lastName: true,
        email: true,
        grade: true,
      });

      if (hasErrors) {
        return;
      }

      submit({
        action: 'create',
        data: values,
      });
    },
    [submit, validate, values],
  );

  const handleCancel = useCallback(() => {
    close();
  }, [close]);

  return (
    <form className="modal" onSubmit={handleSubmit} noValidate>
      <header className="modal__header">
        <h2 className="modal__title" id={`${instanceId}-title`}>
          Registrar estudiante
        </h2>
      </header>
      <section className="modal__body">
        <div className="modal__field">
          <label htmlFor="create-student-first-name">Nombre</label>
          <input
            id="create-student-first-name"
            type="text"
            value={values.firstName}
            onChange={handleChange('firstName')}
            aria-invalid={touched.firstName && Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? 'create-student-first-name-error' : undefined}
          />
          {touched.firstName && errors.firstName ? (
            <p className="modal__error" id="create-student-first-name-error">
              {errors.firstName}
            </p>
          ) : null}
        </div>
        <div className="modal__field">
          <label htmlFor="create-student-last-name">Apellido</label>
          <input
            id="create-student-last-name"
            type="text"
            value={values.lastName}
            onChange={handleChange('lastName')}
            aria-invalid={touched.lastName && Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? 'create-student-last-name-error' : undefined}
          />
          {touched.lastName && errors.lastName ? (
            <p className="modal__error" id="create-student-last-name-error">
              {errors.lastName}
            </p>
          ) : null}
        </div>
        <div className="modal__field">
          <label htmlFor="create-student-email">Correo electrónico</label>
          <input
            id="create-student-email"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            aria-invalid={touched.email && Boolean(errors.email)}
            aria-describedby={errors.email ? 'create-student-email-error' : undefined}
          />
          {touched.email && errors.email ? (
            <p className="modal__error" id="create-student-email-error">
              {errors.email}
            </p>
          ) : null}
        </div>
        <div className="modal__field">
          <label htmlFor="create-student-grade">Grado</label>
          <input
            id="create-student-grade"
            type="text"
            value={values.grade}
            onChange={handleChange('grade')}
            aria-invalid={touched.grade && Boolean(errors.grade)}
            aria-describedby={errors.grade ? 'create-student-grade-error' : undefined}
          />
          {touched.grade && errors.grade ? (
            <p className="modal__error" id="create-student-grade-error">
              {errors.grade}
            </p>
          ) : null}
        </div>
      </section>
      <footer className="modal__footer">
        <button type="button" className="modal__button modal__button--ghost" onClick={handleCancel}>
          Cancelar
        </button>
        <button type="submit" className="modal__button modal__button--primary">
          Guardar
        </button>
      </footer>
    </form>
  );
};

export default CreateStudentForm;
