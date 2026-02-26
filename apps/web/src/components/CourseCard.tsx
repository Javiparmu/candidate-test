import { useState } from 'react';
import styled from 'styled-components';
import { BookOpen, CheckCircle, PlayCircle, Circle } from 'lucide-react';

interface CourseCardProps {
  title: string;
  description: string;
  thumbnail?: string;
  progress?: number;
  category: string;
  totalLessons: number;
  completedLessons?: number;
}

type CourseStatus = 'completed' | 'in-progress' | 'not-started';

function getStatus(progress: number): CourseStatus {
  if (progress === 100) return 'completed';
  if (progress > 0) return 'in-progress';
  return 'not-started';
}

const STATUS_CONFIG: Record<CourseStatus, { label: string; icon: typeof CheckCircle }> = {
  completed: { label: 'Repasar', icon: CheckCircle },
  'in-progress': { label: 'Continuar', icon: PlayCircle },
  'not-started': { label: 'Comenzar', icon: Circle },
};

export function CourseCard({
  title,
  description,
  thumbnail,
  progress = 0,
  category,
  totalLessons,
  completedLessons = 0,
}: CourseCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const status = getStatus(progress);
  const { label, icon: StatusIcon } = STATUS_CONFIG[status];

  return (
    <Card>
      <ThumbnailWrapper>
        {thumbnail ? (
          <ThumbnailImg
            src={thumbnail}
            title={title}
            alt={title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            $visible={imageLoaded}
          />
        ) : (
          <ThumbnailPlaceholder>
            <BookOpen size={48} />
          </ThumbnailPlaceholder>
        )}
        <CategoryBadge>{category}</CategoryBadge>
        {status === 'completed' && <CompletedOverlay><CheckCircle size={28} /></CompletedOverlay>}
      </ThumbnailWrapper>

      <Content>
        <Title>{title}</Title>
        <Description>{description}</Description>

        <ProgressSection>
          <ProgressBar>
            <ProgressFill $progress={progress} $status={status} />
          </ProgressBar>
          <ProgressText>
            {completedLessons}/{totalLessons} lecciones &middot; {progress}%
          </ProgressText>
        </ProgressSection>

        <ActionButton $status={status}>
          <StatusIcon size={16} />
          {label}
        </ActionButton>
      </Content>
    </Card>
  );
}

const Card = styled.div`
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition: all 0.25s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--color-primary);
  }

  &:active {
    transform: translateY(-2px);
  }
`;

const ThumbnailWrapper = styled.div`
  height: 140px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-background);

  ${Card}:hover & img {
    filter: brightness(1.05);
  }
`;

const ThumbnailImg = styled.img<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.25s ease;
`;

const ThumbnailPlaceholder = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  opacity: 0.5;
  background: var(--color-background);
`;

const CompletedOverlay = styled.div`
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  color: var(--color-success, #16a34a);
  background: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CategoryBadge = styled.span`
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  backdrop-filter: blur(4px);
`;

const Content = styled.div`
  padding: var(--spacing-md);
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-primary);
  transition: color 0.2s ease;

  ${Card}:hover & {
    color: var(--color-primary);
  }
`;

const Description = styled.p`
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-md);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ProgressSection = styled.div`
  margin-bottom: var(--spacing-md);
`;

const ProgressBar = styled.div`
  height: 6px;
  background: var(--color-background);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
`;

const ProgressFill = styled.div<{ $progress: number; $status: CourseStatus }>`
  height: 100%;
  width: ${(props) => props.$progress}%;
  background: ${(props) =>
    props.$status === 'completed'
      ? 'var(--color-success, #16a34a)'
      : 'var(--color-primary)'};
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
`;

const ProgressText = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
`;

const ActionButton = styled.button<{ $status: CourseStatus }>`
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  transition: all 0.2s ease;

  background: ${(props) =>
    props.$status === 'completed'
      ? 'var(--color-success, #16a34a)'
      : props.$status === 'in-progress'
        ? 'var(--color-primary)'
        : 'var(--color-background)'};
  color: ${(props) => (props.$status === 'not-started' ? 'var(--color-text-primary)' : 'white')};

  &:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
  }
`;
