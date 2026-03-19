import { TemplateProps, TemplateId } from './types';
import ModernTemplate from './ModernTemplate';
import MinimalTemplate from './MinimalTemplate';
import TechnicalTemplate from './TechnicalTemplate';
import ClassicTemplate from './ClassicTemplate';

export * from './types';

interface TemplateRegistryProps extends TemplateProps {
    templateId: TemplateId;
}

export function ResumeTemplate({ templateId, data, className }: TemplateRegistryProps) {
    switch (templateId) {
        case 'modern':
            return <ModernTemplate data={data} className={className} />;
        case 'minimal':
            return <MinimalTemplate data={data} className={className} />;
        case 'classic':
            return <ClassicTemplate data={data} className={className} />;
        case 'technical':
            return <TechnicalTemplate data={data} className={className} />;
        default:
            return <ModernTemplate data={data} className={className} />;
    }
}
