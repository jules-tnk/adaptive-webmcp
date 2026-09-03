declare module "ts-expect" {
  export type TypeEqual<Left, Right> = [Left] extends [Right]
    ? [Right] extends [Left]
      ? true
      : false
    : false;
}
