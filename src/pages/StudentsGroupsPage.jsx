import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './StudentsGroupsPage.css';

const DEFAULT_PAGINATION = { offset: 0, limit: 10 };

const createInitialFilters = () => ({
  student_id: '',
  full_name: '',
  payment_reference: '',
  generation: '',
  grade_group: '',
  enabled: '',
});

const createInitialStudent = () => ({
  first_name: '',
  last_name_father: '',
  last_name_mother: '',
  birth_date: '',
  phone_number: '',
  tax_id: '',
  curp: '',
  street: '',
  ext_number: '',
  int_number: '',
  suburb: '',
  locality: '',
  municipality: '',
  state: '',
  personal_email: '',
  image: null,
  email: '',
  username: '',
  password: '',
  school_id: '',
  group_id: '',
  register_id: '',
  payment_reference: '',
});

const extractListFromPayload = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    payload.list,
    payload.response,
    payload.schools,
    payload.classes,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeSelectOption = (item, index = 0) => {
  if (item == null) {
    return { value: '', label: '' };
  }

  if (typeof item !== 'object') {
    const stringValue = String(item);
    return { value: stringValue, label: stringValue };
  }

  const valueKeys = [
    'id',
    'school_id',
    'schoolId',
    'class_id',
    'classId',
    'group_id',
    'groupId',
    'value',
    'uuid',
    'code',
  ];

  let value = '';
  for (const key of valueKeys) {
    const candidate = item[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      value = String(candidate);
      break;
    }
  }

  const labelKeys = [
    'name',
    'label',
    'title',
    'description',
    'code',
    'group_name',
    'class_name',
  ];

  let label = '';
  for (const key of labelKeys) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      label = candidate;
      break;
    }
  }

  if (!label) {
    label = value || String(index + 1);
  }

  return { value, label };
};

const normalizeStudentsResponse = (payload) => {
  if (!payload) {
    return { students: [], total: 0 };
  }

  if (Array.isArray(payload)) {
    return { students: payload, total: payload.length };
  }

  const possibleArrays = [
    payload.data,
    payload.results,
    payload.items,
    payload.students,
    payload.data?.students,
    payload.data?.items,
    payload.response,
  ].find(Array.isArray);

  const students = possibleArrays ?? [];

  const total =
    payload.total ??
    payload.count ??
    payload.meta?.total ??
    payload.data?.total ??
    payload.pagination?.total ??
    students.length;

  return { students, total: Number.isFinite(total) ? total : students.length };
};

