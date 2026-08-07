import { useProjectUIStore } from '../../stores/projectUIStore';
import { useProjects } from '../../hooks/useProjects';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

export function ProjectTabs() {
  const openTabs = useProjectUIStore((s) => s.openTabs);
  const activeTabId = useProjectUIStore((s) => s.activeTabId);
  const setActiveTab = useProjectUIStore((s) => s.setActiveTab);
  const closeTab = useProjectUIStore((s) => s.closeTab);
  const { projects } = useProjects();
  const { t } = useTranslation();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
      {openTabs.map((tabId) => {
        const project = projects.find((p) => p.id === tabId);
        if (!project) return null;
        const isActive = tabId === activeTabId;

        // A tab is two actions, so it is two buttons in a container — not one
        // button with a clickable span inside it. The span could not be focused
        // or announced, and nesting interactive elements is invalid markup.
        return (
          <div
            key={tabId}
            className={`group flex shrink-0 items-center rounded-md text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
              isActive ? 'text-text-primary bg-bg-elevated' : 'text-text-muted'
            }`}
            style={{ boxShadow: isActive ? NEU.pressedSm : undefined }}
          >
            <button
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`flex min-w-0 items-center gap-1.5 rounded-l-md py-1 pl-2.5 pr-1 ${
                isActive ? '' : 'hover:text-text-secondary'
              }`}
            >
              {project.icon ? (
                <span className="text-[11px] shrink-0 leading-none">{project.icon}</span>
              ) : (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
              )}
              <span className="truncate max-w-[100px]">{project.name}</span>
            </button>
            <button
              type="button"
              onClick={() => closeTab(tabId)}
              aria-label={`${t('projects.closeTab')}: ${project.name}`}
              title={t('projects.closeTab')}
              className="rounded-r-md py-1 pl-0.5 pr-2 text-[11px] text-text-muted transition-opacity hover:text-text-primary can-hover:opacity-0 can-hover:group-hover:opacity-100 focus-visible:opacity-100"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
