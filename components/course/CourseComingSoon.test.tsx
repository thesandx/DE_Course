import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getSoonCourse } from '@/lib/course/courses';

import { CourseComingSoon } from './CourseComingSoon';

describe('CourseComingSoon', () => {
  it('names the course, says it is on the way and lists its plan', () => {
    const course = getSoonCourse('gcp-architect');
    render(<CourseComingSoon course={course} />);
    expect(screen.getByRole('heading', { level: 1, name: course.title })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Coming soon');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(course.plan?.length ?? 0);
    expect(screen.getByText('Design for security and compliance')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All courses' })).toHaveAttribute('href', '/');
  });
});
