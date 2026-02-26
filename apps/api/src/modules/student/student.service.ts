import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { Course, CourseDocument } from './schemas/course.schema';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class StudentService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>
  ) {}

  /**
   * ✅ IMPLEMENTADO - Obtiene los datos del dashboard
   */
  async getDashboard(studentId: string) {
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) return null;

    const progressRecords = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .lean();

    const totalCourses = progressRecords.length;
    const completedCourses = progressRecords.filter(
      (p) => p.progressPercentage === 100
    ).length;
    const inProgressCourses = progressRecords.filter(
      (p) => p.progressPercentage > 0 && p.progressPercentage < 100
    ).length;
    const totalTimeSpent = progressRecords.reduce(
      (acc, p) => acc + (p.timeSpentMinutes || 0),
      0
    );

    // Obtener cursos recientes (últimos 3 accedidos)
    const recentProgress = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ lastAccessedAt: -1 })
      .limit(3)
      .populate('courseId')
      .lean();

    const recentCourses = recentProgress.map((p) => ({
      course: p.courseId,
      progress: p.progressPercentage,
      lastAccessed: p.lastAccessedAt,
    }));

    return {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        avatar: student.avatar,
        preferences: student.preferences,
      },
      stats: {
        totalCourses,
        completedCourses,
        inProgressCourses,
        totalTimeSpentMinutes: totalTimeSpent,
        totalTimeSpentFormatted: this.formatTime(totalTimeSpent),
      },
      recentCourses,
    };
  }

  /**
   * ✅ IMPLEMENTADO - Obtiene cursos con progreso
   */
  async getCoursesWithProgress(studentId: string) {
    const courses = await this.courseModel.find().lean();
    const progressRecords = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .lean();

    const progressMap = new Map(
      progressRecords.map((p) => [p.courseId.toString(), p])
    );

    return courses.map((course) => {
      const progress = progressMap.get(course._id.toString());
      return {
        ...course,
        progress: progress
          ? {
              completedLessons: progress.completedLessons,
              progressPercentage: progress.progressPercentage,
              lastAccessedAt: progress.lastAccessedAt,
              timeSpentMinutes: progress.timeSpentMinutes,
            }
          : null,
      };
    });
  }

  async getDetailedStats(studentId: string) {
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) return null;
  
    const sid = new Types.ObjectId(studentId);
  
    const [res] = await this.progressModel.aggregate([
      { $match: { studentId: sid } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalCourses: { $sum: 1 },
                completedCourses: {
                  $sum: { $cond: [{ $eq: ['$progressPercentage', 100] }, 1, 0] },
                },
                inProgressCourses: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gt: ['$progressPercentage', 0] },
                          { $lt: ['$progressPercentage', 100] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                notStartedCourses: {
                  $sum: { $cond: [{ $eq: ['$progressPercentage', 0] }, 1, 0] },
                },
                totalTimeSpentMinutes: {
                  $sum: { $ifNull: ['$timeSpentMinutes', 0] },
                },
                averageProgress: { $avg: '$progressPercentage' },
              },
            },
          ],
  
          timeByCategory: [
            {
              $lookup: {
                from: 'courses',
                localField: 'courseId',
                foreignField: '_id',
                as: 'course',
              },
            },
            { $unwind: '$course' },
            {
              $group: {
                _id: '$course.category',
                totalMinutes: { $sum: { $ifNull: ['$timeSpentMinutes', 0] } },
              },
            },
            { $project: { category: '$_id', totalMinutes: 1, _id: 0 } },
          ],
          
          studyDates: [
            { $match: { lastAccessedAt: { $ne: null } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$lastAccessedAt' },
                },
              },
            },
            { $sort: { _id: -1 } },
            { $project: { date: '$_id', _id: 0 } },
          ],

          weeklyActivity: [
            {
              $match: {
                lastAccessedAt: {
                  $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$lastAccessedAt' },
                },
                minutes: { $sum: { $ifNull: ['$timeSpentMinutes', 0] } },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', minutes: 1, _id: 0 } },
          ],
        },
      },
      {
        $project: {
          summary: { $ifNull: [{ $arrayElemAt: ['$summary', 0] }, {}] },
          timeByCategory: 1,
          studyDates: 1,
          weeklyActivity: 1,
        },
      },
    ]);

    const {
      totalCourses = 0,
      completedCourses = 0,
      inProgressCourses = 0,
      notStartedCourses = 0,
      totalTimeSpentMinutes = 0,
      averageProgress = 0,
    } = res.summary;
  
    const timeByCategory: Record<string, number> = {};
    for (const { category, totalMinutes } of res.timeByCategory) {
      if (category) timeByCategory[category] = totalMinutes;
    }
  
    const streakDates = res.studyDates.map((d) => d.date);
    const studyStreak = this.calculateStudyStreak(streakDates);
  
    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      notStartedCourses,
      totalTimeSpentMinutes,
      totalTimeSpentFormatted: this.formatTime(totalTimeSpentMinutes),
      averageProgress: Math.round(averageProgress),
      studyStreak,
      timeByCategory,
      weeklyActivity: res.weeklyActivity,
    };
  }

  async updatePreferences(studentId: string, dto: UpdatePreferencesDto) {
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) return null;

    const mergedPreferences = {
      ...student.preferences,
      ...dto,
    };

    const updated = await this.studentModel
      .findByIdAndUpdate(
        studentId,
        { $set: { preferences: mergedPreferences } },
        { new: true }
      )
      .lean();

    return updated;
  }

  private calculateStudyStreak(dayStrings: string[]): number {
    if (!dayStrings?.length) return 0;
  
    const daysSet = new Set(dayStrings);
  
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
    const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(todayUtc);
      d.setUTCDate(d.getUTCDate() - i);
      const key = toYMD(d);
      if (!daysSet.has(key)) break;
      streak++;
    }
  
    return streak;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  /**
   * Método auxiliar para buscar un estudiante por ID
   */
  async findById(id: string) {
    return this.studentModel.findById(id).lean();
  }
}
