import { PrismaClient } from "@prisma/client";
import { inferDomain } from "./src/services/analysis/domainDetector.js";

const prisma = new PrismaClient();

async function run() {
  const projects = await prisma.project.findMany();
  let updated = 0;
  for (const proj of projects) {
    // re-infer the domain purely based on techStack currently saved in db
    const domain = inferDomain({
      techStack: proj.techStack as string[],
      languages: proj.techStack as string[], // approximate
    });
    
    // update db if different (and skip null if it couldn't infer)
    if (domain && domain !== proj.domain) {
      await prisma.project.update({
        where: { id: proj.id },
        data: { domain },
      });
      updated++;
      console.log(`Updated ${proj.name} -> ${domain}`);
    }
  }
  console.log(`Finished checking ${projects.length} projects. Updated ${updated}.`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
