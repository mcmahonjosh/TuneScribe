import { Project, ProjectStatus } from '@/types/project';

const STORAGE_KEY = 'tunescribe_projects';

function loadAll(): Project[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function persist(projects: Project[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
}

export async function listProjects(): Promise<Project[]> {
  return loadAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return loadAll().find((project) => project.id === id) ?? null;
}

export async function saveProject(project: Project): Promise<void> {
  const projects = loadAll().filter((item) => item.id !== project.id);
  projects.push(project);
  persist(projects);
}

export async function deleteProject(id: string): Promise<void> {
  persist(loadAll().filter((project) => project.id !== id));
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  errorMessage?: string
): Promise<void> {
  const projects = loadAll();
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) {
    return;
  }
  projects[index] = {
    ...projects[index],
    status,
    updatedAt: new Date().toISOString(),
    errorMessage,
  };
  persist(projects);
}
