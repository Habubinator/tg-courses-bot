import { repository } from "../db/repository";
import {
    Course,
    Lesson,
    UserCourse,
    CourseState,
} from "../../generated/prisma";

export class CourseService {
    async startFirstCourse(
        userId: string
    ): Promise<{ course: Course; userCourse: UserCourse } | null> {
        const course = await repository.getFirstCourse();
        if (!course) return null;

        let userCourse = await repository.getUserCourse(userId, course.id);
        if (!userCourse) {
            userCourse = await repository.createUserCourse(userId, course.id);
        }

        return { course, userCourse };
    }

    async getCurrentLesson(userCourse: UserCourse): Promise<Lesson | null> {
        const course = await repository.getCourseById(userCourse.courseId);
        if (!course || !course.lessons) return null;

        return course.lessons[userCourse.currentLessonIndex] || null;
    }

    async markLessonWatched(
        userId: string,
        courseId: string
    ): Promise<boolean> {
        const userCourse = await repository.getUserCourse(userId, courseId);
        if (!userCourse) return false;

        const course = await repository.getCourseById(courseId);
        if (!course) return false;

        const currentLesson = course.lessons[userCourse.currentLessonIndex];
        if (!currentLesson) return false;

        // If lesson has a test, move to taking test state
        if (currentLesson.test) {
            await repository.updateUserCourseState(
                userId,
                courseId,
                CourseState.TAKING_TEST
            );
        } else {
            // Move to next lesson or complete course
            const nextLessonIndex = userCourse.currentLessonIndex + 1;
            if (nextLessonIndex >= course.lessons.length) {
                await repository.completeUserCourse(userId, courseId);
            } else {
                await repository.updateUserCourseState(
                    userId,
                    courseId,
                    CourseState.WATCHING_LESSON,
                    nextLessonIndex
                );
            }
        }

        return true;
    }

    async completeTest(userId: string, courseId: string): Promise<boolean> {
        const userCourse = await repository.getUserCourse(userId, courseId);
        if (!userCourse) return false;

        const course = await repository.getCourseById(courseId);
        if (!course) return false;

        // Move to next lesson or complete course
        const nextLessonIndex = userCourse.currentLessonIndex + 1;
        if (nextLessonIndex >= course.lessons.length) {
            await repository.completeUserCourse(userId, courseId);
        } else {
            await repository.updateUserCourseState(
                userId,
                courseId,
                CourseState.WATCHING_LESSON,
                nextLessonIndex
            );
        }

        return true;
    }
}

export const courseService = new CourseService();