const StudentsGroupsPage = ({ language, placeholder, strings }) => {
  const [activeTab, setActiveTab] = useState('students');
  const [searchValue, setSearchValue] = useState('');
  const [students, setStudents] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { token } = useAuth();
  const [filters, setFilters] = useState(createInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState(createInitialFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState(createInitialStudent);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [formFeedback, setFormFeedback] = useState('');
  const [globalAlert, setGlobalAlert] = useState(null);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);

  const [selectedStudent, setSelectedStudent] = useState(null);

  const filtersCount = useMemo(
    () =>
      Object.entries(appliedFilters).reduce((count, [key, value]) => {
        if (key === 'enabled' && value === '') {
          return count;
        }
        if (value === '' || value === null || value === undefined) {
          return count;
        }
        return count + 1;
      }, 0),
    [appliedFilters],
  );

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({
      lang: language ?? 'es',
      offset: String(pagination.offset ?? 0),
      limit: String(pagination.limit ?? 10),
      export_all: 'false',
    });

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        return;
      }

      if (key === 'enabled') {
        params.set('enabled', value);
        return;
      }

      params.set(key, value);
    });

    const controller = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/students?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load students');
      }

      const payload = await response.json();
      const { students: normalizedStudents, total } = normalizeStudentsResponse(payload);

      setStudents(normalizedStudents);
      setTotalStudents(total);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'Unable to load students');
        setStudents([]);
        setTotalStudents(0);
      }
    } finally {
      setIsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [appliedFilters, language, pagination.limit, pagination.offset, token]);

  useEffect(() => {
    const abort = fetchStudents();
    return () => {
      if (typeof abort === 'function') {
        abort();
      }
    };
  }, [fetchStudents]);

  useEffect(() => {
    setSearchValue(appliedFilters.full_name ?? '');
  }, [appliedFilters.full_name]);

  useEffect(() => {
    if (isFiltersOpen) {
      setFilters(appliedFilters);
    }
  }, [appliedFilters, isFiltersOpen]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    setAppliedFilters((previous) => ({ ...previous, full_name: trimmed }));
    setFilters((previous) => ({ ...previous, full_name: trimmed }));
    setPagination((previous) => ({ ...previous, offset: 0 }));
  };

  const handlePaginationChange = (direction) => {
    setPagination((previous) => {
      const totalPages = Math.ceil((totalStudents || 0) / previous.limit) || 1;
      const currentPage = Math.floor((previous.offset || 0) / previous.limit) + 1;
      if (direction === 'next' && currentPage < totalPages) {
        return { ...previous, offset: previous.offset + previous.limit };
      }
      if (direction === 'prev' && currentPage > 1) {
        return { ...previous, offset: previous.offset - previous.limit };
      }
      return previous;
    });
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    setPagination((previous) => ({ ...previous, offset: 0 }));
    setIsFiltersOpen(false);
  };

  const handleClearFilters = () => {
    const reset = createInitialFilters();
    setFilters(reset);
    setAppliedFilters(reset);
    setPagination((previous) => ({ ...previous, offset: 0 }));
    setIsFiltersOpen(false);
  };

  const fetchClasses = useCallback(
    async (schoolId) => {
      if (!schoolId) {
        setClassOptions([]);
        setStudentForm((previous) => ({ ...previous, group_id: '' }));
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/classes?lang=en&school_id=${encodeURIComponent(schoolId)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!response.ok) {
          throw new Error('Failed to load classes');
        }

        const payload = await response.json();
        const classesList = extractListFromPayload(payload);
        const options = classesList
          .map((item, index) => normalizeSelectOption(item, index))
          .filter((option) => option.value !== '');
        setClassOptions(options);

        if (options.length > 0) {
          setStudentForm((previous) => ({ ...previous, group_id: options[0].value }));
        } else {
          setStudentForm((previous) => ({ ...previous, group_id: '' }));
        }
      } catch (error) {
        console.error('Failed to load classes', error);
        setClassOptions([]);
        setStudentForm((previous) => ({ ...previous, group_id: '' }));
      }
    },
    [token],
  );

  const fetchSchools = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/schools/list?lang=es&status_filter=-1`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load schools');
      }

      const payload = await response.json();
      const schoolsList = extractListFromPayload(payload);
      const options = schoolsList
        .map((item, index) => normalizeSelectOption(item, index))
        .filter((option) => option.value !== '');
      setSchoolOptions(options);

      if (options.length > 0) {
        const selectedSchool = options[0].value;
        setStudentForm((previous) => ({ ...previous, school_id: selectedSchool }));
        fetchClasses(selectedSchool);
      } else {
        setStudentForm((previous) => ({ ...previous, school_id: '', group_id: '' }));
        setClassOptions([]);
      }
    } catch (error) {
      console.error('Failed to load schools', error);
      setSchoolOptions([]);
      setStudentForm((previous) => ({ ...previous, school_id: '', group_id: '' }));
      setClassOptions([]);
    }
  }, [fetchClasses, token]);

  useEffect(() => {
    if (isStudentModalOpen) {
      fetchSchools();
    }
  }, [fetchSchools, isStudentModalOpen]);

  const handleStudentFormChange = (event) => {
    const { name, value } = event.target;
    if (name === 'school_id') {
      setStudentForm((previous) => ({ ...previous, school_id: value, group_id: '' }));
      fetchClasses(value);
      return;
    }

    setStudentForm((previous) => ({ ...previous, [name]: value }));
  };

  const closeStudentModal = () => {
    setIsStudentModalOpen(false);
    setStudentForm(createInitialStudent());
    setFormFeedback('');
  };

  const handleCreateStudent = async (event) => {
    event.preventDefault();
    setIsSubmittingStudent(true);
    setFormFeedback('');

    const payload = [{ ...studentForm }];

    try {
      const response = await fetch(`${API_BASE_URL}/students/create?lang=${language ?? 'es'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create student');
      }

      setGlobalAlert({ type: 'success', message: strings.form.success });
      closeStudentModal();
      fetchStudents();
    } catch (error) {
      console.error('Failed to create student', error);
      setFormFeedback(strings.form.error);
      setGlobalAlert({ type: 'error', message: strings.form.error });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const { title, description } = placeholder;
  const statusLabels = strings.status;

  const activePage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil((totalStudents || 0) / pagination.limit));
  const showingFrom = Math.min(totalStudents, pagination.offset + 1);
  const showingTo = Math.min(totalStudents, pagination.offset + students.length);

  const renderStatusPill = (student) => {
    const rawStatus =
      student.status ?? student.enabled ?? student.is_enabled ?? student.user_status ?? student.state;
    const isActive =
      rawStatus === 1 ||
      rawStatus === '1' ||
      rawStatus === true ||
      rawStatus === 'true' ||
      rawStatus === statusLabels.active ||
      rawStatus === 'Activo';

    const label = student.user_status ?? (isActive ? statusLabels.active : statusLabels.inactive);
    const tone = isActive ? 'active' : 'inactive';

    return <span className={`students-table__status students-table__status--${tone}`}>{label}</span>;
  };

  const handleBackdropClick = (event) => {
    if (event.target.dataset.dismiss === 'filters') {
      setIsFiltersOpen(false);
    }
  };

  const handleDetailClose = () => {
    setSelectedStudent(null);
  };

  return (
    <div className="students-groups">
      <header className="students-groups__header">
        <div>
          <h2>{strings.header?.title ?? title}</h2>
          <p>{strings.header?.subtitle ?? description}</p>
        </div>
        <button type="button" className="students-groups__add" onClick={() => setIsStudentModalOpen(true)}>
          <span>+</span>
          {strings.actions.addStudent}
        </button>
      </header>

      <nav className="students-groups__tabs" aria-label="Tabs">
        <button
          type="button"
          className={activeTab === 'students' ? 'is-active' : ''}
          onClick={() => setActiveTab('students')}
        >
          {strings.tabs.students}
        </button>
        <button
          type="button"
          className={activeTab === 'groups' ? 'is-active' : ''}
          onClick={() => setActiveTab('groups')}
        >
          {strings.tabs.groups}
        </button>
      </nav>

      {activeTab === 'students' ? (
        <section className="students-view">
          <div className="students-view__toolbar">
            <form className="students-view__search" onSubmit={handleSearchSubmit}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={strings.searchPlaceholder}
              />
            </form>

            <div className="students-view__actions">
              <button type="button" className="students-view__filters" onClick={() => setIsFiltersOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 5h16M7 12h10M10 19h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {strings.actions.filters}
                {filtersCount > 0 && <span className="students-view__filters-count">{filtersCount}</span>}
              </button>
              <button type="button" className="students-view__secondary">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7h16M4 12h16M4 17h10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {strings.actions.bulkUpload}
              </button>
            </div>
          </div>

          {globalAlert && (
            <div className={`students-groups__alert students-groups__alert--${globalAlert.type}`}>
              {globalAlert.message}
            </div>
          )}

          <div className="students-table__wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th scope="col">{strings.table.registrationId}</th>
                  <th scope="col">{strings.table.student}</th>
                  <th scope="col">{strings.table.gradeGroup}</th>
                  <th scope="col">{strings.table.generation}</th>
                  <th scope="col">{strings.table.status}</th>
                  <th scope="col">{strings.table.contact}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="students-table__empty">
                      <span className="students-table__loader" aria-hidden="true" />
                      Cargando alumnos...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="students-table__empty">
                      {error}
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="students-table__empty">
                      {strings.table.empty}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const fullName = student.full_name ??
                      [student.first_name, student.last_name_father, student.last_name_mother]
                        .filter(Boolean)
                        .join(' ');
                    const initials = fullName
                      .split(' ')
                      .filter(Boolean)
                      .map((part) => part.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('');
                    const contact = student.personal_email ?? student.email ?? student.phone_number ?? '-';

                    return (
                      <tr key={student.student_id ?? student.id ?? fullName}>
                        <td data-title={strings.table.registrationId}>{student.register_id ?? student.registration_id ?? '—'}</td>
                        <td data-title={strings.table.student}>
                          <button type="button" className="students-table__identity" onClick={() => setSelectedStudent(student)}>
                            <span className="students-table__avatar" aria-hidden="true">
                              {initials || '??'}
                            </span>
                            <span className="students-table__name">{fullName || '—'}</span>
                          </button>
                        </td>
                        <td data-title={strings.table.gradeGroup}>{student.grade_group ?? student.group ?? '—'}</td>
                        <td data-title={strings.table.generation}>{student.generation ?? '—'}</td>
                        <td data-title={strings.table.status}>{renderStatusPill(student)}</td>
                        <td data-title={strings.table.contact} className="students-table__contact">
                          {contact}
                          {student.phone_number && <span>{student.phone_number}</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="students-table__footer">
            <div>
              {totalStudents > 0 ? (
                <span>
                  {strings.pagination.showing} {showingFrom}-{showingTo} {strings.pagination.of} {totalStudents}{' '}
                  {strings.pagination.students}
                </span>
              ) : (
                <span>{strings.pagination.showing} 0 {strings.pagination.of} 0 {strings.pagination.students}</span>
              )}
            </div>
            <div className="students-table__pager">
              <button
                type="button"
                onClick={() => handlePaginationChange('prev')}
                disabled={activePage <= 1}
              >
                ←
              </button>
              <span>
                {activePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePaginationChange('next')}
                disabled={activePage >= totalPages}
              >
                →
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <section className="students-groups__placeholder">
          <div>
            <h3>{strings.groupsPlaceholder.title}</h3>
            <p>{strings.groupsPlaceholder.description}</p>
          </div>
        </section>
      )}

      {isFiltersOpen && (
        <div className="students-filters is-open" data-dismiss="filters" onClick={handleBackdropClick}>
          <div className="students-filters__backdrop" aria-hidden="true" />
          <aside className="students-filters__panel" role="dialog" aria-modal="true">
            <header className="students-filters__header">
              <div>
                <h3>{strings.filters.title}</h3>
                <p>{strings.filters.subtitle}</p>
              </div>
              <button type="button" onClick={() => setIsFiltersOpen(false)} aria-label="Cerrar filtros">
                ×
              </button>
            </header>
            <form className="students-filters__form" onSubmit={handleApplyFilters}>
              <label>
                <span>{strings.filters.studentId}</span>
                <input name="student_id" value={filters.student_id} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.fullName}</span>
                <input name="full_name" value={filters.full_name} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.paymentReference}</span>
                <input name="payment_reference" value={filters.payment_reference} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.generation}</span>
                <input name="generation" value={filters.generation} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.gradeGroup}</span>
                <input name="grade_group" value={filters.grade_group} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.enabled}</span>
                <select className='custom_select' name="enabled" value={filters.enabled} onChange={handleFilterChange}>
                  <option value="">{strings.filters.enabledOptions.all}</option>
                  <option value="true">{strings.filters.enabledOptions.enabled}</option>
                  <option value="false">{strings.filters.enabledOptions.disabled}</option>
                </select>
              </label>
              <div className="students-filters__actions">
                <button type="button" onClick={handleClearFilters} className="is-text">
                  {strings.filters.clear}
                </button>
                <button type="submit">{strings.filters.apply}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {isStudentModalOpen && (
        <div className="students-modal">
          <div className="students-modal__backdrop" aria-hidden="true" onClick={closeStudentModal} />
          <div className="students-modal__dialog" role="dialog" aria-modal="true">
            <header className="students-modal__header">
              <div>
                <h3>{strings.form.title}</h3>
                <p>{strings.form.description}</p>
              </div>
              <button type="button" onClick={closeStudentModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <form className="students-form" onSubmit={handleCreateStudent}>
              <section>
                <h4>{strings.form.sections.personal}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.firstName}</span>
                    <input
                      name="first_name"
                      value={studentForm.first_name}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.lastNameFather}</span>
                    <input
                      name="last_name_father"
                      value={studentForm.last_name_father}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.lastNameMother}</span>
                    <input
                      name="last_name_mother"
                      value={studentForm.last_name_mother}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.birthDate}</span>
                    <input
                      type="date"
                      name="birth_date"
                      value={studentForm.birth_date}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.username}</span>
                    <input
                      name="username"
                      value={studentForm.username}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.password}</span>
                    <input
                      type="password"
                      name="password"
                      value={studentForm.password}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                </div>
              </section>

              <section>
                <h4>{strings.form.sections.contact}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.phoneNumber}</span>
                    <input
                      name="phone_number"
                      value={studentForm.phone_number}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.personalEmail}</span>
                    <input
                      type="email"
                      name="personal_email"
                      value={studentForm.personal_email}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.email}</span>
                    <input type="email" name="email" value={studentForm.email} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.taxId}</span>
                    <input name="tax_id" value={studentForm.tax_id} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.curp}</span>
                    <input name="curp" value={studentForm.curp} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.street}</span>
                    <input name="street" value={studentForm.street} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.extNumber}</span>
                    <input name="ext_number" value={studentForm.ext_number} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.intNumber}</span>
                    <input name="int_number" value={studentForm.int_number} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.suburb}</span>
                    <input name="suburb" value={studentForm.suburb} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.locality}</span>
                    <input name="locality" value={studentForm.locality} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.municipality}</span>
                    <input name="municipality" value={studentForm.municipality} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.state}</span>
                    <input name="state" value={studentForm.state} onChange={handleStudentFormChange} />
                  </label>
                </div>
              </section>

              <section>
                <h4>{strings.form.sections.academic}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.registerId}</span>
                    <input
                      name="register_id"
                      value={studentForm.register_id}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.paymentReference}</span>
                    <input
                      name="payment_reference"
                      value={studentForm.payment_reference}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.schoolId}</span>
                    <select
                      className='custom_select'
                      name="school_id"
                      value={studentForm.school_id}
                      onChange={handleStudentFormChange}
                      disabled={!schoolOptions.length}
                      required
                    >
                      {schoolOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{strings.form.fields.groupId}</span>
                    <select
                      className='custom_select'
                      name="group_id"
                      value={studentForm.group_id}
                      onChange={handleStudentFormChange}
                      disabled={!classOptions.length}
                      required={classOptions.length > 0}
                    >
                      {classOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {formFeedback && <p className="students-form__feedback">{formFeedback}</p>}

              <footer className="students-form__actions">
                <button type="button" onClick={closeStudentModal} className="is-secondary">
                  {strings.form.cancel}
                </button>
                <button type="submit" disabled={isSubmittingStudent}>
                  {isSubmittingStudent ? '...' : strings.form.submit}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="students-detail">
          <div className="students-detail__backdrop" aria-hidden="true" onClick={handleDetailClose} />
          <div className="students-detail__card" role="dialog" aria-modal="true">
            <header>
              <h3>{strings.detailPlaceholder.title}</h3>
              <button type="button" onClick={handleDetailClose} aria-label={strings.detailPlaceholder.close}>
                ×
              </button>
            </header>
            <p>{strings.detailPlaceholder.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

StudentsGroupsPage.defaultProps = {
  language: 'es',
};

export default StudentsGroupsPage;

