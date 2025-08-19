import TelegramBot from "node-telegram-bot-api";
import { repository } from "../../db/repository";
import { courseService } from "../../services/courseService";
import { testService } from "../../services/testService";
import { Keyboard } from "../keyboard";
import { CourseState, MediaType } from "../../../generated/prisma";
import { GradeCalculator } from "../../services/gradeCalculator";

export class CourseCommands {
    private bot: TelegramBot;

    constructor(bot: TelegramBot) {
        this.bot = bot;
    }

    registerHandlers() {
        // Handle button clicks
        this.bot.onText(/📚 Начать курс/, this.handleStartCourse.bind(this));
        this.bot.onText(/✅ Посмотрел!/, this.handleWatchedLesson.bind(this));

        // Handle callback queries for test answers
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

        // Handle contact sharing
        this.bot.on("contact", this.handleContact.bind(this));
    }

    private async handleStartCourse(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        try {
            // Get or create user
            const user = await repository.getOrCreateUser(
                chatId,
                msg.chat.username,
                msg.chat.first_name,
                msg.chat.last_name
            );

            // Start first course
            const result = await courseService.startFirstCourse(user.id);
            if (!result) {
                await this.bot.sendMessage(
                    chatId,
                    "❌ В данный момент нет доступных курсов."
                );
                return;
            }

            const { course, userCourse } = result;

            // Send first lesson
            await this.sendCurrentLesson(chatId, userCourse.userId, course.id);
        } catch (error) {
            console.error("Error starting course:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при запуске курса."
            );
        }
    }

    private async handleWatchedLesson(msg: TelegramBot.Message) {
        const chatId = msg.chat.id.toString();

        try {
            const user = await repository.getOrCreateUser(chatId);

            // Find user's current course
            const course = await repository.getFirstCourse();
            if (!course) return;

            const userCourse = await repository.getUserCourse(
                user.id,
                course.id
            );
            if (
                !userCourse ||
                userCourse.state !== CourseState.WATCHING_LESSON
            ) {
                await this.bot.sendMessage(
                    chatId,
                    "❌ Вы не просматриваете урок в данный момент."
                );
                return;
            }

            // Mark lesson as watched
            const success = await courseService.markLessonWatched(
                user.id,
                course.id
            );
            if (!success) {
                await this.bot.sendMessage(
                    chatId,
                    "❌ Произошла ошибка при отметке урока."
                );
                return;
            }

            // Check what's next
            const updatedUserCourse = await repository.getUserCourse(
                user.id,
                course.id
            );
            if (!updatedUserCourse) return;

            if (updatedUserCourse.state === CourseState.TAKING_TEST) {
                await this.startTest(chatId, user.id, course.id);
            } else if (
                updatedUserCourse.state === CourseState.COMPLETED_COURSE
            ) {
                await this.handleCourseCompletion(chatId, user, course);
            } else {
                await this.sendCurrentLesson(chatId, user.id, course.id);
            }
        } catch (error) {
            console.error("Error handling watched lesson:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при обработке урока."
            );
        }
    }

    private async sendCurrentLesson(
        chatId: string,
        userId: string,
        courseId: string
    ) {
        try {
            const userCourse = await repository.getUserCourse(userId, courseId);
            if (!userCourse) return;

            const lesson = await courseService.getCurrentLesson(userCourse);
            if (!lesson) {
                await this.bot.sendMessage(
                    chatId,
                    "✅ Вы завершили все уроки в этом курсе!"
                );
                return;
            }

            const options: any = {
                caption: lesson.caption || lesson.title,
                reply_markup: Keyboard.getWatchedKeyboard(),
            };

            // Add button if provided
            if (lesson.buttonText && lesson.buttonUrl) {
                options.reply_markup = {
                    inline_keyboard: [
                        [
                            {
                                text: lesson.buttonText,
                                url: lesson.buttonUrl,
                            },
                        ],
                    ],
                };
            }

            // Send media based on type
            if (lesson.mediaType === MediaType.PHOTO) {
                await this.bot.sendPhoto(chatId, lesson.mediaUrl, options);
            } else if (lesson.mediaType === MediaType.VIDEO) {
                await this.bot.sendVideo(chatId, lesson.mediaUrl, options);
            }
        } catch (error) {
            console.error("Error sending lesson:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при отправке урока."
            );
        }
    }

    private async startTest(chatId: string, userId: string, courseId: string) {
        try {
            const userCourse = await repository.getUserCourse(userId, courseId);
            if (!userCourse) return;

            const course = await repository.getCourseById(courseId);
            if (!course) return;

            const currentLesson = course.lessons[userCourse.currentLessonIndex];
            if (!currentLesson?.test) return;

            // Start the test
            testService.startTest(userId, currentLesson.test);

            await this.bot.sendMessage(
                chatId,
                `📝 Тест: ${currentLesson.test.title}\n\nОтветьте на все вопросы, чтобы продолжить.`,
                { reply_markup: Keyboard.removeKeyboard() }
            );

            // Send first question
            await this.sendNextQuestion(chatId, userId, currentLesson.test);
        } catch (error) {
            console.error("Error starting test:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при запуске теста."
            );
        }
    }

