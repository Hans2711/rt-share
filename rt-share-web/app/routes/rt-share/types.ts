// src/routes/rt-share/types.ts
export interface User {
  id: string;
  ip: string;
  isOnline: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isFile?: boolean;
  filename?: string;
}
