export interface TestAnswer {
    questionId: string;
    selectedOption: number;
}

export interface UserTestProgress {
    testId: string;
    currentQuestionIndex: number;
    answers: TestAnswer[];
    startedAt: Date;
}
