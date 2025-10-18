import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
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
    payload.content,
    payload.content?.items,
    payload.content?.data,
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
    'grade_group',
    'gradeGroup',
    'generation',
    'group',
    'grade',
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
    const gradeGroup = item.grade_group ?? item.gradeGroup ?? '';
    const gradeParts = [item.grade, item.group].filter((part) => part && String(part).trim() !== '');
    const combined = gradeGroup || (gradeParts.length ? gradeParts.join('-') : '');
    const generation = item.generation ?? item.generation_name ?? item.school_year ?? '';
    if (combined) {
      label = generation ? `${combined} · ${generation}` : combined;
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

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil((totalStudents || 0) / pagination.limit));
  const showingFrom = Math.min(totalStudents, pagination.offset + 1);
  const showingTo = Math.min(totalStudents, pagination.offset + students.length);

  const renderStatusBadge = (student) => {
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
    const tone = isActive ? 'success' : 'secondary';

    return <span className={`badge rounded-pill text-bg-${tone}`}>{label}</span>;
  };

  const handleDetailClose = () => {
    setSelectedStudent(null);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <header className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3">
        <div>
          <h2 className="h3 mb-1">{strings.header?.title ?? title}</h2>
          <p className="text-secondary mb-0">{strings.header?.subtitle ?? description}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary d-flex align-items-center gap-2"
            onClick={() => setIsStudentModalOpen(true)}
          >
            <span className="fs-4 lh-1" aria-hidden="true">
              +
            </span>
            {strings.actions.addStudent}
          </button>
        </div>
      </header>

      <nav aria-label="Tabs">
        <div className="nav nav-tabs">
          <button
            type="button"
            className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            {strings.tabs.students}
          </button>
          <button
            type="button"
            className={`nav-link ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            {strings.tabs.groups}
          </button>
        </div>
      </nav>

      {activeTab === 'students' ? (
        <section className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-3 align-items-center mb-4">
              <div className="col-12 col-lg-6">
                <form className="input-group" onSubmit={handleSearchSubmit}>
                  <span className="input-group-text">
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
                      <path
                        d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    type="search"
                    className="form-control"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={strings.searchPlaceholder}
                    aria-label={strings.searchPlaceholder}
                  />
                  <button type="submit" className="btn btn-primary">
                    {strings.actions.search ?? 'Buscar'}
                  </button>
                </form>
              </div>
              <div className="col-12 col-lg-6 d-flex justify-content-lg-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary d-flex align-items-center gap-2 position-relative"
                  onClick={() => setIsFiltersOpen(true)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
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
                  {filtersCount > 0 ? (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-primary">
                      {filtersCount}
                    </span>
                  ) : null}
                </button>
                <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2">
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
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

            {globalAlert ? (
              <div
                className={`alert alert-${globalAlert.type === 'success' ? 'success' : 'danger'} d-flex align-items-center`}
                role="alert"
              >
                {globalAlert.message}
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
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
                      <td colSpan={6} className="text-center py-4">
                        <div className="spinner-border text-primary" role="status" aria-hidden="true" />
                        <span className="ms-2">Cargando alumnos...</span>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-danger">
                        {error}
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-secondary">
                        {strings.table.empty}
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const fullName =
                        student.full_name ??
                        [student.first_name, student.last_name_father, student.last_name_mother]
                          .filter(Boolean)
                          .join(' ');
                      const initials = fullName
                        .split(' ')
                        .filter(Boolean)
                        .map((part) => part.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join('');
                      const contact = student.personal_email ?? student.email ?? student.phone_number ?? '—';

                      return (
                        <tr key={student.student_id ?? student.id ?? fullName}>
                          <td>{student.register_id ?? student.registration_id ?? '—'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-3"
                              onClick={() => setSelectedStudent(student)}
                            >
                              <span
                                className="rounded-circle bg-primary-subtle text-primary fw-semibold d-inline-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px' }}
                                aria-hidden="true"
                              >
                                {initials || '??'}
                              </span>
                              <span className="fw-semibold text-body">{fullName || '—'}</span>
                            </button>
                          </td>
                          <td>{student.grade_group ?? student.group ?? '—'}</td>
                          <td>{student.generation ?? '—'}</td>
                          <td>{renderStatusBadge(student)}</td>
                          <td>
                            <div className="d-flex flex-column">
                              <span>{contact}</span>
                              {student.phone_number ? <small className="text-secondary">{student.phone_number}</small> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mt-3">
              <div className="text-secondary">
                {totalStudents > 0 ? (
                  <span>
                    {strings.pagination.showing} {showingFrom}-{showingTo} {strings.pagination.of} {totalStudents}{' '}
                    {strings.pagination.students}
                  </span>
                ) : (
                  <span>
                    {strings.pagination.showing} 0 {strings.pagination.of} 0 {strings.pagination.students}
                  </span>
                )}
              </div>
              <nav aria-label="Student pagination">
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage <= 1 ? 'disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => handlePaginationChange('prev')}
                      disabled={currentPage <= 1}
                    >
                      «
                    </button>
                  </li>
                  <li className="page-item disabled">
                    <span className="page-link">
                      {currentPage} / {totalPages}
                    </span>
                  </li>
                  <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => handlePaginationChange('next')}
                      disabled={currentPage >= totalPages}
                    >
                      »
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </section>
      ) : (
        <section className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <h3 className="h5 mb-3">{strings.groupsPlaceholder.title}</h3>
            <p className="text-secondary mb-0">{strings.groupsPlaceholder.description}</p>
          </div>
        </section>
      )}

      {isFiltersOpen ? (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1060 }}
          >
            <div className="modal-dialog modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h3 className="modal-title h5 mb-1">{strings.filters.title}</h3>
                    <p className="text-secondary mb-0">{strings.filters.subtitle}</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setIsFiltersOpen(false)} />
                </div>
                <form onSubmit={handleApplyFilters}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">
                          {strings.filters.studentId}
                          <input
                            name="student_id"
                            value={filters.student_id}
                            onChange={handleFilterChange}
                            className="form-control"
                          />
                        </label>
                      </div>
                      <div className="col-12">
                        <label className="form-label">
                          {strings.filters.fullName}
                          <input
                            name="full_name"
                            value={filters.full_name}
                            onChange={handleFilterChange}
                            className="form-control"
                          />
                        </label>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          {strings.filters.paymentReference}
                          <input
                            name="payment_reference"
                            value={filters.payment_reference}
                            onChange={handleFilterChange}
                            className="form-control"
                          />
                        </label>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          {strings.filters.generation}
                          <input
                            name="generation"
                            value={filters.generation}
                            onChange={handleFilterChange}
                            className="form-control"
                          />
                        </label>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          {strings.filters.gradeGroup}
                          <input
                            name="grade_group"
                            value={filters.grade_group}
                            onChange={handleFilterChange}
                            className="form-control"
                          />
                        </label>
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">
                          {strings.filters.enabled}
                          <select
                            className="form-select"
                            name="enabled"
                            value={filters.enabled}
                            onChange={handleFilterChange}
                          >
                            <option value="">{strings.filters.enabledOptions.all}</option>
                            <option value="true">{strings.filters.enabledOptions.enabled}</option>
                            <option value="false">{strings.filters.enabledOptions.disabled}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-link text-decoration-none"
                      onClick={handleClearFilters}
                    >
                      {strings.filters.clear}
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {strings.filters.apply}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1055 }} />
        </>
      ) : null}

      {isStudentModalOpen ? (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1070 }}
          >
            <div className="modal-dialog modal-dialog-scrollable modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h3 className="modal-title h5 mb-1">{strings.form.title}</h3>
                    <p className="text-secondary mb-0">{strings.form.description}</p>
                  </div>
                  <button type="button" className="btn-close" aria-label="Cerrar" onClick={closeStudentModal} />
                </div>
                <form onSubmit={handleCreateStudent}>
                  <div className="modal-body">
                    <section className="mb-4">
                      <h4 className="h6 text-uppercase text-secondary mb-3">{strings.form.sections.personal}</h4>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.firstName}
                            <input
                              name="first_name"
                              value={studentForm.first_name}
                              onChange={handleStudentFormChange}
                              className="form-control"
                              required
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.lastNameFather}
                            <input
                              name="last_name_father"
                              value={studentForm.last_name_father}
                              onChange={handleStudentFormChange}
                              className="form-control"
                              required
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.lastNameMother}
                            <input
                              name="last_name_mother"
                              value={studentForm.last_name_mother}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.birthDate}
                            <input
                              type="date"
                              name="birth_date"
                              value={studentForm.birth_date}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.phoneNumber}
                            <input
                              name="phone_number"
                              value={studentForm.phone_number}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.personalEmail}
                            <input
                              type="email"
                              name="personal_email"
                              value={studentForm.personal_email}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                      </div>
                    </section>

                    <section className="mb-4">
                      <h4 className="h6 text-uppercase text-secondary mb-3">{strings.form.sections.contact}</h4>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.email}
                            <input
                              type="email"
                              name="email"
                              value={studentForm.email}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.username}
                            <input
                              name="username"
                              value={studentForm.username}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.password}
                            <input
                              name="password"
                              value={studentForm.password}
                              onChange={handleStudentFormChange}
                              className="form-control"
                              type="password"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.taxId}
                            <input
                              name="tax_id"
                              value={studentForm.tax_id}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.curp}
                            <input
                              name="curp"
                              value={studentForm.curp}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                      </div>
                    </section>

                    <section className="mb-4">
                      <h4 className="h6 text-uppercase text-secondary mb-3">{strings.form.sections.address}</h4>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.street}
                            <input
                              name="street"
                              value={studentForm.street}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">
                            {strings.form.fields.extNumber}
                            <input
                              name="ext_number"
                              value={studentForm.ext_number}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">
                            {strings.form.fields.intNumber}
                            <input
                              name="int_number"
                              value={studentForm.int_number}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.suburb}
                            <input
                              name="suburb"
                              value={studentForm.suburb}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.locality}
                            <input
                              name="locality"
                              value={studentForm.locality}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.municipality}
                            <input
                              name="municipality"
                              value={studentForm.municipality}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.state}
                            <input
                              name="state"
                              value={studentForm.state}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                      </div>
                    </section>

                    <section className="mb-4">
                      <h4 className="h6 text-uppercase text-secondary mb-3">{strings.form.sections.academic}</h4>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.registerId}
                            <input
                              name="register_id"
                              value={studentForm.register_id}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.paymentReference}
                            <input
                              name="payment_reference"
                              value={studentForm.payment_reference}
                              onChange={handleStudentFormChange}
                              className="form-control"
                            />
                          </label>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.schoolId}
                            <select
                              className="form-select"
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
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {strings.form.fields.groupId}
                            <select
                              className="form-select"
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
                      </div>
                    </section>

                    {formFeedback ? (
                      <div className="alert alert-danger" role="alert">
                        {formFeedback}
                      </div>
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeStudentModal}>
                      {strings.form.cancel}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmittingStudent}>
                      {isSubmittingStudent ? '...' : strings.form.submit}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1065 }} onClick={closeStudentModal} />
        </>
      ) : null}

      {selectedStudent ? (
        <>
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1080 }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title h5 mb-0">{strings.detailPlaceholder.title}</h3>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label={strings.detailPlaceholder.close}
                    onClick={handleDetailClose}
                  />
                </div>
                <div className="modal-body">
                  <p className="text-secondary mb-0">{strings.detailPlaceholder.description}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1075 }} onClick={handleDetailClose} />
        </>
      ) : null}
    </div>
  );
};

StudentsGroupsPage.defaultProps = {
  language: 'es',
};

export default StudentsGroupsPage;

