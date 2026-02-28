import { z } from "zod";
export const logSchema = z.object({
  username: z.string().min(1, "Nope.").min(2, "Nada!"),
  password: z.string().min(10, "Nope!"),
});

export type logType = z.infer<typeof logSchema>;
