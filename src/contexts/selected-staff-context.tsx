
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedStaffContextType {
  selectedStaffIds: string[];
  toggleStaffSelection: (staffId: string) => void;
}

const SelectedStaffContext = createContext<SelectedStaffContextType | undefined>(undefined);

export function SelectedStaffProvider({ children }: { children: ReactNode }) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prevIds =>
      prevIds.includes(staffId)
        ? prevIds.filter(id => id !== staffId)
        : [...prevIds, staffId]
    );
  };

  return (
    <SelectedStaffContext.Provider value={{ selectedStaffIds, toggleStaffSelection }}>
      {children}
    </SelectedStaffContext.Provider>
  );
}

export function useSelectedStaff() {
  const context = useContext(SelectedStaffContext);
  if (context === undefined) {
    throw new Error('useSelectedStaff must be used within a SelectedStaffProvider');
  }
  return context;
}
