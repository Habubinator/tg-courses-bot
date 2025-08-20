import express from "express";
import cors from "cors";
import { prisma } from "../db";
import jwt from "jsonwebtoken";
import path from "path";

export const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - fix the path resolution
const publicPath = path.resolve(process.cwd(), "public");
console.log("Public path:", publicPath); // Debug log
app.use(express.static(publicPath));

// Root route to serve index.html
app.get("/", (req, res) => {
    const indexPath = path.join(publicPath, "index.html");
    console.log("Serving index.html from:", indexPath); // Debug log
    res.sendFile(indexPath);
});

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// Middleware для проверки авторизации
export const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    });
};

// Авторизация
app.post("/api/auth/login", async (req, res) => {
    try {
        const { login, password } = req.body;

        if (login === "admin" && password === "admin123") {
            const token = jwt.sign(
                { id: 1, login: "admin", role: "admin" },
                JWT_SECRET,
                { expiresIn: "24h" }
            );

            res.json({
                success: true,
                token,
                user: { id: 1, login: "admin", role: "admin" },
            });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).json({ error: "Login failed" });
    }
});

// === ПОЛЬЗОВАТЕЛИ ===

// Получить всех пользователей
app.get("/api/users", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const courseStatus = req.query.courseStatus as string;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } },
                { telegramId: { contains: search } },
            ];
        }

        // Фильтр по статусу курса
        if (courseStatus) {
            if (courseStatus === "completed") {
                where.userCourses = {
                    some: { completedAt: { not: null } },
                };
            } else if (courseStatus === "in_progress") {
                where.userCourses = {
                    some: {
                        AND: [
                            { completedAt: null },
                            { currentLessonIndex: { gt: 0 } },
                        ],
                    },
                };
            } else if (courseStatus === "not_started") {
                where.userCourses = { none: {} };
            }
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                include: {
                    userCourses: {
                        include: {
                            course: true,
                        },
                    },
                    testResults: {
                        include: {
                            test: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Получить пользователя по ID
app.get("/api/users/:id", authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
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

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// Удалить пользователя
app.delete("/api/users/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.user.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// === КУРСЫ ===

// Получить все курсы
app.get("/api/courses", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where,
                skip,
                take: limit,
                include: {
                    _count: {
                        select: {
                            lessons: true,
                            userCourses: true,
                        },
                    },
                },
                orderBy: { orderIndex: "asc" },
            }),
            prisma.course.count({ where }),
        ]);

        res.json({
            success: true,
            data: courses,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch courses" });
    }
});

// Получить курс по ID
app.get("/api/courses/:id", authenticateToken, async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                lessons: {
                    orderBy: { orderIndex: "asc" },
                },
            },
        });

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch course" });
    }
});

// Создать курс
app.post("/api/courses", authenticateToken, async (req, res) => {
    try {
        const { title, description, orderIndex, isActive } = req.body;

        const course = await prisma.course.create({
            data: {
                title,
                description,
                orderIndex: orderIndex || 0,
                isActive: isActive !== undefined ? isActive : true,
            },
        });

        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ error: "Failed to create course" });
    }
});

// Обновить курс
app.put("/api/courses/:id", authenticateToken, async (req, res) => {
    try {
        const { title, description, orderIndex, isActive } = req.body;

        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: {
                title,
                description,
                orderIndex,
                isActive,
            },
        });

        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ error: "Failed to update course" });
    }
});

// Переключить статус курса
app.put("/api/courses/:id/toggle", authenticateToken, async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
        });

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        const updatedCourse = await prisma.course.update({
            where: { id: req.params.id },
            data: { isActive: !course.isActive },
        });

        res.json({ success: true, data: updatedCourse });
    } catch (error) {
        res.status(500).json({ error: "Failed to toggle course status" });
    }
});

// Удалить курс
app.delete("/api/courses/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.course.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "Course deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete course" });
    }
});

// === УРОКИ ===

// Получить все уроки
app.get("/api/lessons", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const courseId = req.query.courseId as string;
        const mediaType = req.query.mediaType as string;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (search) {
            where.title = { contains: search, mode: "insensitive" };
        }

        if (courseId) {
            where.courseId = courseId;
        }

        if (mediaType) {
            where.mediaType = mediaType;
        }

        const [lessons, total] = await Promise.all([
            prisma.lesson.findMany({
                where,
                skip,
                take: limit,
                include: {
                    course: true,
                    test: {
                        include: {
                            _count: {
                                select: {
                                    questions: true,
                                },
                            },
                        },
                    },
                },
                orderBy: [{ courseId: "asc" }, { orderIndex: "asc" }],
            }),
            prisma.lesson.count({ where }),
        ]);

        res.json({
            success: true,
            data: lessons,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch lessons" });
    }
});

// Получить урок по ID
app.get("/api/lessons/:id", authenticateToken, async (req, res) => {
    try {
        const lesson = await prisma.lesson.findUnique({
            where: { id: req.params.id },
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

        if (!lesson) {
            return res.status(404).json({ error: "Lesson not found" });
        }

        res.json({ success: true, data: lesson });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch lesson" });
    }
});

// Создать урок
app.post("/api/lessons", authenticateToken, async (req, res) => {
    try {
        const {
            courseId,
            title,
            mediaType,
            mediaUrl,
            caption,
            buttonText,
            buttonUrl,
            orderIndex,
        } = req.body;

        const lesson = await prisma.lesson.create({
            data: {
                courseId,
                title,
                mediaType,
                mediaUrl,
                caption,
                buttonText,
                buttonUrl,
                orderIndex: orderIndex || 0,
            },
        });

        res.json({ success: true, data: lesson });
    } catch (error) {
        res.status(500).json({ error: "Failed to create lesson" });
    }
});

// Обновить урок
app.put("/api/lessons/:id", authenticateToken, async (req, res) => {
    try {
        const {
            courseId,
            title,
            mediaType,
            mediaUrl,
            caption,
            buttonText,
            buttonUrl,
            orderIndex,
        } = req.body;

        const lesson = await prisma.lesson.update({
            where: { id: req.params.id },
            data: {
                courseId,
                title,
                mediaType,
                mediaUrl,
                caption,
                buttonText,
                buttonUrl,
                orderIndex,
            },
        });

        res.json({ success: true, data: lesson });
    } catch (error) {
        res.status(500).json({ error: "Failed to update lesson" });
    }
});

// Удалить урок
app.delete("/api/lessons/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.lesson.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "Lesson deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete lesson" });
    }
});

