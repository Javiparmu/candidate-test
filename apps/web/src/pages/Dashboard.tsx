import { useQuery } from '@tanstack/react-query';
import styled, { keyframes } from 'styled-components';
import { BookOpen, CheckCircle, Clock, Target, RefreshCw, Flame } from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { CourseCard } from '../components/CourseCard';
import { ActivityChart } from '../components/ActivityChart';
import { api } from '../services/api';

interface DashboardProps {
  studentId: string;
}

export function Dashboard({ studentId }: DashboardProps) {
  const { data: dashboard, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', studentId],
    queryFn: () => api.getDashboard(studentId),
  });

  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', studentId],
    queryFn: () => api.getCourses(studentId),
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', studentId],
    queryFn: () => api.getStats(studentId),
    enabled: !!dashboard,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <ErrorContainer>
        <ErrorIcon>!</ErrorIcon>
        <ErrorTitle>Error al cargar el dashboard</ErrorTitle>
        <ErrorDescription>
          {(error as Error).message || 'No se pudo conectar con el servidor.'}
        </ErrorDescription>
        <RetryButton onClick={() => refetch()}>
          <RefreshCw size={16} />
          Reintentar
        </RetryButton>
      </ErrorContainer>
    );
  }

  if (!dashboard) {
    return (
      <ErrorContainer>
        <ErrorTitle>No se encontraron datos</ErrorTitle>
        <ErrorDescription>No hay información disponible para este estudiante.</ErrorDescription>
      </ErrorContainer>
    );
  }

  return (
    <Container>
      <Header>
        <Greeting>
          <h1>¡Hola, {dashboard.student.name}!</h1>
          <Subtitle>Aquí está tu progreso de hoy</Subtitle>
        </Greeting>
      </Header>

      <StatsGrid>
        <StatsCard
          title="Cursos Activos"
          value={stats?.inProgressCourses ?? dashboard.stats.inProgressCourses}
          icon={<BookOpen size={24} />}
          color="var(--color-primary)"
        />
        <StatsCard
          title="Cursos Completados"
          value={stats?.completedCourses ?? dashboard.stats.completedCourses}
          icon={<CheckCircle size={24} />}
          color="var(--color-success)"
        />
        <StatsCard
          title="Tiempo de Estudio"
          value={stats?.totalTimeSpentFormatted ?? dashboard.stats.totalTimeSpentFormatted}
          icon={<Clock size={24} />}
          color="var(--color-secondary)"
          subtitle="Total acumulado"
        />
        <StatsCard
          title="Racha de Estudio"
          value={stats?.studyStreak != null ? `${stats.studyStreak} días` : '—'}
          icon={<Flame size={24} />}
          color="#f59e0b"
          subtitle="Días consecutivos"
        />
        <StatsCard
          title="Total Cursos"
          value={stats?.totalCourses ?? dashboard.stats.totalCourses}
          icon={<Target size={24} />}
          color="var(--color-primary)"
        />
      </StatsGrid>

      <Section>
        <SectionTitle>Actividad Semanal</SectionTitle>
        <ActivityChart weeklyActivity={stats?.weeklyActivity} />
      </Section>

      <Section>
        <SectionHeader>
          <SectionTitle>Continúa donde lo dejaste</SectionTitle>
          <ViewAllLink href="/courses">Ver todos →</ViewAllLink>
        </SectionHeader>

        {isLoadingCourses ? (
          <CoursesGrid>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCourseCard key={i}>
                <SkeletonBlock $width="100%" $height="140px" />
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonBlock $width="80%" $height="16px" />
                  <SkeletonBlock $width="60%" $height="12px" />
                  <SkeletonBlock $width="100%" $height="8px" />
                </div>
              </SkeletonCourseCard>
            ))}
          </CoursesGrid>
        ) : (
          <CoursesGrid>
            {courses?.slice(0, 4).map((course: any) => (
              <CourseCard
                key={course._id}
                title={course.title}
                description={course.description}
                thumbnail={course.thumbnail}
                progress={course.progress?.progressPercentage || 0}
                category={course.category}
                totalLessons={course.totalLessons}
                completedLessons={course.progress?.completedLessons || 0}
              />
            ))}
          </CoursesGrid>
        )}

        {!isLoadingCourses && courses?.length === 0 && (
          <EmptyState>
            No tienes cursos todavía. ¡Explora el catálogo!
          </EmptyState>
        )}
      </Section>
    </Container>
  );
}

const DashboardSkeleton = () => {
  return (
<Container>
        <Header>
          <Greeting>
            <SkeletonBlock $width="280px" $height="32px" />
            <SkeletonBlock $width="200px" $height="18px" style={{ marginTop: '8px' }} />
          </Greeting>
        </Header>

        <StatsGrid>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i}>
              <SkeletonBlock $width="40px" $height="40px" $rounded />
              <SkeletonBlock $width="100px" $height="14px" />
              <SkeletonBlock $width="60px" $height="28px" />
            </SkeletonCard>
          ))}
        </StatsGrid>

        <Section>
          <SkeletonBlock $width="160px" $height="20px" />
          <SkeletonChartBlock />
        </Section>

        <Section>
          <SkeletonBlock $width="220px" $height="20px" />
          <CoursesGrid>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCourseCard key={i}>
                <SkeletonBlock $width="100%" $height="140px" />
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonBlock $width="80%" $height="16px" />
                  <SkeletonBlock $width="60%" $height="12px" />
                  <SkeletonBlock $width="100%" $height="8px" />
                </div>
              </SkeletonCourseCard>
            ))}
          </CoursesGrid>
        </Section>
      </Container>
  );
};

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.header`
  margin-bottom: var(--spacing-xl);
`;

const Greeting = styled.div`
  h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: var(--spacing-xs);
  }
`;

const Subtitle = styled.p`
  color: var(--color-text-secondary);
  font-size: 16px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
`;

const Section = styled.section`
  margin-bottom: var(--spacing-xl);
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
`;

const ViewAllLink = styled.a`
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
`;

const CoursesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--color-border);
`;

const SkeletonBlock = styled.div<{ $width: string; $height: string; $rounded?: boolean }>`
  width: ${(props) => props.$width};
  height: ${(props) => props.$height};
  border-radius: ${(props) => (props.$rounded ? 'var(--radius-full)' : 'var(--radius-md)')};
  background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface) 37%, var(--color-border) 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const SkeletonCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`;

const SkeletonChartBlock = styled.div`
  height: 200px;
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-md);
  background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface) 37%, var(--color-border) 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`;

const SkeletonCourseCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: var(--spacing-sm);
`;

const ErrorIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: #fef2f2;
  color: var(--color-error, #dc2626);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
`;

const ErrorTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
`;

const ErrorDescription = styled.p`
  color: var(--color-text-secondary);
  font-size: 14px;
  max-width: 400px;
  text-align: center;
`;

const RetryButton = styled.button`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
`;
