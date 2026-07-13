import React from 'react';

interface FormSectionProps {
  heading?: string;
  description?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ heading, description, children }) => {
  return (
    <div className="form-section">
      {heading && (
        <div className="form-section-header">
          <div className="form-section-heading">{heading}</div>
          {description && <div className="form-section-description">{description}</div>}
        </div>
      )}
      <div className="form-section-body">{children}</div>
    </div>
  );
};
