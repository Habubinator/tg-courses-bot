import { PrismaClient, MediaType, CourseState } from "../../generated/prisma";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function seed() {
    console.log("🌱 Starting database seeding...");

    try {
        // Create admin user
        console.log("👨‍💼 Creating admin user...");
        const admin = await prisma.admin.create({
            data: {
                telegramId: "513950472", // Replace with your actual Telegram ID
            },
        });
        console.log(`✅ Admin created with ID: ${admin.id}`);

        // Create course
        console.log("📚 Creating test course...");
        const course = await prisma.course.create({
            data: {
                title: "Основы безопасности в школе",
                description:
                    "Курс по основам безопасности и правилам поведения в школе",
                isActive: true,
                orderIndex: 1,
            },
        });
        console.log(`✅ Course created: ${course.title}`);

        // Create lessons
        console.log("📖 Creating lessons...");

        // Lesson 1: Introduction
        const lesson1 = await prisma.lesson.create({
            data: {
                courseId: course.id,
                title: "Добро пожаловать в курс безопасности",
                mediaType: MediaType.PHOTO,
                mediaUrl:
                    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800",
                caption:
                    '🎓 Добро пожаловать в курс "Основы безопасности в школе"!\n\nВ этом курсе вы изучите:\n• Правила поведения в школе\n• Основы пожарной безопасности\n• Действия в чрезвычайных ситуациях\n• Правила дорожного движения\n\nДавайте начнем обучение!',
                buttonText: "📋 Правила курса",
                buttonUrl: "https://example.com/rules",
                orderIndex: 0,
            },
        });

        // Lesson 2: Fire Safety
        const lesson2 = await prisma.lesson.create({
            data: {
                courseId: course.id,
                title: "Пожарная безопасность",
                mediaType: MediaType.VIDEO,
                mediaUrl:
                    "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
                caption:
                    "🔥 Урок 1: Пожарная безопасность\n\nВ этом уроке вы узнаете:\n• Как предотвратить пожар\n• Что делать при обнаружении огня\n• Как правильно эвакуироваться\n• Как пользоваться огнетушителем\n\nВнимательно изучите материал!",
                buttonText: "🚒 Инструкция по эвакуации",
                buttonUrl: "https://example.com/evacuation",
                orderIndex: 1,
            },
        });

        // Create test for lesson 2
        const test1 = await prisma.test.create({
            data: {
                lessonId: lesson2.id,
                title: "Тест по пожарной безопасности",
            },
        });

        // Create questions for test 1
        const questions1 = await prisma.question.createMany({
            data: [
                {
                    testId: test1.id,
                    questionText:
                        "Что нужно делать в первую очередь при обнаружении пожара?",
                    options: [
                        "Попытаться потушить огонь самостоятельно",
                        "Сообщить взрослым или вызвать пожарную службу",
                        "Собрать свои вещи",
                        "Спрятаться в классе",
                    ],
                    correctOption: 1,
                    orderIndex: 0,
                },
                {
                    testId: test1.id,
                    questionText:
                        "По какому номеру вызывается пожарная служба?",
                    options: ["101", "102", "103", "104"],
                    correctOption: 0,
                    orderIndex: 1,
                },
                {
                    testId: test1.id,
                    questionText: "Как правильно покидать здание при пожаре?",
                    options: [
                        "Бежать как можно быстрее",
                        "Использовать лифт",
                        "Двигаться спокойно по лестнице, пригнувшись",
                        "Ждать помощи в классе",
                    ],
                    correctOption: 2,
                    orderIndex: 2,
                },
            ],
        });

        // Lesson 3: Emergency Situations
        const lesson3 = await prisma.lesson.create({
            data: {
                courseId: course.id,
                title: "Действия в чрезвычайных ситуациях",
                mediaType: MediaType.PHOTO,
                mediaUrl:
                    "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800",
                caption:
                    "⚠️ Урок 2: Чрезвычайные ситуации\n\nВ этом уроке изучаем:\n• Что такое чрезвычайная ситуация\n• Сигналы тревоги в школе\n• Правила поведения при землетрясении\n• Действия при угрозе теракта\n\nЗнание этих правил может спасти жизнь!",
                orderIndex: 2,
            },
        });

        // Create test for lesson 3
        const test2 = await prisma.test.create({
            data: {
                lessonId: lesson3.id,
                title: "Тест по чрезвычайным ситуациям",
            },
        });

        // Create questions for test 2
        const questions2 = await prisma.question.createMany({
            data: [
                {
                    testId: test2.id,
                    questionText:
                        "Что означает длинный непрерывный звук сирены в школе?",
                    options: [
                        "Начало урока",
                        "Пожарная тревога",
                        "Воздушная тревога",
                        "Конец учебного дня",
                    ],
                    correctOption: 2,
                    orderIndex: 0,
                },
                {
                    testId: test2.id,
                    questionText:
                        "Как нужно вести себя при землетрясении, находясь в классе?",
                    options: [
                        "Выбежать из класса",
                        "Спрятаться под парту и держаться за ее ножки",
                        "Встать у окна",
                        "Забраться на стол",
                    ],
                    correctOption: 1,
                    orderIndex: 1,
                },
            ],
        });

        // Lesson 4: Road Safety
        const lesson4 = await prisma.lesson.create({
            data: {
                courseId: course.id,
                title: "Правила дорожного движения",
                mediaType: MediaType.VIDEO,
                mediaUrl:
                    "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
                caption:
                    "🚦 Урок 3: Безопасность на дороге\n\nИзучаем важные правила:\n• Как правильно переходить дорогу\n• Значение дорожных знаков\n• Правила для пешеходов\n• Безопасность в транспорте\n\nЭти знания помогут вам быть в безопасности!",
                buttonText: "🚸 ПДД для детей",
                buttonUrl: "https://example.com/road-rules",
                orderIndex: 3,
            },
        });

        // Final lesson without test
        const lesson5 = await prisma.lesson.create({
            data: {
                courseId: course.id,
                title: "Заключение курса",
                mediaType: MediaType.PHOTO,
                mediaUrl:
                    "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800",
                caption:
                    "🎉 Поздравляем с завершением курса!\n\nВы успешно изучили:\n✅ Пожарную безопасность\n✅ Действия в ЧС\n✅ Правила дорожного движения\n\nТеперь вы знаете, как обеспечить свою безопасность в школе и за ее пределами. Применяйте полученные знания каждый день!",
                orderIndex: 4,
            },
        });

        console.log(`✅ Created ${5} lessons`);

        // Create notifications
        console.log("🔔 Creating notifications...");

        // Notification for lesson watching timeout
        await prisma.notification.create({
            data: {
                courseId: course.id,
                state: CourseState.WATCHING_LESSON,
                mediaType: MediaType.PHOTO,
                mediaUrl:
                    "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800",
                caption:
                    "⏰ Напоминание о продолжении обучения\n\nВы начали изучать курс безопасности, но не завершили урок. Пожалуйста, продолжите обучение!\n\nПолученные знания очень важны для вашей безопасности.",
                buttonText: "📚 Продолжить обучение",
                buttonUrl: "https://t.me/your_bot_username",
                delayMinutes: 30,
                isActive: true,
            },
        });

        // Notification for test timeout
        await prisma.notification.create({
            data: {
                courseId: course.id,
                state: CourseState.TAKING_TEST,
                mediaType: MediaType.PHOTO,
                mediaUrl:
                    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800",
                caption:
                    "📝 Не забудьте пройти тест!\n\nВы просмотрели урок, но не прошли тест. Тест поможет закрепить полученные знания.\n\nПожалуйста, завершите тестирование!",
                buttonText: "📝 Пройти тест",
                buttonUrl: "https://t.me/your_bot_username",
                delayMinutes: 45,
                isActive: true,
            },
        });

        console.log("✅ Created 2 notifications");

        // Create sample user for testing
        console.log("👤 Creating test user...");
        const testUser = await prisma.user.create({
            data: {
                telegramId: "987654321",
                username: "testuser",
                firstName: "Тест",
                lastName: "Пользователь",
                phoneNumber: "+380123456789",
            },
        });

        // Create user course progress (started but not completed)
        const userCourse = await prisma.userCourse.create({
            data: {
                userId: testUser.id,
                courseId: course.id,
                currentLessonIndex: 1,
                state: CourseState.WATCHING_LESSON,
                lastActivity: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
            },
        });

        console.log("✅ Created test user with course progress");

        console.log("\n🎉 Database seeding completed successfully!");
        console.log("\n📊 Summary:");
        console.log(`• 1 course: "${course.title}"`);
        console.log("• 5 lessons (2 with tests)");
        console.log("• 5 test questions");
        console.log("• 2 notifications");
        console.log("• 1 admin user");
        console.log("• 1 test user");
        console.log(
            "\n📋 Admin Telegram ID: 123456789 (update this in the seed file)"
        );
        console.log("📋 Test User Telegram ID: 987654321");
        console.log("\nℹ️  Don't forget to:");
        console.log("1. Update admin Telegram ID in the seed file");
        console.log("2. Replace placeholder URLs with real media URLs");
        console.log("3. Update button URLs with your actual bot username");
    } catch (error) {
        console.error("❌ Error during seeding:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seed().catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
});
