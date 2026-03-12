// frontend/src/components/resume/templates/types.ts

export interface ContactData {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
    website: string;
}

export interface ExperienceEntry {
    id: string;
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
}

export interface ProjectEntry {
    id: string;
    name: string;
    repoUrl: string;
    description: string;
    techStack: string;
    stars: number | null;
    forks: number | null;
}

export interface EducationEntry {
    id: string;
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    description: string;
}

export interface ResumeData {
    contact: ContactData;
    experience: ExperienceEntry[];
    projects: ProjectEntry[];
    skills: string[];
    education: EducationEntry[];
}

export type TemplateId = 'modern' | 'minimal' | 'technical' | 'classic';

export interface TemplateProps {
    data: ResumeData;
    className?: string;
}
