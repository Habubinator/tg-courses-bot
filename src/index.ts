import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "./config";
import { BotHandlers } from "./bot/handlers";
import { Scheduler } from "./services/scheduler";
import { NotificationService } from "./services/notificationService";
import { app, PORT } from "./server/app";

// Global notification service instance
let notificationService: NotificationService;

async function main(): Promise<void> {
    console.log("Starting School Onboarding Bot...");

    // Validate bot token
    if (!CONFIG.bot.token) {
        console.error(
            "Error: Bot token is missing! Please check your .env file."
        );
        process.exit(1);
    }

    try {
        // Initialize the bot with token from config
        const bot = new TelegramBot(CONFIG.bot.token, { polling: true });
        console.log("Bot initialized successfully!");

        // Initialize notification service
        notificationService = new NotificationService(bot);

        // Set up the handlers
        const handlers = new BotHandlers(bot);
        handlers.registerHandlers();
        console.log("Bot handlers registered successfully!");

        // Initialize scheduler
        const scheduler = new Scheduler(bot);
        scheduler.init();
        console.log("Scheduler initialized successfully!");

        app.listen(PORT, () => {
            console.log(`🚀 Admin API Server running on port ${PORT}`);
            console.log(`📊 Admin panel: http://localhost:${PORT}`);
            console.log(`🔗 API endpoints: http://localhost:${PORT}/api/*`);
        });

        // Log successful startup
        console.log("Bot is now running. Press CTRL+C to stop.");

        // Handle application termination
        process.on("SIGINT", async () => {
            console.log("Received SIGINT. Shutting down bot...");
            await bot.close();
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            console.log("Received SIGTERM. Shutting down bot...");
            await bot.close();
            process.exit(0);
        });

        // Unhandled errors
        bot.on("polling_error", (error) => {
            console.error("Polling error:", error);
        });
    } catch (error) {
        console.error("Error starting the bot:", error);
        process.exit(1);
    }
}

// Run the application
main().catch((error) => {
    console.error("Unhandled error in main:", error);
    process.exit(1);
});
