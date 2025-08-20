import TelegramBot from "node-telegram-bot-api";
import { repository } from "../db/repository";
import { CONFIG } from "../config";
import { CourseState, MediaType } from "../../generated/prisma";

export class NotificationService {
    private bot: TelegramBot;

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    async checkAndSendNotifications(): Promise<void> {
        try {
            // Check for users who need lesson start notifications
            await this.checkLessonStartNotifications();

            // Check for users who need watched lesson notifications
            await this.checkWatchedNotifications();

            // Check for users who need test completion notifications
            await this.checkTestTimeoutNotifications();
        } catch (error) {
            console.error("Error in notification service:", error);
        }
    }

    private async checkLessonStartNotifications(): Promise<void> {
        const users = await repository.getUsersForNotification(
            "", // All courses
            CourseState.WATCHING_LESSON,
            CONFIG.app.lessonStartTimeoutMinutes
        );

        for (const userCourse of users) {
            const notifications = await repository.getNotificationsForState(
                userCourse.courseId,
                CourseState.WATCHING_LESSON
            );

            for (const notification of notifications) {
                await this.sendNotification(
                    userCourse.user.telegramId,
                    notification
                );
            }
        }
    }

    private async checkWatchedNotifications(): Promise<void> {
        const users = await repository.getUsersForNotification(
            "", // All courses
            CourseState.TAKING_TEST,
            CONFIG.app.watchedTimeoutMinutes
        );

        for (const userCourse of users) {
            const notifications = await repository.getNotificationsForState(
                userCourse.courseId,
                CourseState.TAKING_TEST
            );

            for (const notification of notifications) {
                await this.sendNotification(
                    userCourse.user.telegramId,
                    notification
                );
            }
        }
    }

    private async checkTestTimeoutNotifications(): Promise<void> {
        const users = await repository.getUsersForNotification(
            "", // All courses
            CourseState.TAKING_TEST,
            CONFIG.app.testTimeoutMinutes
        );

        for (const userCourse of users) {
            // Отправляем напоминание о незавершенном тесте
            const message =
                `⏰ *Напоминание о тесте*\n\n` +
                `Вы начали проходить тест, но не завершили его.\n\n` +
                `Пожалуйста, завершите тест, чтобы продолжить обучение.\n\n` +
                `Нажмите /start для продолжения.`;

            try {
                await this.bot.sendMessage(
                    userCourse.user.telegramId,
                    message,
                    {
                        parse_mode: "Markdown",
                    }
                );
            } catch (error) {
                console.error(
                    `Error sending test timeout notification to ${userCourse.user.telegramId}:`,
                    error
                );
            }
        }
    }

    private async sendNotification(
        telegramId: string,
        notification: any
    ): Promise<void> {
        try {
            const options: any = {
                caption: notification.caption,
            };

            if (notification.buttonText && notification.buttonUrl) {
                options.reply_markup = {
                    inline_keyboard: [
                        [
                            {
                                text: notification.buttonText,
                                url: notification.buttonUrl,
                            },
                        ],
                    ],
                };
            }

            if (notification.mediaType === MediaType.PHOTO) {
                await this.bot.sendPhoto(
                    telegramId,
                    notification.mediaUrl,
                    options
                );
            } else if (notification.mediaType === MediaType.VIDEO) {
                await this.bot.sendVideo(
                    telegramId,
                    notification.mediaUrl,
                    options
                );
            }
        } catch (error) {
            console.error(
                `Error sending notification to ${telegramId}:`,
                error
            );
        }
    }

