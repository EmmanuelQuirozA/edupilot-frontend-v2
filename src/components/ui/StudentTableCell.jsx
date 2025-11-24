import StudentInfo from './StudentInfo.jsx';

const buildStudentDetailsLabel = ({ gradeGroup, scholarLevel, enrollment }) => {
  const details = [];

  if (gradeGroup) {
    details.push(`Grupo: ${gradeGroup}`);
  }

  if (scholarLevel) {
    details.push(`Nivel: ${scholarLevel}`);
  }

  if (enrollment) {
    details.push(`Matrícula: ${enrollment}`);
  }

  return details.join(' · ');
};

const StudentTableCell = ({
  name,
  fallbackName = '—',
  gradeGroup,
  scholarLevel,
  enrollment,
  onClick,
  href,
  disabled = false,
  className = '',
  avatarText,
  avatarFallback,
  nameButtonProps,
}) => {
  const metaValue = buildStudentDetailsLabel({ gradeGroup, scholarLevel, enrollment });

  return (
    <StudentInfo
      name={name}
      fallbackName={fallbackName}
      metaValue={metaValue || undefined}
      onClick={onClick}
      href={href}
      disabled={disabled}
      className={className}
      avatarText={avatarText}
      avatarFallback={avatarFallback}
      nameButtonProps={nameButtonProps}
    />
  );
};

export default StudentTableCell;
