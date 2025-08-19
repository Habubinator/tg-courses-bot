import TelegramBot from "node-telegram-bot-api";
import { CourseCommands } from "./commands/course";
import { AdminCommands } from "./commands/admin";
import { Keyboard } from "./keyboard";
import { repository } from "../db/repository";

export class BotHandlers {
    private bot: TelegramBot;
    private courseCommands: CourseCommands;
    private adminCommands: AdminCommands;

    constructor(bot: TelegramBot) {
        this.bot = bot;
        this.bot.setMyCommands([
            {
                command: "/start",
                description: "Начать работу с ботом",
            },
            {
                command: "/help",
                description: "Получить справку",
            },
            {
                command: "/admin_add",
                description: "Добавить администратора (только для админов)",
            },
            {
                command: "/admin_remove",
                description: "Удалить администратора (только для админов)",
            },
            {
                command: "/stats",
                description: "Получить статистику (только для админов)",
            },
        ]);

        this.courseCommands = new CourseCommands(bot);
        this.adminCommands = new AdminCommands(bot);
    }

    public registerHandlers(): void {
        // Register command-specific handlers
        this.courseCommands.registerHandlers();
        this.adminCommands.registerHandlers();

        // Register global commands
        this.registerGlobalCommands();
    }

    private registerGlobalCommands(): void {
        // Start command
        this.bot.onText(/\/start/, this.handleStart.bind(this));

        // Help command
        this.bot.onText(/\/help/, this.handleHelp.bind(this));
    }

    private async handleStart(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id.toString();

        // Create or get user
        await repository.getOrCreateUser(
            chatId,
            msg.chat.username,
            msg.chat.first_name,
            msg.chat.last_name
        );

        const welcomeMessage =
            "🎓 Добро пожаловать в систему онлайн обучения!\n\n" +
            "Здесь вы сможете пройти обучающий курс с интерактивными уроками и тестами.\n\n" +
            "📚 Нажмите кнопку ниже, чтобы начать обучение.";

        await this.bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: Keyboard.getStartKeyboard(),
        });
    }

    private async handleHelp(msg: TelegramBot.Message): Promise<void> {
        const chatId = msg.chat.id.toString();

        const helpMessage =
            "📚 *Справка по использованию бота*\n\n" +
            "*Как использовать:*\n" +
            "1. Нажмите 'Начать курс' для старта обучения\n" +
            "2. Просматривайте уроки и нажимайте 'Посмотрел!' после изучения\n" +
            "3. Проходите тесты, выбирая правильные ответы\n" +
            "4. Получайте оценки и продолжайте обучение\n\n" +
            "*Команды:*\n" +
            "/start - начать работу с ботом\n" +
            "/help - показать эту справку\n\n" +
            "*Оценки:*\n" +
            "🏆 A (90-100%) - Отлично\n" +
            "🥈 B (80-89%) - Хорошо\n" +
            "🥉 C (70-79%) - Удовлетворительно\n" +
            "📚 D (60-69%) - Слабо\n" +
            "📖 F (0-59%) - Неудовлетворительно";

        await this.bot.sendMessage(chatId, helpMessage, {
            parse_mode: "Markdown",
        });
    }
}