    async notifyAdminsOfCompletion(user: any, course: any): Promise<void> {
        const admins = await repository.getAdmins();

        const message =
            `🎓 Пользователь завершил курс!\n\n` +
            `👤 Пользователь: ${user.firstName || ""} ${
                user.lastName || ""
            }\n` +
            `📞 Телефон: ${user.phoneNumber || "Не указан"}\n` +
            `👤 Username: @${user.username || "Не указан"}\n` +
            `📚 Курс: ${course.title}\n` +
            `🆔 Telegram ID: ${user.telegramId}\n` +
            `📅 Дата завершения: ${new Date().toLocaleString("ru-RU")}`;

        for (const admin of admins) {
            try {
                await this.bot.sendMessage(admin.telegramId, message);
            } catch (error) {
                console.error(
                    `Error notifying admin ${admin.telegramId}:`,
                    error
                );
            }
        }
    }

    async notifyUsersAboutNewTest(
        lessonId: string,
        testTitle: string
    ): Promise<{ sent: number; total: number }> {
        try {
            // Получаем урок и курс
            const lesson = await repository.getCourseById(""); // Нужно будет исправить
            if (!lesson) {
                throw new Error("Lesson not found");
            }

            // Находим пользователей, которые прошли этот урок
            const usersWhoCompleted = await this.getUsersWhoCompletedLesson(
                lessonId
            );

            const message =
                `📝 *Новый тест доступен!*\n\n` +
                `К уроку, который вы уже прошли, был добавлен тест.\n\n` +
                `🎯 *Тест:* ${testTitle}\n\n` +
                `Пройдите его, чтобы закрепить полученные знания!\n\n` +
                `Нажмите /start для продолжения.`;

            let sentCount = 0;

            for (const user of usersWhoCompleted) {
                try {
                    await this.bot.sendMessage(user.telegramId, message, {
                        parse_mode: "Markdown",
                    });
                    sentCount++;
                } catch (error) {
                    console.error(
                        `Failed to send test notification to user ${user.telegramId}:`,
                        error
                    );
                }
            }

            return {
                sent: sentCount,
                total: usersWhoCompleted.length,
            };
        } catch (error) {
            console.error("Error in notifyUsersAboutNewTest:", error);
            throw error;
        }
    }

    private async getUsersWhoCompletedLesson(lessonId: string): Promise<any[]> {
        // Это заглушка - нужно будет реализовать запрос к базе данных
        // для получения пользователей, которые прошли конкретный урок

        // Пример реализации:
        // 1. Получить урок и его orderIndex
        // 2. Найти всех пользователей курса, у которых currentLessonIndex > orderIndex
        // 3. Или курс завершен

        return [];
    }

    async notifyUserAboutTestFailure(
        telegramId: string,
        testTitle: string,
        score: number,
        requiredScore: number = 70
    ): Promise<void> {
        const message =
            `📝 *Результат теста*\n\n` +
            `Тест: ${testTitle}\n` +
            `Ваш результат: ${score}%\n\n` +
            `К сожалению, для прохождения требуется минимум ${requiredScore}%.\n\n` +
            `Вы можете пересдать тест. Изучите материал еще раз и попробуйте снова!\n\n` +
            `Нажмите /start для продолжения.`;

        try {
            await this.bot.sendMessage(telegramId, message, {
                parse_mode: "Markdown",
            });
        } catch (error) {
            console.error(
                `Error sending test failure notification to ${telegramId}:`,
                error
            );
        }
    }

    async notifyUserAboutTestSuccess(
        telegramId: string,
        testTitle: string,
        score: number,
        grade: string
    ): Promise<void> {
        const gradeEmojis: { [key: string]: string } = {
            A: "🏆",
            B: "🥈",
            C: "🥉",
            D: "📚",
            F: "📖",
        };

        const emoji = gradeEmojis[grade] || "✅";

        const message =
            `🎉 *Тест успешно пройден!*\n\n` +
            `Тест: ${testTitle}\n` +
            `Ваш результат: ${score}%\n` +
            `Оценка: ${emoji} ${grade}\n\n` +
            `Поздравляем с успешным прохождением теста!\n\n` +
            `Нажмите /start для продолжения обучения.`;

        try {
            await this.bot.sendMessage(telegramId, message, {
                parse_mode: "Markdown",
            });
        } catch (error) {
            console.error(
                `Error sending test success notification to ${telegramId}:`,
                error
            );
        }
    }

