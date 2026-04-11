import { inferDomain } from "./src/services/analysis/domainDetector.js";

const publicSeva = [
  "JavaScript", "HTML", "CSS", "React", "Node.js", "Express", "MongoDB", "Tailwind", "Mongoose"
];
console.log("PublicSeva:", inferDomain({ techStack: publicSeva, languages: publicSeva }));

const financeHub = [
  "TypeScript", "Python", "CSS", "JavaScript"
];
console.log("FinanceHub:", inferDomain({ techStack: financeHub, languages: financeHub }));

const fitfusionn = [
  "Kotlin", "Firebase", "REST", "Java"
];
console.log("FITFUSIONN:", inferDomain({ techStack: fitfusionn, languages: fitfusionn }));

const victor = [
  "TypeScript", "JavaScript", "CSS", "Next.js"
];
console.log("Victor:", inferDomain({ techStack: victor, languages: victor }));

const metaPDF = [
  "Python", "HTML", "CSS", "JavaScript"
];
console.log("MetaPDF:", inferDomain({ techStack: metaPDF, languages: metaPDF }));