    private async sendNextQuestion(chatId: string, userId: string, test: any) {
        try {
            const progress = testService.getTestProgress(userId);
            if (!progress) return;

            const question = test.questions[progress.currentQuestionIndex];
            if (!question) {
                // Test completed
                await this.completeTest(chatId, userId, test);
                return;
            }

            const questionText =
                `❓ Вопрос ${progress.currentQuestionIndex + 1} из ${
                    test.questions.length
                }\n\n` + `${question.questionText}`;

            await this.bot.sendMessage(chatId, questionText, {
                reply_markup: Keyboard.getTestKeyboard(question.options),
            });
        } catch (error) {
            console.error("Error sending question:", error);
        }
    }

    private async completeTest(chatId: string, userId: string, test: any) {
        try {
            const result = await testService.completeTest(userId, test);
            if (!result) return;

            const user = await repository.getOrCreateUser(chatId);
            const course = await repository.getFirstCourse();
            if (!course) return;

            // Send test results
            const gradeText = GradeCalculator.formatScore(
                result.score,
                result.grade
            );
            await this.bot.sendMessage(
                chatId,
                `🎯 Тест завершен!\n\n${gradeText}\n\nПоздравляем с прохождением теста!`
            );

            // Complete test and move to next lesson
            await courseService.completeTest(userId, course.id);

            // Check what's next
            const updatedUserCourse = await repository.getUserCourse(
                userId,
                course.id
            );
            if (!updatedUserCourse) return;

            if (updatedUserCourse.state === CourseState.COMPLETED_COURSE) {
                await this.handleCourseCompletion(chatId, user, course);
            } else {
                await this.sendCurrentLesson(chatId, userId, course.id);
            }
        } catch (error) {
            console.error("Error completing test:", error);
        }
    }

    private async handleCourseCompletion(
        chatId: string,
        user: any,
        course: any
    ) {
        try {
            await this.bot.sendMessage(
                chatId,
                `🎉 Поздравляем! Вы успешно завершили курс "${course.title}"!\n\n` +
                    `Спасибо за ваше участие и усердие в обучении.`,
                { reply_markup: Keyboard.removeKeyboard() }
            );

            // Request phone number if not provided
            if (!user.phoneNumber) {
                await this.bot.sendMessage(
                    chatId,
                    "📞 Пожалуйста, поделитесь своим номером телефона для завершения регистрации:",
                    { reply_markup: Keyboard.getPhoneRequestKeyboard() }
                );
            } else {
                // Notify admins immediately
                const notificationService =
                    require("../../services/notificationService").notificationService;
                if (notificationService) {
                    await notificationService.notifyAdminsOfCompletion(
                        user,
                        course
                    );
                }
            }
        } catch (error) {
            console.error("Error handling course completion:", error);
        }
    }

    private async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
        if (!query.message || !query.data) return;

        const chatId = query.message.chat.id.toString();

        // Handle test answers
        if (query.data.startsWith("answer_")) {
            const selectedOption = parseInt(query.data.replace("answer_", ""));

            try {
                const user = await repository.getOrCreateUser(chatId);
                const progress = testService.getTestProgress(user.id);

                if (!progress) {
                    await this.bot.answerCallbackQuery(query.id, {
                        text: "Тест не найден.",
                    });
                    return;
                }

                const course = await repository.getFirstCourse();
                if (!course) return;

                const userCourse = await repository.getUserCourse(
                    user.id,
                    course.id
                );
                if (!userCourse) return;

                const currentLesson =
                    course.lessons[userCourse.currentLessonIndex];
                if (!currentLesson?.test) return;

                const question =
                    currentLesson.test.questions[progress.currentQuestionIndex];
                if (!question) return;

                // Submit answer
                testService.submitAnswer(user.id, question.id, selectedOption);

                await this.bot.answerCallbackQuery(query.id, {
                    text: "Ответ записан!",
                });

                // Send next question or complete test
                await this.sendNextQuestion(
                    chatId,
                    user.id,
                    currentLesson.test
                );
            } catch (error) {
                console.error("Error handling test answer:", error);
                await this.bot.answerCallbackQuery(query.id, {
                    text: "Ошибка при обработке ответа.",
                });
            }
        }

        await this.bot.answerCallbackQuery(query.id);
    }

    private async handleContact(msg: TelegramBot.Message) {
        if (!msg.contact) return;

        const chatId = msg.chat.id.toString();

        try {
            const user = await repository.getOrCreateUser(chatId);

            // Update phone number
            await repository.updateUserPhone(user.id, msg.contact.phone_number);

            await this.bot.sendMessage(
                chatId,
                "✅ Спасибо! Ваш номер телефона сохранен.",
                { reply_markup: Keyboard.removeKeyboard() }
            );

            // Notify admins
            const course = await repository.getFirstCourse();
            if (course) {
                const updatedUser = await repository.getOrCreateUser(chatId);
                const notificationService =
                    require("../../services/notificationService").notificationService;
                if (notificationService) {
                    await notificationService.notifyAdminsOfCompletion(
                        updatedUser,
                        course
                    );
                }
            }
        } catch (error) {
            console.error("Error handling contact:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ Произошла ошибка при сохранении номера."
            );
        }
    }
}
