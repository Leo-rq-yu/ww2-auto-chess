import { Piece, ActiveSynergy, TraitType } from '../types';
import { UNIT_DEFINITIONS, SYNERGY_DEFINITIONS } from '../types/units';

// =============================================
// Synergy System
// =============================================

// Count traits from a list of pieces
export function countTraits(pieces: Piece[]): Map<TraitType, number> {
  const counts = new Map<TraitType, number>();

  for (const piece of pieces) {
    const def = UNIT_DEFINITIONS[piece.typeId];
    if (!def) continue;

    for (const trait of def.traits) {
      const current = counts.get(trait) || 0;
      counts.set(trait, current + 1);
    }
  }

  return counts;
}

// Calculate active synergies
export function calculateSynergies(pieces: Piece[]): ActiveSynergy[] {
  const traitCounts = countTraits(pieces);
  const activeSynergies: ActiveSynergy[] = [];

  for (const synergy of SYNERGY_DEFINITIONS) {
    const count = traitCounts.get(synergy.traitType) || 0;
    activeSynergies.push({
      synergyId: synergy.synergyId,
      count,
      isActive: count >= synergy.triggerCount,
    });
  }

  return activeSynergies;
}

// Apply synergy bonuses to pieces
export function applySynergyBonuses(pieces: Piece[], synergies: ActiveSynergy[]): Piece[] {
  const modifiedPieces = pieces.map(p => ({ ...p }));

  for (const synergy of synergies) {
    if (!synergy.isActive) continue;

    const synergyDef = SYNERGY_DEFINITIONS.find(s => s.synergyId === synergy.synergyId);
    if (!synergyDef) continue;

    // Apply effects to matching pieces
    for (const piece of modifiedPieces) {
      const unitDef = UNIT_DEFINITIONS[piece.typeId];
      if (!unitDef || !unitDef.traits.includes(synergyDef.traitType)) continue;

      // Apply stat bonuses
      if (synergyDef.effect.stat && synergyDef.effect.value) {
        switch (synergyDef.effect.stat) {
          case 'defense':
            piece.defense += synergyDef.effect.value;
            break;
          case 'speed':
            piece.speed += synergyDef.effect.value;
            break;
          case 'attack':
            piece.attackMin += synergyDef.effect.value;
            piece.attackMax += synergyDef.effect.value;
            break;
        }
      }

      // Handle special effects (these are tracked and applied during battle)
      // - fortification_buff: Engineer synergy enhances fortifications
      // - dodge_chance_25: Air synergy gives dodge chance
    }
  }

  return modifiedPieces;
}

// Check if a synergy would activate with additional piece
export function wouldActivateSynergy(
  currentPieces: Piece[],
  newPieceTypeId: string
): { synergyId: string; name: string } | null {
  const newUnitDef = UNIT_DEFINITIONS[newPieceTypeId];
  if (!newUnitDef) return null;

  const currentCounts = countTraits(currentPieces);

  for (const trait of newUnitDef.traits) {
    const currentCount = currentCounts.get(trait) || 0;
    const newCount = currentCount + 1;

    // Check if this would trigger a synergy
    const synergy = SYNERGY_DEFINITIONS.find(
      s => s.traitType === trait && currentCount < s.triggerCount && newCount >= s.triggerCount
    );

    if (synergy) {
      return { synergyId: synergy.synergyId, name: synergy.name };
    }
  }

  return null;
}

// Get synergy progress for display
export interface SynergyProgress {
  synergyId: string;
  name: string;
  description: string;
  traitType: TraitType;
  currentCount: number;
  triggerCount: number;
  isActive: boolean;
}

export function getSynergyProgress(pieces: Piece[]): SynergyProgress[] {
  const traitCounts = countTraits(pieces);

  return SYNERGY_DEFINITIONS.map(synergy => ({
    synergyId: synergy.synergyId,
    name: synergy.name,
    description: synergy.description,
    traitType: synergy.traitType,
    currentCount: traitCounts.get(synergy.traitType) || 0,
    triggerCount: synergy.triggerCount,
    isActive: (traitCounts.get(synergy.traitType) || 0) >= synergy.triggerCount,
  }));
}

// Get potential synergies that could be activated
export function getPotentialSynergies(
  pieces: Piece[],
  availableUnits: string[]
): { synergyId: string; name: string; unitsNeeded: string[] }[] {
  const traitCounts = countTraits(pieces);
  const potentials: { synergyId: string; name: string; unitsNeeded: string[] }[] = [];

  for (const synergy of SYNERGY_DEFINITIONS) {
    const currentCount = traitCounts.get(synergy.traitType) || 0;
    if (currentCount >= synergy.triggerCount) continue; // Already active

    const needed = synergy.triggerCount - currentCount;

    // Find units that can contribute to this synergy
    const contributingUnits = availableUnits.filter(unitId => {
      const def = UNIT_DEFINITIONS[unitId];
      return def && def.traits.includes(synergy.traitType);
    });

    if (contributingUnits.length >= needed) {
      potentials.push({
        synergyId: synergy.synergyId,
        name: synergy.name,
        unitsNeeded: contributingUnits.slice(0, needed),
      });
    }
  }

  return potentials;
}
