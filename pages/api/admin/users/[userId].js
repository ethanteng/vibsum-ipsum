import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.email !== "ethan+vybescript@ethanteng.com") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { userId } = req.query;
  if (req.method === "DELETE") {
    // Delete user and all related data (tokens, campaigns)
    await prisma.user.delete({ where: { id: userId } });
    return res.status(204).end();
  }
  res.setHeader("Allow", ["DELETE"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
} 