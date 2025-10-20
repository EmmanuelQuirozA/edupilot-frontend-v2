import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import './StudentsBulkUploadPage.css';

const CSV_COLUMN_KEYS = [
  'row_number',
  'first_name',
  'last_name_father',
  'last_name_mother',
  'birth_date',
  'phone_number',
  'tax_id',
  'curp',
  'street',
  'ext_number',
  'int_number',
  'suburb',
  'locality',
  'municipality',
  'state',
  'personal_email',
  'email',
  'username',
  'password',
  'register_id',
  'payment_reference',
  'group_id',
  'balance',
];

const REQUIRED_FIELDS = [
  'first_name',
  'last_name_father',
  'last_name_mother',
  'email',
  'username',
  'password',
  'register_id',
  'payment_reference',
  'group_id',
];

const DUPLICATE_KEY_FIELDS = ['register_id', 'payment_reference', 'username'];

const FIELD_TRANSLATION_MAP = {
  first_name: 'firstName',
  last_name_father: 'lastNameFather',
  last_name_mother: 'lastNameMother',
  birth_date: 'birthDate',
  phone_number: 'phoneNumber',
  tax_id: 'taxId',
  curp: 'curp',
  street: 'street',
  ext_number: 'extNumber',
  int_number: 'intNumber',
  suburb: 'suburb',
  locality: 'locality',
  municipality: 'municipality',
  state: 'state',
  personal_email: 'personalEmail',
  email: 'email',
  username: 'username',
  password: 'password',
  register_id: 'registerId',
  payment_reference: 'paymentReference',
  group_id: 'groupId',
  balance: 'balance',
};

const VALIDATION_DELAY_MS = 1200;

