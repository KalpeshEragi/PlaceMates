import { TemplateProps } from './types';
import { Terminal, Github, Star, GitFork, Link } from 'lucide-react';

export default function TechnicalTemplate({ data, className = '' }: TemplateProps) {
    return (
        <div className={`w-full max-w-[850px] mx-auto bg-slate-900 text-slate-300 p-8 font-mono ${className}`} style={{ minHeight: '1100px' }}>
            {/* Header */}
            <header className="border-b-2 border-emerald-500/30 pb-6 mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                        <Terminal className="w-8 h-8 text-emerald-400" />
                        {data.contact.name || 'guest@system:~'}
                    </h1>
                    <div className="flex flex-wrap gap-4 text-sm text-emerald-400/80">
                        {data.contact.email && <span>{data.contact.email}</span>}
                        {data.contact.phone && <span>{data.contact.phone}</span>}
                        {data.contact.location && <span>{data.contact.location}</span>}
                    </div>
                </div>
                <div className="text-right text-xs space-y-1 text-slate-500">
                    {data.contact.githubUrl && <div className="flex items-center justify-end gap-2"><Github className="w-3 h-3" /> {data.contact.githubUrl.replace('https://', '')}</div>}
                    {data.contact.linkedinUrl && <div className="flex items-center justify-end gap-2"><Link className="w-3 h-3" /> {data.contact.linkedinUrl.replace('https://linkedin.com/in/', '')}</div>}
                    {data.contact.website && <div className="flex items-center justify-end gap-2"><Link className="w-3 h-3" /> {data.contact.website.replace('https://', '')}</div>}
                </div>
            </header>

            {/* Skills Container (Terminal style) */}
            {data.skills.length > 0 && (
                <section className="mb-8 bg-slate-950 rounded border border-slate-800 p-4">
                    <div className="text-slate-500 text-xs mb-2">~ % cat skills.json</div>
                    <div className="flex flex-wrap gap-2">
                        {data.skills.map((skill, i) => (
                            <span key={i} className="text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded text-xs border border-emerald-900/50">
                                {skill}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-2 gap-8">
                {/* Experience */}
                <div className="col-span-2 space-y-8">
                    {data.experience.length > 0 && (
                        <section>
                            <h2 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                                <span className="text-slate-600">~/</span>experience
                            </h2>
                            <div className="space-y-6">
                                {data.experience.map(exp => (
                                    <div key={exp.id} className="border-l border-slate-700 pl-4">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-white text-lg">{exp.title}</h3>
                                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                                {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                                            </span>
                                        </div>
                                        <div className="text-emerald-400/80 text-sm mb-3">@ {exp.company}</div>
                                        <p className="text-sm leading-relaxed text-slate-400 whitespace-pre-wrap">{exp.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Projects */}
                <div className="col-span-2 space-y-8">
                    {data.projects.length > 0 && (
                        <section>
                            <h2 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                                <span className="text-slate-600">~/</span>projects
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {data.projects.map(proj => (
                                    <div key={proj.id} className="bg-slate-800/50 border border-slate-700 rounded p-4 hover:border-emerald-500/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                <Github className="w-4 h-4 text-slate-400" />
                                                {proj.name}
                                            </h3>
                                            <div className="flex gap-3 text-xs text-slate-400">
                                                {proj.stars != null && (
                                                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {proj.stars}</span>
                                                )}
                                                {proj.forks != null && (
                                                    <span className="flex items-center gap-1"><GitFork className="w-3 h-3" /> {proj.forks}</span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4 h-12 overflow-hidden text-ellipsis line-clamp-3">{proj.description}</p>
                                        <div className="text-xs text-emerald-400/80 truncate">
                                            [{proj.techStack}]
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Education */}
                <div className="col-span-2 space-y-8">
                    {data.education.length > 0 && (
                        <section>
                            <h2 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                                <span className="text-slate-600">~/</span>education
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {data.education.map(edu => (
                                    <div key={edu.id} className="border-l border-slate-700 pl-4">
                                        <h3 className="font-bold text-white text-md">{edu.degree}</h3>
                                        <div className="text-sm text-emerald-400/80 my-1">{edu.field} • {edu.institution}</div>
                                        <div className="text-xs text-slate-500">{edu.startDate} - {edu.endDate}</div>
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
