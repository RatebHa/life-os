import React from 'react';

export interface FormFieldProps {
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
        <span className="form-field-label-text">
          {label}
          {required && <span className="form-field-required">*</span>}
        </span>
        {children}
      </label>
      {error ? (
        <div className="form-field-error">{error}</div>
      ) : help ? (
        <div className="form-field-help">{help}</div>
      ) : null}
    </div>
  );
};
