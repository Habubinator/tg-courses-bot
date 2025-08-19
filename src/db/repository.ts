import {
    PrismaClient,
    User,
    Course,
    Lesson,
    Test,
    Question,
    UserCourse,
    TestResult,
    Admin,
    Notification,
    CourseState,
    MediaType,
    Grade,
} from "../../generated/prisma";

export const prisma = new PrismaClient();

export class Repository {
    // User management
    async getOrCreateUser(
        telegramId: string,
        username?: string,
        firstName?: string,
        lastName?: string
    ) {
        const user = await prisma.user.upsert({
            where: { telegramId },
            update: { username, firstName, lastName },
            create: { telegramId, username, firstName, lastName },
        });
        return user;
    }

    async updateUserPhone(userId: string, phoneNumber: string) {
        return prisma.user.update({
            where: { id: userId },
            data: { phoneNumber },
        });
    }

    // Course management
    async getFirstCourse() {
        return prisma.course.findFirst({
            where: { isActive: true },
            orderBy: { orderIndex: "asc" },
            include: {
                lessons: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        test: {
                            include: {
                                questions: {
                                    orderBy: { orderIndex: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    async getCourseById(courseId: string) {
        return prisma.course.findUnique({
            where: { id: courseId },
            include: {
                lessons: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                        test: {
                            include: {
                                questions: {
                                    orderBy: { orderIndex: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    // User course progress
    async getUserCourse(userId: string, courseId: string) {
        return prisma.userCourse.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
            include: {
                course: {
                    include: {
                        lessons: {
                            orderBy: { orderIndex: "asc" },
                        },
                    },
                },
            },
        });
    }

    async createUserCourse(userId: string, courseId: string) {
        return prisma.userCourse.create({
            data: {
                userId,
                courseId,
                state: CourseState.WATCHING_LESSON,
                currentLessonIndex: 0,
            },
            include: {
                course: {
                    include: {
                        lessons: {
                            orderBy: { orderIndex: "asc" },
                        },
                    },
                },
            },
        });
    }

    async updateUserCourseState(
        userId: string,
        courseId: string,
        state: CourseState,
        lessonIndex?: number
    ) {
        return prisma.userCourse.update({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
            data: {
                state,
                currentLessonIndex: lessonIndex,
                lastActivity: new Date(),
            },
        });
    }

    async completeUserCourse(userId: string, courseId: string) {
        return prisma.userCourse.update({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
            data: {
                state: CourseState.COMPLETED_COURSE,
                completedAt: new Date(),
                lastActivity: new Date(),
            },
        });
    }

    // Test results
    async saveTestResult(
        userId: string,
        testId: string,
        score: number,
        grade: Grade,
        answers: any
    ) {
        return prisma.testResult.create({
            data: {
                userId,
                testId,
                score,
                grade,
                answers,
            },
        });
    }

    // Admin management
    async getAdmins() {
        return prisma.admin.findMany();
    }

    async addAdmin(telegramId: string) {
        return prisma.admin.create({
            data: { telegramId },
        });
    }

    async removeAdmin(telegramId: string) {
        return prisma.admin.delete({
            where: { telegramId },
        });
    }

    async isAdmin(telegramId: string) {
        const admin = await prisma.admin.findUnique({
            where: { telegramId },
        });
        return !!admin;
    }

    // Notifications
    async getNotificationsForState(courseId: string, state: CourseState) {
        return prisma.notification.findMany({
            where: {
                courseId,
                state,
                isActive: true,
            },
        });
    }

    async getUsersForNotification(
        courseId: string,
        state: CourseState,
        timeoutMinutes: number
    ) {
        const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

        return prisma.userCourse.findMany({
            where: {
                courseId,
                state,
                lastActivity: {
                    lt: timeoutDate,
                },
            },
            include: {
                user: true,
                course: true,
            },
        });
    }

    // Statistics
    async getUserStats(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userCourses: {
                    include: {
                        course: true,
                    },
                },
                testResults: {
                    include: {
                        test: {
                            include: {
                                lesson: true,
                            },
                        },
                    },
                },
            },
        });

        return user;
    }
}

export const repository = new Repository();
