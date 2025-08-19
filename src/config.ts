import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
    bot: {
        token: process.env.BOT_TOKEN || "",
    },
    app: {
        lessonStartTimeoutMinutes: parseInt(
            process.env.LESSON_START_TIMEOUT || "30"
        ),
        watchedTimeoutMinutes: parseInt(process.env.WATCHED_TIMEOUT || "60"),
        testTimeoutMinutes: parseInt(process.env.TEST_TIMEOUT || "45"),
    },
    notifications: {
        checkIntervalMinutes: parseInt(
            process.env.NOTIFICATION_CHECK_INTERVAL || "5"
        ),
    },
};