    async sendCustomNotification(
        telegramId: string,
        message: string,
        mediaUrl?: string,
        mediaType?: "PHOTO" | "VIDEO",
        buttonText?: string,
        buttonUrl?: string
    ): Promise<void> {
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

            if (mediaUrl && mediaType) {
                options.caption = message;

                if (mediaType === "PHOTO") {
                    await this.bot.sendPhoto(telegramId, mediaUrl, options);
                } else if (mediaType === "VIDEO") {
                    await this.bot.sendVideo(telegramId, mediaUrl, options);
                }
            } else {
                await this.bot.sendMessage(telegramId, message, {
                    parse_mode: "Markdown",
                    ...options,
                });
            }
        } catch (error) {
            console.error(
                `Error sending custom notification to ${telegramId}:`,
                error
            );
            throw error;
        }
    }

    async broadcastToAllUsers(
        message: string,
        mediaUrl?: string,
        mediaType?: "PHOTO" | "VIDEO",
        buttonText?: string,
        buttonUrl?: string
    ): Promise<{ sent: number; failed: number }> {
        try {
            // Получаем всех пользователей
            const users = await repository.getAllUsers(); // Нужно добавить этот метод в repository

            let sentCount = 0;
            let failedCount = 0;

            for (const user of users) {
                try {
                    await this.sendCustomNotification(
                        user.telegramId,
                        message,
                        mediaUrl,
                        mediaType,
                        buttonText,
                        buttonUrl
                    );
                    sentCount++;

                    // Добавляем небольшую задержку между отправками
                    await new Promise((resolve) => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(
                        `Failed to send broadcast to user ${user.telegramId}:`,
                        error
                    );
                    failedCount++;
                }
            }

            return { sent: sentCount, failed: failedCount };
        } catch (error) {
            console.error("Error in broadcastToAllUsers:", error);
            throw error;
        }
    }

    async notifyAdminsAboutNewUser(user: any): Promise<void> {
        const admins = await repository.getAdmins();

        const message =
            `👋 *Новый пользователь зарегистрировался!*\n\n` +
            `👤 Имя: ${user.firstName || ""} ${user.lastName || ""}\n` +
            `👤 Username: @${user.username || "Не указан"}\n` +
            `🆔 Telegram ID: ${user.telegramId}\n` +
            `📅 Дата регистрации: ${new Date().toLocaleString("ru-RU")}`;

        for (const admin of admins) {
            try {
                await this.bot.sendMessage(admin.telegramId, message, {
                    parse_mode: "Markdown",
                });
            } catch (error) {
                console.error(
                    `Error notifying admin ${admin.telegramId} about new user:`,
                    error
                );
            }
        }
    }

    async notifyAdminsAboutError(
        errorMessage: string,
        userId?: string,
        context?: string
    ): Promise<void> {
        const admins = await repository.getAdmins();

        const message =
            `⚠️ *Ошибка в системе*\n\n` +
            `📝 Ошибка: ${errorMessage}\n` +
            (userId ? `👤 Пользователь: ${userId}\n` : "") +
            (context ? `📍 Контекст: ${context}\n` : "") +
            `⏰ Время: ${new Date().toLocaleString("ru-RU")}`;

        for (const admin of admins) {
            try {
                await this.bot.sendMessage(admin.telegramId, message, {
                    parse_mode: "Markdown",
                });
            } catch (error) {
                console.error(
                    `Error notifying admin ${admin.telegramId} about error:`,
                    error
                );
            }
        }
    }
}

// Экспортируем переменную для использования в других модулях
export let notificationService: NotificationService | null = null;

export function initializeNotificationService(bot: TelegramBot): void {
    notificationService = new NotificationService(bot);
}
