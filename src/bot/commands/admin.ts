import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";

export class AdminCommands {
    private bot: TelegramBot;

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Admin commands
        this.bot.onText(/\/admin_add (.+)/, this.handleAddAdmin.bind(this));
        this.bot.onText(
            /\/admin_remove (.+)/,
            this.handleRemoveAdmin.bind(this)
        );
        this.bot.onText(/\/stats/, this.handleStats.bind(this));
    }

    private async handleAddAdmin(
        msg: TelegramBot.Message,
        match: RegExpExecArray | null
    ) {
        const chatId = msg.chat.id.toString();

        if (!(await repository.isAdmin(chatId))) {
            await this.bot.sendMessage(
                chatId,
                "❌ У вас нет прав администратора."
            );
            return;
        }

        if (!match || !match[1]) {
            await this.bot.sendMessage(
                chatId,
                "❌ Пожалуйста, укажите Telegram ID. Пример: /admin_add 123456789"
            );
            return;
        }

        const telegramId = match[1].trim();

        try {
            await repository.addAdmin(telegramId);
            await this.bot.sendMessage(
                chatId,
                `✅ Администратор ${telegramId} успешно добавлен!`
            );
        } catch (error) {
            console.error("Error adding admin:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при добавлении администратора."
            );
        }
    }

    private async handleRemoveAdmin(
        msg: TelegramBot.Message,
        match: RegExpExecArray | null
    ) {
        const chatId = msg.chat.id.toString();

        if (!(await repository.isAdmin(chatId))) {
            await this.bot.sendMessage(
                chatId,
                "❌ У вас нет прав администратора."
            );
            return;
        }

        if (!match || !match[1]) {
            await this.bot.sendMessage(
                chatId,
                "❌ Пожалуйста, укажите Telegram ID. Пример: /admin_remove 123456789"
            );
            return;
        }

        const telegramId = match[1].trim();

        try {
            await repository.removeAdmin(telegramId);
            await this.bot.sendMessage(
                chatId,
                `✅ Администратор ${telegramId} успешно удален!`
            );
        } catch (error) {
            console.error("Error removing admin:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при удалении администратора."
            );
        }
    }

    private async handleStats(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        if (!(await repository.isAdmin(chatId))) {
            await this.bot.sendMessage(
                chatId,
                "❌ У вас нет прав администратора."
            );
            return;
        }

        try {
            // Get basic statistics
            const course = await repository.getFirstCourse();
            if (!course) {
                await this.bot.sendMessage(chatId, "❌ Курс не найден.");
                return;
            }

            const stats = await repository.getUserStats("");

            await this.bot.sendMessage(
                chatId,
                `📊 Статистика курса "${course.title}"\n\n` +
                    `👥 Всего пользователей: ${
                        stats?.userCourses?.length || 0
                    }\n` +
                    `✅ Завершили курс: ${
                        stats?.userCourses?.filter((uc: any) => uc.completedAt)
                            ?.length || 0
                    }\n` +
                    `📚 В процессе обучения: ${
                        stats?.userCourses?.filter((uc: any) => !uc.completedAt)
                            ?.length || 0
                    }`
            );
        } catch (error) {
            console.error("Error getting stats:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при получении статистики."
            );
        }
    }
}
