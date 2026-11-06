export type MutuallyAssignable<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
export type AssertTrue<Condition extends true> = Condition;

// FromSchema yields mutable arrays; a shared type may keep its arrays readonly, which says nothing about the JSON shape.
export type WithMutableArrays<T> = T extends readonly (infer Item)[]
  ? WithMutableArrays<Item>[]
  : T extends object
    ? { [Key in keyof T]: WithMutableArrays<T[Key]> }
    : T;
