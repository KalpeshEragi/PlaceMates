import { TemplateProps } from './types';

export default function MinimalTemplate({ data, className = '' }: TemplateProps) {
    return (
        <div className={`w-full max-w-[850px] mx-auto bg-white text-zinc-900 p-16 font-sans ${className}`} style={{ minHeight: '1100px' }}>
            {/* Header */}
            <header className="mb-16">
                <h1 className="text-4xl font-light tracking-tight mb-4">{data.contact.name || 'Your Name'}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500 font-medium">
                    {data.contact.email && <span>{data.contact.email}</span>}
                    {data.contact.phone && <span>{data.contact.phone}</span>}
                    {data.contact.location && <span>{data.contact.location}</span>}
                    {data.contact.website && <span>{data.contact.website.replace('https://', '')}</span>}
                    {data.contact.linkedinUrl && <span>{data.contact.linkedinUrl.replace('https://', '')}</span>}
                </div>
            </header>

            <div className="space-y-16">
                {/* Experience */}
                {data.experience.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-[0.2em] mb-8">Experience</h2>
                        <div className="space-y-10">
                            {data.experience.map(exp => (
                                <div key={exp.id} className="grid grid-cols-12 gap-8">
                                    <div className="col-span-3 text-sm text-zinc-500 pt-1">
                                        {exp.startDate} — {exp.current ? 'Present' : exp.endDate}
                                    </div>
                                    <div className="col-span-9">
                                        <h3 className="text-lg font-medium text-zinc-900">{exp.title}</h3>
                                        <div className="text-zinc-600 mb-4">{exp.company}</div>
                                        <p className="text-zinc-600 leading-relaxed text-sm whitespace-pre-wrap">{exp.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Projects */}
                {data.projects.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-[0.2em] mb-8">Selected Projects</h2>
                        <div className="space-y-10">
                            {data.projects.map(proj => (
                                <div key={proj.id} className="grid grid-cols-12 gap-8">
                                    <div className="col-span-3 text-sm text-zinc-500 pt-1">
                                        {proj.techStack}
                                    </div>
                                    <div className="col-span-9">
                                        <h3 className="text-lg font-medium text-zinc-900">{proj.name}</h3>
                                        {proj.repoUrl && (
                                            <a href={proj.repoUrl} className="text-sm text-zinc-400 hover:text-zinc-600 truncate block mb-2">{proj.repoUrl}</a>
                                        )}
                                        <p className="text-zinc-600 leading-relaxed text-sm whitespace-pre-wrap mt-2">{proj.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Skills */}
                {data.skills.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-[0.2em] mb-8">Expertise</h2>
                        <div className="flex flex-wrap gap-x-8 gap-y-4 text-zinc-700 text-sm">
                            {data.skills.map((skill, i) => (
                                <span key={i}>{skill}</span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Education */}
                {data.education.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-[0.2em] mb-8">Education</h2>
                        <div className="space-y-6">
                            {data.education.map(edu => (
                                <div key={edu.id} className="grid grid-cols-12 gap-8">
                                    <div className="col-span-3 text-sm text-zinc-500 pt-1">
                                        {edu.startDate} — {edu.endDate}
                                    </div>
                                    <div className="col-span-9">
                                        <h3 className="text-base font-medium text-zinc-900">{edu.degree} in {edu.field}</h3>
                                        <div className="text-zinc-600 text-sm">{edu.institution}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
