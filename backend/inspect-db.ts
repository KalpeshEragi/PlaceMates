import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.project.findFirst({where: {name: 'PublicSeva'}}).then(proj => console.log(JSON.stringify(proj, null, 2))).finally(() => p.$disconnect());
