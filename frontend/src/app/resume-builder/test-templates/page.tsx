'use client';

import { ResumeTemplate, ResumeData, TemplateId } from '@/components/resume/templates';
import { useState } from 'react';

const DUMMY_DATA: ResumeData = {
    contact: {
        name: 'Alex Developer',
        email: 'alex.dev@example.com',
        phone: '+1 (555) 123-4567',
        location: 'San Francisco, CA',
        linkedinUrl: 'https://linkedin.com/in/alexdev',
        githubUrl: 'https://github.com/alexdev',
        portfolioUrl: 'https://alexdev.io',
        website: 'https://blog.alexdev.io'
    },
    experience: [
        {
            id: '1',
            title: 'Senior Frontend Engineer',
            company: 'TechCorp Solutions',
            location: 'San Francisco (Hybrid)',
            startDate: 'Jan 2021',
            endDate: '',
            current: true,
            description: 'Led the migration of a legacy Angular dashboard to Next.js and React, improving performance by 40%.\nArchitected a scalable component library used by 5 different product teams.\nMentored junior engineers and conducted regular code reviews.'
        },
        {
            id: '2',
            title: 'Software Engineer',
            company: 'Startup Inc.',
            location: 'Remote',
            startDate: 'Mar 2018',
            endDate: 'Dec 2020',
            current: false,
            description: 'Developed scalable backend services in Node.js and Express.\nIntegrated Stripe payment processing and reduced checkout drop-off by 15%.\nCollaborated and pair-programmed extensively.'
        }
    ],
    projects: [
        {
            id: 'p1',
            name: 'OpenSource UI Library',
            repoUrl: 'https://github.com/alexdev/os-ui',
            description: 'A highly accessible, customizable React UI component library. Adopted by over 500 developers worldwide.',
            techStack: 'React, TypeScript, TailwindCSS',
            stars: 1240,
            forks: 340
        },
        {
            id: 'p2',
            name: 'CryptoTracker AI',
            repoUrl: 'https://github.com/alexdev/crypto-ai',
            description: 'An AI-powered dashboard that predicts short-term crypto trends using sentiment analysis from Twitter.',
            techStack: 'Python, Next.js, OpenAI API',
            stars: 85,
            forks: 12
        }
    ],
    skills: [
        'JavaScript (ES6+)', 'TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Docker', 'AWS'
    ],
    education: [
        {
            id: 'e1',
            institution: 'University of California, Berkeley',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: 'Aug 2014',
            endDate: 'May 2018',
            gpa: '3.8',
            description: 'Relevant coursework: Data Structures, Algorithms, Artificial Intelligence.'
        }
    ]
};

export default function TemplateTestPage() {
    const [activeTemplate, setActiveTemplate] = useState<TemplateId>('modern');

    const templates: { id: TemplateId, label: string }[] = [
        { id: 'modern', label: 'Modern' },
        { id: 'minimal', label: 'Minimal' },
        { id: 'technical', label: 'Technical' },
        { id: 'classic', label: 'Classic' }
    ];

    return (
        <div className="min-h-screen bg-neutral-100 py-10">
            <div className="max-w-5xl mx-auto px-4">
                <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Template Playground</h1>
                    <div className="flex gap-2">
                        {templates.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTemplate(t.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    activeTemplate === t.id 
                                    ? 'bg-neutral-900 text-white' 
                                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-center">
                    <ResumeTemplate 
                        templateId={activeTemplate} 
                        data={DUMMY_DATA} 
                        className="shadow-2xl border border-neutral-200" 
                    />
                </div>
            </div>
        </div>
    );
}
