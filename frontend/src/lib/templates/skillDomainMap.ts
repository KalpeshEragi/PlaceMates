/**
 * skillDomainMap.ts
 *
 * Maps common technology names to logical domain groups for portfolio display.
 * Categories: Frontend, Backend, Programming Languages, Databases, DevOps, AI/ML, Project Management, Other
 * Falls back to "Other" if no match is found.
 */

export type SkillDomain =
  | "Frontend"
  | "Backend"
  | "Programming Languages"
  | "Databases"
  | "DevOps"
  | "AI/ML"
  | "Project Management"
  | "Other";

const SKILL_MAP: Record<string, SkillDomain> = {
  // ── Frontend ──────────────────────────────────────────────────
  react: "Frontend", "react.js": "Frontend", "react native": "Frontend",
  next: "Frontend", "next.js": "Frontend", nextjs: "Frontend",
  vue: "Frontend", "vue.js": "Frontend", vuejs: "Frontend",
  nuxt: "Frontend", "nuxt.js": "Frontend",
  angular: "Frontend",
  svelte: "Frontend", "svelte kit": "Frontend", sveltekit: "Frontend",
  html: "Frontend", html5: "Frontend",
  css: "Frontend", css3: "Frontend",
  sass: "Frontend", scss: "Frontend", less: "Frontend",
  tailwind: "Frontend", tailwindcss: "Frontend", "tailwind css": "Frontend",
  bootstrap: "Frontend",
  "material ui": "Frontend", mui: "Frontend",
  "chakra ui": "Frontend",
  "ant design": "Frontend", antd: "Frontend",
  "styled components": "Frontend", emotion: "Frontend",
  redux: "Frontend", zustand: "Frontend", recoil: "Frontend", mobx: "Frontend",
  webpack: "Frontend", vite: "Frontend", parcel: "Frontend", rollup: "Frontend",
  jquery: "Frontend",
  "framer motion": "Frontend", gsap: "Frontend",
  "three.js": "Frontend", threejs: "Frontend",
  d3: "Frontend", "d3.js": "Frontend", "chart.js": "Frontend",
  storybook: "Frontend", figma: "Frontend",
  flutter: "Frontend", ionic: "Frontend", capacitor: "Frontend", cordova: "Frontend", expo: "Frontend",

  // ── Backend ───────────────────────────────────────────────────
  node: "Backend", "node.js": "Backend", nodejs: "Backend",
  express: "Backend", "express.js": "Backend", expressjs: "Backend",
  fastify: "Backend", koa: "Backend", hapi: "Backend",
  nestjs: "Backend", "nest.js": "Backend",
  django: "Backend", flask: "Backend", fastapi: "Backend",
  spring: "Backend", "spring boot": "Backend", springboot: "Backend",
  rails: "Backend", "ruby on rails": "Backend",
  laravel: "Backend", symfony: "Backend",
  gin: "Backend", fiber: "Backend",
  actix: "Backend", axum: "Backend",
  ".net": "Backend", "asp.net": "Backend", dotnet: "Backend",
  graphql: "Backend", grpc: "Backend", rest: "Backend", "rest api": "Backend",
  prisma: "Backend", drizzle: "Backend", sequelize: "Backend", typeorm: "Backend",
  socket: "Backend", "socket.io": "Backend", websocket: "Backend",
  kafka: "Backend", rabbitmq: "Backend",
  nginx: "Backend", apache: "Backend",
  jwt: "Backend", oauth: "Backend", passport: "Backend",

  // ── Programming Languages ─────────────────────────────────────
  javascript: "Programming Languages", typescript: "Programming Languages",
  python: "Programming Languages",
  java: "Programming Languages", kotlin: "Programming Languages", scala: "Programming Languages",
  "c": "Programming Languages", "c++": "Programming Languages", "c#": "Programming Languages",
  go: "Programming Languages", golang: "Programming Languages",
  rust: "Programming Languages",
  ruby: "Programming Languages", php: "Programming Languages",
  swift: "Programming Languages", swiftui: "Programming Languages",
  "objective-c": "Programming Languages",
  dart: "Programming Languages",
  r: "Programming Languages", matlab: "Programming Languages",
  lua: "Programming Languages", perl: "Programming Languages",
  haskell: "Programming Languages", elixir: "Programming Languages", erlang: "Programming Languages",
  clojure: "Programming Languages", "f#": "Programming Languages",
  assembly: "Programming Languages", zig: "Programming Languages",
  solidity: "Programming Languages",

  // ── Databases ─────────────────────────────────────────────────
  postgresql: "Databases", postgres: "Databases",
  mysql: "Databases", mariadb: "Databases",
  mongodb: "Databases", mongo: "Databases",
  sqlite: "Databases",
  firebase: "Databases", firestore: "Databases",
  supabase: "Databases", "neon db": "Databases", neon: "Databases",
  dynamodb: "Databases", cassandra: "Databases", couchdb: "Databases",
  redis: "Databases",
  elasticsearch: "Databases", "elastic search": "Databases",
  pinecone: "Databases", weaviate: "Databases", chroma: "Databases",
  sql: "Databases", nosql: "Databases",

  // ── DevOps ────────────────────────────────────────────────────
  docker: "DevOps", kubernetes: "DevOps", k8s: "DevOps",
  aws: "DevOps", azure: "DevOps", gcp: "DevOps", "google cloud": "DevOps",
  terraform: "DevOps", ansible: "DevOps", puppet: "DevOps",
  jenkins: "DevOps", "github actions": "DevOps", "ci/cd": "DevOps",
  "gitlab ci": "DevOps", circleci: "DevOps",
  linux: "DevOps", bash: "DevOps", shell: "DevOps",
  vercel: "DevOps", netlify: "DevOps", heroku: "DevOps",
  cloudflare: "DevOps", digitalocean: "DevOps",
  prometheus: "DevOps", grafana: "DevOps", datadog: "DevOps",
  git: "DevOps", github: "DevOps", gitlab: "DevOps",

  // ── AI/ML ─────────────────────────────────────────────────────
  tensorflow: "AI/ML", pytorch: "AI/ML", keras: "AI/ML",
  scikit: "AI/ML", "scikit-learn": "AI/ML", sklearn: "AI/ML",
  numpy: "AI/ML", pandas: "AI/ML", scipy: "AI/ML",
  opencv: "AI/ML", "computer vision": "AI/ML",
  nlp: "AI/ML", "natural language processing": "AI/ML",
  transformers: "AI/ML", "hugging face": "AI/ML", huggingface: "AI/ML",
  langchain: "AI/ML", openai: "AI/ML", gpt: "AI/ML",
  "machine learning": "AI/ML", "deep learning": "AI/ML",
  jupyter: "AI/ML", "jupyter notebook": "AI/ML",
  matplotlib: "AI/ML", seaborn: "AI/ML", plotly: "AI/ML",
  "stable diffusion": "AI/ML", llm: "AI/ML",
  rag: "AI/ML", "vector db": "AI/ML",

  // ── Project Management ────────────────────────────────────────
  jira: "Project Management", trello: "Project Management",
  asana: "Project Management", notion: "Project Management",
  confluence: "Project Management", slack: "Project Management",
  scrum: "Project Management", agile: "Project Management",
  kanban: "Project Management", "project management": "Project Management",
  monday: "Project Management", clickup: "Project Management",
  linear: "Project Management", basecamp: "Project Management",
  miro: "Project Management", "microsoft teams": "Project Management",
};

/**
 * Get the domain group for a given skill name.
 * Case-insensitive matching.
 */
export function getSkillDomain(skillName: string): SkillDomain {
  const key = skillName.toLowerCase().trim();
  return SKILL_MAP[key] ?? "Other";
}

/**
 * Group an array of skill names into domain buckets.
 */
export function groupSkillsByDomain(
  skills: string[],
): Record<SkillDomain, string[]> {
  const groups: Record<SkillDomain, string[]> = {
    Frontend: [],
    Backend: [],
    "Programming Languages": [],
    Databases: [],
    DevOps: [],
    "AI/ML": [],
    "Project Management": [],
    Other: [],
  };

  for (const skill of skills) {
    const domain = getSkillDomain(skill);
    groups[domain].push(skill);
  }

  return groups;
}

/** Domain label → icon mapping (emoji-based for universal rendering) */
export const DOMAIN_ICONS: Record<SkillDomain, string> = {
  Frontend: "🎨",
  Backend: "⚙️",
  "Programming Languages": "🧑‍💻",
  Databases: "🗄️",
  DevOps: "☁️",
  "AI/ML": "🧠",
  "Project Management": "📋",
  Other: "🔧",
};
