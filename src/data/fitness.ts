/** Stops that involve long walks, steep trails or many steps. Review with local knowledge before relying on it. */
export const STRENUOUS_IDS = ['SP001', 'SP002', 'SP003', 'SP004', 'SP005', 'SP020', 'SP027', 'SP028']
export const isStrenuous = (id: string): boolean => STRENUOUS_IDS.includes(id)
