import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getDashboard: vi.fn(),
    getCourses: vi.fn(),
    getStats: vi.fn(),
  },
}));

const mockGetDashboard = vi.mocked(api.getDashboard);
const mockGetCourses = vi.mocked(api.getCourses);
const mockGetStats = vi.mocked(api.getStats);

const mockDashboard = {
  student: {
    id: '507f1f77bcf86cd799439011',
    name: 'María García',
    email: 'maria@test.com',
  },
  stats: {
    totalCourses: 5,
    completedCourses: 1,
    inProgressCourses: 2,
    totalTimeSpentMinutes: 565,
    totalTimeSpentFormatted: '9h 25m',
  },
  recentCourses: [],
};

const mockCourses = [
  {
    _id: '1',
    title: 'React desde Cero',
    description: 'Aprende React',
    category: 'Frontend',
    totalLessons: 20,
    progress: { progressPercentage: 70, completedLessons: 14 },
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDashboard.mockResolvedValue(mockDashboard as any);
    mockGetCourses.mockResolvedValue(mockCourses as any);
    mockGetStats.mockResolvedValue({
      studyStreak: 3,
      averageProgress: 45,
      weeklyActivity: [],
    } as any);
  });

  it('should render student greeting', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText(/¡Hola, María García!/)).toBeInTheDocument();
  });

  it('should render stats cards', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText('Cursos Activos')).toBeInTheDocument();
    expect(screen.getByText('Cursos Completados')).toBeInTheDocument();
    expect(screen.getByText('Tiempo de Estudio')).toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    const d = deferred<any>();
    mockGetDashboard.mockImplementation(() => d.promise);

    renderWithProviders(<Dashboard studentId="test" />);

    expect(screen.queryByText(/¡Hola/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos Activos')).not.toBeInTheDocument();

    d.resolve(mockDashboard as any);
    await waitFor(() => {
      expect(screen.getByText(/¡Hola, María García!/)).toBeInTheDocument();
    });
  });

  it('should show error state when API fails', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<Dashboard studentId="test" />);

    expect(await screen.findByText('Error al cargar el dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('should render course cards', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText('React desde Cero')).toBeInTheDocument();
    expect(screen.getByText('Aprende React')).toBeInTheDocument();
  });

  it('should show empty state when no courses', async () => {
    mockGetCourses.mockResolvedValue([] as any);

    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    expect(await screen.findByText(/No tienes cursos todavía/)).toBeInTheDocument();
  });

  it('should render activity chart placeholder', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    const heading = await screen.findByText('Actividad Semanal');
    expect(heading).toBeInTheDocument();

    const chartSection = heading.closest('section');
    expect(chartSection).toBeInTheDocument();
  });

  it('should be accessible (a11y)', async () => {
    renderWithProviders(<Dashboard studentId="507f1f77bcf86cd799439011" />);

    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/María García/);

    const link = screen.getByRole('link', { name: /Ver todos/i });
    expect(link).toHaveAttribute('href', '/courses');
  });

  it('should retry when clicking retry button', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('Network error'));
    mockGetDashboard.mockResolvedValueOnce(mockDashboard as any);

    renderWithProviders(<Dashboard studentId="test" />);

    expect(await screen.findByText('Error al cargar el dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));

    expect(await screen.findByText(/¡Hola, María García!/)).toBeInTheDocument();
    expect(mockGetDashboard).toHaveBeenCalledTimes(2);
  });
});