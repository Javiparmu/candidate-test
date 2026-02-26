import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { NotFoundException } from '@nestjs/common';

describe('StudentController', () => {
  let controller: StudentController;
  let service: StudentService;

  const mockStudentService = {
    getDashboard: jest.fn(),
    getCoursesWithProgress: jest.fn(),
    getDetailedStats: jest.fn(),
    updatePreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        {
          provide: StudentService,
          useValue: mockStudentService,
        },
      ],
    }).compile();

    controller = module.get<StudentController>(StudentController);
    service = module.get<StudentService>(StudentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should return dashboard data for valid student', async () => {
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

      mockStudentService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockDashboard);
      expect(service.getDashboard).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException when student not found', async () => {
      mockStudentService.getDashboard.mockResolvedValue(null);

      await expect(controller.getDashboard('invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getCourses', () => {
    it('should return courses with progress', async () => {
      const mockCourses = [
        {
          _id: 'course1',
          title: 'React desde Cero',
          progress: { progressPercentage: 70 },
        },
        {
          _id: 'course2',
          title: 'Node.js',
          progress: null,
        },
      ];

      mockStudentService.getCoursesWithProgress.mockResolvedValue(mockCourses);

      const result = await controller.getCourses('507f1f77bcf86cd799439011');

      expect(result).toHaveLength(2);
      expect(result[0].progress?.progressPercentage).toBe(70);
    });
  });

  describe('getStats', () => {
    it('should return detailed statistics for student', async () => {
      const mockStats = {
        totalCourses: 5,
        completedCourses: 1,
        inProgressCourses: 3,
        notStartedCourses: 1,
        totalTimeSpentMinutes: 565,
        totalTimeSpentFormatted: '9h 25m',
        averageProgress: 42,
        studyStreak: 3,
        timeByCategory: { JavaScript: 200, React: 365 },
      };

      mockStudentService.getDetailedStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockStats);
      expect(service.getDetailedStats).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should calculate study streak correctly', async () => {
      const mockStats = {
        totalCourses: 2,
        completedCourses: 0,
        inProgressCourses: 2,
        notStartedCourses: 0,
        totalTimeSpentMinutes: 120,
        totalTimeSpentFormatted: '2h 0m',
        averageProgress: 50,
        studyStreak: 7,
        timeByCategory: {},
      };

      mockStudentService.getDetailedStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('507f1f77bcf86cd799439011');

      expect(result.studyStreak).toBe(7);
    });

    it('should aggregate time by category', async () => {
      const mockStats = {
        totalCourses: 3,
        completedCourses: 1,
        inProgressCourses: 2,
        notStartedCourses: 0,
        totalTimeSpentMinutes: 300,
        totalTimeSpentFormatted: '5h 0m',
        averageProgress: 60,
        studyStreak: 1,
        timeByCategory: { JavaScript: 100, React: 120, 'Node.js': 80 },
      };

      mockStudentService.getDetailedStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('507f1f77bcf86cd799439011');

      expect(Object.keys(result.timeByCategory)).toContain('JavaScript');
      expect(Object.keys(result.timeByCategory)).toContain('React');
      expect(Object.keys(result.timeByCategory)).toContain('Node.js');
    });

    it('should handle student with no courses', async () => {
      mockStudentService.getDetailedStats.mockResolvedValue(null);

      await expect(controller.getStats('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update student preferences', async () => {
      const mockStudent = {
        _id: '507f1f77bcf86cd799439011',
        name: 'María',
        preferences: { theme: 'dark', language: 'es', notifications: true },
      };

      mockStudentService.updatePreferences.mockResolvedValue(mockStudent);

      const result = await controller.updatePreferences('507f1f77bcf86cd799439011', {
        theme: 'dark',
      });

      expect(result.preferences.theme).toBe('dark');
      expect(service.updatePreferences).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { theme: 'dark' }
      );
    });

    it('should merge partial preferences update', async () => {
      const mockStudent = {
        _id: '507f1f77bcf86cd799439011',
        name: 'María',
        preferences: { theme: 'light', language: 'en', notifications: true },
      };

      mockStudentService.updatePreferences.mockResolvedValue(mockStudent);

      const result = await controller.updatePreferences('507f1f77bcf86cd799439011', {
        language: 'en',
      });

      expect(result.preferences.theme).toBe('light');
      expect(result.preferences.language).toBe('en');
    });

    it('should validate theme value', async () => {
      const mockStudent = {
        _id: '507f1f77bcf86cd799439011',
        preferences: { theme: 'dark' },
      };

      mockStudentService.updatePreferences.mockResolvedValue(mockStudent);

      const result = await controller.updatePreferences('507f1f77bcf86cd799439011', {
        theme: 'dark',
      });

      expect(['light', 'dark']).toContain(result.preferences.theme);
    });

    it('should throw NotFoundException for invalid student', async () => {
      mockStudentService.updatePreferences.mockResolvedValue(null);

      await expect(
        controller.updatePreferences('invalid-id', { theme: 'dark' })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
