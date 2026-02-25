import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('Admin App', () => {
  it('renders admin console heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Admin Feedback Console' })).toBeInTheDocument();
  });
});
