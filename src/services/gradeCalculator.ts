import { Grade } from "../../generated/prisma";

export class GradeCalculator {
    static calculateGrade(score: number): Grade {
        if (score >= 90) return Grade.A;
        if (score >= 80) return Grade.B;
        if (score >= 70) return Grade.C;
        if (score >= 60) return Grade.D;
        return Grade.F;
    }

    static getGradeEmoji(grade: Grade): string {
        switch (grade) {
            case Grade.A:
                return "🏆";
            case Grade.B:
                return "🥈";
            case Grade.C:
                return "🥉";
            case Grade.D:
                return "📚";
            case Grade.F:
                return "📖";
        }
    }

    static formatScore(score: number, grade: Grade): string {
        const emoji = this.getGradeEmoji(grade);
        return `${emoji} Оценка: ${grade} (${score}%)`;
    }
}
