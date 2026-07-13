import React from 'react';

export interface FormSectionProps {
  heading?: string;
  description?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ heading, description, children }) => {
  return (
    <div className="form-section">
      {(heading || description) && (
        <div className="form-section-header">
          {heading && <div className="form-section-heading">{heading}</div>}
          {description && <div className="form-section-description">{description}</div>}
        </div>
      )}
      <div className="form-section-body">{children}</div>
    </div>
  );
};
