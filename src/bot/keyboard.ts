import TelegramBot from "node-telegram-bot-api";

export class Keyboard {
    static getStartKeyboard(): TelegramBot.ReplyKeyboardMarkup {
        return {
            keyboard: [[{ text: "📚 Начать курс" }]],
            resize_keyboard: true,
            one_time_keyboard: true,
        };
    }

    static getWatchedKeyboard(): TelegramBot.ReplyKeyboardMarkup {
        return {
            keyboard: [[{ text: "✅ Посмотрел!" }]],
            resize_keyboard: true,
        };
    }

    static getTestKeyboard(
        options: string[]
    ): TelegramBot.InlineKeyboardMarkup {
        const keyboard = options.map((option, index) => [
            {
                text: `${index + 1}. ${option}`,
                callback_data: `answer_${index}`,
            },
        ]);

        return {
            inline_keyboard: keyboard,
        };
    }

    static getPhoneRequestKeyboard(): TelegramBot.ReplyKeyboardMarkup {
        return {
            keyboard: [
                [{ text: "📞 Поделиться номером", request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        };
    }

    static removeKeyboard(): TelegramBot.ReplyKeyboardRemove {
        return {
            remove_keyboard: true,
        };
    }
}
