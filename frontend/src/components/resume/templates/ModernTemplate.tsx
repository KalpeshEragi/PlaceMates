import { TemplateProps } from './types';
import { Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';

export default function ModernTemplate({ data, className = '' }: TemplateProps) {
    return (
        <div className={`w-full max-w-[850px] mx-auto bg-white text-slate-800 shadow-2xl overflow-hidden rounded-xl ${className}`} style={{ minHeight: '1100px' }}>
            {/* Header / Contact Area */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white p-12">
                <h1 className="text-5xl font-extrabold tracking-tight mb-4">{data.contact.name || 'Your Name'}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-6 text-sm font-medium text-indigo-100">
                    {data.contact.email && (
                        <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> {data.contact.email}</span>
                    )}
                    {data.contact.phone && (
                        <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {data.contact.phone}</span>
                    )}
                    {data.contact.location && (
                        <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {data.contact.location}</span>
                    )}
                    {data.contact.linkedinUrl && (
                        <span className="flex items-center gap-2"><Linkedin className="w-4 h-4" /> {data.contact.linkedinUrl.replace('https://', '')}</span>
                    )}
                    {data.contact.githubUrl && (
                        <span className="flex items-center gap-2"><Github className="w-4 h-4" /> {data.contact.githubUrl.replace('https://', '')}</span>
                    )}
                    {data.contact.website && (
                        <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> {data.contact.website.replace('https://', '')}</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8 p-12">
                {/* Main Column */}
                <div className="col-span-2 space-y-10">
                    {/* Experience Section */}
                    {data.experience.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-indigo-900 mb-6 border-b-2 border-indigo-100 pb-2">Experience</h2>
                            <div className="space-y-8">
                                {data.experience.map(exp => (
                                    <div key={exp.id} className="relative pl-6 border-l-2 border-indigo-200">
                                        <div className="absolute w-3 h-3 bg-indigo-600 rounded-full -left-[7px] top-2" />
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="text-lg font-bold text-slate-900">{exp.title}</h3>
                                            <span className="text-sm font-semibold text-indigo-600 shrink-0">
                                                {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                                            </span>
                                        </div>
                                        <div className="text-sm font-medium text-slate-600 mb-3">{exp.company} {exp.location && `• ${exp.location}`}</div>
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{exp.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Projects Section */}
                    {data.projects.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-indigo-900 mb-6 border-b-2 border-indigo-100 pb-2">Projects</h2>
                            <div className="grid gap-6">
                                {data.projects.map(proj => (
                                    <div key={proj.id} className="bg-slate-50 p-5 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <h3 className="text-lg font-bold text-slate-900">{proj.name}</h3>
                                        </div>
                                        <p className="text-sm text-slate-700 mb-4 whitespace-pre-wrap leading-relaxed">{proj.description}</p>
                                        <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 inline-block px-2.5 py-1 rounded">
                                            {proj.techStack}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar Column */}
                <div className="col-span-1 space-y-10">
                    {/* Skills Section */}
                    {data.skills.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-indigo-900 mb-6 border-b-2 border-indigo-100 pb-2">Skills</h2>
                            <div className="flex flex-wrap gap-2">
                                {data.skills.map((skill, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-full border border-indigo-100">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Education Section */}
                    {data.education.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-indigo-900 mb-6 border-b-2 border-indigo-100 pb-2">Education</h2>
                            <div className="space-y-6">
                                {data.education.map(edu => (
                                    <div key={edu.id}>
                                        <h3 className="text-md font-bold text-slate-900 leading-snug">{edu.degree} in {edu.field}</h3>
                                        <div className="text-sm text-slate-600 mt-1 font-medium">{edu.institution}</div>
                                        <div className="text-xs text-indigo-600 mt-1 font-semibold">{edu.startDate} - {edu.endDate}</div>
                                        {edu.gpa && <div className="text-xs text-slate-500 mt-1">GPA: {edu.gpa}</div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
