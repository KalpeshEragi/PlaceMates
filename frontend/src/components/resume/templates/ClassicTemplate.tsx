import { TemplateProps } from './types';

export default function ClassicTemplate({ data, className = '' }: TemplateProps) {
    return (
        <div className={`w-full max-w-[850px] mx-auto bg-white text-gray-900 p-16 font-serif ${className}`} style={{ minHeight: '1100px' }}>
            {/* Header */}
            <header className="text-center mb-8 border-b-2 border-gray-900 pb-6">
                <h1 className="text-4xl font-bold uppercase tracking-wider mb-3 text-gray-900">{data.contact.name || 'Your Name'}</h1>
                <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                    {data.contact.location && <span>{data.contact.location}</span>}
                    {data.contact.location && (data.contact.phone || data.contact.email) && <span>•</span>}
                    {data.contact.phone && <span>{data.contact.phone}</span>}
                    {data.contact.phone && data.contact.email && <span>•</span>}
                    {data.contact.email && <span>{data.contact.email}</span>}
                </div>
                <div className="flex justify-center flex-wrap gap-x-4 mt-1 text-sm text-gray-600">
                    {data.contact.linkedinUrl && <span>{data.contact.linkedinUrl.replace('https://www.', '')}</span>}
                    {data.contact.website && <span>|</span>}
                    {data.contact.website && <span>{data.contact.website.replace('https://', '')}</span>}
                </div>
            </header>

            <div className="space-y-6">
                {/* Experience Section */}
                {data.experience.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900 border-b border-gray-400 mb-4 pb-1">Professional Experience</h2>
                        <div className="space-y-5">
                            {data.experience.map(exp => (
                                <div key={exp.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-md font-bold text-gray-900">{exp.title}</h3>
                                        <span className="text-sm font-medium text-gray-700 italic">
                                            {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                                        </span>
                                    </div>
                                    <div className="text-md font-semibold text-gray-800 mb-2 italic">{exp.company}{exp.location && `, ${exp.location}`}</div>
                                    <div className="text-sm text-gray-800 leading-relaxed pl-4 whitespace-pre-wrap list-disc list-inside">
                                        {exp.description.split('\n').map((line, idx) => (
                                            line.trim() ? <div key={idx} className="relative before:content-['•'] before:absolute before:-left-4 before:text-gray-500">{line}</div> : <br key={idx} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Education */}
                {data.education.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900 border-b border-gray-400 mb-4 pb-1">Education</h2>
                        <div className="space-y-4">
                            {data.education.map(edu => (
                                <div key={edu.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-md font-bold text-gray-900">{edu.institution}</h3>
                                        <span className="text-sm font-medium text-gray-700 italic">
                                            {edu.startDate} - {edu.endDate}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-800 italic">
                                        {edu.degree} in {edu.field}
                                        {edu.gpa && `, GPA: ${edu.gpa}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Projects */}
                {data.projects.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900 border-b border-gray-400 mb-4 pb-1">Academic & Personal Projects</h2>
                        <div className="space-y-4">
                            {data.projects.map(proj => (
                                <div key={proj.id}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-md font-bold text-gray-900">{proj.name}</h3>
                                        <span className="text-sm font-medium text-gray-700 italic">{proj.techStack}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{proj.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Skills */}
                {data.skills.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold uppercase tracking-widest text-gray-900 border-b border-gray-400 mb-4 pb-1">Skills & Interests</h2>
                        <div className="text-sm text-gray-800 leading-relaxed">
                            <span className="font-bold">Technical Skills: </span>
                            {data.skills.join(', ')}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
