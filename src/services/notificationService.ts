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
}
