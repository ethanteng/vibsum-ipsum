import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.email !== "ethan+vybescript@ethanteng.com") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        mailchimpToken: { select: { id: true } },
        intercomToken: { select: { id: true } },
        campaigns: { select: { id: true, prompt: true, result: true, createdAt: true } },
      },
    });
    const result = users.map(u => {
      const mostRecentPrompt = u.campaigns.reduce((latest, c) => {
        if (!latest || new Date(c.createdAt) > new Date(latest.createdAt)) return c;
        return latest;
      }, null);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        mailchimpConnected: !!u.mailchimpToken,
        intercomConnected: !!u.intercomToken,
        promptCount: u.campaigns.length,
        mostRecentPromptAt: mostRecentPrompt ? mostRecentPrompt.createdAt : null,
        prompts: u.campaigns.map(c => ({ id: c.id, prompt: c.prompt, result: c.result, createdAt: c.createdAt }))
      };
    });
    return res.json({ users: result });
  }
  res.setHeader("Allow", ["GET"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 