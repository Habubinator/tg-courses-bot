import { repository } from "../db/repository";
import { Test, Question, TestResult } from "../../generated/prisma";
import { TestAnswer, UserTestProgress } from "../types";
import { GradeCalculator } from "./gradeCalculator";

export class TestService {
    private userTestProgress: Map<string, UserTestProgress> = new Map();

    startTest(userId: string, test: Test): void {
        this.userTestProgress.set(userId, {
            testId: test.id,
            currentQuestionIndex: 0,
            answers: [],
            startedAt: new Date(),
        });
    }

    getCurrentQuestion(userId: string): Question | null {
        const progress = this.userTestProgress.get(userId);
        if (!progress) return null;

        // This would need to be enhanced to fetch the actual question
        return null;
    }

    submitAnswer(
        userId: string,
        questionId: string,
        selectedOption: number
    ): boolean {
        const progress = this.userTestProgress.get(userId);
        if (!progress) return false;

        progress.answers.push({
            questionId,
            selectedOption,
        });

        progress.currentQuestionIndex++;
        return true;
    }

    async completeTest(userId: string, test: Test & { questions: Question[] }) {
        const progress = this.userTestProgress.get(userId);
        if (!progress) return null;

        // Calculate score
        let correctAnswers = 0;
        const totalQuestions = test.questions.length;

        for (const answer of progress.answers) {
            const question = test.questions.find(
                (q) => q.id === answer.questionId
            );
            if (question && question.correctOption === answer.selectedOption) {
                correctAnswers++;
            }
        }

        const score = Math.round((correctAnswers / totalQuestions) * 100);
        const grade = GradeCalculator.calculateGrade(score);

        // Save result
        const result = await repository.saveTestResult(
            userId,
            test.id,
            score,
            grade,
            progress.answers
        );

        // Clean up progress
        this.userTestProgress.delete(userId);

        return result;
    }

    isTestInProgress(userId: string): boolean {
        return this.userTestProgress.has(userId);
    }

    getTestProgress(userId: string): UserTestProgress | null {
        return this.userTestProgress.get(userId) || null;
    }
}

export const testService = new TestService();
