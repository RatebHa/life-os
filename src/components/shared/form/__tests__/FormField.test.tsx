import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../FormField';
import { TextInput } from '../TextInput';

describe('FormField', () => {
  it('renders the label text', () => {
    render(
      <FormField label="Title">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('shows the required marker when required is true', () => {
    render(
      <FormField label="Title" required>
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('shows help text when provided and no error', () => {
    render(
      <FormField label="Title" help="Some help text">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Some help text')).toBeTruthy();
  });

  it('shows error text instead of help text when both are provided', () => {
    render(
      <FormField label="Title" help="Some help text" error="Title is required">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Title is required')).toBeTruthy();
    expect(screen.queryByText('Some help text')).toBeNull();
  });

  it('sets data-invalid on the wrapper when error is present', () => {
    const { container } = render(
      <FormField label="Title" error="Title is required">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(container.querySelector('.form-field')?.getAttribute('data-invalid')).toBe('true');
  });
});
