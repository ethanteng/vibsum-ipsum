import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = session.user.id;

  if (req.method === "GET") {
    // Fetch all campaigns for this user, newest first
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        prompt: true,
        result: true,
        createdAt: true,
      },
    });
    res.json({ campaigns });
  } else if (req.method === "POST") {
    const { prompt, result } = req.body;
    if (!prompt || !result) {
      return res.status(400).json({ error: "Missing prompt or result" });
    }
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        prompt,
        result: typeof result === "string" ? result : JSON.stringify(result),
      },
      select: {
        id: true,
        prompt: true,
        result: true,
        createdAt: true,
      },
    });
    res.status(201).json({ campaign });
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 