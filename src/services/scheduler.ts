import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import { NotificationService } from "./notificationService";
import { CONFIG } from "../config";

export class Scheduler {
    private bot: TelegramBot;
    private notificationService: NotificationService;

    constructor(bot: TelegramBot) {
        this.bot = bot;
        this.notificationService = new NotificationService(bot);
    }

    init() {
        // Check for notifications every X minutes
        const cronPattern = `*/${CONFIG.notifications.checkIntervalMinutes} * * * *`;

        cron.schedule(cronPattern, async () => {
            try {
                await this.notificationService.checkAndSendNotifications();
            } catch (error) {
                console.error("Error in scheduled notification check:", error);
            }
        });

        console.log(
            `Notification scheduler initialized with ${CONFIG.notifications.checkIntervalMinutes} minute intervals`
        );
    }
}
