import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, help, error, children }) => {
  return (
    <div className="form-field" data-invalid={error ? 'true' : undefined}>
      <label className="form-field-label">
        {label}
        {required && <span className="form-field-required">*</span>}
      </label>
      {children}
      {error ? (
        <div className="form-field-error">{error}</div>
      ) : help ? (
        <div className="form-field-help">{help}</div>
      ) : null}
    </div>
  );
};
