import { z } from "zod";
export const logSchema = z.object({
  username: z.string().min(1, "Too short.").min(2, "NNore is better!"),
  password: z.string().min(10, "Too short!"),
});

export type logType = z.infer<typeof logSchema>;