// === ТЕСТЫ ===

// Получить все тесты
app.get("/api/tests", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (search) {
            where.title = { contains: search, mode: "insensitive" };
        }

        const [tests, total] = await Promise.all([
            prisma.test.findMany({
                where,
                skip,
                take: limit,
                include: {
                    lesson: {
                        include: {
                            course: true,
                        },
                    },
                    _count: {
                        select: {
                            questions: true,
                            testResults: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.test.count({ where }),
        ]);

        res.json({
            success: true,
            data: tests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch tests" });
    }
});

// Получить вопросы теста
app.get("/api/tests/:id/questions", authenticateToken, async (req, res) => {
    try {
        const questions = await prisma.question.findMany({
            where: { testId: req.params.id },
            orderBy: { orderIndex: "asc" },
        });

        res.json({ success: true, data: questions });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch test questions" });
    }
});

// Удалить тест
app.delete("/api/tests/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.test.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "Test deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete test" });
    }
});

// === АДМИНИСТРАТОРЫ ===

// Получить всех админов
app.get("/api/admins", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        let where: any = {};

        if (search) {
            where.telegramId = { contains: search };
        }

        const [admins, total] = await Promise.all([
            prisma.admin.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.admin.count({ where }),
        ]);

        res.json({
            success: true,
            data: admins,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch admins" });
    }
});

// Добавить админа
app.post("/api/admins", authenticateToken, async (req, res) => {
    try {
        const { telegramId } = req.body;

        const admin = await prisma.admin.create({
            data: { telegramId },
        });

        res.json({ success: true, data: admin });
    } catch (error) {
        res.status(500).json({ error: "Failed to create admin" });
    }
});

// Удалить админа
app.delete("/api/admins/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.admin.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "Admin deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete admin" });
    }
});

// === УВЕДОМЛЕНИЯ ===

// Получить все уведомления
app.get("/api/notifications", authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                skip,
                take: limit,
                include: {
                    course: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.notification.count(),
        ]);

        res.json({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// Получить уведомление по ID
app.get("/api/notifications/:id", authenticateToken, async (req, res) => {
    try {
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id },
            include: {
                course: true,
            },
        });

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch notification" });
    }
});

// Создать уведомление
app.post("/api/notifications", authenticateToken, async (req, res) => {
    try {
        const {
            courseId,
            state,
            mediaType,
            mediaUrl,
            caption,
            buttonText,
            buttonUrl,
            delayMinutes,
            isActive,
        } = req.body;

        const notification = await prisma.notification.create({
            data: {
                courseId: courseId || null,
                state,
                mediaType,
                mediaUrl,
                caption,
                buttonText,
                buttonUrl,
                delayMinutes,
                isActive: isActive !== undefined ? isActive : true,
            },
        });

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ error: "Failed to create notification" });
    }
});

// Обновить уведомление
app.put("/api/notifications/:id", authenticateToken, async (req, res) => {
    try {
        const {
            courseId,
            state,
            mediaType,
            mediaUrl,
            caption,
            buttonText,
            buttonUrl,
            delayMinutes,
            isActive,
        } = req.body;

        const notification = await prisma.notification.update({
            where: { id: req.params.id },
            data: {
                courseId: courseId || null,
                state,
                mediaType,
                mediaUrl,
                caption,
                buttonText,
                buttonUrl,
                delayMinutes,
                isActive,
            },
        });

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ error: "Failed to update notification" });
    }
});

// Переключить статус уведомления
app.put(
    "/api/notifications/:id/toggle",
    authenticateToken,
    async (req, res) => {
        try {
            const notification = await prisma.notification.findUnique({
                where: { id: req.params.id },
            });

            if (!notification) {
                return res
                    .status(404)
                    .json({ error: "Notification not found" });
            }

            const updatedNotification = await prisma.notification.update({
                where: { id: req.params.id },
                data: { isActive: !notification.isActive },
            });

            res.json({ success: true, data: updatedNotification });
        } catch (error) {
            res.status(500).json({
                error: "Failed to toggle notification status",
            });
        }
    }
);

// Удалить уведомление
app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
    try {
        await prisma.notification.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete notification" });
    }
});

// === СТАТИСТИКА ===

// Получить общую статистику
app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
        const [
            totalUsers,
            totalCourses,
            totalAdmins,
            totalLessons,
            totalTests,
            completedCourses,
            inProgressCourses,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.admin.count(),
            prisma.lesson.count(),
            prisma.test.count(),
            prisma.userCourse.count({
                where: { completedAt: { not: null } },
            }),
            prisma.userCourse.count({
                where: {
                    AND: [
                        { completedAt: null },
                        { currentLessonIndex: { gt: 0 } },
                    ],
                },
            }),
        ]);

        res.json({
            success: true,
            data: {
                totalUsers,
                totalCourses,
                totalAdmins,
                totalLessons,
                totalTests,
                completedCourses,
                inProgressCourses,
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

console.log("Express app configured successfully!");
