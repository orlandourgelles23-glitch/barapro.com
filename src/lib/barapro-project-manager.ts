'use client';

import { useState, useCallback } from 'react';
import { useBaraproStore } from '@/lib/barapro-store';

const PROJECTS_KEY = 'barapro_projects_list';
const CURRENT_PROJECT_KEY = 'barapro_current_project_id';

export interface SavedProject {
  id: string;
  name: string;
  data: any; // full BARAPRO state data
  createdAt: string;
  updatedAt: string;
}

/**
 * Manages multiple BARAPRO projects stored in localStorage.
 */
export function useProjectManager() {
  const [projects, setProjects] = useState<SavedProject[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(PROJECTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  });
  const [isLoaded] = useState(true);

  // Persist projects list to localStorage
  const persistProjects = useCallback((list: SavedProject[]) => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    setProjects(list);
  }, []);

  // Persist current project ID
  const persistCurrentId = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(CURRENT_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
    setCurrentProjectId(id);
  }, []);

  // Save current store state as a project
  const saveProject = useCallback((projectName: string): string => {
    const store = useBaraproStore.getState();
    const projectData = {
      project: store.project,
      constructionItems: store.constructionItems,
      capitalItems: store.capitalItems,
      subcontractItems: store.subcontractItems,
      resourceItems: store.resourceItems,
      purchaseItems: store.purchaseItems,
      salesItems: store.salesItems,
      otherIncomeItems: store.otherIncomeItems,
      subventionItems: store.subventionItems,
      salesReturnItems: store.salesReturnItems,
      publicServiceItems: store.publicServiceItems,
      commercialExpenses: store.commercialExpenses,
      adminExpenses: store.adminExpenses,
      maintenanceItems: store.maintenanceItems,
      indirectExpenses: store.indirectExpenses,
      loans: store.loans,
      parameters: store.parameters,
      sparePartItems: store.sparePartItems,
      otherResourceItems: store.otherResourceItems,
      intangibleAssets: store.intangibleAssets,
      directCostItems: store.directCostItems,
      commercialSalaries: store.commercialSalaries,
      adminSalaries: store.adminSalaries,
      maintenanceSalaries: store.maintenanceSalaries,
      indirectSalaries: store.indirectSalaries,
      directCostSalaries: store.directCostSalaries,
      logicalFramework: store.logicalFramework,
    };

    const now = new Date().toISOString();
    // Read from localStorage directly to avoid stale closure
    const existingList = (() => {
      try {
        return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      } catch {
        return [];
      }
    })();
    if (currentProjectId) {
      const idx = existingList.findIndex((p) => p.id === currentProjectId);
      if (idx >= 0) {
        existingList[idx] = {
          ...existingList[idx],
          name: projectName,
          data: projectData,
          updatedAt: now,
        };
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(existingList));
        setProjects(existingList);
        persistCurrentId(existingList[idx].id);
        return existingList[idx].id;
      }
    }

    // Create new project
    const newProject: SavedProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: projectName,
      data: projectData,
      createdAt: now,
      updatedAt: now,
    };
    existingList.push(newProject);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(existingList));
    setProjects(existingList);
    persistCurrentId(newProject.id);
    return newProject.id;
  }, [currentProjectId, persistCurrentId]);

  // Load a project by ID
  const loadProject = useCallback((projectId: string) => {
    // Read from localStorage to avoid stale closure
    const list = (() => {
      try {
        return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      } catch {
        return [];
      }
    })();
    const proj = list.find((p) => p.id === projectId);
    if (!proj) return false;

    useBaraproStore.getState().loadFromExcel(proj.data);
    persistCurrentId(projectId);
    return true;
  }, [persistCurrentId]);

  // Create a new blank project (clears current data)
  const createNewProject = useCallback((projectName: string): string => {
    // Reset store to defaults
    useBaraproStore.getState().resetAll();
    // Clear autosave
    localStorage.removeItem('barapro_autosave');

    const store = useBaraproStore.getState();
    const projectData = {
      project: { ...store.project, projectName },
      constructionItems: [],
      capitalItems: [],
      subcontractItems: [],
      resourceItems: [],
      purchaseItems: [],
      salesItems: [],
      otherIncomeItems: [],
      subventionItems: [],
      salesReturnItems: [],
      publicServiceItems: [],
      commercialExpenses: [],
      adminExpenses: [],
      maintenanceItems: [],
      indirectExpenses: [],
      loans: [],
      parameters: store.parameters,
      sparePartItems: [],
      otherResourceItems: [],
      intangibleAssets: [],
      directCostItems: [],
      commercialSalaries: [],
      adminSalaries: [],
      maintenanceSalaries: [],
      indirectSalaries: [],
      directCostSalaries: [],
      logicalFramework: store.logicalFramework,
    };

    const now = new Date().toISOString();
    const newProject: SavedProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: projectName,
      data: projectData,
      createdAt: now,
      updatedAt: now,
    };

    const newList = [...projects, newProject];
    persistProjects(newList);
    persistCurrentId(newProject.id);

    // Load the new project data
    useBaraproStore.getState().loadFromExcel(projectData);
    return newProject.id;
  }, [projects, persistProjects, persistCurrentId]);

  // Delete a project
  const deleteProject = useCallback((projectId: string) => {
    const newList = (() => {
      try {
        const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
        return list.filter((p: SavedProject) => p.id !== projectId);
      } catch {
        return [];
      }
    })();
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(newList));
    setProjects(newList);

    // If deleting current project, switch to another or clear
    if (currentProjectId === projectId) {
      if (newList.length > 0) {
        loadProject(newList[0].id);
      } else {
        persistCurrentId(null);
        localStorage.removeItem('barapro_autosave');
      }
    }
  }, [currentProjectId, persistCurrentId, loadProject]);

  // Rename a project
  const renameProject = useCallback((projectId: string, newName: string) => {
    const newList = (() => {
      try {
        const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
        return list.map((p: SavedProject) =>
          p.id === projectId
            ? { ...p, name: newName, updatedAt: new Date().toISOString() }
            : p
        );
      } catch {
        return [];
      }
    })();
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(newList));
    setProjects(newList);
  }, []);

  // Duplicate a project
  const duplicateProject = useCallback((projectId: string): string | null => {
    const list = (() => {
      try {
        return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      } catch {
        return [];
      }
    })();
    const proj = list.find((p: SavedProject) => p.id === projectId);
    if (!proj) return null;

    const now = new Date().toISOString();
    const dup: SavedProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${proj.name} (copia)`,
      data: JSON.parse(JSON.stringify(proj.data)), // Deep copy to avoid shared references
      createdAt: now,
      updatedAt: now,
    };

    const newList = [...list, dup];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(newList));
    setProjects(newList);
    return dup.id;
  }, []);

  // Get current project info
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return {
    projects,
    currentProject,
    currentProjectId,
    isLoaded,
    saveProject,
    loadProject,
    createNewProject,
    deleteProject,
    renameProject,
    duplicateProject,
  };
}
