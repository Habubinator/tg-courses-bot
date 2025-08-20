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

    async getAllUsers() {
        return prisma.user.findMany({
            select: {
                id: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                createdAt: true,
            },
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

    // Lesson management
    async getLessonById(lessonId: string) {
        return prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                course: true,
                test: {
                    include: {
                        questions: {
                            orderBy: { orderIndex: "asc" },
                        },
                    },
                },
            },
        });
    }

    async getUsersWhoCompletedLesson(lessonId: string) {
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { course: true },
        });

        if (!lesson) {
            return [];
        }

        // Находим пользователей, которые прошли этот урок
        const usersWhoCompleted = await prisma.userCourse.findMany({
            where: {
                courseId: lesson.courseId,
                OR: [
                    { currentLessonIndex: { gt: lesson.orderIndex } },
                    { completedAt: { not: null } },
                ],
            },
            include: {
                user: {
                    select: {
                        id: true,
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return usersWhoCompleted.map((uc) => uc.user);
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

    async getTestResults(testId: string) {
        return prisma.testResult.findMany({
            where: { testId },
            include: {
                user: {
                    select: {
                        id: true,
                        telegramId: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                test: {
                    include: {
                        lesson: {
                            include: {
                                course: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async getUserTestResults(userId: string, testId?: string) {
        const where: any = { userId };
        if (testId) {
            where.testId = testId;
        }

        return prisma.testResult.findMany({
            where,
            include: {
                test: {
                    include: {
                        lesson: {
                            include: {
                                course: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    // Test management
    async getTestById(testId: string) {
        return prisma.test.findUnique({
            where: { id: testId },
            include: {
                lesson: {
                    include: {
                        course: true,
                    },
                },
                questions: {
                    orderBy: { orderIndex: "asc" },
                },
                testResults: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                telegramId: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async createTest(lessonId: string, title: string) {
        return prisma.test.create({
            data: {
                lessonId,
                title,
            },
        });
    }

    async createQuestion(
        testId: string,
        questionText: string,
        options: string[],
        correctOption: number,
        orderIndex: number
    ) {
        return prisma.question.create({
            data: {
                testId,
                questionText,
                options,
                correctOption,
                orderIndex,
            },
        });
    }

    async getQuestionsByTestId(testId: string) {
        return prisma.question.findMany({
            where: { testId },
            orderBy: { orderIndex: "asc" },
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

        const whereClause: any = {
            state,
            lastActivity: {
                lt: timeoutDate,
            },
        };

        if (courseId) {
            whereClause.courseId = courseId;
        }

        return prisma.userCourse.findMany({
            where: whereClause,
            include: {
                user: true,
                course: true,
            },
        });
    }

    async createNotification(data: {
        courseId?: string;
        state: CourseState;
        mediaType: MediaType;
        mediaUrl: string;
        caption: string;
        buttonText?: string;
        buttonUrl?: string;
        delayMinutes: number;
        isActive: boolean;
    }) {
        return prisma.notification.create({
            data: {
                courseId: data.courseId || null,
                state: data.state,
                mediaType: data.mediaType,
                mediaUrl: data.mediaUrl,
                caption: data.caption,
                buttonText: data.buttonText,
                buttonUrl: data.buttonUrl,
                delayMinutes: data.delayMinutes,
                isActive: data.isActive,
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

    async getCourseStatistics(courseId: string) {
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                lessons: {
                    include: {
                        test: {
                            include: {
                                testResults: true,
                                questions: true,
                            },
                        },
                    },
                },
                userCourses: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                telegramId: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });

        return course;
    }

    async getSystemStatistics() {
        const [
            totalUsers,
            totalCourses,
            totalLessons,
            totalTests,
            totalQuestions,
            totalTestResults,
            activeCourses,
            completedCourses,
            inProgressCourses,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.lesson.count(),
            prisma.test.count(),
            prisma.question.count(),
            prisma.testResult.count(),
            prisma.course.count({ where: { isActive: true } }),
            prisma.userCourse.count({ where: { completedAt: { not: null } } }),
            prisma.userCourse.count({
                where: {
                    AND: [
                        { completedAt: null },
                        { currentLessonIndex: { gt: 0 } },
                    ],
                },
            }),
        ]);

        return {
            totalUsers,
            totalCourses,
            totalLessons,
            totalTests,
            totalQuestions,
            totalTestResults,
            activeCourses,
            completedCourses,
            inProgressCourses,
        };
    }

    // Utility methods
    async getUserProgress(userId: string, courseId: string) {
        const userCourse = await this.getUserCourse(userId, courseId);
        if (!userCourse) return null;

        const course = await this.getCourseById(courseId);
        if (!course) return null;

        const totalLessons = course.lessons.length;
        const completedLessons = userCourse.currentLessonIndex;
        const progressPercentage =
            totalLessons > 0
                ? Math.round((completedLessons / totalLessons) * 100)
                : 0;

        return {
            userCourse,
            course,
            totalLessons,
            completedLessons,
            progressPercentage,
            isCompleted: !!userCourse.completedAt,
        };
    }

    async resetUserProgress(userId: string, courseId: string) {
        return prisma.userCourse.update({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
            data: {
                currentLessonIndex: 0,
                state: CourseState.WATCHING_LESSON,
                completedAt: null,
                lastActivity: new Date(),
            },
        });
    }

    async deleteUserData(userId: string) {
        // Удаляем все связанные данные пользователя
        await prisma.$transaction([
            prisma.testResult.deleteMany({ where: { userId } }),
            prisma.userCourse.deleteMany({ where: { userId } }),
            prisma.user.delete({ where: { id: userId } }),
        ]);
    }

    // Batch operations
    async createUsersFromTelegramIds(telegramIds: string[]) {
        const users = [];
        for (const telegramId of telegramIds) {
            try {
                const user = await this.getOrCreateUser(telegramId);
                users.push(user);
            } catch (error) {
                console.error(
                    `Error creating user with telegram ID ${telegramId}:`,
                    error
                );
            }
        }
        return users;
    }

    async bulkUpdateUserCourseActivity(userCourseIds: string[]) {
        return prisma.userCourse.updateMany({
            where: {
                id: { in: userCourseIds },
            },
            data: {
                lastActivity: new Date(),
            },
        });
    }
}

export const repository = new Repository();