const escapeCsvValue = (value) => {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

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
    payload.schools,
    payload.content,
    payload.response,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeSelectOption = (item, index = 0) => {
  if (!item || typeof item !== 'object') {
    const stringValue = item == null ? '' : String(item);
    return { value: stringValue, label: stringValue || String(index + 1) };
  }

  const valueKeys = [
    'id',
    'school_id',
    'schoolId',
    'group_id',
    'groupId',
    'class_id',
    'classId',
    'value',
    'uuid',
    'code',
  ];

  let value = '';
  for (const key of valueKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      value = String(item[key]);
      break;
    }
  }

  const labelKeys = [
    'name',
    'label',
    'title',
    'description',
    'grade_group',
    'group_name',
    'code',
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

const parseCsvContent = (content) => {
  const rows = [];
  let currentValue = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      if (insideQuotes && content[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && content[index + 1] === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue !== '' || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows
    .map((row) => row.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)))
    .filter((row) => row.some((cell) => (typeof cell === 'string' ? cell.trim() !== '' : cell != null)));
};

const buildDuplicateKey = (rowValues) => {
  const parts = DUPLICATE_KEY_FIELDS.map((field) => {
    const value = rowValues[field];
    if (value === undefined || value === null) {
      return '';
    }
    return typeof value === 'string' ? value.trim().toLowerCase() : String(value).toLowerCase();
  });

  if (parts.every((part) => part)) {
    return parts.join('|');
  }

  return null;
};

const createReportCsv = (rows, strings, getFieldLabel, getStatusLabel) => {
  const headers = [
    strings.table?.rowNumber ?? 'Row',
    strings.table?.status ?? 'Status',
    strings.table?.errors ?? 'Errors',
    ...CSV_COLUMN_KEYS.filter((key) => key !== 'row_number').map((key) => getFieldLabel(key)),
  ];

  const lines = [headers.map(escapeCsvValue).join(',')];

  rows.forEach((row) => {
    const errorMessage = row.errors?.length ? row.errors.join(' | ') : '';
    const values = [
      row.displayRowNumber ?? row.rowNumber ?? '',
      getStatusLabel(row.status),
      errorMessage,
      ...CSV_COLUMN_KEYS
        .filter((key) => key !== 'row_number')
        .map((key) => row.values?.[key] ?? ''),
    ];

    lines.push(values.map(escapeCsvValue).join(','));
  });

  return lines.join('\n');
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ConfirmationDialog = ({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="bulk-upload__confirm" role="presentation">
      <div className="bulk-upload__confirm-backdrop" aria-hidden="true" onClick={onCancel} />
      <div className="bulk-upload__confirm-dialog" role="dialog" aria-modal="true">
        <header>
          <h3>{title}</h3>
        </header>
        <p>{message}</p>
        <footer>
          <button type="button" className="is-text" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

const StudentsBulkUploadPage = ({ language = 'es', strings = {}, onNavigateBack }) => {
  const { token } = useAuth();
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [rows, setRows] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [focusedRowId, setFocusedRowId] = useState(null);

  const rowsRef = useRef([]);
  const validationTimerRef = useRef(null);
  const focusTimerRef = useRef(null);
  const rowRefs = useRef(new Map());
  const duplicateValidationRef = useRef(new Map());
  const duplicateRequestIdRef = useRef(new Map());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const clearValidationTimer = useCallback(() => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
      validationTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearValidationTimer();
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
      duplicateValidationRef.current.clear();
      duplicateRequestIdRef.current.clear();
    },
    [clearValidationTimer],
  );

  const getFieldLabel = useCallback(
    (field) => {
      const tableHeaders = strings.table?.headers ?? {};
      const translationKey = FIELD_TRANSLATION_MAP[field];
      if (translationKey) {
        if (tableHeaders[translationKey]) {
          return tableHeaders[translationKey];
        }

        if (strings.form?.fields?.[translationKey]) {
          return strings.form.fields[translationKey];
        }
      }

      if (tableHeaders[field]) {
        return tableHeaders[field];
      }

      if (strings.table?.[field]) {
        return strings.table[field];
      }

      return field;
    },
    [strings.form?.fields, strings.table],
  );

  const getStatusLabel = useCallback(
    (status) => {
      if (!status) {
        return strings.statuses?.pending ?? 'Pendiente';
      }

      if (status === 'valid') {
        return strings.statuses?.valid ?? 'Listo';
      }

      if (status === 'invalid') {
        return strings.statuses?.invalid ?? 'Con incidencias';
      }

      return strings.statuses?.pending ?? 'Pendiente';
    },
    [strings.statuses],
  );

  const duplicateMessages = useMemo(
    () => ({
      register_id: strings.validation?.duplicateRegisterId ?? 'La matrícula ya está registrada.',
      payment_reference:
        strings.validation?.duplicatePaymentReference ?? 'La referencia de pago ya está registrada.',
      username: strings.validation?.duplicateUsername ?? 'El usuario ya está registrado.',
    }),
    [
      strings.validation?.duplicatePaymentReference,
      strings.validation?.duplicateRegisterId,
      strings.validation?.duplicateUsername,
    ],
  );

  const getDuplicateMessage = useCallback(
    (field) => duplicateMessages[field] ?? strings.validation?.duplicateInSystem ?? 'Registro duplicado.',
    [duplicateMessages, strings.validation?.duplicateInSystem],
  );

  const updateRowWithDuplicateResult = useCallback(
    (rowId, result) => {
      setRows((previousRows) => {
        let didUpdate = false;
        const mapped = previousRows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }

          didUpdate = true;
          const duplicateMessagesList = DUPLICATE_KEY_FIELDS.map((field) => getDuplicateMessage(field));
          const filteredErrors = row.errors.filter((error) => !duplicateMessagesList.includes(error));
          const nextErrors = [...filteredErrors];

          let hasDuplicate = false;
          DUPLICATE_KEY_FIELDS.forEach((field) => {
            if (Number(result?.[field]) === 1) {
              hasDuplicate = true;
              const message = getDuplicateMessage(field);
              if (message && !nextErrors.includes(message)) {
                nextErrors.push(message);
              }
            }
          });

          const nextStatus = hasDuplicate || filteredErrors.length > 0 ? 'invalid' : 'pending';

          return {
            ...row,
            errors: nextErrors,
            status: nextStatus,
          };
        });

        if (didUpdate) {
          rowsRef.current = mapped;
        }

        return mapped;
      });
    },
    [getDuplicateMessage],
  );

  const validateDuplicateFields = useCallback(
    async (rowId, values) => {
      const params = new URLSearchParams({
        register_id: values.register_id ?? '',
        payment_reference: values.payment_reference ?? '',
        username: values.username ?? '',
      });

      const hasAnyValue = Array.from(params.values()).some((value) => value);

      if (!hasAnyValue) {
        duplicateValidationRef.current.delete(rowId);
        duplicateRequestIdRef.current.delete(rowId);
        updateRowWithDuplicateResult(rowId, {});
        return;
      }

      duplicateValidationRef.current.delete(rowId);
      updateRowWithDuplicateResult(rowId, {});

      const requestId = Date.now();
      duplicateRequestIdRef.current.set(rowId, requestId);

      try {
        const response = await fetch(`${API_BASE_URL}/students/validate-exist?${params.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error('Validation request failed');
        }

        const payload = await response.json();
        if (duplicateRequestIdRef.current.get(rowId) !== requestId) {
          return;
        }

        const resultArray = Array.isArray(payload) ? payload : [];
        const result = resultArray[0] ?? {};
        duplicateValidationRef.current.set(rowId, result);
        duplicateRequestIdRef.current.delete(rowId);
        updateRowWithDuplicateResult(rowId, result);
      } catch (error) {
        console.error('Validation error', error);
        duplicateRequestIdRef.current.delete(rowId);
      }
    },
    [token, updateRowWithDuplicateResult],
  );

  const handleSchoolChange = useCallback(
    (event) => {
      const { value } = event.target;
      if (value === selectedSchool) {
        return;
      }

      setSelectedSchool(value);
      setGroupOptions([]);
      setRows([]);
      rowsRef.current = [];
      setUploadedFileName('');
      clearValidationTimer();
    },
    [clearValidationTimer, selectedSchool],
  );

  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);

    try {
      const response = await fetch(`${API_BASE_URL}/schools/list?lang=${language}&status_filter=-1`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load schools');
      }

      const payload = await response.json();
      const list = extractListFromPayload(payload);
      const options = list.map((item, index) => normalizeSelectOption(item, index));
      setSchoolOptions(options);

      if (!options.find((option) => option.value === selectedSchool)) {
        setSelectedSchool(options[0]?.value ?? '');
      }
    } catch (error) {
      console.error('Failed to load schools', error);
      setAlert({ type: 'error', message: strings.notifications?.parseError ?? 'No fue posible cargar las escuelas.' });
      setSchoolOptions([]);
      setSelectedSchool('');
    } finally {
      setIsLoadingSchools(false);
    }
  }, [language, selectedSchool, strings.notifications?.parseError, token]);

  const fetchGroups = useCallback(
    async (schoolId) => {
      if (!schoolId) {
        setGroupOptions([]);
        return;
      }

      setIsLoadingGroups(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/classes?lang=${language}&school_id=${encodeURIComponent(schoolId)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!response.ok) {
          throw new Error('Failed to load groups');
        }

        const payload = await response.json();
        const list = extractListFromPayload(payload);
        const options = list.map((item, index) => normalizeSelectOption(item, index));
        setGroupOptions(options);

        setRows((previousRows) => {
          if (!previousRows.length) {
            return previousRows;
          }

          const mapped = previousRows.map((row) => {
            if (!row.values.group_id) {
              return row;
            }

            const isGroupValid = options.some((option) => option.value === row.values.group_id);
            if (isGroupValid) {
              return row;
            }

            return {
              ...row,
              values: { ...row.values, group_id: '' },
              status: 'pending',
            };
          });

          rowsRef.current = mapped;
          return mapped;
        });
      } catch (error) {
        console.error('Failed to load groups', error);
        setAlert({ type: 'error', message: strings.notifications?.parseError ?? 'No fue posible cargar los grupos.' });
        setGroupOptions([]);
      } finally {
        setIsLoadingGroups(false);
      }
    },
    [language, strings.notifications?.parseError, token],
  );

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    fetchGroups(selectedSchool);
  }, [fetchGroups, selectedSchool]);

  const runValidation = useCallback(
    async (candidateRows) => {
      const currentRows = candidateRows ?? rowsRef.current;
      if (!currentRows || currentRows.length === 0) {
        setRows([]);
        rowsRef.current = [];
        return;
      }

      setIsValidating(true);

      const preliminaryRows = currentRows.map((row) => ({
        ...row,
        errors: [],
        status: 'pending',
        serverMessage: '',
      }));

      const duplicateMap = new Map();

      preliminaryRows.forEach((row, index) => {
        const sanitizedValues = { ...row.values };

        CSV_COLUMN_KEYS.filter((key) => key !== 'row_number').forEach((key) => {
          const value = sanitizedValues[key];
          if (typeof value === 'string') {
            sanitizedValues[key] = value.trim();
          }
        });

        preliminaryRows[index].values = sanitizedValues;

        REQUIRED_FIELDS.forEach((field) => {
          const value = sanitizedValues[field];
          if (!value) {
            const fieldLabel = getFieldLabel(field);
            const messageTemplate = strings.validation?.missingRequired ?? 'El campo {field} es obligatorio.';
            const message = messageTemplate.replace('{field}', fieldLabel);
            preliminaryRows[index].errors.push(message);
          }
        });

        if (sanitizedValues.group_id) {
          const groupIsValid = groupOptions.some((option) => option.value === sanitizedValues.group_id);
          if (!groupIsValid) {
            preliminaryRows[index].errors.push(strings.validation?.invalidGroup ?? 'Selecciona un grupo válido.');
          }
        }

        const duplicateKey = buildDuplicateKey(sanitizedValues);
        if (duplicateKey) {
          const entries = duplicateMap.get(duplicateKey) ?? [];
          entries.push(index);
          duplicateMap.set(duplicateKey, entries);
          preliminaryRows[index].duplicateKey = duplicateKey;
        } else {
          preliminaryRows[index].duplicateKey = null;
          duplicateValidationRef.current.delete(row.id);
        }

        const cachedDuplicateResult = duplicateValidationRef.current.get(row.id);
        if (cachedDuplicateResult) {
          DUPLICATE_KEY_FIELDS.forEach((field) => {
            if (Number(cachedDuplicateResult[field]) === 1) {
              preliminaryRows[index].errors.push(getDuplicateMessage(field));
            }
          });
        }
      });

      duplicateMap.forEach((indexes) => {
        if (indexes.length <= 1) {
          return;
        }

        indexes.forEach((duplicateIndex) => {
          preliminaryRows[duplicateIndex].errors.push(
            strings.validation?.duplicateInFile ?? 'Registro duplicado en el archivo.',
          );
        });
      });

      const rowsForServer = preliminaryRows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !row.errors.length && row.duplicateKey)
        .filter(({ row }) => !duplicateValidationRef.current.has(row.id));

      if (rowsForServer.length > 0) {
        const requests = rowsForServer.map(async ({ row, index }) => {
          try {
            const params = new URLSearchParams({
              register_id: row.values.register_id ?? '',
              payment_reference: row.values.payment_reference ?? '',
              username: row.values.username ?? '',
            });

            const response = await fetch(`${API_BASE_URL}/students/validate-exist?${params.toString()}`, {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (!response.ok) {
              throw new Error('Validation request failed');
            }

            const payload = await response.json();
            const resultArray = Array.isArray(payload) ? payload : [];
            const result = resultArray[0] ?? {};
            duplicateValidationRef.current.set(row.id, result);

            DUPLICATE_KEY_FIELDS.forEach((field) => {
              if (Number(result[field]) === 1) {
                preliminaryRows[index].errors.push(getDuplicateMessage(field));
              }
            });
          } catch (error) {
            console.error('Validation error', error);
            preliminaryRows[index].errors.push(
              strings.validation?.unableToValidate ?? 'No fue posible validar el registro en el servidor.',
            );
          }
        });

        await Promise.all(requests);
      }

      const finalRows = preliminaryRows.map((row) => {
        const nextRow = { ...row };
        delete nextRow.duplicateKey;
        if (nextRow.errors.length > 0) {
          nextRow.status = 'invalid';
        } else {
          nextRow.status = 'valid';
        }
        return nextRow;
      });

      rowsRef.current = finalRows;
      setRows(finalRows);
      setIsValidating(false);
    },
    [getDuplicateMessage, getFieldLabel, groupOptions, strings.validation, token],
  );

  const scheduleValidation = useCallback(() => {
    clearValidationTimer();
    validationTimerRef.current = setTimeout(() => {
      runValidation();
    }, VALIDATION_DELAY_MS);
  }, [clearValidationTimer, runValidation]);

  const handleRowChange = useCallback(
    (rowId, field, value) => {
      setRows((previousRows) => {
        const mapped = previousRows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }

          return {
            ...row,
            values: {
              ...row.values,
              [field]: value,
            },
            status: 'pending',
          };
        });

        rowsRef.current = mapped;
        return mapped;
      });

      if (DUPLICATE_KEY_FIELDS.includes(field)) {
        const updatedRow = rowsRef.current.find((row) => row.id === rowId);
        if (updatedRow) {
          validateDuplicateFields(rowId, updatedRow.values);
        }
      }

      scheduleValidation();
    },
    [scheduleValidation, validateDuplicateFields],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer?.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleFile = useCallback(
    (file) => {
      if (!file || (!file.name.endsWith('.csv') && file.type !== 'text/csv')) {
        setAlert({ type: 'warning', message: strings.notifications?.invalidFile ?? 'Selecciona un archivo CSV.' });
        return;
      }

      if (!selectedSchool) {
        setAlert({
          type: 'warning',
          message:
            strings.notifications?.missingSchool ?? 'Selecciona una escuela antes de continuar.',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const text = reader.result;
          const parsedRows = parseCsvContent(typeof text === 'string' ? text : '');
          if (!parsedRows.length) {
            setAlert({ type: 'warning', message: strings.notifications?.parseError ?? 'No fue posible procesar el archivo. Verifica el formato.' });
            return;
          }

          const [headerRow, ...dataRows] = parsedRows;
          const normalizedHeader = headerRow.map((cell) =>
            typeof cell === 'string' ? cell.trim().toLowerCase().replace(/\s+/g, '_') : '',
          );

          const fieldIndexes = CSV_COLUMN_KEYS.map((key) => normalizedHeader.indexOf(key));

          const dataLimit = dataRows.length > 100 ? 100 : dataRows.length;
          const trimmedRows = dataRows.slice(0, dataLimit);

          if (dataRows.length > 100) {
            const message = strings.validation?.limitExceeded ??
              'El archivo solo puede contener hasta 100 registros. Se procesaron los primeros 100.';
            setAlert({ type: 'warning', message });
          }

          const preparedRows = trimmedRows.map((row, rowIndex) => {
            const values = { school_id: selectedSchool };
            CSV_COLUMN_KEYS.forEach((key, columnIndex) => {
              if (key === 'row_number') {
                return;
              }

              const headerIndex = fieldIndexes[columnIndex];
              if (headerIndex === -1) {
                values[key] = '';
                return;
              }

              const cellValue = row[headerIndex];
              values[key] = cellValue ?? '';
            });

            const displayRowNumberIndex = fieldIndexes[0];
            const displayRowNumber = displayRowNumberIndex >= 0 ? row[displayRowNumberIndex] : rowIndex + 1;

            return {
              id: `${Date.now()}-${rowIndex}`,
              displayRowNumber: displayRowNumber || rowIndex + 1,
              values,
              errors: [],
              status: 'pending',
              serverMessage: '',
            };
          });

          rowsRef.current = preparedRows;
          setRows(preparedRows);
          setUploadedFileName(file.name);
          await runValidation(preparedRows);
        } catch (error) {
          console.error('Failed to parse CSV', error);
          setAlert({ type: 'error', message: strings.notifications?.parseError ?? 'No fue posible procesar el archivo.' });
          setRows([]);
          rowsRef.current = [];
          setUploadedFileName('');
        }
      };

      reader.readAsText(file, 'UTF-8');
    },
    [runValidation, selectedSchool, strings.notifications, strings.validation],
  );

  const handleClearFile = useCallback(() => {
    setUploadedFileName('');
    setRows([]);
    rowsRef.current = [];
    duplicateValidationRef.current.clear();
    duplicateRequestIdRef.current.clear();
    clearValidationTimer();
  }, [clearValidationTimer]);

  const handleFocusRow = useCallback((rowId) => {
    const element = rowRefs.current.get(rowId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedRowId(rowId);
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
      focusTimerRef.current = setTimeout(() => setFocusedRowId(null), 2000);
    }
  }, []);

  const summary = useMemo(() => {
    const stats = { total: rows.length, valid: 0, invalid: 0, pending: 0 };
    rows.forEach((row) => {
      if (row.status === 'valid') {
        stats.valid += 1;
      } else if (row.status === 'invalid') {
        stats.invalid += 1;
      } else {
        stats.pending += 1;
      }
    });
    return stats;
  }, [rows]);

  const logEntries = useMemo(
    () =>
      rows
        .filter((row) => row.errors?.length)
        .map((row) => ({
          id: row.id,
          label: `${strings.table?.rowNumber ?? 'Fila'} ${row.displayRowNumber}`,
          messages: row.errors,
        })),
    [rows, strings.table?.rowNumber],
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/bulkfile/students_bulk_upload.csv', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      downloadBlob(blob, 'students_bulk_upload.csv');
    } catch (error) {
      console.error('Download template error', error);
      setAlert({ type: 'error', message: strings.notifications?.downloadError ?? 'No fue posible descargar el formato.' });
    }
  }, [strings.notifications?.downloadError, token]);

  const handleDownloadReport = useCallback(() => {
    if (!rows.length) {
      return;
    }

    const csv = createReportCsv(rows, strings, getFieldLabel, getStatusLabel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = strings.report?.fileName ?? 'reporte_carga_masiva.csv';
    downloadBlob(blob, fileName);
    setAlert({ type: 'success', message: strings.notifications?.reportReady ?? 'Reporte descargado correctamente.' });
  }, [getFieldLabel, getStatusLabel, rows, strings]);

  const sendCreateRequest = useCallback(
    async (validRows) => {
      try {
        const response = await fetch(`${API_BASE_URL}/students/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(
            validRows.map((row) => ({
              ...row.values,
              school_id: row.values.school_id ?? selectedSchool,
            })),
          ),
        });

        if (!response.ok) {
          throw new Error('Failed to create students');
        }

        const payload = await response.json();
        const message = payload.message ?? strings.notifications?.createSuccess ?? 'Alumnos creados correctamente.';
        setAlert({ type: payload.success === false ? 'error' : 'success', message });

        if (payload.success !== false) {
          handleClearFile();
        }
      } catch (error) {
        console.error('Create students error', error);
        setAlert({ type: 'error', message: strings.notifications?.createError ?? 'No fue posible crear los alumnos.' });
      }
    },
    [
      handleClearFile,
      selectedSchool,
      strings.notifications?.createError,
      strings.notifications?.createSuccess,
      token,
    ],
  );

  const handleCreateStudents = useCallback(() => {
    if (!rows.length) {
      setAlert({ type: 'info', message: strings.notifications?.noValidRecords ?? 'No hay registros válidos qué crear.' });
      return;
    }

    const validRows = rows.filter((row) => row.status === 'valid');
    if (!validRows.length) {
      setAlert({ type: 'info', message: strings.notifications?.noValidRecords ?? 'No hay registros válidos qué crear.' });
      return;
    }

    const invalidRows = rows.filter((row) => row.status !== 'valid');

    if (invalidRows.length > 0) {
      const title = strings.confirmations?.mixedTitle ?? 'Registros con incidencias';
      const messageTemplate = strings.confirmations?.mixedMessage ??
        'Se encontraron {invalidCount} registros con incidencias. ¿Deseas continuar y crear únicamente los {validCount} registros válidos?';
      const message = messageTemplate
        .replace('{invalidCount}', invalidRows.length)
        .replace('{validCount}', validRows.length);

      setConfirmation({
        title,
        message,
        confirmLabel: strings.confirmations?.confirm ?? 'Sí, continuar',
        cancelLabel: strings.confirmations?.cancel ?? 'Revisar',
        onConfirm: () => {
          setConfirmation(null);
          sendCreateRequest(validRows);
        },
        onCancel: () => setConfirmation(null),
      });
      return;
    }

    sendCreateRequest(validRows);
  }, [rows, sendCreateRequest, strings.confirmations, strings.notifications?.noValidRecords]);

  const columns = useMemo(() => CSV_COLUMN_KEYS.filter((key) => key !== 'row_number'), []);

  return (
    <div className="students-bulk-upload">
      <GlobalToast alert={alert} onClose={() => setAlert(null)} />

      <header className="bulk-upload__header">
        <div>
          <h1>{strings.header?.title ?? 'Carga masiva de alumnos'}</h1>
          <p>{strings.header?.description ?? 'Sube un archivo CSV para registrar múltiples alumnos de una sola vez.'}</p>
        </div>
        <div className="bulk-upload__summary">
          <span>{strings.summary?.total ?? 'Total'}: {summary.total}</span>
          <span className="is-valid">{strings.summary?.valid ?? 'Válidos'}: {summary.valid}</span>
          <span className="is-invalid">{strings.summary?.invalid ?? 'Con incidencias'}: {summary.invalid}</span>
        </div>
      </header>

      <div className="bulk-upload__layout">
        <section className="bulk-upload__card bulk-upload__card--actions">
          <h2>{strings.steps?.title ?? 'Pasos para la carga'}</h2>
          <ol className="bulk-upload__steps">
            <li>
              <div>
                <span>{strings.steps?.selectSchool?.title ?? 'Selecciona la escuela'}</span>
                <p>{strings.steps?.selectSchool?.description ?? 'Elige la escuela para obtener los grupos disponibles.'}</p>
              </div>
              <select
                className="bulk-upload__select"
                value={selectedSchool}
                onChange={handleSchoolChange}
                disabled={isLoadingSchools || !schoolOptions.length}
              >
                {schoolOptions.length === 0 ? (
                  <option value="">{strings.steps?.selectSchool?.empty ?? 'No hay escuelas disponibles'}</option>
                ) : null}
                {schoolOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </li>
            <li>
              <div>
                <span>{strings.steps?.downloadTemplate?.title ?? 'Descarga el formato'}</span>
                <p>{strings.steps?.downloadTemplate?.description ?? 'Utiliza el archivo CSV de referencia para evitar errores.'}</p>
              </div>
              <button type="button" className="bulk-upload__download" onClick={handleDownloadTemplate}>
                {strings.actions?.downloadTemplate ?? 'Descargar aquí'}
              </button>
            </li>
            <li>
              <div>
                <span>{strings.steps?.uploadFile?.title ?? 'Sube el archivo CSV'}</span>
                <p>{strings.steps?.uploadFile?.description ?? 'Arrastra o selecciona un archivo con máximo 100 registros.'}</p>
              </div>
            </li>
          </ol>

          <div
            className={`bulk-upload__dropzone${isDragging ? ' is-dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div>
              <strong>{strings.dropzone?.title ?? 'Arrastra y suelta un archivo CSV aquí'}</strong>
              <p>{strings.dropzone?.description ?? 'o haz clic para seleccionarlo desde tu computadora.'}</p>
              <span>{strings.dropzone?.helper ?? 'Acepta máximo 100 registros por carga.'}</span>
            </div>
            <label className="bulk-upload__file-button">
              <input type="file" accept=".csv,text/csv" onChange={handleFileInputChange} />
              {strings.actions?.selectFile ?? 'Seleccionar archivo'}
            </label>
          </div>

          {uploadedFileName ? (
            <div className="bulk-upload__file-info">
              <span>{strings.fileInfo?.label ?? 'Archivo seleccionado'}:</span>
              <strong>{uploadedFileName}</strong>
              <button type="button" className="is-text" onClick={handleClearFile}>
                {strings.actions?.removeFile ?? 'Eliminar'}
              </button>
            </div>
          ) : null}

          <p className="bulk-upload__helper">{strings.helper ?? 'Recuerda completar todos los campos obligatorios marcados con *.'}</p>
        </section>

        <section className="bulk-upload__card bulk-upload__card--preview">
          <header className="bulk-upload__preview-header">
            <div>
              <h2>{strings.table?.title ?? 'Previsualización de registros'}</h2>
              <p>{strings.table?.subtitle ?? 'Edita la información antes de confirmar la carga.'}</p>
            </div>
            <div className="bulk-upload__preview-actions">
              <button
                type="button"
                className="is-text"
                onClick={handleDownloadReport}
                disabled={!rows.length}
              >
                {strings.report?.download ?? 'Descargar reporte'}
              </button>
              <button type="button" className="is-secondary" onClick={onNavigateBack}>
                {strings.actions?.back ?? 'Volver a alumnos'}
              </button>
              <button type="button" onClick={handleCreateStudents} disabled={!rows.length}>
                {isValidating ? strings.actions?.validating ?? 'Validando...' : strings.actions?.create ?? 'Crear alumnos válidos'}
              </button>
            </div>
          </header>

          <div className="bulk-upload__table-wrapper">
            {rows.length ? (
              <table className="bulk-upload__table">
                <thead>
                  <tr>
                    <th>{strings.table?.rowNumber ?? 'Fila'}</th>
                    {columns.map((column) => (
                      <th key={column}>
                        {getFieldLabel(column)}{REQUIRED_FIELDS.includes(column) ? ' *' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        ref={(element) => {
                          if (element) {
                            rowRefs.current.set(row.id, element);
                          } else {
                            rowRefs.current.delete(row.id);
                          }
                        }}
                        className={`bulk-upload__row bulk-upload__row--${row.status}${focusedRowId === row.id ? ' is-focused' : ''}`}
                      >
                        <td data-label={strings.table?.rowNumber ?? 'Fila'}>{row.displayRowNumber ?? ''}</td>
                        {columns.map((column) => {
                          if (column === 'birth_date') {
                            return (
                              <td key={column} data-label={getFieldLabel(column)}>
                                <input
                                  type="date"
                                  value={row.values[column] ?? ''}
                                  onChange={(event) => handleRowChange(row.id, column, event.target.value)}
                                />
                              </td>
                            );
                          }

                          if (column === 'group_id') {
                            return (
                              <td key={column} data-label={getFieldLabel(column)}>
                                <select
                                  value={row.values[column] ?? ''}
                                  onChange={(event) => handleRowChange(row.id, column, event.target.value)}
                                  disabled={isLoadingGroups || !groupOptions.length}
                                >
                                  <option value="">
                                    {strings.table?.groupPlaceholder ?? 'Selecciona un grupo'}
                                  </option>
                                  {groupOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          return (
                            <td key={column} data-label={getFieldLabel(column)}>
                              <input
                                type="text"
                                value={row.values[column] ?? ''}
                                onChange={(event) => handleRowChange(row.id, column, event.target.value)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bulk-upload__table-placeholder">
                <p>{strings.table?.empty ?? 'Selecciona un archivo CSV para mostrar una previsualización.'}</p>
              </div>
            )}
          </div>

          <aside className="bulk-upload__logs">
            <div className="bulk-upload__logs-header">
              <h3>{strings.logs?.title ?? 'Incidencias detectadas'}</h3>
              <span>{logEntries.length}</span>
            </div>
            <p>{strings.logs?.hint ?? 'Haz clic en un elemento para ir al registro correspondiente.'}</p>
            {logEntries.length ? (
              <ul>
                {logEntries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => handleFocusRow(entry.id)}>
                      <strong>{entry.label}</strong>
                      <span>{entry.messages[0]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bulk-upload__logs-empty">{strings.logs?.empty ?? 'No se detectaron incidencias.'}</p>
            )}
          </aside>
        </section>
      </div>

      <ConfirmationDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        message={confirmation?.message ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? ''}
        cancelLabel={confirmation?.cancelLabel ?? ''}
        onConfirm={confirmation?.onConfirm}
        onCancel={confirmation?.onCancel}
      />
    </div>
  );
};

export default StudentsBulkUploadPage;
