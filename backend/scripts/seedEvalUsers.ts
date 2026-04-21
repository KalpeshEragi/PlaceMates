/**
 * seedEvalUsers.ts
 *
 * Full-flow seed script for PlaceMates evaluation pipeline.
 *
 * Creates:
 *   - 10 synthetic users with diverse profiles (skills, projects, experience, education)
 *   - 15 synthetic jobs with diverse descriptions
 *   - Embeddings for each user (via embedding service at localhost:8100)
 *   - Embeddings for each job (stored in FAISS via embedding service)
 *   - Triggers the REAL semantic matching pipeline for each user → unbiased JobMatch records
 *
 * Usage:
 *   npx tsx scripts/seedEvalUsers.ts
 *
 * Prerequisites:
 *   - Embedding service running at http://localhost:8100
 *   - Database accessible via DATABASE_URL in .env
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:8100";

// ────────────────────────────────────────────────────────────
// MOCK DATA
// ────────────────────────────────────────────────────────────

interface MockUser {
  email: string;
  name: string;
  primaryDomain: string;
  summaryText: string;
  skills: Array<{ name: string; domain: string; source: string }>;
  projects: Array<{
    name: string;
    repoUrl: string;
    domain: string;
    techStack: string[];
    description: string;
    projectType: string;
  }>;
  experiences: Array<{
    role: string;
    company: string;
    startDate: string;
    endDate: string | null;
    description: string;
  }>;
  educations: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
  }>;
  jobPreferences: {
    primaryRole: string;
    secondaryRoles: string[];
    workType: string;
    locations: string[];
    minSalary: number;
    currency: string;
    experienceLevel: string;
    jobType: string;
  };
}

const MOCK_USERS: MockUser[] = [
  // ── 1. Full Stack Developer ──────────────────────────────
  {
    email: "alex.sharma@evaltest.com",
    name: "Alex Sharma",
    primaryDomain: "Full Stack",
    summaryText:
      "Full-stack developer with 3+ years of experience building scalable web applications using React, Node.js, and PostgreSQL. Proficient in CI/CD pipelines, Docker, and cloud deployments on AWS. Passionate about clean architecture, test-driven development, and delivering polished user experiences.",
    skills: [
      { name: "React", domain: "Frontend", source: "github" },
      { name: "Node.js", domain: "Backend", source: "github" },
      { name: "TypeScript", domain: "Frontend", source: "github" },
      { name: "PostgreSQL", domain: "Backend", source: "github" },
      { name: "Docker", domain: "DevOps", source: "github" },
      { name: "AWS", domain: "DevOps", source: "linkedin" },
      { name: "GraphQL", domain: "Backend", source: "github" },
      { name: "Tailwind CSS", domain: "Frontend", source: "github" },
    ],
    projects: [
      {
        name: "TaskFlow",
        repoUrl: "https://github.com/alexsharma/taskflow",
        domain: "Full Stack",
        techStack: ["React", "Node.js", "PostgreSQL", "Docker"],
        description:
          "A real-time project management tool with Kanban boards, team collaboration features, and automated sprint tracking. Serves 500+ daily active users with 99.9% uptime.",
        projectType: "solo",
      },
      {
        name: "ShopEase API",
        repoUrl: "https://github.com/alexsharma/shopease-api",
        domain: "Backend",
        techStack: ["Express", "MongoDB", "Redis", "Stripe"],
        description:
          "RESTful e-commerce API with payment integration, inventory management, and order tracking. Handles 10K+ transactions per day.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "Full Stack Developer",
        company: "TechNova Solutions",
        startDate: "Jul 2022",
        endDate: null,
        description:
          "Lead development of client-facing dashboards using React and Node.js. Reduced page load times by 40% through code splitting and lazy loading. Implemented CI/CD pipeline with GitHub Actions.",
      },
      {
        role: "Junior Developer",
        company: "WebCraft Studios",
        startDate: "Jan 2021",
        endDate: "Jun 2022",
        description:
          "Built responsive web applications using React and Express. Migrated legacy jQuery codebase to modern React components, improving maintainability by 60%.",
      },
    ],
    educations: [
      {
        institution: "Indian Institute of Technology, Bombay",
        degree: "B.Tech",
        field: "Computer Science",
        startDate: "2017",
        endDate: "2021",
      },
    ],
    jobPreferences: {
      primaryRole: "Full Stack Developer",
      secondaryRoles: ["Frontend Developer", "Backend Developer"],
      workType: "remote",
      locations: ["Bangalore", "Mumbai", "Remote"],
      minSalary: 1200000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 2. Backend Engineer ──────────────────────────────────
  {
    email: "priya.patel@evaltest.com",
    name: "Priya Patel",
    primaryDomain: "Backend",
    summaryText:
      "Backend engineer specializing in distributed systems, microservices architecture, and high-throughput data pipelines. Expert in Go, Python, and Kubernetes with experience building systems that handle millions of requests per day. Strong advocate for observability and SRE best practices.",
    skills: [
      { name: "Go", domain: "Backend", source: "github" },
      { name: "Python", domain: "Backend", source: "github" },
      { name: "Kubernetes", domain: "DevOps", source: "github" },
      { name: "gRPC", domain: "Backend", source: "github" },
      { name: "Redis", domain: "Backend", source: "github" },
      { name: "Kafka", domain: "Backend", source: "github" },
      { name: "PostgreSQL", domain: "Backend", source: "github" },
      { name: "Prometheus", domain: "DevOps", source: "linkedin" },
      { name: "Terraform", domain: "DevOps", source: "linkedin" },
    ],
    projects: [
      {
        name: "EventStream",
        repoUrl: "https://github.com/priyapatel/eventstream",
        domain: "Backend",
        techStack: ["Go", "Kafka", "PostgreSQL", "Redis"],
        description:
          "Distributed event streaming platform processing 2M+ events/day with exactly-once delivery guarantees and sub-10ms p99 latency.",
        projectType: "solo",
      },
      {
        name: "K8s-AutoScaler",
        repoUrl: "https://github.com/priyapatel/k8s-autoscaler",
        domain: "DevOps",
        techStack: ["Go", "Kubernetes", "Prometheus"],
        description:
          "Custom Kubernetes HPA controller with ML-based predictive scaling, reducing cloud costs by 35% while maintaining SLA compliance.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "Senior Backend Engineer",
        company: "ScaleUp Technologies",
        startDate: "Mar 2021",
        endDate: null,
        description:
          "Architected and deployed microservices handling 5M+ daily API calls. Led migration from monolith to event-driven microservices using Kafka and gRPC, improving system reliability from 99.5% to 99.99%.",
      },
      {
        role: "Backend Developer",
        company: "DataPulse Inc.",
        startDate: "Aug 2019",
        endDate: "Feb 2021",
        description:
          "Built high-throughput data ingestion pipelines in Python and Go. Designed Redis caching layer reducing database load by 70%.",
      },
    ],
    educations: [
      {
        institution: "National Institute of Technology, Trichy",
        degree: "B.Tech",
        field: "Computer Science and Engineering",
        startDate: "2015",
        endDate: "2019",
      },
    ],
    jobPreferences: {
      primaryRole: "Backend Engineer",
      secondaryRoles: ["Platform Engineer", "SRE"],
      workType: "hybrid",
      locations: ["Bangalore", "Hyderabad"],
      minSalary: 2000000,
      currency: "INR",
      experienceLevel: "Senior",
      jobType: "full-time",
    },
  },

  // ── 3. Frontend Developer ────────────────────────────────
  {
    email: "rohan.kumar@evaltest.com",
    name: "Rohan Kumar",
    primaryDomain: "Frontend",
    summaryText:
      "Frontend developer passionate about creating beautiful, accessible, and performant user interfaces. Expert in React, Next.js, and modern CSS with a strong eye for design. Experienced in building design systems, component libraries, and complex data visualization dashboards.",
    skills: [
      { name: "React", domain: "Frontend", source: "github" },
      { name: "Next.js", domain: "Frontend", source: "github" },
      { name: "TypeScript", domain: "Frontend", source: "github" },
      { name: "CSS", domain: "Frontend", source: "github" },
      { name: "Figma", domain: "Frontend", source: "linkedin" },
      { name: "D3.js", domain: "Frontend", source: "github" },
      { name: "Storybook", domain: "Frontend", source: "github" },
      { name: "Jest", domain: "Frontend", source: "github" },
      { name: "Webpack", domain: "Frontend", source: "github" },
    ],
    projects: [
      {
        name: "DesignKit",
        repoUrl: "https://github.com/rohankumar/designkit",
        domain: "Frontend",
        techStack: ["React", "TypeScript", "Storybook", "CSS Modules"],
        description:
          "Open-source React component library with 50+ accessible components, dark mode support, and comprehensive Storybook documentation. 800+ GitHub stars.",
        projectType: "solo",
      },
      {
        name: "DataViz Pro",
        repoUrl: "https://github.com/rohankumar/dataviz-pro",
        domain: "Frontend",
        techStack: ["React", "D3.js", "TypeScript", "WebSocket"],
        description:
          "Real-time data visualization dashboard with interactive charts, drill-down capabilities, and WebSocket-powered live updates.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "Senior Frontend Developer",
        company: "PixelPerfect Labs",
        startDate: "Jun 2021",
        endDate: null,
        description:
          "Led the frontend team of 5 developers building a SaaS analytics platform. Architected the design system used across 3 product lines. Improved Core Web Vitals to green scores across all pages.",
      },
      {
        role: "Frontend Developer",
        company: "StartupVerse",
        startDate: "Jan 2020",
        endDate: "May 2021",
        description:
          "Built consumer-facing web applications in React with Next.js SSR. Implemented A/B testing framework that increased conversion rates by 25%.",
      },
    ],
    educations: [
      {
        institution: "BITS Pilani",
        degree: "B.E.",
        field: "Information Technology",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "Frontend Developer",
      secondaryRoles: ["UI Engineer", "Full Stack Developer"],
      workType: "remote",
      locations: ["Remote", "Bangalore", "Pune"],
      minSalary: 1500000,
      currency: "INR",
      experienceLevel: "Senior",
      jobType: "full-time",
    },
  },

  // ── 4. AI/ML Engineer ────────────────────────────────────
  {
    email: "ananya.gupta@evaltest.com",
    name: "Ananya Gupta",
    primaryDomain: "ML",
    summaryText:
      "AI/ML engineer with deep expertise in natural language processing, transformer architectures, and production ML systems. Published research in ACL and EMNLP. Experienced in fine-tuning large language models, building RAG pipelines, and deploying models at scale using MLflow and AWS SageMaker.",
    skills: [
      { name: "Python", domain: "ML", source: "github" },
      { name: "PyTorch", domain: "ML", source: "github" },
      { name: "TensorFlow", domain: "ML", source: "github" },
      { name: "Hugging Face", domain: "ML", source: "github" },
      { name: "LangChain", domain: "ML", source: "github" },
      { name: "MLflow", domain: "ML", source: "github" },
      { name: "FastAPI", domain: "Backend", source: "github" },
      { name: "Docker", domain: "DevOps", source: "github" },
      { name: "AWS SageMaker", domain: "ML", source: "linkedin" },
    ],
    projects: [
      {
        name: "SmartSummarizer",
        repoUrl: "https://github.com/ananyagupta/smart-summarizer",
        domain: "ML",
        techStack: ["Python", "PyTorch", "Hugging Face", "FastAPI"],
        description:
          "Fine-tuned BART model for multi-document summarization achieving 42.3 ROUGE-L on CNN/DailyMail. Deployed as a FastAPI microservice with batch inference support.",
        projectType: "solo",
      },
      {
        name: "RAG-QA Engine",
        repoUrl: "https://github.com/ananyagupta/rag-qa-engine",
        domain: "ML",
        techStack: ["Python", "LangChain", "ChromaDB", "OpenAI"],
        description:
          "Retrieval-Augmented Generation Q&A system for enterprise knowledge bases. Supports hybrid search (semantic + keyword), context-aware re-ranking, and citation extraction.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "ML Engineer",
        company: "AIFirst Labs",
        startDate: "Sep 2021",
        endDate: null,
        description:
          "Built production NLP pipelines for sentiment analysis and named entity recognition serving 1M+ daily predictions. Fine-tuned LLMs for domain-specific tasks. Led the MLOps transformation using MLflow and DVC.",
      },
      {
        role: "Research Intern",
        company: "Microsoft Research India",
        startDate: "May 2020",
        endDate: "Aug 2021",
        description:
          "Researched cross-lingual transfer learning for low-resource Indian languages. Published paper at ACL 2021 on multilingual NER with zero-shot transfer.",
      },
    ],
    educations: [
      {
        institution: "Indian Institute of Science, Bangalore",
        degree: "M.Tech",
        field: "Artificial Intelligence",
        startDate: "2019",
        endDate: "2021",
      },
    ],
    jobPreferences: {
      primaryRole: "ML Engineer",
      secondaryRoles: ["AI Engineer", "NLP Engineer", "Research Scientist"],
      workType: "hybrid",
      locations: ["Bangalore", "Hyderabad", "Remote"],
      minSalary: 2500000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 5. Data Analyst ──────────────────────────────────────
  {
    email: "vikram.singh@evaltest.com",
    name: "Vikram Singh",
    primaryDomain: "Data",
    summaryText:
      "Data analyst with strong SQL skills, experience in Python data analysis, and expertise in building dashboards with Tableau and Power BI. Skilled at translating complex business requirements into actionable insights. Experience in A/B testing, cohort analysis, and predictive modeling for e-commerce and fintech domains.",
    skills: [
      { name: "SQL", domain: "Data", source: "github" },
      { name: "Python", domain: "Data", source: "github" },
      { name: "Pandas", domain: "Data", source: "github" },
      { name: "Tableau", domain: "Data", source: "linkedin" },
      { name: "Power BI", domain: "Data", source: "linkedin" },
      { name: "Excel", domain: "Data", source: "linkedin" },
      { name: "R", domain: "Data", source: "github" },
      { name: "Scikit-learn", domain: "ML", source: "github" },
    ],
    projects: [
      {
        name: "SalesInsight Dashboard",
        repoUrl: "https://github.com/vikramsingh/sales-insight",
        domain: "Data",
        techStack: ["Python", "Pandas", "Plotly", "PostgreSQL"],
        description:
          "Interactive sales analytics dashboard tracking KPIs, revenue trends, and customer segmentation. Used by a 20-person sales team to optimize pipeline management.",
        projectType: "solo",
      },
      {
        name: "ChurnPredictor",
        repoUrl: "https://github.com/vikramsingh/churn-predictor",
        domain: "Data",
        techStack: ["Python", "Scikit-learn", "XGBoost", "Flask"],
        description:
          "ML-powered customer churn prediction model achieving 89% accuracy. Integrated with CRM via REST API to provide real-time risk scores.",
        projectType: "solo",
      },
    ],
    experiences: [
      {
        role: "Data Analyst",
        company: "FinEdge Analytics",
        startDate: "Apr 2022",
        endDate: null,
        description:
          "Built automated reporting pipelines processing 10M+ rows daily. Created executive dashboards in Tableau reducing report generation time from 2 days to 15 minutes. Conducted A/B tests that increased user engagement by 18%.",
      },
      {
        role: "Junior Data Analyst",
        company: "RetailMax",
        startDate: "Jul 2020",
        endDate: "Mar 2022",
        description:
          "Performed cohort analysis and customer lifetime value modeling. Built SQL-based ETL pipelines for the data warehouse.",
      },
    ],
    educations: [
      {
        institution: "Delhi University",
        degree: "B.Sc.",
        field: "Statistics",
        startDate: "2017",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "Data Analyst",
      secondaryRoles: ["Business Analyst", "Analytics Engineer"],
      workType: "hybrid",
      locations: ["Delhi", "Gurgaon", "Noida"],
      minSalary: 900000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 6. DevOps / Cloud Engineer ───────────────────────────
  {
    email: "meera.nair@evaltest.com",
    name: "Meera Nair",
    primaryDomain: "DevOps",
    summaryText:
      "DevOps engineer with deep expertise in AWS cloud infrastructure, CI/CD pipelines, and infrastructure-as-code. Certified AWS Solutions Architect. Experienced in managing Kubernetes clusters, implementing GitOps workflows, and building secure, scalable cloud-native architectures.",
    skills: [
      { name: "AWS", domain: "DevOps", source: "github" },
      { name: "Terraform", domain: "DevOps", source: "github" },
      { name: "Kubernetes", domain: "DevOps", source: "github" },
      { name: "Docker", domain: "DevOps", source: "github" },
      { name: "GitHub Actions", domain: "DevOps", source: "github" },
      { name: "Jenkins", domain: "DevOps", source: "linkedin" },
      { name: "Python", domain: "Backend", source: "github" },
      { name: "Ansible", domain: "DevOps", source: "github" },
      { name: "ArgoCD", domain: "DevOps", source: "github" },
    ],
    projects: [
      {
        name: "InfraBlueprint",
        repoUrl: "https://github.com/meeranair/infra-blueprint",
        domain: "DevOps",
        techStack: ["Terraform", "AWS", "Kubernetes", "ArgoCD"],
        description:
          "Production-grade IaC template for AWS EKS clusters with GitOps-based deployments, auto-scaling, monitoring with Prometheus/Grafana, and security hardening.",
        projectType: "solo",
      },
    ],
    experiences: [
      {
        role: "DevOps Engineer",
        company: "CloudFirst India",
        startDate: "Jan 2021",
        endDate: null,
        description:
          "Managed AWS infrastructure for 15+ microservices. Reduced deployment time from 45 minutes to 5 minutes through automated CI/CD. Cut cloud costs by 40% via right-sizing and spot instances.",
      },
    ],
    educations: [
      {
        institution: "Kerala University",
        degree: "B.Tech",
        field: "Computer Science",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "DevOps Engineer",
      secondaryRoles: ["Cloud Engineer", "SRE", "Platform Engineer"],
      workType: "remote",
      locations: ["Remote", "Bangalore", "Chennai"],
      minSalary: 1800000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 7. Mobile Developer ──────────────────────────────────
  {
    email: "arjun.das@evaltest.com",
    name: "Arjun Das",
    primaryDomain: "Mobile",
    summaryText:
      "Mobile developer specializing in React Native and Flutter cross-platform development. Built apps with 100K+ downloads on Play Store. Experienced in offline-first architectures, push notifications, and in-app purchases. Strong background in UI/UX design for mobile interfaces.",
    skills: [
      { name: "React Native", domain: "Mobile", source: "github" },
      { name: "Flutter", domain: "Mobile", source: "github" },
      { name: "TypeScript", domain: "Frontend", source: "github" },
      { name: "Dart", domain: "Mobile", source: "github" },
      { name: "Firebase", domain: "Backend", source: "github" },
      { name: "Swift", domain: "Mobile", source: "github" },
      { name: "Kotlin", domain: "Mobile", source: "github" },
      { name: "Redux", domain: "Frontend", source: "github" },
    ],
    projects: [
      {
        name: "FitTrack",
        repoUrl: "https://github.com/arjundas/fittrack",
        domain: "Mobile",
        techStack: ["React Native", "TypeScript", "Firebase", "Redux"],
        description:
          "Cross-platform fitness tracking app with workout plans, nutrition logging, and social challenges. 50K+ downloads with 4.5-star rating on Play Store.",
        projectType: "solo",
      },
      {
        name: "QuickChat",
        repoUrl: "https://github.com/arjundas/quickchat",
        domain: "Mobile",
        techStack: ["Flutter", "Dart", "Firebase", "WebRTC"],
        description:
          "Real-time messaging app with end-to-end encryption, voice/video calls, and offline message queuing.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "Mobile Developer",
        company: "AppForge Studios",
        startDate: "Aug 2021",
        endDate: null,
        description:
          "Led mobile development for 3 client projects using React Native. Implemented offline-first architecture with SQLite sync. Reduced app crash rate from 2.5% to 0.3%.",
      },
      {
        role: "Junior Mobile Developer",
        company: "MobiWorks",
        startDate: "Feb 2020",
        endDate: "Jul 2021",
        description:
          "Developed Flutter apps for e-commerce clients. Built reusable widget library reducing development time by 30%.",
      },
    ],
    educations: [
      {
        institution: "VIT Vellore",
        degree: "B.Tech",
        field: "Computer Science",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "Mobile Developer",
      secondaryRoles: ["React Native Developer", "Flutter Developer"],
      workType: "hybrid",
      locations: ["Bangalore", "Chennai", "Pune"],
      minSalary: 1400000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 8. Security Engineer ─────────────────────────────────
  {
    email: "deepa.menon@evaltest.com",
    name: "Deepa Menon",
    primaryDomain: "Security",
    summaryText:
      "Application security engineer with expertise in penetration testing, SAST/DAST tooling, and secure SDLC practices. CEH and OSCP certified. Experienced in building security automation pipelines, conducting threat modeling sessions, and implementing zero-trust architectures. Active CTF competitor.",
    skills: [
      { name: "Python", domain: "Backend", source: "github" },
      { name: "Burp Suite", domain: "Security", source: "linkedin" },
      { name: "Docker", domain: "DevOps", source: "github" },
      { name: "AWS", domain: "DevOps", source: "linkedin" },
      { name: "OWASP", domain: "Security", source: "linkedin" },
      { name: "Terraform", domain: "DevOps", source: "github" },
      { name: "Go", domain: "Backend", source: "github" },
      { name: "Kubernetes", domain: "DevOps", source: "github" },
    ],
    projects: [
      {
        name: "VulnScanner",
        repoUrl: "https://github.com/deepamenon/vulnscanner",
        domain: "Security",
        techStack: ["Python", "Docker", "OWASP ZAP", "PostgreSQL"],
        description:
          "Automated vulnerability scanning pipeline that integrates with CI/CD to catch OWASP Top-10 issues before deployment. Reduced security incidents by 60%.",
        projectType: "solo",
      },
    ],
    experiences: [
      {
        role: "Security Engineer",
        company: "CyberShield India",
        startDate: "May 2021",
        endDate: null,
        description:
          "Lead application security assessments for 20+ microservices. Implemented SAST/DAST scanning in CI/CD pipeline catching 95% of vulnerabilities before production. Designed zero-trust network architecture.",
      },
    ],
    educations: [
      {
        institution: "Manipal Institute of Technology",
        degree: "B.Tech",
        field: "Information Technology",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "Security Engineer",
      secondaryRoles: [
        "Application Security Engineer",
        "DevSecOps Engineer",
      ],
      workType: "hybrid",
      locations: ["Bangalore", "Mumbai", "Hyderabad"],
      minSalary: 2200000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },

  // ── 9. Data Engineer ─────────────────────────────────────
  {
    email: "karan.joshi@evaltest.com",
    name: "Karan Joshi",
    primaryDomain: "Data",
    summaryText:
      "Data engineer experienced in building and maintaining large-scale data pipelines using Apache Spark, Airflow, and dbt. Expert in data modeling, warehouse design, and real-time streaming with Kafka. Strong background in building data platforms that power analytics and ML workloads.",
    skills: [
      { name: "Python", domain: "Backend", source: "github" },
      { name: "Apache Spark", domain: "Data", source: "github" },
      { name: "Airflow", domain: "Data", source: "github" },
      { name: "SQL", domain: "Data", source: "github" },
      { name: "dbt", domain: "Data", source: "github" },
      { name: "Kafka", domain: "Backend", source: "github" },
      { name: "Snowflake", domain: "Data", source: "linkedin" },
      { name: "AWS", domain: "DevOps", source: "linkedin" },
      { name: "Scala", domain: "Backend", source: "github" },
    ],
    projects: [
      {
        name: "DataForge",
        repoUrl: "https://github.com/karanjoshi/dataforge",
        domain: "Data",
        techStack: ["Python", "Apache Spark", "Airflow", "dbt"],
        description:
          "End-to-end data platform processing 500GB+ daily data volume. Includes automated quality checks, lineage tracking, and self-service analytics layer.",
        projectType: "collaborative",
      },
      {
        name: "StreamProcessor",
        repoUrl: "https://github.com/karanjoshi/stream-processor",
        domain: "Data",
        techStack: ["Scala", "Kafka", "Flink", "Cassandra"],
        description:
          "Real-time data processing engine for event-driven analytics with sub-second latency and exactly-once semantics.",
        projectType: "solo",
      },
    ],
    experiences: [
      {
        role: "Senior Data Engineer",
        company: "DataScale Technologies",
        startDate: "Feb 2021",
        endDate: null,
        description:
          "Architected cloud data platform on AWS serving 50+ analysts. Built automated data quality framework catching 99% of data anomalies. Migrated legacy ETL to modern dbt + Airflow stack, reducing data freshness from 24h to 2h.",
      },
      {
        role: "Data Engineer",
        company: "AnalyticsPro",
        startDate: "Jun 2019",
        endDate: "Jan 2021",
        description:
          "Built Spark-based ETL pipelines for a large e-commerce data warehouse. Optimized queries reducing average dashboard load time from 30s to 3s.",
      },
    ],
    educations: [
      {
        institution: "IIIT Hyderabad",
        degree: "M.Tech",
        field: "Data Science",
        startDate: "2017",
        endDate: "2019",
      },
    ],
    jobPreferences: {
      primaryRole: "Data Engineer",
      secondaryRoles: ["Analytics Engineer", "Platform Engineer"],
      workType: "hybrid",
      locations: ["Hyderabad", "Bangalore", "Remote"],
      minSalary: 2000000,
      currency: "INR",
      experienceLevel: "Senior",
      jobType: "full-time",
    },
  },

  // ── 10. Blockchain / Web3 Developer ──────────────────────
  {
    email: "siddharth.rao@evaltest.com",
    name: "Siddharth Rao",
    primaryDomain: "Web3",
    summaryText:
      "Web3 developer with hands-on experience in Solidity smart contract development, DeFi protocol design, and dApp frontend integration. Proficient in Rust for Solana programs. Built DeFi protocols with $10M+ TVL. Strong understanding of consensus mechanisms, tokenomics, and on-chain governance.",
    skills: [
      { name: "Solidity", domain: "Web3", source: "github" },
      { name: "Rust", domain: "Web3", source: "github" },
      { name: "TypeScript", domain: "Frontend", source: "github" },
      { name: "React", domain: "Frontend", source: "github" },
      { name: "Ethers.js", domain: "Web3", source: "github" },
      { name: "Hardhat", domain: "Web3", source: "github" },
      { name: "Node.js", domain: "Backend", source: "github" },
      { name: "The Graph", domain: "Web3", source: "github" },
    ],
    projects: [
      {
        name: "YieldVault",
        repoUrl: "https://github.com/siddharthrao/yield-vault",
        domain: "Web3",
        techStack: ["Solidity", "Hardhat", "React", "Ethers.js"],
        description:
          "DeFi yield aggregation protocol with auto-compounding vaults and multi-chain support (Ethereum, Polygon, Arbitrum). Audited by CertiK with 0 critical findings.",
        projectType: "solo",
      },
      {
        name: "NFT Marketplace",
        repoUrl: "https://github.com/siddharthrao/nft-marketplace",
        domain: "Web3",
        techStack: ["Solidity", "Next.js", "IPFS", "The Graph"],
        description:
          "Decentralized NFT marketplace with lazy minting, royalty enforcement, and collection-based auctions. Integrated with IPFS for metadata storage.",
        projectType: "collaborative",
      },
    ],
    experiences: [
      {
        role: "Smart Contract Developer",
        company: "DeFi Labs",
        startDate: "Oct 2021",
        endDate: null,
        description:
          "Developed and audited smart contracts for DeFi protocols. Built governance systems, staking mechanisms, and cross-chain bridges. Managed $50M+ in TVL across deployed contracts.",
      },
      {
        role: "Full Stack Developer",
        company: "WebCraft Inc.",
        startDate: "Jan 2020",
        endDate: "Sep 2021",
        description:
          "Built traditional web apps before transitioning to Web3 development. Created dApp frontends using React and Ethers.js.",
      },
    ],
    educations: [
      {
        institution: "PES University, Bangalore",
        degree: "B.Tech",
        field: "Computer Science",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    jobPreferences: {
      primaryRole: "Blockchain Developer",
      secondaryRoles: [
        "Smart Contract Developer",
        "Web3 Developer",
        "Full Stack Developer",
      ],
      workType: "remote",
      locations: ["Remote", "Bangalore"],
      minSalary: 2500000,
      currency: "INR",
      experienceLevel: "Mid",
      jobType: "full-time",
    },
  },
];

// ────────────────────────────────────────────────────────────
// MOCK JOBS (15 diverse jobs)
// ────────────────────────────────────────────────────────────

interface MockJob {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
}

const MOCK_JOBS: MockJob[] = [
  {
    title: "Senior Full Stack Developer",
    company: "Atlassian",
    location: "Bangalore, India (Hybrid)",
    description:
      "We are looking for a Senior Full Stack Developer to build scalable web applications using React, Node.js, and PostgreSQL. You will work on CI/CD pipelines, microservices architecture, and cloud deployments on AWS. Experience with TypeScript, GraphQL, and Docker required. Strong testing skills (Jest, Cypress) preferred.",
    link: "https://jobs.test/atlassian-fullstack-1",
  },
  {
    title: "Backend Engineer - Distributed Systems",
    company: "Google",
    location: "Hyderabad, India",
    description:
      "Join our team building next-gen distributed systems. Requirements: Go or Java, Kubernetes, gRPC, experience with event-driven architectures using Kafka or Pub/Sub. Building systems handling millions of requests daily. Strong foundation in algorithms and system design required.",
    link: "https://jobs.test/google-backend-1",
  },
  {
    title: "Frontend Engineer - Design Systems",
    company: "Figma",
    location: "Remote (India)",
    description:
      "Build the future of design tooling. Looking for a frontend engineer with deep React expertise, experience building component libraries and design systems. TypeScript, CSS-in-JS, accessibility (WCAG 2.1), Storybook experience required. Bonus: D3.js or canvas API experience.",
    link: "https://jobs.test/figma-frontend-1",
  },
  {
    title: "Machine Learning Engineer - NLP",
    company: "Microsoft",
    location: "Bangalore, India (Hybrid)",
    description:
      "Join Microsoft Research India to build production NLP systems. Requirements: PyTorch/TensorFlow, Hugging Face transformers, experience fine-tuning large language models, RAG pipelines, and deploying ML models at scale. Published research is a plus.",
    link: "https://jobs.test/microsoft-ml-1",
  },
  {
    title: "Data Analyst - Business Intelligence",
    company: "Flipkart",
    location: "Bangalore, India",
    description:
      "We need a data analyst to drive business decisions through data. Requirements: SQL expertise, Python (Pandas, NumPy), Tableau or Power BI dashboards, A/B testing experience. Experience with e-commerce metrics, cohort analysis, and predictive modeling is a plus.",
    link: "https://jobs.test/flipkart-data-1",
  },
  {
    title: "DevOps Engineer - Cloud Infrastructure",
    company: "Amazon Web Services",
    location: "Mumbai, India",
    description:
      "Manage and optimize cloud infrastructure for high-scale services. Requirements: AWS certifications, Terraform, Kubernetes, CI/CD (Jenkins/GitHub Actions), monitoring with Prometheus and Grafana. Experience with GitOps, ArgoCD, and cost optimization strategies preferred.",
    link: "https://jobs.test/aws-devops-1",
  },
  {
    title: "Senior Mobile Developer - React Native",
    company: "PhonePe",
    location: "Bangalore, India",
    description:
      "Build world-class mobile experiences for India's leading payments platform. Requirements: React Native expertise, TypeScript, state management (Redux/Zustand), offline-first architectures, push notifications. Experience with performance optimization and native modules preferred.",
    link: "https://jobs.test/phonepe-mobile-1",
  },
  {
    title: "Application Security Engineer",
    company: "Razorpay",
    location: "Bangalore, India (Hybrid)",
    description:
      "Secure our payment infrastructure. Requirements: penetration testing, SAST/DAST tools (SonarQube, OWASP ZAP), threat modeling, secure SDLC practices. CEH or OSCP certification required. Experience with cloud security (AWS), Kubernetes security, and zero-trust architecture.",
    link: "https://jobs.test/razorpay-security-1",
  },
  {
    title: "Senior Data Engineer - Real-time Pipelines",
    company: "Uber",
    location: "Hyderabad, India",
    description:
      "Design and build data pipelines processing petabytes of data. Requirements: Apache Spark, Kafka, Airflow, SQL, dbt. Experience with Snowflake or BigQuery, data quality frameworks, and real-time streaming architectures. Scala or Python proficiency required.",
    link: "https://jobs.test/uber-dataeng-1",
  },
  {
    title: "Blockchain Developer - DeFi",
    company: "Polygon Labs",
    location: "Remote (Global)",
    description:
      "Build the next generation of DeFi protocols on Polygon. Requirements: Solidity, Hardhat/Foundry, EVM internals, DeFi protocol design (AMM, lending, yield). Experience with Rust (Solana) is a plus. Smart contract security auditing experience preferred.",
    link: "https://jobs.test/polygon-web3-1",
  },
  {
    title: "Full Stack Engineer - Fintech",
    company: "Razorpay",
    location: "Bangalore, India",
    description:
      "Build payment infrastructure used by millions. Requirements: React, Node.js, TypeScript, PostgreSQL. Experience with payment gateway integrations, real-time processing, and high-availability systems. Knowledge of PCI-DSS compliance is a bonus.",
    link: "https://jobs.test/razorpay-fullstack-1",
  },
  {
    title: "AI Research Scientist",
    company: "Google DeepMind",
    location: "Bangalore, India",
    description:
      "Conduct cutting-edge AI research. Requirements: PhD or strong publication record in ML, deep learning, NLP, or computer vision. PyTorch expertise, experience with large-scale distributed training. Looking for candidates who can push the boundaries of AI capabilities.",
    link: "https://jobs.test/deepmind-research-1",
  },
  {
    title: "Platform Engineer - Kubernetes",
    company: "Swiggy",
    location: "Bangalore, India (Hybrid)",
    description:
      "Build and maintain our container orchestration platform. Requirements: Kubernetes administration, Helm, ArgoCD, Terraform, AWS/GCP. Experience with service mesh (Istio), observability stack (Prometheus, Grafana, Jaeger), and platform engineering for microservices at scale.",
    link: "https://jobs.test/swiggy-platform-1",
  },
  {
    title: "Flutter Developer",
    company: "CRED",
    location: "Bangalore, India",
    description:
      "Build beautiful mobile experiences for our fintech platform. Requirements: Flutter, Dart, Firebase, state management (BLoC/Riverpod). Experience with animations, custom widgets, and platform-specific integrations. Design sensibility and attention to UI/UX details required.",
    link: "https://jobs.test/cred-flutter-1",
  },
  {
    title: "Data Scientist - Recommendations",
    company: "Netflix",
    location: "Remote (India)",
    description:
      "Build recommendation systems at Netflix scale. Requirements: Python, TensorFlow/PyTorch, collaborative filtering, deep learning for recommendations. Strong statistical foundation, A/B testing experience. Familiarity with Spark for large-scale data processing.",
    link: "https://jobs.test/netflix-datascience-1",
  },
];

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

async function callEmbedProfile(
  userId: string,
  profileText: string,
  profileHash: string,
): Promise<number[] | null> {
  try {
    const res = await fetch(`${EMBEDDING_SERVICE_URL}/embed/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        profile_text: profileText,
        profile_hash: profileHash,
      }),
    });
    if (!res.ok) {
      console.error(
        `  ❌ Embed profile HTTP ${res.status}: ${await res.text()}`,
      );
      return null;
    }
    const data = await res.json();
    return data.embedding as number[];
  } catch (err: any) {
    console.error(`  ❌ Embed profile error: ${err.message}`);
    return null;
  }
}

async function callEmbedBatchJobs(
  jobs: Array<{ job_id: string; text: string }>,
): Promise<boolean> {
  try {
    const res = await fetch(`${EMBEDDING_SERVICE_URL}/embed/batch-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs }),
    });
    if (!res.ok) {
      console.error(
        `  ❌ Embed batch jobs HTTP ${res.status}: ${await res.text()}`,
      );
      return false;
    }
    const data = await res.json();
    console.log(`  ✅ Embedded ${data.count} jobs into FAISS index`);
    return true;
  } catch (err: any) {
    console.error(`  ❌ Embed batch jobs error: ${err.message}`);
    return false;
  }
}

function buildProfileText(user: MockUser): string {
  const parts: string[] = [];
  if (user.primaryDomain) parts.push(`Domain: ${user.primaryDomain}`);
  if (user.summaryText) parts.push(user.summaryText);
  if (user.skills.length > 0) {
    parts.push(`Skills: ${user.skills.map((s) => s.name).join(", ")}`);
  }
  for (const exp of user.experiences) {
    let t = `${exp.role} at ${exp.company}`;
    if (exp.description) t += `: ${exp.description}`;
    parts.push(t);
  }
  for (const proj of user.projects.slice(0, 5)) {
    const tech = proj.techStack.join(", ");
    let t = `Project ${proj.name} (${tech})`;
    if (proj.description) t += `: ${proj.description}`;
    parts.push(t);
  }
  for (const edu of user.educations) {
    parts.push(`${edu.degree} in ${edu.field} from ${edu.institution}`);
  }
  return parts.join(" | ");
}

// ────────────────────────────────────────────────────────────
// MAIN SEED FLOW
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n");
  console.log(
    "╔══════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   PlaceMates — Evaluation Dataset Seed Script           ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════╝",
  );
  console.log("");

  // ── Step 0: Health check ──────────────────────────────────
  console.log("── Step 0: Checking embedding service health ──");
  try {
    const health = await fetch(`${EMBEDDING_SERVICE_URL}/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const hData = await health.json();
    console.log(
      `  ✅ Embedding service healthy (dim=${hData.embedding_dim}, faiss=${hData.faiss_size})`,
    );
  } catch (err: any) {
    console.error(
      `  ❌ Embedding service not reachable at ${EMBEDDING_SERVICE_URL}`,
    );
    console.error(
      `     Make sure it's running: python -m uvicorn app.main:app --port 8100`,
    );
    console.error(`     Error: ${err.message}`);
    process.exit(1);
  }

  // ── Step 1: Create users ──────────────────────────────────
  console.log("\n── Step 1: Creating mock users ──");
  const createdUserIds: string[] = [];

  for (const mockUser of MOCK_USERS) {
    // Check if user already exists (idempotent)
    const existing = await prisma.userAuth.findUnique({
      where: { email: mockUser.email },
    });

    if (existing) {
      console.log(`  ⏭️  User exists: ${mockUser.name} (${existing.id})`);
      createdUserIds.push(existing.id);
      continue;
    }

    // Create UserAuth + UserProfile
    const userAuth = await prisma.userAuth.create({
      data: {
        email: mockUser.email,
        onboardingStage: "complete",
        analysisStatus: "success",
        githubConnected: true,
        linkedinImported: true,
        profile: {
          create: {
            name: mockUser.name,
          },
        },
      },
    });

    const userId = userAuth.id;
    createdUserIds.push(userId);

    // Create Skills
    for (const skill of mockUser.skills) {
      await prisma.skill.create({
        data: {
          userId,
          name: skill.name,
          domain: skill.domain,
          source: skill.source,
        },
      });
    }

    // Create Projects
    for (const proj of mockUser.projects) {
      await prisma.project.create({
        data: {
          userId,
          name: proj.name,
          repoUrl: proj.repoUrl,
          domain: proj.domain,
          projectType: proj.projectType,
          techStack: proj.techStack,
          description: proj.description,
          baseBullets: [],
          finalBullets: [proj.description],
          aiDescription: proj.description,
          aiSkills: proj.techStack,
          aiComplexity: "intermediate",
          rankingScore: Math.random() * 50 + 50, // 50-100
        },
      });
    }

    // Create Experiences
    for (const exp of mockUser.experiences) {
      await prisma.experience.create({
        data: {
          userId,
          role: exp.role,
          company: exp.company,
          startDate: exp.startDate,
          endDate: exp.endDate,
          description: exp.description,
        },
      });
    }

    // Create Education
    for (const edu of mockUser.educations) {
      await prisma.education.create({
        data: {
          userId,
          institution: edu.institution,
          degree: edu.degree,
          field: edu.field,
          startDate: edu.startDate,
          endDate: edu.endDate,
        },
      });
    }

    // Create UserSummary
    await prisma.userSummary.create({
      data: {
        userId,
        summaryText: mockUser.summaryText,
        primaryDomain: mockUser.primaryDomain,
      },
    });

    // Create JobPreferences
    await prisma.jobPreferences.create({
      data: {
        userId,
        primaryRole: mockUser.jobPreferences.primaryRole,
        secondaryRoles: mockUser.jobPreferences.secondaryRoles,
        workType: mockUser.jobPreferences.workType,
        locations: mockUser.jobPreferences.locations,
        minSalary: mockUser.jobPreferences.minSalary,
        currency: mockUser.jobPreferences.currency,
        experienceLevel: mockUser.jobPreferences.experienceLevel,
        jobType: mockUser.jobPreferences.jobType,
      },
    });

    console.log(`  ✅ User created: ${mockUser.name} (${userId})`);
  }

  console.log(`\n  📊 Total users ready: ${createdUserIds.length}`);

  // ── Step 2: Create mock jobs ──────────────────────────────
  console.log("\n── Step 2: Creating mock jobs ──");
  const createdJobIds: string[] = [];

  for (const mockJob of MOCK_JOBS) {
    // Idempotent via unique link
    const existing = await prisma.job.findUnique({
      where: { link: mockJob.link },
    });

    if (existing) {
      console.log(
        `  ⏭️  Job exists: ${mockJob.title} (${existing.id})`,
      );
      createdJobIds.push(existing.id);
      continue;
    }

    const job = await prisma.job.create({
      data: {
        title: mockJob.title,
        company: mockJob.company,
        location: mockJob.location,
        description: mockJob.description,
        postedAt: new Date(),
        link: mockJob.link,
      },
    });

    createdJobIds.push(job.id);
    console.log(
      `  ✅ Job created: ${mockJob.title} @ ${mockJob.company} (${job.id})`,
    );
  }

  console.log(`\n  📊 Total jobs ready: ${createdJobIds.length}`);

  // ── Step 3: Generate & store user embeddings ──────────────
  console.log("\n── Step 3: Generating user embeddings ──");

  for (let i = 0; i < MOCK_USERS.length; i++) {
    const userId = createdUserIds[i];
    const mockUser = MOCK_USERS[i];

    // Check if embedding already exists
    const existingEmb = await prisma.userEmbedding.findUnique({
      where: { userId },
    });

    if (existingEmb && existingEmb.embedding.length > 0) {
      console.log(`  ⏭️  Embedding exists for: ${mockUser.name}`);
      continue;
    }

    const profileText = buildProfileText(mockUser);
    const profileHash = md5(profileText);

    console.log(`  🔄 Embedding profile: ${mockUser.name}...`);
    const embedding = await callEmbedProfile(userId, profileText, profileHash);

    if (!embedding) {
      console.error(`  ❌ Failed to embed: ${mockUser.name} — skipping`);
      continue;
    }

    // Store embedding
    await prisma.userEmbedding.upsert({
      where: { userId },
      create: {
        userId,
        embedding,
        profileHash,
      },
      update: {
        embedding,
        profileHash,
        embeddedAt: new Date(),
      },
    });

    console.log(
      `  ✅ Embedding stored: ${mockUser.name} (dim=${embedding.length})`,
    );
  }

  // ── Step 4: Embed jobs into FAISS ─────────────────────────
  console.log("\n── Step 4: Embedding jobs into FAISS index ──");

  // Load jobs from DB to get full data
  const jobsFromDb = await prisma.job.findMany({
    where: { id: { in: createdJobIds } },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      description: true,
      embeddedAt: true,
    },
  });

  const unembeddedJobs = jobsFromDb.filter((j) => !j.embeddedAt);

  if (unembeddedJobs.length === 0) {
    console.log("  ⏭️  All jobs already embedded in FAISS");
  } else {
    const jobTexts = unembeddedJobs.map((j) => ({
      job_id: j.id,
      text: `${j.title} at ${j.company}, ${j.location}. ${j.description}`,
    }));

    const success = await callEmbedBatchJobs(jobTexts);

    if (success) {
      // Mark jobs as embedded
      await prisma.job.updateMany({
        where: { id: { in: unembeddedJobs.map((j) => j.id) } },
        data: { embeddedAt: new Date() },
      });
      console.log(
        `  ✅ Marked ${unembeddedJobs.length} jobs as embedded in DB`,
      );
    }
  }

  // ── Step 5: Trigger REAL semantic matching pipeline ───────
  //    Uses the existing matchJobsForUser() from semanticMatchingService.ts
  //    This ensures unbiased, system-generated JobMatch records.
  console.log("\n── Step 5: Running semantic matching pipeline for each user ──");

  // Import the actual matching service
  const { matchJobsForUser } = await import(
    "../src/services/semantic/semanticMatchingService"
  );

  let totalMatchesCreated = 0;

  for (let i = 0; i < createdUserIds.length; i++) {
    const userId = createdUserIds[i];
    const userName = MOCK_USERS[i].name;

    console.log(`  🔄 Running semantic match: ${userName}...`);

    try {
      const matches = await matchJobsForUser(userId);

      if (!matches || matches.length === 0) {
        console.warn(`  ⚠️  No matches found for: ${userName}`);
        continue;
      }

      // Store matches in DB (same logic as internalController.semanticMatchForN8n)
      for (const m of matches) {
        await prisma.jobMatch.upsert({
          where: { userId_jobId: { userId, jobId: m.jobId } },
          create: {
            userId,
            jobId: m.jobId,
            matchScore: Math.round(m.score * 100),
            semanticScore: m.score,
            matchMethod: "semantic",
          },
          update: {
            matchScore: Math.round(m.score * 100),
            semanticScore: m.score,
            matchMethod: "semantic",
          },
        });
      }

      totalMatchesCreated += matches.length;
      console.log(
        `  ✅ ${userName}: ${matches.length} matches (top: ${matches[0].score.toFixed(4)})`,
      );
    } catch (err: any) {
      console.error(`  ❌ Matching failed for ${userName}: ${err.message}`);
    }
  }

  console.log(`\n  📊 Total semantic matches created: ${totalMatchesCreated}`);

  // ── Step 6: Validation Summary ────────────────────────────
  console.log("\n── Step 6: Validation ──");

  const totalUsers = await prisma.userAuth.count({
    where: { id: { in: createdUserIds } },
  });
  const totalEmbeddings = await prisma.userEmbedding.count({
    where: { userId: { in: createdUserIds } },
  });
  const totalJobs = await prisma.job.count({
    where: { id: { in: createdJobIds } },
  });
  const totalMatches = await prisma.jobMatch.count({
    where: { userId: { in: createdUserIds } },
  });

  console.log(`  Users:      ${totalUsers}`);
  console.log(`  Embeddings: ${totalEmbeddings}`);
  console.log(`  Jobs:       ${totalJobs}`);
  console.log(`  Matches:    ${totalMatches}`);

  if (totalEmbeddings < totalUsers) {
    console.warn(
      `\n  ⚠️  WARNING: Only ${totalEmbeddings}/${totalUsers} users have embeddings!`,
    );
  }

  if (totalMatches === 0) {
    console.warn(
      `\n  ⚠️  WARNING: No JobMatch records were created!`,
    );
    console.warn(
      `     The semantic matching pipeline may have filtered out all jobs.`,
    );
    console.warn(
      `     Check if jobs were created recently (24h recency filter).`,
    );
  }

  if (totalUsers >= 5 && totalEmbeddings >= 5 && totalMatches >= 10) {
    console.log("\n  🎉 Dataset is ready for evaluation!");
    console.log("  Run:  npx tsx scripts/runEvaluation.ts");
  } else {
    console.warn("\n  ⚠️  Dataset may be incomplete. Check warnings above.");
  }

  console.log(
    "\n╔══════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   Seed Complete!                                        ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════╝\n",
  );
}

// ────────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error("\n❌ Seed script failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
