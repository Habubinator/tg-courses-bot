import express from "express";
import cors from "cors";
import { prisma } from "../db";
import jwt from "jsonwebtoken";
import path from "path";
import TelegramBot from "node-telegram-bot-api";

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

// Создаем бота для отправки уведомлений (если токен доступен)
let bot: TelegramBot | null = null;
if (process.env.BOT_TOKEN) {
    bot = new TelegramBot(process.env.BOT_TOKEN);
}

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

        if (login === "admin" && password === "admin") {
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

// Получить пользователей, которые прошли урок
app.get(
    "/api/lessons/:id/completed-users",
    authenticateToken,
    async (req, res) => {
        try {
            const lessonId = req.params.id;

            // Получаем урок с информацией о курсе
            const lesson = await prisma.lesson.findUnique({
                where: { id: lessonId },
                include: { course: true },
            });

            if (!lesson) {
                return res.status(404).json({ error: "Lesson not found" });
            }

            // Находим пользователей, которые прошли этот урок
            // (т.е. их currentLessonIndex больше orderIndex этого урока или курс завершен)
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

            const users = usersWhoCompleted.map((uc) => uc.user);

            res.json({ success: true, data: users });
        } catch (error) {
            console.error("Error fetching completed users:", error);
            res.status(500).json({ error: "Failed to fetch completed users" });
        }
    }
);

// Отправить уведомления о добавленном тесте
app.post(
    "/api/lessons/:id/notify-test-added",
    authenticateToken,
    async (req, res) => {
        try {
            const lessonId = req.params.id;
            const { testId, testTitle } = req.body;

            if (!bot) {
                return res.status(500).json({ error: "Bot not configured" });
            }

            // Получаем пользователей, которые прошли урок
            const usersResponse = await prisma.lesson.findUnique({
                where: { id: lessonId },
                include: {
                    course: {
                        include: {
                            userCourses: {
                                where: {
                                    OR: [
                                        {
                                            currentLessonIndex: {
                                                gt: await prisma.lesson
                                                    .findUnique({
                                                        where: { id: lessonId },
                                                    })
                                                    .then(
                                                        (l) =>
                                                            l?.orderIndex || 0
                                                    ),
                                            },
                                        },
                                        { completedAt: { not: null } },
                                    ],
                                },
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!usersResponse) {
                return res.status(404).json({ error: "Lesson not found" });
            }

            const lesson = await prisma.lesson.findUnique({
                where: { id: lessonId },
                include: { course: true },
            });

            // Находим пользователей более простым способом
            const usersWhoCompleted = await prisma.userCourse.findMany({
                where: {
                    courseId: lesson?.courseId,
                    OR: [
                        { currentLessonIndex: { gt: lesson?.orderIndex || 0 } },
                        { completedAt: { not: null } },
                    ],
                },
                include: {
                    user: true,
                },
            });

            let notificationsSent = 0;

            const message =
                `📝 *Новый тест доступен!*\n\n` +
                `К уроку "${lesson?.title}", который вы уже прошли, был добавлен тест.\n\n` +
                `🎯 *Тест:* ${testTitle}\n\n` +
                `Пройдите его, чтобы закрепить полученные знания! Нажмите /start для продолжения.`;

            // Отправляем уведомления
            for (const userCourse of usersWhoCompleted) {
                try {
                    await bot.sendMessage(userCourse.user.telegramId, message, {
                        parse_mode: "Markdown",
                    });
                    notificationsSent++;
                } catch (error) {
                    console.error(
                        `Failed to send notification to user ${userCourse.user.telegramId}:`,
                        error
                    );
                }
            }

            res.json({
                success: true,
                data: {
                    notificationsSent,
                    totalUsers: usersWhoCompleted.length,
                },
            });
        } catch (error) {
            console.error("Error sending test notifications:", error);
            res.status(500).json({ error: "Failed to send notifications" });
        }
    }
);

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

// Создать тест
app.post("/api/tests", authenticateToken, async (req, res) => {
    try {
        const { lessonId, title, questions } = req.body;

        // Проверяем, что урок существует и у него еще нет теста
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { test: true },
        });

        if (!lesson) {
            return res.status(404).json({ error: "Lesson not found" });
        }

        if (lesson.test) {
            return res.status(400).json({ error: "Lesson already has a test" });
        }

        // Создаем тест в транзакции
        const result = await prisma.$transaction(async (tx) => {
            // Создаем тест
            const test = await tx.test.create({
                data: {
                    lessonId,
                    title,
                },
            });

            // Создаем вопросы
            if (questions && questions.length > 0) {
                await tx.question.createMany({
                    data: questions.map((q: any, index: number) => ({
                        testId: test.id,
                        questionText: q.questionText,
                        options: q.options,
                        correctOption: q.correctOption,
                        orderIndex:
                            q.orderIndex !== undefined ? q.orderIndex : index,
                    })),
                });
            }

            return test;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error creating test:", error);
        res.status(500).json({ error: "Failed to create test" });
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

// Обновить тест
app.put("/api/tests/:id", authenticateToken, async (req, res) => {
    try {
        const { title, questions } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // Обновляем тест
            const test = await tx.test.update({
                where: { id: req.params.id },
                data: { title },
            });

            // Если переданы вопросы, обновляем их
            if (questions) {
                // Удаляем старые вопросы
                await tx.question.deleteMany({
                    where: { testId: req.params.id },
                });

                // Создаем новые вопросы
                if (questions.length > 0) {
                    await tx.question.createMany({
                        data: questions.map((q: any, index: number) => ({
                            testId: req.params.id,
                            questionText: q.questionText,
                            options: q.options,
                            correctOption: q.correctOption,
                            orderIndex:
                                q.orderIndex !== undefined
                                    ? q.orderIndex
                                    : index,
                        })),
                    });
                }
            }

            return test;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error updating test:", error);
        res.status(500).json({ error: "Failed to update test" });
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

// === МАССОВАЯ РАССЫЛКА ===

// Получить статистику аудитории для рассылки
app.get(
    "/api/broadcast/audience-stats",
    authenticateToken,
    async (req, res) => {
        try {
            const { targetType, courseId, status, recentDays } = req.query;

            let where: any = {};
            let totalUsers = 0;
            let breakdown: any[] = [];

            switch (targetType) {
                case "all":
                    totalUsers = await prisma.user.count();

                    // Разбивка по статусу регистрации
                    const [recentUsers, activeUsers] = await Promise.all([
                        prisma.user.count({
                            where: {
                                createdAt: {
                                    gte: new Date(
                                        Date.now() - 7 * 24 * 60 * 60 * 1000
                                    ),
                                },
                            },
                        }),
                        prisma.userCourse.count({
                            where: {
                                lastActivity: {
                                    gte: new Date(
                                        Date.now() - 7 * 24 * 60 * 60 * 1000
                                    ),
                                },
                            },
                        }),
                    ]);

                    breakdown = [
                        { label: "Всего пользователей", count: totalUsers },
                        { label: "Новые за неделю", count: recentUsers },
                        { label: "Активные за неделю", count: activeUsers },
                    ];
                    break;

                case "course":
                    if (courseId) {
                        const courseUsers = await prisma.userCourse.findMany({
                            where: { courseId: courseId as string },
                            include: { user: true },
                        });

                        totalUsers = courseUsers.length;

                        const completed = courseUsers.filter(
                            (uc) => uc.completedAt
                        ).length;
                        const inProgress = courseUsers.filter(
                            (uc) => !uc.completedAt && uc.currentLessonIndex > 0
                        ).length;
                        const notStarted = courseUsers.filter(
                            (uc) => uc.currentLessonIndex === 0
                        ).length;

                        breakdown = [
                            { label: "Завершили курс", count: completed },
                            { label: "В процессе", count: inProgress },
                            { label: "Не начинали", count: notStarted },
                        ];
                    }
                    break;

                case "status":
                    if (status === "completed") {
                        where.userCourses = {
                            some: { completedAt: { not: null } },
                        };
                    } else if (status === "in_progress") {
                        where.userCourses = {
                            some: {
                                AND: [
                                    { completedAt: null },
                                    { currentLessonIndex: { gt: 0 } },
                                ],
                            },
                        };
                    } else if (status === "not_started") {
                        where.userCourses = { none: {} };
                    }

                    totalUsers = await prisma.user.count({ where });
                    breakdown = [
                        {
                            label: `Пользователи со статусом: ${status}`,
                            count: totalUsers,
                        },
                    ];
                    break;

                case "recent":
                    const days = parseInt(recentDays as string) || 7;
                    where.createdAt = {
                        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                    };

                    totalUsers = await prisma.user.count({ where });
                    breakdown = [
                        {
                            label: `Зарегистрированы за ${days} дней`,
                            count: totalUsers,
                        },
                    ];
                    break;

                default:
                    totalUsers = 0;
            }

            // Дополнительная статистика
            const [activeUsers, recentUsers] = await Promise.all([
                prisma.userCourse.count({
                    where: {
                        lastActivity: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
                prisma.user.count({
                    where: {
                        createdAt: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
            ]);

            res.json({
                success: true,
                data: {
                    totalUsers,
                    activeUsers,
                    recentUsers,
                    breakdown,
                },
            });
        } catch (error) {
            console.error("Error fetching audience stats:", error);
            res.status(500).json({
                error: "Failed to fetch audience statistics",
            });
        }
    }
);

// Отправить массовую рассылку
app.post("/api/broadcast/send", authenticateToken, async (req, res) => {
    try {
        const {
            targetType,
            courseId,
            status,
            recentDays,
            mediaType,
            mediaUrl,
            message,
            buttonText,
            buttonUrl,
        } = req.body;

        if (!bot) {
            return res.status(500).json({ error: "Bot not configured" });
        }

        // Валидация
        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message is required" });
        }

        if (mediaType !== "text" && !mediaUrl) {
            return res
                .status(400)
                .json({ error: "Media URL is required for media messages" });
        }

        if (buttonText && !buttonUrl) {
            return res
                .status(400)
                .json({
                    error: "Button URL is required when button text is provided",
                });
        }

        // Получаем пользователей для рассылки
        let users: any[] = [];

        switch (targetType) {
            case "all":
                users = await prisma.user.findMany({
                    select: {
                        id: true,
                        telegramId: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                    },
                });
                break;

            case "course":
                if (courseId) {
                    const courseUsers = await prisma.userCourse.findMany({
                        where: { courseId },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    telegramId: true,
                                    firstName: true,
                                    lastName: true,
                                    username: true,
                                },
                            },
                        },
                    });
                    users = courseUsers.map((uc) => uc.user);
                }
                break;

            case "status":
                let where: any = {};

                if (status === "completed") {
                    where.userCourses = {
                        some: { completedAt: { not: null } },
                    };
                } else if (status === "in_progress") {
                    where.userCourses = {
                        some: {
                            AND: [
                                { completedAt: null },
                                { currentLessonIndex: { gt: 0 } },
                            ],
                        },
                    };
                } else if (status === "not_started") {
                    where.userCourses = { none: {} };
                }

                users = await prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        telegramId: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                    },
                });
                break;

            case "recent":
                const days = parseInt(recentDays) || 7;
                users = await prisma.user.findMany({
                    where: {
                        createdAt: {
                            gte: new Date(
                                Date.now() - days * 24 * 60 * 60 * 1000
                            ),
                        },
                    },
                    select: {
                        id: true,
                        telegramId: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                    },
                });
                break;

            default:
                return res.status(400).json({ error: "Invalid target type" });
        }

        if (users.length === 0) {
            return res.json({
                success: true,
                data: {
                    sent: 0,
                    failed: 0,
                    total: 0,
                    details: [
                        {
                            success: false,
                            message:
                                "No users found for the specified criteria",
                        },
                    ],
                },
            });
        }

        // Отправляем сообщения
        let sentCount = 0;
        let failedCount = 0;
        const details: any[] = [];

        for (const user of users) {
            try {
                const options: any = {};

                if (buttonText && buttonUrl) {
                    options.reply_markup = {
                        inline_keyboard: [
                            [
                                {
                                    text: buttonText,
                                    url: buttonUrl,
                                },
                            ],
                        ],
                    };
                }

                if (mediaType === "text") {
                    await bot.sendMessage(user.telegramId, message, {
                        parse_mode: "Markdown",
                        ...options,
                    });
                } else {
                    options.caption = message;
                    options.parse_mode = "Markdown";

                    if (mediaType === "PHOTO") {
                        await bot.sendPhoto(user.telegramId, mediaUrl, options);
                    } else if (mediaType === "VIDEO") {
                        await bot.sendVideo(user.telegramId, mediaUrl, options);
                    }
                }

                sentCount++;
                details.push({
                    success: true,
                    message: `Отправлено пользователю ${user.firstName || ""} ${
                        user.lastName || ""
                    } (@${user.username || user.telegramId})`,
                });

                // Добавляем небольшую задержку между отправками
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                failedCount++;
                details.push({
                    success: false,
                    message: `Ошибка отправки пользователю ${
                        user.firstName || ""
                    } ${user.lastName || ""}: ${error.message}`,
                });
                console.error(
                    `Failed to send broadcast to user ${user.telegramId}:`,
                    error
                );
            }
        }

        // Логируем массовую рассылку
        console.log(
            `Broadcast completed: ${sentCount} sent, ${failedCount} failed out of ${users.length} total users`
        );

        res.json({
            success: true,
            data: {
                sent: sentCount,
                failed: failedCount,
                total: users.length,
                details: details.slice(0, 50), // Ограничиваем количество деталей для производительности
            },
        });
    } catch (error) {
        console.error("Error sending broadcast:", error);
        res.status(500).json({ error: "Failed to send broadcast" });
    }
});

// Получить историю рассылок (опционально - для будущего расширения)
app.get("/api/broadcast/history", authenticateToken, async (req, res) => {
    try {
        // Здесь можно было бы хранить историю рассылок в отдельной таблице
        // Пока что возвращаем заглушку
        res.json({
            success: true,
            data: [],
            message: "Broadcast history feature is not implemented yet",
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch broadcast history" });
    }
});

// Получить шаблоны сообщений (опционально)
app.get("/api/broadcast/templates", authenticateToken, async (req, res) => {
    try {
        // Готовые шаблоны для быстрой рассылки
        const templates = [
            {
                id: "welcome",
                name: "Приветственное сообщение",
                message:
                    "👋 Добро пожаловать в наш образовательный бот!\n\nМы рады видеть вас среди наших учеников. Начните свое обучение прямо сейчас!",
                mediaType: "text",
                buttonText: "Начать обучение",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "reminder",
                name: "Напоминание о курсе",
                message:
                    "📚 Не забудьте продолжить обучение!\n\nУ вас есть незавершенные уроки. Уделите несколько минут своему развитию.",
                mediaType: "text",
                buttonText: "Продолжить",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "announcement",
                name: "Объявление",
                message:
                    "📢 Важное объявление!\n\n[Введите ваше объявление здесь]",
                mediaType: "text",
            },
            {
                id: "new_course",
                name: "Новый курс",
                message:
                    "🆕 Новый курс доступен!\n\nМы добавили новый курс, который поможет вам развить дополнительные навыки.",
                mediaType: "text",
                buttonText: "Изучить курс",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "congratulations",
                name: "Поздравления",
                message: "🎉 Поздравляем!\n\n[Введите текст поздравления]",
                mediaType: "text",
            },
        ];

        res.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// Применить шаблон
app.get("/api/broadcast/templates/:id", authenticateToken, async (req, res) => {
    try {
        const templates = [
            {
                id: "welcome",
                name: "Приветственное сообщение",
                message:
                    "👋 Добро пожаловать в наш образовательный бот!\n\nМы рады видеть вас среди наших учеников. Начните свое обучение прямо сейчас!",
                mediaType: "text",
                buttonText: "Начать обучение",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "reminder",
                name: "Напоминание о курсе",
                message:
                    "📚 Не забудьте продолжить обучение!\n\nУ вас есть незавершенные уроки. Уделите несколько минут своему развитию.",
                mediaType: "text",
                buttonText: "Продолжить",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "announcement",
                name: "Объявление",
                message:
                    "📢 Важное объявление!\n\n[Введите ваше объявление здесь]",
                mediaType: "text",
            },
            {
                id: "new_course",
                name: "Новый курс",
                message:
                    "🆕 Новый курс доступен!\n\nМы добавили новый курс, который поможет вам развить дополнительные навыки.",
                mediaType: "text",
                buttonText: "Изучить курс",
                buttonUrl: "https://t.me/your_bot_username",
            },
            {
                id: "congratulations",
                name: "Поздравления",
                message: "🎉 Поздравляем!\n\n[Введите текст поздравления]",
                mediaType: "text",
            },
        ];

        const template = templates.find((t) => t.id === req.params.id);

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json({
            success: true,
            data: template,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch template" });
    }
});

console.log("Express app configured successfully!");
