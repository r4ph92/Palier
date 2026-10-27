export type MutuallyAssignable<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
export type AssertTrue<Condition extends true> = Condition;
