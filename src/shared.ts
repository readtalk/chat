import { createSubjects } from "@openauthjs/openauth/subject";
import { object, string } from "valibot";

export type ChatMessage = {
  id: string;
  content: string;
  user: string;
  role: "user" | "assistant";
};

export type Message =
  | {
      type: "add";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
    }
  | {
      type: "update";
      id: string;
      content: string;
      user: string;
      role: "user" | "assistant";
    }
  | {
      type: "all";
      messages: ChatMessage[];
    };

export const subjects = createSubjects({
  user: object({
    id: string(),
  }),
});
