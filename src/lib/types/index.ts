export interface Chrome {
  runtime: {
    sendMessage: (message: any, callback?: (response: any) => void) => void;
  };
}