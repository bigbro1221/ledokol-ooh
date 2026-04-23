declare module 'sns-validator' {
  type SnsMessage = Record<string, string>;
  type ValidateCallback = (err: Error | null, message: SnsMessage) => void;

  class MessageValidator {
    validate(message: SnsMessage, callback: ValidateCallback): void;
  }

  export = MessageValidator;
}
